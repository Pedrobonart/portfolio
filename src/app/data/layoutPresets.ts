// Preset layouts referenced from PROJECTS.csv via the `layout_preset` column.
// Each preset returns a fragment that the codegen merges into a Project:
//   - `media`  — appended to the project's media array
//   - `layout` — set on the project (replaces the default body)
//
// Add new presets here. Keep them small and named after the visual story they
// tell, not the contents (so the CSV stays readable).
import type { LayoutBlock, MediaBlock } from './projects';

export interface PresetFragment {
  media?: MediaBlock[];
  layout?: LayoutBlock[];
}

export const layoutPresets: Record<string, PresetFragment> = {
  // No media, default page (hero + description + details).
  default: {},

  // Hero + carousel under it, grid above related projects. Text stays default.
  gallery: {
    media: [
      { kind: 'carousel', slot: 'afterHero', aspect: '16/9', images: [] },
      { kind: 'grid',     slot: 'beforeRelated', columns: 3, aspect: '1/1', images: [] },
    ],
  },

  // Bespoke story: description, hero-companion image, details, photo pair.
  // The image / pair sources still come from the project's media_file JSON.
  story: {
    layout: [
      { kind: 'description' },
      { kind: 'spacer', size: 'md' },
      { kind: 'details' },
    ],
  },
};

/** Look up a preset by name; returns {} for unknown / empty values. */
export function resolvePreset(name?: string): PresetFragment {
  if (!name) return {};
  return layoutPresets[name] ?? {};
}
