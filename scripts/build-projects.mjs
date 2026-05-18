#!/usr/bin/env node
// Reads templates/Projects/PROJECTS.csv (and optional per-project media JSON
// sidecars in templates/Projects/media/) and emits src/app/data/projects.generated.ts.
//
// Usage:
//   node scripts/build-projects.mjs
//   npm run build:projects
//
// The generated file exports `csvProjects: Project[]`, which is merged into
// the live `projects` list by src/app/data/projects.ts. Hand-coded projects
// in projects.ts are NOT touched.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const CSV_PATH  = join(ROOT, 'templates/Projects/PROJECTS.csv');
const MEDIA_DIR = join(ROOT, 'templates/Projects/media');
const OUT_PATH  = join(ROOT, 'src/app/data/projects.generated.ts');
const PRESETS_PATH = join(ROOT, 'src/app/data/layoutPresets.ts');

// ─── Minimal CSV parser ──────────────────────────────────────────────────
// Handles: double-quoted fields, embedded commas, embedded newlines,
// "" as an escaped quote. No streaming — entire file in memory.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"')                    { inQuotes = false; }
      else                                   { field += c; }
    } else {
      if (c === '"')                         { inQuotes = true; }
      else if (c === ',')                    { row.push(field); field = ''; }
      else if (c === '\r')                   { /* skip */ }
      else if (c === '\n')                   { row.push(field); rows.push(row); row = []; field = ''; }
      else                                   { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ─── Cell coercion helpers ───────────────────────────────────────────────
const trimOrNull = (s) => (s == null ? null : (s.trim() === '' ? null : s.trim()));

function parseTags(s) {
  const v = trimOrNull(s);
  if (!v) return [];
  return v.split(/[|;,]/).map((t) => t.trim()).filter(Boolean);
}

function parseExtra(s) {
  // Format: "Label A:51.2,4.4 | Label B:52.0,5.1"  (label optional)
  const v = trimOrNull(s);
  if (!v) return undefined;
  const parts = v.split(/\s*\|\s*/);
  const out = parts.map((p) => {
    const m = p.match(/^(?:([^:]+):)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) throw new Error(`extra_locations: cannot parse "${p}"`);
    const [, label, lat, lng] = m;
    return label ? { label: label.trim(), coordinates: [Number(lat), Number(lng)] }
                 : { coordinates: [Number(lat), Number(lng)] };
  });
  return out.length ? out : undefined;
}

function loadMediaSidecar(name) {
  if (!name) return {};
  const path = join(MEDIA_DIR, name);
  if (!existsSync(path)) {
    console.warn(`  ⚠  media_file "${name}" not found at ${path} — skipping`);
    return {};
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return {
      media:  Array.isArray(raw.media)  ? raw.media  : undefined,
      layout: Array.isArray(raw.layout) ? raw.layout : undefined,
    };
  } catch (e) {
    throw new Error(`media_file "${name}" is not valid JSON: ${e.message}`);
  }
}

// ─── Load layout presets at build time (regex-extract, no TS compiler) ───
// Presets are defined in TS but we only need the small fragment shape.
// To avoid bringing in a TS loader, parse them via a one-off `eval` of the
// fragment object literals. If parsing fails we fall back to {} and warn.
function loadPresets() {
  if (!existsSync(PRESETS_PATH)) return {};
  const src = readFileSync(PRESETS_PATH, 'utf8');
  const m = src.match(/layoutPresets\s*:\s*Record<string,\s*PresetFragment>\s*=\s*({[\s\S]*?^};)/m);
  if (!m) return {};
  try {
    // Strip trailing `;`, then eval as a JS object literal.
    const body = m[1].replace(/;$/, '');
    // eslint-disable-next-line no-eval
    return (0, eval)('(' + body + ')');
  } catch (e) {
    console.warn(`  ⚠  could not parse layoutPresets.ts: ${e.message}`);
    return {};
  }
}

// ─── Row → Project ───────────────────────────────────────────────────────
function rowToProject(headers, row, presets) {
  const get = (k) => trimOrNull(row[headers.indexOf(k)]);
  // Pull a bilingual field: if the `_es` column is non-empty, emit a
  // `{ en, es }` object; otherwise emit a plain string for english-only.
  const getLocalized = (k) => {
    const en = get(k);
    const es = get(`${k}_es`);
    if (en == null && es == null) return undefined;
    if (es == null || es === '') return en ?? '';
    return { en: en ?? '', es };
  };
  // Same for arrays parsed via pipe.
  const getLocalizedTags = () => {
    const en = parseTags(get('tags'));
    const esRaw = get('tags_es');
    const es = esRaw ? parseTags(esRaw) : null;
    if (!es || es.length === 0) return en;
    return { en, es };
  };

  if (!get('id')) return null; // empty row

  const lat = Number(get('lat'));
  const lng = Number(get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Row ${get('id')}: invalid lat/lng`);
  }

  const project = {
    id:               get('id'),
    title:            getLocalized('title'),
    type:             get('type'),
    year:             Number(get('year')),
    location:         getLocalized('location'),
    country:          getLocalized('country'),
    coordinates:      [lat, lng],
    extraLocations:   parseExtra(get('extra_locations')),
    shortDescription: getLocalized('short_description') ?? '',
    description:      getLocalized('description') ?? '',
    details:          getLocalized('details') ?? '',
    client:           getLocalized('client') ?? '',
    workType:         get('work_type'),
    area:             getLocalized('area'),
    scale:            getLocalized('scale'),
    image:            get('image') ?? '',
    tags:             getLocalizedTags(),
  };

  // Merge preset + sidecar media/layout.
  const preset  = presets[get('layout_preset') ?? 'default'] ?? {};
  const sidecar = loadMediaSidecar(get('media_file'));

  const media  = [...(preset.media  ?? []), ...(sidecar.media  ?? [])];
  const layout = sidecar.layout ?? preset.layout;

  if (media.length)  project.media  = media;
  if (layout)        project.layout = layout;

  // Strip undefined keys so the emitted TS stays clean.
  for (const k of Object.keys(project)) if (project[k] === undefined) delete project[k];
  return project;
}

// ─── Emit ────────────────────────────────────────────────────────────────
function emit(projects) {
  const banner =
    `// AUTO-GENERATED by scripts/build-projects.mjs — DO NOT EDIT BY HAND.\n` +
    `// Source: templates/Projects/PROJECTS.csv (+ optional media sidecars).\n` +
    `// Regenerate with: npm run build:projects (runs automatically before dev/build).\n`;
  const body = `import type { Project } from './projects';\n\n` +
               `export const csvProjects: Project[] = ${JSON.stringify(projects, null, 2)};\n`;
  writeFileSync(OUT_PATH, banner + '\n' + body);
}

// ─── Main ────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(CSV_PATH)) {
    console.log('No PROJECTS.csv found — emitting empty csvProjects.');
    emit([]);
    return;
  }
  const text = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(text).filter((r) => r.some((c) => c && c.trim() !== ''));
  if (rows.length === 0) { emit([]); return; }

  const [headers, ...data] = rows;
  const presets = loadPresets();
  const projects = [];
  for (let i = 0; i < data.length; i++) {
    try {
      const p = rowToProject(headers, data[i], presets);
      if (p) projects.push(p);
    } catch (e) {
      console.error(`  ✗ row ${i + 2}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  emit(projects);
  console.log(`✓ build-projects: emitted ${projects.length} project(s) to ${OUT_PATH.replace(ROOT + '/', '')}`);
}

main();
