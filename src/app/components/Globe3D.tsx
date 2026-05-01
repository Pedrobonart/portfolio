import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { projects, Project } from '../data/projects';
import { useLanguage } from '../context/LanguageContext';
import { feature, mesh } from 'topojson-client';
import { Crosshair } from 'lucide-react';

interface Globe3DProps {
  isDark: boolean;
}

// ── One marker slot on the globe ──────────────────────────────────────────────
// A project with N extra locations produces N+1 slots (primary + extras).
interface ProjectSlot {
  project: Project;
  coordinates: [number, number];
  /** Optional site label, e.g. "Site A" or "Rotterdam HQ". Shown in the hover card. */
  label?: string;
}

function expandToSlots(ps: Project[]): ProjectSlot[] {
  const slots: ProjectSlot[] = [];
  for (const p of ps) {
    // Primary marker — no label unless there are also extra locations
    const hasExtras = !!p.extraLocations?.length;
    slots.push({
      project: p,
      coordinates: p.coordinates,
      label: hasExtras ? (p.extraLocations![0]?.label ? undefined : undefined) : undefined,
    });
    // Extra markers
    for (const ex of p.extraLocations ?? []) {
      slots.push({ project: p, coordinates: ex.coordinates, label: ex.label });
    }
  }
  return slots;
}

interface HoverState {
  project: Project;
  /** Site label if the project has multiple locations. */
  label?: string;
  x: number;
  y: number;
  clusterCenter: [number, number];
}

const GLOBE_RADIUS = 2;
const ZOOM_MIN = 2.5;    // closest zoom (city-scale)
const ZOOM_MAX = 10;
const ZOOM_DEFAULT = 6;
const ZOOM_STEP = 0.5;
const CITY_ZOOM = 2.85;  // target z when flying to a city
const CLUSTER_DIST = 0.8; // degrees – cluster grouping radius
const SPREAD_DIST = 0.22; // degrees – spread radius within a cluster

// ── Cluster + spread helper ──────────────────────────────────────────────────
interface PlacedSlot {
  project: Project;
  label?: string;
  lat: number;
  lng: number;
  clusterCenter: [number, number];
}

function buildPlacedSlots(slots: ProjectSlot[]): PlacedSlot[] {
  const n = slots.length;
  const used = new Array(n).fill(false);
  const groups: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const g = [i];
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const [la, lo] = slots[i].coordinates;
      const [lb, lob] = slots[j].coordinates;
      if (Math.hypot(lb - la, lob - lo) < CLUSTER_DIST) {
        g.push(j);
        used[j] = true;
      }
    }
    groups.push(g);
  }

  const result: PlacedSlot[] = [];
  for (const g of groups) {
    const clat = g.reduce((s, i) => s + slots[i].coordinates[0], 0) / g.length;
    const clng = g.reduce((s, i) => s + slots[i].coordinates[1], 0) / g.length;
    const clusterCenter: [number, number] = [clat, clng];

    if (g.length === 1) {
      const s = slots[g[0]];
      result.push({ project: s.project, label: s.label, lat: s.coordinates[0], lng: s.coordinates[1], clusterCenter });
    } else {
      g.forEach((idx, k) => {
        const s = slots[idx];
        // Start from the pin's true coordinates rather than the cluster centroid,
        // so pins that are already spread across a region keep their general position.
        result.push({ project: s.project, label: s.label, lat: s.coordinates[0], lng: s.coordinates[1], clusterCenter });
      });
    }
  }

  // ── Force-directed repulsion pass ─────────────────────────────────────────
  // Iteratively push any two pins that are closer than MIN_PUSH apart so
  // no markers visually overlap, regardless of cluster membership.
  const MIN_PUSH = 0.55; // degrees  (~60 km at mid-latitudes)
  const ITERATIONS = 40;
  const STEP = 0.5;      // fraction of overlap to correct each iteration

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let anyMoved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dlat = result[j].lat - result[i].lat;
        const dlng = result[j].lng - result[i].lng;
        const dist = Math.hypot(dlat, dlng);
        if (dist < MIN_PUSH && dist > 0.0001) {
          const overlap = (MIN_PUSH - dist) * STEP;
          const nx = dlat / dist;
          const ny = dlng / dist;
          result[i].lat -= nx * overlap * 0.5;
          result[i].lng -= ny * overlap * 0.5;
          result[j].lat += nx * overlap * 0.5;
          result[j].lng += ny * overlap * 0.5;
          anyMoved = true;
        }
      }
    }
    if (!anyMoved) break; // converged early
  }

  return result;
}

const placedSlots = buildPlacedSlots(expandToSlots(projects));

// ── Math helpers ─────────────────────────────────────────────────────────────
function latLngToVec3(lat: number, lng: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Compute earthGroup euler angles (rx, ry) so that the point at (lat, lng)
 *  is centred in front of the camera (Three.js XYZ euler, no Z rotation). */
function computeFlyRotation(lat: number, lng: number): [number, number] {
  const [vx, vy, vz] = latLngToVec3(lat, lng, 1);
  // Step 1: rx makes the y component zero after Rx application
  const rx = Math.atan2(vy, vz);
  const rxClamped = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rx));
  // Step 2: ry centres the x component after Rx
  const rho = Math.sqrt(vy * vy + vz * vz);
  const ry = Math.atan2(-vx, rho);
  return [rxClamped, ry];
}

// ── Stylized canvas texture ───────────────────────────────────────────────────
type TextureDetail = 'low' | 'mid' | 'high';

// CDN base for Natural Earth GeoJSON (official nvkelso repo via jsDelivr)
const NE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson';

// Module-level cache so each file is only fetched once per session
const geoDataCache = new Map<string, any>();
async function fetchGeoJSON(url: string): Promise<any> {
  if (geoDataCache.has(url)) return geoDataCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const data = await res.json();
  geoDataCache.set(url, data);
  return data;
}

// ── GeoJSON drawing helpers ───────────────────────────────────────────────────
type ProjFn = (v: number) => number;

function drawLineFeatures(
  ctx: CanvasRenderingContext2D,
  features: GeoJSON.Feature[],
  projX: ProjFn, projY: ProjFn,
) {
  for (const f of features) {
    const geom = f.geometry as GeoJSON.LineString | GeoJSON.MultiLineString | null;
    if (!geom) continue;
    const rings: GeoJSON.Position[][] =
      geom.type === 'LineString' ? [geom.coordinates]
      : geom.type === 'MultiLineString' ? geom.coordinates : [];
    for (const ring of rings) {
      ctx.beginPath();
      let prevLng = 0;
      ring.forEach(([lng, lat], i) => {
        const x = projX(lng), y = projY(lat);
        if (i === 0 || Math.abs(lng - prevLng) > 180) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prevLng = lng;
      });
      ctx.stroke();
    }
  }
}

function buildGeoPath(geom: GeoJSON.Geometry, projX: ProjFn, projY: ProjFn): Path2D {
  const path = new Path2D();
  const drawRing = (ring: GeoJSON.Position[]) => {
    if (ring.length === 0) return;
    const maxRingLat = ring.reduce((m, [, lat]) => Math.max(m, lat), -Infinity);
    const isPolar = maxRingLat < -55;

    if (isPolar) {
      // Antarctic-style ring: detour through the south pole edge to keep the cap filled.
      let first = true, prevLng = 0, prevLat = 0;
      for (const [lng, lat] of ring) {
        const x = projX(lng), y = projY(lat);
        if (first) { path.moveTo(x, y); first = false; }
        else if (Math.abs(lng - prevLng) > 180) {
          const W = projX(180), H = projY(-90);
          const fromRight = prevLng > 0;
          const frac = fromRight
            ? (180 - prevLng) / (lng + 360 - prevLng)
            : (-180 - prevLng) / (lng - 360 - prevLng);
          const yEdge = projY(prevLat + frac * (lat - prevLat));
          path.lineTo(fromRight ? W : 0, yEdge);
          path.lineTo(fromRight ? W : 0, H);
          path.lineTo(fromRight ? 0 : W, H);
          path.lineTo(fromRight ? 0 : W, yEdge);
          path.lineTo(x, y);
        } else { path.lineTo(x, y); }
        prevLng = lng; prevLat = lat;
      }
      path.closePath();
      return;
    }

    // Non-polar: split the ring at antimeridian crossings into sub-rings, each
    // closed individually so polygons like Russia don't draw a stripe across
    // the texture from their easternmost to their westernmost vertex.
    const subRings: GeoJSON.Position[][] = [[]];
    let prevLng: number | null = null, prevLat = 0;
    for (const [lng, lat] of ring) {
      if (prevLng !== null && Math.abs(lng - prevLng) > 180) {
        const fromRight = prevLng > 0;
        const denom = fromRight ? (lng + 360 - prevLng) : (lng - 360 - prevLng);
        // Degenerate seam (both vertices exactly on the antimeridian, e.g.
        // Fiji's [180, lat] → [-180, lat] closure in 110m TopoJSON) makes
        // denom 0 and frac NaN. In that case, the crossing is purely along
        // the antimeridian itself, so the split latitude is simply prevLat.
        let latEdge: number;
        if (denom === 0) {
          latEdge = prevLat;
        } else {
          const frac = fromRight ? (180 - prevLng) / denom : (-180 - prevLng) / denom;
          latEdge = prevLat + frac * (lat - prevLat);
        }
        subRings[subRings.length - 1].push([fromRight ? 180 : -180, latEdge]);
        subRings.push([[fromRight ? -180 : 180, latEdge]]);
      }
      subRings[subRings.length - 1].push([lng, lat]);
      prevLng = lng; prevLat = lat;
    }
    // Merge the trailing sub-ring back into the leading one — the ring's implicit
    // closure connects them on the same side of the antimeridian.
    if (subRings.length > 1) {
      const tail = subRings.pop()!;
      subRings[0] = tail.concat(subRings[0]);
    }
    for (const sub of subRings) {
      if (sub.length === 0) continue;
      let first = true;
      for (const [lng, lat] of sub) {
        const x = projX(lng), y = projY(lat);
        if (first) { path.moveTo(x, y); first = false; }
        else path.lineTo(x, y);
      }
      path.closePath();
    }
  };
  if (geom.type === 'Polygon') geom.coordinates.forEach(drawRing);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(drawRing));
  return path;
}

function drawPolygonFeatures(
  ctx: CanvasRenderingContext2D,
  features: GeoJSON.Feature[],
  projX: ProjFn, projY: ProjFn,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth?: number,
) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  for (const f of features) {
    if (!f.geometry) continue;
    ctx.fill(buildGeoPath(f.geometry, projX, projY), 'nonzero');
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth ?? 1;
    for (const f of features) {
      if (!f.geometry) continue;
      ctx.stroke(buildGeoPath(f.geometry, projX, projY));
    }
  }
  ctx.restore();
}

function drawCityDots(
  ctx: CanvasRenderingContext2D,
  features: GeoJSON.Feature[],
  projX: ProjFn, projY: ProjFn,
  isDark: boolean,
  detail: TextureDetail,
  W: number,
) {
  // Only render country capitals — filter by NE featurecla / ADM0CAP / CAPITAL fields
  const isCapital = (props: Record<string, any>) =>
    props.featurecla === 'Admin-0 capital' ||
    props.featurecla === 'Admin-0 capital alt' ||
    props.ADM0CAP === 1 ||
    props.CAPITAL === 'primary' ||
    props.CAPITAL === 'Primary';

  const dotR   = detail === 'high' ? W * 0.0002 : W * 0.0003;
  const fontSize = detail === 'high' ? W * 0.0032 : W * 0.0042;

  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'left';

  for (const f of features) {
    if (f.geometry?.type !== 'Point') continue;
    const props = f.properties ?? {};
    if (!isCapital(props)) continue;

    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    const x = projX(lng), y = projY(lat);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(x, y, dotR * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(220,200,160,0.14)' : 'rgba(80,55,30,0.11)';
    ctx.fill();

    // Capital dot
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(255,228,175,0.95)' : 'rgba(55,32,8,0.95)';
    ctx.fill();
  }
  ctx.restore();
}

async function buildStylizedTexture(
  isDark: boolean,
  detail: TextureDetail = 'low',
  maxTextureSize = 8192,
): Promise<HTMLCanvasElement> {
  // Scale texture resolution with the LOD tier; clamp to the GPU's max so
  // higher-resolution bakes don't break on devices with smaller limits.
  const targetW =
    detail === 'high' ? 16384 :
    detail === 'mid'  ? 8192  :
                        4096;
  const W = Math.min(targetW, maxTextureSize);
  const H = W / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Constant 30° graticule across all zoom tiers (no minor lines).
  const minorStep = 30;
  const majorStep = 30;
  // Base topology: world-atlas TopoJSON (50m for mid+high; 10m countries ~60MB is too large)
  const topoFile = detail === 'low' ? 'countries-110m.json' : 'countries-50m.json';

  const projX = (lng: number) => (lng + 180) / 360 * W;
  const projY = (lat: number) => (90 - lat) / 180 * H;

  // ── Per-tier line widths ────────────────────────────────────────────────────
  // The HIGH texture is magnified ~4× on screen vs LOW, so we use proportionally
  // thinner canvas strokes so lines don't appear bloated when zoomed in.
  const lw = {
    gratMinor:   detail === 'high' ? 0.8  : detail === 'mid' ? 1.2  : 2.0,
    gratMajor:   detail === 'high' ? 1.6  : detail === 'mid' ? 2.5  : 4.0,
    equator:     detail === 'high' ? 2.5  : detail === 'mid' ? 4.0  : 6.0,
    tropic:      detail === 'high' ? 1.6  : detail === 'mid' ? 2.5  : 4.0,
    riverMinor:  detail === 'high' ? 0.7  : 1.5,
    riverMajor:  detail === 'high' ? 1.6  : 3.0,
    lakeOutline: detail === 'high' ? 0.8  : 1.5,
    stateLine:   detail === 'high' ? 0.9  : 1.8,
    border:      detail === 'high' ? 1.4  : detail === 'mid' ? 2.2  : 1.6,
    coast:       detail === 'high' ? 1.1  : detail === 'mid' ? 1.8  : 1.6,
  };

  // ── Ocean ─────────────────────────────────────────────────────────────────
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (isDark) {
    oceanGrad.addColorStop(0, '#04091a'); oceanGrad.addColorStop(1, '#060d22');
  } else {
    oceanGrad.addColorStop(0, '#c8ddf0'); oceanGrad.addColorStop(1, '#b8cce0');
  }
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Graticule ─────────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(70,110,200,0.09)' : 'rgba(80,110,160,0.10)';
  ctx.lineWidth = lw.gratMinor;
  for (let lat = -80; lat <= 80; lat += minorStep) {
    if (lat % majorStep === 0) continue;
    ctx.beginPath(); ctx.moveTo(0, projY(lat)); ctx.lineTo(W, projY(lat)); ctx.stroke();
  }
  for (let lng = -180 + minorStep; lng < 180; lng += minorStep) {
    if (lng % majorStep === 0) continue;
    ctx.beginPath(); ctx.moveTo(projX(lng), 0); ctx.lineTo(projX(lng), H); ctx.stroke();
  }
  ctx.strokeStyle = isDark ? 'rgba(90,140,230,0.2)' : 'rgba(70,100,150,0.18)';
  ctx.lineWidth = lw.gratMajor;
  for (let lat = -90; lat <= 90; lat += majorStep) {
    ctx.beginPath(); ctx.moveTo(0, projY(lat)); ctx.lineTo(W, projY(lat)); ctx.stroke();
  }
  for (let lng = -180; lng <= 180; lng += majorStep) {
    ctx.beginPath(); ctx.moveTo(projX(lng), 0); ctx.lineTo(projX(lng), H); ctx.stroke();
  }
  ctx.strokeStyle = isDark ? 'rgba(120,170,255,0.42)' : 'rgba(60,90,150,0.38)';
  ctx.lineWidth = lw.equator; ctx.setLineDash([40, 24]);
  ctx.beginPath(); ctx.moveTo(0, projY(0)); ctx.lineTo(W, projY(0)); ctx.stroke();
  ctx.strokeStyle = isDark ? 'rgba(100,150,240,0.22)' : 'rgba(70,100,150,0.22)';
  ctx.lineWidth = lw.tropic; ctx.setLineDash([20, 32]);
  for (const lat of [23.436, -23.436, 66.56, -66.56]) {
    ctx.beginPath(); ctx.moveTo(0, projY(lat)); ctx.lineTo(W, projY(lat)); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // ── Data source selection per tier ─────────────────────────────────────────
  //   LOW  → world-atlas 110m only, no NE layers
  //   MID  → world-atlas 50m + NE 50m rivers/lakes/states + NE 50m cities
  //   HIGH → world-atlas 50m + NE 10m rivers/lakes/states + NE 10m urban areas
  //           + NE 50m cities (more permissive rank filter)
  const riversFile = detail === 'high'
    ? `${NE}/ne_10m_rivers_lake_centerlines.geojson`
    : `${NE}/ne_50m_rivers_lake_centerlines.geojson`;
  const lakesFile = detail === 'high'
    ? `${NE}/ne_10m_lakes.geojson`
    : `${NE}/ne_50m_lakes.geojson`;
  const statesFile = detail === 'high'
    ? `${NE}/ne_10m_admin_1_states_provinces_lines.geojson`
    : `${NE}/ne_50m_admin_1_states_provinces_lines.geojson`;

  const topoPromise    = fetchGeoJSON(`https://cdn.jsdelivr.net/npm/world-atlas@2/${topoFile}`);
  const riversPromise  = detail !== 'low' ? fetchGeoJSON(riversFile).catch(() => null)  : Promise.resolve(null);
  const lakesPromise   = detail !== 'low' ? fetchGeoJSON(lakesFile).catch(() => null)   : Promise.resolve(null);
  const statesPromise  = detail !== 'low' ? fetchGeoJSON(statesFile).catch(() => null)  : Promise.resolve(null);
  // 50m populated places at ALL tiers — capitals are filtered inside drawCityDots
  const citiesPromise  = fetchGeoJSON(`${NE}/ne_50m_populated_places.geojson`).catch(() => null);
  // Urban footprint polygons — HIGH only (ne_10m_urban_areas)
  const urbanPromise   = detail === 'high'
    ? fetchGeoJSON(`${NE}/ne_10m_urban_areas.geojson`).catch(() => null)
    : Promise.resolve(null);

  const [topology, riversGeo, lakesGeo, statesGeo, citiesGeo, urbanGeo] = await Promise.all([
    topoPromise, riversPromise, lakesPromise, statesPromise, citiesPromise, urbanPromise,
  ]);

  // ── Land / country fills (from world-atlas TopoJSON) ──────────────────────
  let landFeatures: GeoJSON.Feature[] = [];
  try {
    const countries = feature(topology as any, (topology as any).objects.countries) as GeoJSON.FeatureCollection;
    landFeatures = countries.features;
    const borders = mesh(topology as any, (topology as any).objects.countries, (a: any, b: any) => a !== b) as GeoJSON.MultiLineString;
    const coastline = mesh(topology as any, (topology as any).objects.land) as GeoJSON.MultiLineString;

    const drawTopoLines = (geom: GeoJSON.MultiLineString) => {
      for (const ring of geom.coordinates) {
        ctx.beginPath();
        let prevLng = 0;
        ring.forEach(([lng, lat], i) => {
          const x = projX(lng), y = projY(lat);
          if (i === 0 || Math.abs(lng - prevLng) > 180) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          prevLng = lng;
        });
        ctx.stroke();
      }
    };

    // Country fills
    ctx.save();
    ctx.fillStyle = isDark ? '#3d1010' : '#d4b5ab';
    for (const f of countries.features) {
      if (!f.geometry) continue;
      ctx.fill(buildGeoPath(f.geometry, projX, projY), 'nonzero');
    }
    ctx.restore();

    // ── Urban area footprints (HIGH only) ────────────────────────────────────
    if (urbanGeo?.features) {
      drawPolygonFeatures(
        ctx, urbanGeo.features, projX, projY,
        isDark ? 'rgba(80,20,20,0.55)' : 'rgba(180,130,120,0.60)',
        isDark ? 'rgba(160,50,50,0.18)' : 'rgba(120,50,40,0.18)',
        lw.lakeOutline * 0.6,
      );
    }

    // ── Natural Earth: Lakes ─────────────────────────────────────────────────
    if (lakesGeo?.features) {
      drawPolygonFeatures(
        ctx, lakesGeo.features, projX, projY,
        isDark ? 'rgba(6,16,42,0.90)' : 'rgba(175,208,232,0.92)',
        isDark ? 'rgba(70,120,215,0.45)' : 'rgba(75,115,165,0.50)',
        lw.lakeOutline,
      );
    }

    // ── Natural Earth: Rivers ────────────────────────────────────────────────
    if (riversGeo?.features) {
      const majorRivers = riversGeo.features.filter((f: GeoJSON.Feature) =>
        (f.properties?.strokewidth ?? 0) >= 1,
      );
      const minorRivers = riversGeo.features.filter((f: GeoJSON.Feature) =>
        (f.properties?.strokewidth ?? 0) < 1,
      );

      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(55,100,205,0.32)' : 'rgba(95,145,205,0.42)';
      ctx.lineWidth = lw.riverMinor;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      drawLineFeatures(ctx, minorRivers, projX, projY);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(75,135,225,0.58)' : 'rgba(75,125,195,0.68)';
      ctx.lineWidth = lw.riverMajor;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      drawLineFeatures(ctx, majorRivers, projX, projY);
      ctx.restore();
    }

    // ── Natural Earth: State/Province lines (MID + HIGH) ─────────────────────
    if (statesGeo?.features) {
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(95,145,225,0.20)' : 'rgba(115,88,52,0.25)';
      ctx.lineWidth = lw.stateLine;
      ctx.setLineDash([8, 7]);
      ctx.lineCap = 'round';
      drawLineFeatures(ctx, statesGeo.features, projX, projY);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Country borders (on top of NE layers)
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(90,150,240,0.38)' : 'rgba(110,85,50,0.38)';
    ctx.lineWidth = lw.border;
    drawTopoLines(borders as GeoJSON.MultiLineString);
    ctx.restore();

    // Coastline
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(120,175,255,0.65)' : 'rgba(80,60,35,0.65)';
    ctx.lineWidth = lw.coast;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawTopoLines(coastline as GeoJSON.MultiLineString);
    ctx.restore();

  } catch (err) {
    console.warn('Globe3D: could not draw topology', err);
  }

  // ── Natural Earth: City dots (MID + HIGH) ─────────────────────────────────
  if (citiesGeo?.features) {
    drawCityDots(ctx, citiesGeo.features, projX, projY, isDark, detail, W);
  }

  // ── Coordinate labels ─────────────────────────────────────────────────────
  // Skip labels that fall over land so they only sit on ocean.
  const pointInRing = (lng: number, lat: number, ring: GeoJSON.Position[]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number];
      const [xj, yj] = ring[j] as [number, number];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };
  const isOnLand = (lng: number, lat: number): boolean => {
    for (const f of landFeatures) {
      const g = f.geometry;
      if (!g) continue;
      const polys: GeoJSON.Position[][][] =
        g.type === 'Polygon' ? [g.coordinates] :
        g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        if (poly.length === 0) continue;
        if (!pointInRing(lng, lat, poly[0])) continue;
        let inHole = false;
        for (let h = 1; h < poly.length; h++) {
          if (pointInRing(lng, lat, poly[h])) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
    return false;
  };

  ctx.save();
  const fontSize = detail === 'high' ? W * 0.004 : W * 0.0055;
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = isDark ? 'rgba(100,150,230,0.55)' : 'rgba(60,80,130,0.5)';
  // Offset labels off the gridlines so the line doesn't cut through them.
  const labelOffset = fontSize * 0.4;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Constant label spacing across all zoom tiers so the meridian/parallel
  // labels stay anchored to the same lines no matter the LOD.
  const lngLabelStep = 30;
  for (let lng = -150; lng <= 150; lng += lngLabelStep) {
    if (isOnLand(lng, 0)) continue;
    const label = lng === 0 ? '0°' : lng > 0 ? `${lng}°E` : `${Math.abs(lng)}°W`;
    ctx.fillText(label, projX(lng) + labelOffset, projY(0) - labelOffset);
  }
  const latLabelStep = 30;
  for (let lat = -60; lat <= 60; lat += latLabelStep) {
    if (lat === 0) continue;
    if (isOnLand(-178, lat)) continue;
    const label = lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`;
    ctx.fillText(label, projX(-178) + labelOffset, projY(lat) - labelOffset);
  }
  ctx.restore();

  return canvas;
}

// ── Component ────────────────────────────────────────────────────────────────
export function Globe3D({ isDark }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const zoomRef = useRef<number>(ZOOM_DEFAULT);
  const [zoomDisplay, setZoomDisplay] = useState(ZOOM_DEFAULT);

  // Exposed so JSX can trigger fly-to without re-entering the useEffect closure
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number, screenAnchorY?: number) => void) | null>(null);
  // True on devices without hover (phones/tablets). Used to swap the hover card
  // into a tap-to-preview / tap-to-open card.
  const [isTouchDevice] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches,
  );

  const themeRefs = useRef<{
    THREE: any; earthMat: any; ambientLight: any; sunLight: any;
    fillLight: any; starsMat: any; atmoMat: any;
    halo1Mat: any; halo2Mat: any; halo3Mat: any;
    renderer: any;
  } | null>(null);

  // Track current detail tier so theme swaps re-build at the correct LOD
  const detailTierRef = useRef<TextureDetail>('low');
  // GPU max texture size, populated once the renderer is created
  const maxTexSizeRef = useRef<number>(8192);
  // Mirror isDark into a ref so the LOD effect can read it without becoming a dep
  const isDarkRef = useRef(isDark);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);
  // Cache one canvas per tier+theme so revisiting a tier is instant
  // (no GeoJSON refetch, no canvas re-rasterisation).
  const textureCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // Track which combos are currently being built to avoid overlapping bakes.
  const inFlightTextureRef = useRef<Set<string>>(new Set());

  const getOrBuildTexture = (
    isDarkArg: boolean,
    detail: TextureDetail,
  ): Promise<HTMLCanvasElement> => {
    const key = `${detail}:${isDarkArg ? 'dark' : 'light'}`;
    const cached = textureCacheRef.current.get(key);
    if (cached) return Promise.resolve(cached);
    if (inFlightTextureRef.current.has(key)) {
      // A bake is already in progress; poll briefly until it's cached.
      return new Promise((resolve) => {
        const tick = () => {
          const c = textureCacheRef.current.get(key);
          if (c) resolve(c);
          else setTimeout(tick, 60);
        };
        tick();
      });
    }
    inFlightTextureRef.current.add(key);
    return buildStylizedTexture(isDarkArg, detail, maxTexSizeRef.current).then((canvas) => {
      textureCacheRef.current.set(key, canvas);
      inFlightTextureRef.current.delete(key);
      return canvas;
    });
  };

  // ── Helper: bake canvas → Three.js texture and assign to earthMat ──────────
  const applyTexture = (canvas: HTMLCanvasElement, refs: NonNullable<typeof themeRefs.current>) => {
    const { THREE, earthMat, renderer } = refs;
    // Free GPU memory from the previous LOD tier before allocating the new one.
    // Without this, rapid pinch-zooming (which triggers tier swaps) leaks
    // textures and can starve the GPU on mobile (visible as a striped /
    // missing-texture globe).
    if (earthMat.map) earthMat.map.dispose?.();
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    earthMat.map = texture;
    earthMat.needsUpdate = true;
  };

  // ── Scene init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let animId = 0, mounted = true;
    let disposeAll: (() => void) | null = null;
    const initialDark = isDark;

    import('three').then((THREE) => {
      if (!mounted) return;

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#04060f');
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.z = ZOOM_DEFAULT;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';

      // Lighting
      const ambientLight = new THREE.AmbientLight(
        initialDark ? 0x334466 : 0xffffff,
        initialDark ? 1.1 : 0.85
      );
      scene.add(ambientLight);
      const sunLight = new THREE.DirectionalLight(initialDark ? 0x88aadd : 0xfff8f0, initialDark ? 0.7 : 0.9);
      sunLight.position.set(6, 3, 5); scene.add(sunLight);
      const fillLight = new THREE.DirectionalLight(initialDark ? 0x1a2a44 : 0xddeeff, initialDark ? 0.4 : 0.3);
      fillLight.position.set(-5, -2, -3); scene.add(fillLight);

      // Stars
      const starCount = 4000;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 90 + Math.random() * 10;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const starsGeo = new THREE.BufferGeometry();
      starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starsMat = new THREE.PointsMaterial({
        color: 0xffffff, size: initialDark ? 0.08 : 0.05, sizeAttenuation: true,
        transparent: true, opacity: initialDark ? 0.55 : 0.28,
      });
      scene.add(new THREE.Points(starsGeo, starsMat));

      // Earth
      const earthGroup = new THREE.Group();
      scene.add(earthGroup);
      const earthMat = new THREE.MeshPhongMaterial({
        color: initialDark ? 0x0b1b30 : 0xc8d8e8, specular: 0x000000, shininess: 0,
      });
      earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 72, 72), earthMat));
      // Texture-size cap.
      //   • Desktop: 8K. iOS Safari can't reliably hold a 16K×8K canvas +
      //     mipmaps; the corruption shows up as a striped globe.
      //   • Mobile / coarse-pointer devices: 4K. Cuts the GPU memory
      //     footprint to a quarter, halves bake time, and is plenty for
      //     the small physical screen.
      const isMobileGPU = typeof window !== 'undefined'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;
      const desktopCap = 8192;
      const mobileCap = 4096;
      maxTexSizeRef.current = Math.min(
        renderer.capabilities.maxTextureSize ?? desktopCap,
        isMobileGPU ? mobileCap : desktopCap,
      );
      getOrBuildTexture(initialDark, 'low').then((canvas) => {
        if (!mounted) return;
        applyTexture(canvas, { THREE, earthMat, renderer });
        // Preload the mid tier in the background so the first zoom-in feels
        // instant. Skip on slow / low-memory devices via requestIdleCallback,
        // which only fires when the main thread is free.
        const preload = () => { if (mounted) getOrBuildTexture(initialDark, 'mid'); };
        if (typeof (window as any).requestIdleCallback === 'function') {
          (window as any).requestIdleCallback(preload, { timeout: 5000 });
        } else {
          setTimeout(preload, 1500);
        }
      });

      // Atmosphere + halos
      const atmoMat = new THREE.MeshPhongMaterial({
        color: initialDark ? 0x2255aa : 0x6699cc, transparent: true,
        opacity: initialDark ? 0.14 : 0.09, side: THREE.BackSide,
      });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.055, 64, 64), atmoMat));
      const halo1Mat = new THREE.MeshBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.18, side: THREE.BackSide });
      const halo2Mat = new THREE.MeshBasicMaterial({ color: 0x2255aa, transparent: true, opacity: 0.10, side: THREE.BackSide });
      const halo3Mat = new THREE.MeshBasicMaterial({ color: 0x112244, transparent: true, opacity: 0.12, side: THREE.BackSide });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 64, 64), halo1Mat));
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.22, 64, 64), halo2Mat));
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.55, 64, 64), halo3Mat));

      themeRefs.current = { THREE, earthMat, ambientLight, sunLight, fillLight, starsMat, atmoMat, halo1Mat, halo2Mat, halo3Mat, renderer };

      // Markers — use spread positions
      const archColor = initialDark ? 0xe8a848 : 0xc07830;
      const cartoColor = initialDark ? 0x4aaad8 : 0x2a6e9a;
      const markerObjects: Array<{ mesh: THREE.Mesh; placed: PlacedSlot }> = [];
      // Invisible spheres around each pin act as the actual hit area for
      // raycasting. Bigger on touch (no precise pointer) and a bit roomier
      // on desktop so the pin is forgiving to click. The visible pin geometry
      // (cylinder + base disk) is unchanged.
      const pickMeshes: THREE.Mesh[] = [];
      const tapRadius = isMobileGPU ? 0.07 : 0.018;
      const tapMat = new THREE.MeshBasicMaterial({ visible: false });

      placedSlots.forEach((placed) => {
        const { project, label, lat, lng, clusterCenter } = placed;
        const isArch = project.type === 'architecture';
        const color = isArch ? archColor : cartoColor;

        const markerMat = new THREE.MeshPhongMaterial({
          color, emissive: new THREE.Color(color).multiplyScalar(0.3), shininess: 80,
        });
        const markerHeight = 0.025;
        const markerMesh: THREE.Mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, markerHeight, 32),
          markerMat,
        );

        const [x, y, z] = latLngToVec3(lat, lng, GLOBE_RADIUS + markerHeight / 2);
        markerMesh.position.set(x, y, z);
        const normal = new THREE.Vector3(x, y, z).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        markerMesh.setRotationFromQuaternion(q);
        if (isArch) markerMesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(normal, Math.PI / 4));

        markerMesh.userData = { project, label, clusterCenter };
        earthGroup.add(markerMesh);
        markerObjects.push({ mesh: markerMesh, placed });

        const baseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
        const base = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), baseMat);
        const [bx, by, bz] = latLngToVec3(lat, lng, GLOBE_RADIUS + 0.001);
        base.position.set(bx, by, bz);
        base.lookAt(0, 0, 0); base.rotateX(Math.PI);
        earthGroup.add(base);

        // Tap/click proxy — invisible larger sphere centred on the pin.
        const tapTarget = new THREE.Mesh(
          new THREE.SphereGeometry(tapRadius, 8, 8),
          tapMat,
        );
        tapTarget.position.set(x, y, z);
        tapTarget.userData = { project, label, clusterCenter, actualMesh: markerMesh };
        earthGroup.add(tapTarget);
        pickMeshes.push(tapTarget);
      });


      // ── Fly-to state ──────────────────────────────────────────────────────
      const isFlyingRef2 = { current: false };
      const flyTarget = { current: { rx: 0, ry: 0 } };

      const applyZoom = (newZ: number) => {
        const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZ));
        zoomRef.current = z;
        targetZ = z;
        if (mounted) setZoomDisplay(z);
      };

      // Expose flyTo to React JSX. screenAnchorY is in NDC (-1 bottom, 0 centre,
      // +1 top); pass e.g. -0.5 to land the pin 1/4 of the screen up from the
      // bottom so a preview card has room above it.
      flyToRef.current = (lat: number, lng: number, zoom = CITY_ZOOM, screenAnchorY = 0) => {
        const [rxTarget, ryTarget] = computeFlyRotation(lat, lng);
        // Shortest arc for Y rotation
        let ryDelta = ryTarget - earthGroup.rotation.y;
        while (ryDelta > Math.PI) ryDelta -= 2 * Math.PI;
        while (ryDelta < -Math.PI) ryDelta += 2 * Math.PI;
        // Convert the desired NDC y into an extra X-rotation so the target
        // lat appears off-centre on screen at the fly-target zoom.
        // A positive δ rotation around X moves the centred point to negative
        // y in camera space → bottom of the screen — so we negate the
        // anchor (NDC y +1 = top, -1 = bottom) when computing δ.
        const fovRad = (camera.fov * Math.PI) / 180;
        const rxOffset = -screenAnchorY * (zoom - GLOBE_RADIUS) * Math.tan(fovRad / 2) / GLOBE_RADIUS;
        flyTarget.current = { rx: rxTarget + rxOffset, ry: earthGroup.rotation.y + ryDelta };
        isFlyingRef2.current = true;
        applyZoom(zoom);
      };

      // Expose zoom controls
      (container as any).__zoomIn = () => applyZoom(targetZ - ZOOM_STEP);
      (container as any).__zoomOut = () => applyZoom(targetZ + ZOOM_STEP);
      (container as any).__zoomReset = () => applyZoom(ZOOM_DEFAULT);
      (container as any).__setZoom = (z: number) => applyZoom(z);

      // ── Interaction ──────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let isDragging = false, prevX = 0, prevY = 0, dragDistance = 0;
      let isMouseOver = false;
      let currentHoveredProject: Project | null = null;
      let currentHoveredMesh: THREE.Mesh | null = null;
      let targetZ = ZOOM_DEFAULT, currentZ = ZOOM_DEFAULT;
      // Touch devices: hover doesn't exist, so we use a tap-to-preview /
      // tap-again-to-open flow instead of the mouse hover behavior.
      const isTouch = typeof window !== 'undefined'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;
      let lastTappedProject: Project | null = null;
      let lastTapAt = 0;

      const updateHoverHighlight = (mesh: THREE.Mesh | null, project: Project | null) => {
        if (currentHoveredMesh) {
          const mat = currentHoveredMesh.material as THREE.MeshPhongMaterial;
          mat.emissive.set(new THREE.Color(currentHoveredProject?.type === 'architecture' ? archColor : cartoColor).multiplyScalar(0.3));
          currentHoveredMesh.scale.setScalar(1);
        }
        currentHoveredMesh = mesh; currentHoveredProject = project;
        if (mesh) {
          const mat = mesh.material as THREE.MeshPhongMaterial;
          mat.emissive.set(new THREE.Color(project?.type === 'architecture' ? archColor : cartoColor).multiplyScalar(0.85));
          mesh.scale.setScalar(1.4);
        }
      };

      const getMousePos = (e: { clientX: number; clientY: number }) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      };

      // ── Pointer-based input (mouse + touch + pen unified) ──────────────────
      // Tracks active pointers for single-finger drag and two-finger pinch zoom.
      const pointers = new Map<number, { x: number; y: number }>();
      let pinchStartDist = 0;
      let pinchStartZoom = 0;

      const onPointerDown = (e: PointerEvent) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        isFlyingRef2.current = false;

        if (pointers.size === 1) {
          isDragging = true;
          prevX = e.clientX; prevY = e.clientY; dragDistance = 0;
          renderer.domElement.style.cursor = 'grabbing';
        } else if (pointers.size === 2) {
          // Two fingers down → start pinch, cancel drag detection
          isDragging = false;
          const pts = [...pointers.values()];
          pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          pinchStartZoom = targetZ;
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (pointers.has(e.pointerId)) {
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        // Two-finger pinch zoom — pinch out (ratio > 1) → zoom in (lower z).
        if (pointers.size === 2 && pinchStartDist > 0) {
          const pts = [...pointers.values()];
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const ratio = dist / pinchStartDist;
          if (ratio > 0) applyZoom(pinchStartZoom / ratio);
          return;
        }

        // Single-pointer drag → rotate the globe.
        if (pointers.size === 1 && isDragging) {
          const dx = e.clientX - prevX, dy = e.clientY - prevY;
          dragDistance += Math.abs(dx) + Math.abs(dy);
          earthGroup.rotation.y += dx * 0.005;
          earthGroup.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, earthGroup.rotation.x + dy * 0.005));
          prevX = e.clientX; prevY = e.clientY;
          return;
        }

        // Hover preview — mouse only (touch uses tap-to-preview on pointerUp).
        if (e.pointerType !== 'mouse' || isTouch) return;
        getMousePos(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(pickMeshes);
        if (hits.length > 0) {
          const obj = hits[0].object;
          const proj = obj.userData.project as Project;
          const label = obj.userData.label as string | undefined;
          const cc = obj.userData.clusterCenter as [number, number];
          const visible = (obj.userData.actualMesh ?? obj) as THREE.Mesh;
          if (proj !== currentHoveredProject) {
            updateHoverHighlight(visible, proj);
            if (mounted) setHoverState({ project: proj, label, x: e.clientX, y: e.clientY, clusterCenter: cc });
          } else {
            if (mounted) setHoverState((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
          }
          renderer.domElement.style.cursor = 'pointer';
        } else {
          if (currentHoveredProject) { updateHoverHighlight(null, null); if (mounted) setHoverState(null); }
          renderer.domElement.style.cursor = isMouseOver ? 'grab' : 'default';
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const wasMultiTouch = pointers.size > 1;
        pointers.delete(e.pointerId);
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (pointers.size < 2) pinchStartDist = 0;

        if (pointers.size > 0) return; // still other fingers down

        const wasClick = !wasMultiTouch && dragDistance < 6;
        isDragging = false;
        dragDistance = 0;
        renderer.domElement.style.cursor = isMouseOver ? 'grab' : 'default';
        if (!wasClick) return;

        // Tap handling — raycast for a marker hit at the release position.
        getMousePos(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(pickMeshes);

        const isTouchTap = e.pointerType !== 'mouse' || isTouch;

        // Touch UX: while a preview is open, any canvas tap closes it.
        // The only way to open the project from touch is to tap the card.
        if (isTouchTap && lastTappedProject) {
          lastTappedProject = null;
          updateHoverHighlight(null, null);
          if (mounted) setHoverState(null);
          return;
        }

        if (hits.length === 0) {
          // Tap on empty globe → close any open preview (mouse path only;
          // touch already handled above).
          if (currentHoveredProject) updateHoverHighlight(null, null);
          if (mounted) setHoverState(null);
          return;
        }

        const obj = hits[0].object;
        const proj = obj.userData.project as Project;
        const label = obj.userData.label as string | undefined;
        const cc = obj.userData.clusterCenter as [number, number];
        const mesh = (obj.userData.actualMesh ?? obj) as THREE.Mesh;

        if (isTouchTap) {
          // Tap on a pin with no open preview → fly + show preview above it.
          updateHoverHighlight(mesh, proj);
          lastTappedProject = proj;
          lastTapAt = Date.now();
          flyToRef.current?.(cc[0], cc[1], CITY_ZOOM, -0.5);
          const rect = container.getBoundingClientRect();
          if (mounted) setHoverState({
            project: proj,
            label,
            clusterCenter: cc,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height * 0.75,
          });
        } else {
          // Mouse click on a hovered marker → open the project (legacy behaviour).
          navigate(`/projects/${proj.id}`);
        }
      };

      const onPointerCancel = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchStartDist = 0;
        if (pointers.size === 0) { isDragging = false; dragDistance = 0; }
      };

      // Double-click → fly to that project's city
      const onDblClick = (e: MouseEvent) => {
        getMousePos(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(pickMeshes);
        if (hits.length > 0) {
          const cc = hits[0].object.userData.clusterCenter as [number, number];
          flyToRef.current?.(cc[0], cc[1]);
        }
      };

      const onMouseEnter = () => { isMouseOver = true; renderer.domElement.style.cursor = 'grab'; };
      const onMouseLeave = () => {
        isMouseOver = false; isDragging = false;
        renderer.domElement.style.cursor = 'default';
        // On touch the synthesized mouseleave fires after each tap; keep the
        // preview pinned so the second tap can open it.
        if (isTouch) return;
        updateHoverHighlight(null, null);
        if (mounted) setHoverState(null);
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        isFlyingRef2.current = false;
        applyZoom(targetZ + (e.deltaY > 0 ? 1 : -1) * 0.45);
      };
      const onResize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerCancel);
      renderer.domElement.addEventListener('dblclick', onDblClick);
      renderer.domElement.addEventListener('mouseenter', onMouseEnter);
      renderer.domElement.addEventListener('mouseleave', onMouseLeave);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      // Disable native page panning / pinch-zoom on the canvas so our gestures work.
      renderer.domElement.style.touchAction = 'none';
      window.addEventListener('resize', onResize);

      const animate = () => {
        animId = requestAnimationFrame(animate);

        if (isFlyingRef2.current) {
          // Smooth fly-to animation
          const ft = flyTarget.current;
          earthGroup.rotation.x += (ft.rx - earthGroup.rotation.x) * 0.08;
          earthGroup.rotation.y += (ft.ry - earthGroup.rotation.y) * 0.08;
          if (Math.abs(ft.rx - earthGroup.rotation.x) < 0.001 && Math.abs(ft.ry - earthGroup.rotation.y) < 0.001) {
            earthGroup.rotation.x = ft.rx;
            earthGroup.rotation.y = ft.ry;
            isFlyingRef2.current = false;
          }
        } else if (!isDragging && !isMouseOver) {
          // Auto-rotation — slows as you zoom in, stops at city scale
          const autoSpeed = currentZ > 4.5 ? 0.0008 : currentZ > 3.5 ? 0.0002 : 0;
          earthGroup.rotation.y += autoSpeed;
        }

        currentZ += (targetZ - currentZ) * 0.08;
        camera.position.z = currentZ;
        renderer.render(scene, camera);
      };
      animate();

      disposeAll = () => {
        cancelAnimationFrame(animId);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
        renderer.domElement.removeEventListener('dblclick', onDblClick);
        renderer.domElement.removeEventListener('mouseenter', onMouseEnter);
        renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
        renderer.domElement.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', onResize);
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
        renderer.dispose();
        themeRefs.current = null;
        flyToRef.current = null;
      };
    }).catch((err) => console.warn('Globe3D: failed to load three.js', err));

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
      disposeAll?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── Theme hot-swap ─────────────────────────────────────────────────────────
  useEffect(() => {
    const refs = themeRefs.current;
    if (!refs) return;
    const { THREE, earthMat, ambientLight, sunLight, fillLight, starsMat, atmoMat, halo1Mat, halo2Mat, halo3Mat, renderer } = refs;
    ambientLight.color.set(isDark ? 0x334466 : 0xffffff); ambientLight.intensity = isDark ? 1.1 : 0.85;
    sunLight.color.set(isDark ? 0x88aadd : 0xfff8f0); sunLight.intensity = isDark ? 0.7 : 0.9;
    fillLight.color.set(isDark ? 0x1a2a44 : 0xddeeff); fillLight.intensity = isDark ? 0.4 : 0.3;
    starsMat.size = isDark ? 0.08 : 0.05; starsMat.opacity = isDark ? 0.55 : 0.28; starsMat.needsUpdate = true;
    atmoMat.color.set(isDark ? 0x2255aa : 0x6699cc); atmoMat.opacity = isDark ? 0.14 : 0.09; atmoMat.needsUpdate = true;
    halo1Mat.opacity = 0.18; halo1Mat.needsUpdate = true;
    halo2Mat.opacity = 0.10; halo2Mat.needsUpdate = true;
    halo3Mat.opacity = 0.12; halo3Mat.needsUpdate = true;

    // Rebuild texture at the current LOD tier (cache-aware).
    const detail = detailTierRef.current;
    getOrBuildTexture(isDark, detail).then((canvas) => {
      // Bail out if the user has zoomed to a different tier or unmounted.
      if (!themeRefs.current) return;
      if (detailTierRef.current !== detail) return;
      if (isDarkRef.current !== isDark) return;
      applyTexture(canvas, { THREE, earthMat, renderer });
    });
  }, [isDark]);

  // ── LOD: swap texture detail level as zoom changes ─────────────────────────
  // Thresholds (camera z): low 6–10, mid 3.5–6, high <3.5.
  // On touch / coarse-pointer devices we skip the 'high' tier entirely — its
  // 10m GeoJSON layers (urban areas, fine state lines) cost an extra ~5–10 MB
  // of downloads and a heavy canvas bake we can't afford on phone memory.
  useEffect(() => {
    const isMobileGPU = typeof window !== 'undefined'
      && window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const highOrMid: TextureDetail = isMobileGPU ? 'mid' : 'high';
    const newTier: TextureDetail =
      zoomDisplay <= 3.5 ? highOrMid : zoomDisplay <= 6 ? 'mid' : 'low';
    if (newTier === detailTierRef.current) return; // no tier change, skip

    // Debounce: wait for zoom to settle before re-baking the canvas.
    // Cached tiers swap in instantly via getOrBuildTexture.
    const timer = setTimeout(() => {
      const refs = themeRefs.current;
      if (!refs) return;
      detailTierRef.current = newTier;
      const isDarkCurrent = isDarkRef.current;
      getOrBuildTexture(isDarkCurrent, newTier).then((canvas) => {
        // Bail out if the user has zoomed to a different tier or theme changed.
        if (!themeRefs.current) return;
        if (detailTierRef.current !== newTier) return;
        if (isDarkRef.current !== isDarkCurrent) return;
        applyTexture(canvas, refs);
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [zoomDisplay]);

  const handleZoomIn = () => (containerRef.current as any)?.__zoomIn?.();
  const handleZoomOut = () => (containerRef.current as any)?.__zoomOut?.();
  const handleZoomReset = () => (containerRef.current as any)?.__zoomReset?.();
  const setZoomFromPointer = (clientY: number, trackEl: HTMLElement) => {
    const rect = trackEl.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const z = ZOOM_MIN + t * (ZOOM_MAX - ZOOM_MIN);
    (containerRef.current as any)?.__setZoom?.(z);
  };
  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    track.setPointerCapture(e.pointerId);
    setZoomFromPointer(e.clientY, track);
  };
  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setZoomFromPointer(e.clientY, e.currentTarget);
  };
  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const zoomPct = 1 - (zoomDisplay - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
  // LOD tier boundaries expressed as percentages from the bottom of the visualizer.
  // High lives at the top (zoomed in); low at the bottom (zoomed out).
  const HIGH_Z = 3.5, MID_Z = 6;
  const tierBoundary = (z: number) => (1 - (z - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;
  const highBottom = tierBoundary(HIGH_Z);
  const midBottom = tierBoundary(MID_Z);
  const currentTier: TextureDetail =
    zoomDisplay <= HIGH_Z ? 'high' : zoomDisplay <= MID_Z ? 'mid' : 'low';

  const getCardPos = (x: number, y: number) => {
    const CW = 280, CH = 355, PAD = 20, GAP = 36;
    const vw = window.innerWidth, vh = window.innerHeight;

    // Touch devices: card sits centred above the pin (which has just been
    // flown to the centre of the canvas).
    if (isTouchDevice) {
      let left = x - CW / 2;
      let top = y - CH - GAP;
      if (left < PAD) left = PAD;
      if (left + CW > vw - PAD) left = vw - CW - PAD;
      if (top < PAD) top = PAD; // fall back to top of viewport on short screens
      return { left, top };
    }

    // Desktop hover: card sits to the side of the cursor.
    let left = x + 20, top = y - CH / 2;
    if (left + CW > vw - PAD) left = x - CW - 20;
    if (top < PAD) top = PAD;
    if (top + CH > vh - PAD) top = vh - CH - PAD;
    return { left, top };
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Zoom Controls — slider doubles as the LOD tier visualizer */}
      <div className="absolute bottom-42 right-4 z-[1100] hidden md:flex flex-col items-center gap-1" style={{ userSelect: 'none' }}>
        <button onClick={handleZoomIn} title="Zoom in"
          style={{ width: 30, height: 30, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)')}>+</button>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 7, margin: '3px 0' }}>
          {/* tick labels to the left of the merged slider/visualizer */}
          <div style={{ position: 'relative', height: 120, width: 26, fontSize: '0.45rem', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}>
            {[
              { z: ZOOM_MIN, label: ZOOM_MIN.toFixed(2) },
              { z: HIGH_Z,   label: HIGH_Z.toFixed(1)  },
              { z: MID_Z,    label: MID_Z.toFixed(1)   },
              { z: ZOOM_MAX, label: ZOOM_MAX.toFixed(1) },
            ].map(({ z, label }) => (
              <div key={z} style={{ position: 'absolute', right: 0, bottom: `calc(${tierBoundary(z)}% - 4px)`, lineHeight: 1, textAlign: 'right' }}>{label}</div>
            ))}
          </div>

          {/* merged slider track + LOD tier visualizer */}
          <div
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            title={`zoom ${zoomDisplay.toFixed(2)}`}
            style={{ position: 'relative', width: 6, height: 120, borderRadius: 3, overflow: 'visible', cursor: 'pointer', touchAction: 'none', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.25)' }}
          >
            {/* tier segments */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 2, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${highBottom}%`, top: 0, background: currentTier === 'high' ? 'rgba(120,200,255,0.75)' : 'rgba(120,200,255,0.22)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${midBottom}%`, height: `${highBottom - midBottom}%`, background: currentTier === 'mid' ? 'rgba(255,210,120,0.75)' : 'rgba(255,210,120,0.22)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${midBottom}%`, background: currentTier === 'low' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)' }} />
            </div>
            {/* draggable thumb */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: `calc(${zoomPct * 100}% - 4px)`, width: 10, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 4px rgba(0,0,0,0.55)', transition: 'bottom 0.12s', pointerEvents: 'none' }} />
          </div>

          {/* current-z label that tracks the thumb on the right of the bar */}
          <div style={{ position: 'relative', height: 120, width: 26, fontSize: '0.5rem', color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-sans)', fontWeight: 600, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: 0, bottom: `calc(${zoomPct * 100}% - 5px)`, lineHeight: 1, transition: 'bottom 0.12s', textShadow: '0 0 4px rgba(0,0,0,0.7)' }}>{zoomDisplay.toFixed(2)}</div>
          </div>
        </div>

        <button onClick={handleZoomOut} title="Zoom out"
          style={{ width: 30, height: 30, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)')}>−</button>

        <button onClick={handleZoomReset} title="Reset zoom"
          style={{ marginTop: 4, width: 30, height: 16, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.25)')}>RST</button>
      </div>

      {/* Hover Preview Card */}
      {hoverState && (
        <div
          className={`fixed z-[1500] ${isTouchDevice ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={getCardPos(hoverState.x, hoverState.y)}
          onClick={isTouchDevice ? () => navigate(`/projects/${hoverState.project.id}`) : undefined}
        >
          <div style={{ width: 280, background: 'var(--site-surface)', border: '1px solid var(--site-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', cursor: isTouchDevice ? 'pointer' : 'default' }}>
            <div style={{ height: 155, overflow: 'hidden' }}>
              <img src={hoverState.project.image} alt={hoverState.project.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-sans)', letterSpacing: '0.15em', textTransform: 'uppercase', color: hoverState.project.type === 'architecture' ? 'var(--site-arch)' : 'var(--site-carto)', fontWeight: 500 }}>
                  {hoverState.project.type === 'architecture' ? t.landing.arch : t.landing.carto}
                </span>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-sans)', color: 'var(--site-muted)' }}>{hoverState.project.year}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 400, lineHeight: 1.3, color: 'var(--site-text)', marginBottom: 4 }}>
                {hoverState.project.title}
              </h3>
              {/* Site label — shown for multi-location projects */}
              {hoverState.label && (
                <p style={{ fontSize: '0.6rem', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--site-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--site-muted)', flexShrink: 0 }} />
                  {hoverState.label}
                </p>
              )}
              <p style={{ fontSize: '0.7rem', fontFamily: 'var(--font-sans)', color: 'var(--site-muted)', marginBottom: 10 }}>
                {hoverState.project.location}, {hoverState.project.country}
              </p>
              <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-sans)', color: 'var(--site-text2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', marginBottom: 12 }}>
                {hoverState.project.shortDescription}
              </p>

              {/* Fly-to city button */}
              <button
                className="pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); flyToRef.current?.(hoverState.clusterCenter[0], hoverState.clusterCenter[1]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: '1px solid var(--site-border)',
                  color: 'var(--site-muted)', cursor: 'pointer', padding: '4px 8px',
                  fontFamily: 'var(--font-sans)', fontSize: '0.62rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  transition: 'color 0.15s, border-color 0.15s',
                  width: '100%', justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--site-text)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--site-text)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--site-muted)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--site-border)';
                }}
              >
                <Crosshair size={11} strokeWidth={1.5} />
                Zoom to city
              </button>
            </div>
          </div>
        </div>
      )}

      {/* City-scale hint — visible only when very zoomed in */}
      {zoomDisplay < 3.5 && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.6rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
            padding: '4px 12px', whiteSpace: 'nowrap',
          }}
        >
          Double-click a marker · scroll to zoom · drag to pan
        </div>
      )}
    </div>
  );
}