import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { projects, Project } from '../data/projects';
import { useLanguage } from '../context/LanguageContext';

interface Globe3DProps {
  isDark: boolean;
}

// ── Style URLs ───────────────────────────────────────────────────────────────
// Light style: local custom JSON in /public/styles/ (served at BASE_URL + styles/).
// Dark style: OpenFreeMap hosted fallback until a matching dark JSON is ready.
const LIGHT_STYLE = `${import.meta.env.BASE_URL}styles/globe-light.json`;
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

// ── One marker slot on the globe ─────────────────────────────────────────────
interface ProjectSlot {
  project: Project;
  coordinates: [number, number]; // [lat, lng]
  label?: string;
}

function expandToSlots(ps: Project[]): ProjectSlot[] {
  const slots: ProjectSlot[] = [];
  for (const p of ps) {
    slots.push({ project: p, coordinates: p.coordinates });
    for (const ex of p.extraLocations ?? []) {
      slots.push({ project: p, coordinates: ex.coordinates, label: ex.label });
    }
  }
  return slots;
}

interface HoverState {
  project: Project;
  label?: string;
  x: number;
  y: number;
  clusterCenter: [number, number]; // [lat, lng]
}

interface PlacedSlot {
  project: Project;
  label?: string;
  lat: number;
  lng: number;
  clusterCenter: [number, number];
}

const CLUSTER_DIST = 0.8;

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
    g.forEach((idx) => {
      const s = slots[idx];
      result.push({
        project: s.project,
        label: s.label,
        lat: s.coordinates[0],
        lng: s.coordinates[1],
        clusterCenter,
      });
    });
  }

  // Force-directed repulsion so pins don't visually overlap.
  const MIN_PUSH = 0.55, ITERATIONS = 40, STEP = 0.5;
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
    if (!anyMoved) break;
  }
  return result;
}

const placedSlots = buildPlacedSlots(expandToSlots(projects));

// ── Zoom range (MapLibre logarithmic scale: 0=whole world, ~10=city) ─────────
const ZOOM_MIN = 1;
const ZOOM_MAX = 15;
const ZOOM_DEFAULT = 1.1;
const CITY_ZOOM = 6;
const ZOOM_STEP = 0.5;
const AUTO_ROTATE_BELOW_ZOOM = 3.5;

// ── Pin styling ──────────────────────────────────────────────────────────────
const ARCH_LIGHT = '#c07830', ARCH_DARK = '#e8a848';
const CARTO_LIGHT = '#2a6e9a', CARTO_DARK = '#4aaad8';

// ── Component ────────────────────────────────────────────────────────────────
export function Globe3D({ isDark }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(ZOOM_DEFAULT);

  const mapRef = useRef<maplibregl.Map | null>(null);

  const [isTouchDevice] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches,
  );
  // Touch flow: first tap on a pin opens preview; tap on map or another pin closes it.
  const lastTappedRef = useRef<Project | null>(null);
  // Mirror isDark so the marker click handler sees the latest theme.
  const isDarkRef = useRef(isDark);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const map = new maplibregl.Map({
      container,
      style: isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
      center: [10, 25],
      zoom: ZOOM_DEFAULT,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__map = map;

    // Force globe projection after style load (overrides any projection set
    // by the loaded style JSON).
    const applyGlobe = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection?.({ type: 'globe' });
    };
    map.on('style.load', applyGlobe);

    map.on('zoom', () => setZoomDisplay(map.getZoom()));

    // ── Auto-rotation when idle, zoomed out, mouse off-canvas, no preview ────
    let lastInteraction = performance.now();
    let mouseOverGlobe = false;
    const bumpInteraction = () => { lastInteraction = performance.now(); };
    map.on('mousedown', bumpInteraction);
    map.on('touchstart', bumpInteraction);
    map.on('wheel', bumpInteraction);
    map.on('movestart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) bumpInteraction(); });
    const canvasEl = map.getCanvasContainer();
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      // Project the globe center and a point at the equatorial horizon (90° away)
      // to get the true sphere screen radius, regardless of zoom or canvas size.
      const c = map.getCenter();
      const cp = map.project(c as maplibregl.LngLat);
      const ep = map.project(new maplibregl.LngLat(c.lng + 89, 0));
      const globeR = Math.hypot(ep.x - cp.x, ep.y - cp.y);
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseOverGlobe = Math.hypot(mx - cp.x, my - cp.y) <= globeR;
    };
    const onCanvasLeave = () => { mouseOverGlobe = false; };
    canvasEl.addEventListener('mousemove', onMouseMove);
    canvasEl.addEventListener('mouseleave', onCanvasLeave);

    let rafId = 0;
    const tick = () => {
      const idleFor = performance.now() - lastInteraction;
      const blocked = mouseOverGlobe;
      if (
        !blocked &&
        idleFor > 1500 &&
        map.getZoom() < AUTO_ROTATE_BELOW_ZOOM &&
        !map.isMoving()
      ) {
        const c = map.getCenter();
        map.setCenter([c.lng + 0.06, c.lat]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // ── GeoJSON pin source + GL circle layers ────────────────────────────────
    // Pins are rendered as native MapLibre circle layers so they sit firmly
    // on the globe surface (GPU-projected per-frame), occlude when on the
    // back side, and don't drift during rotation. Two stacked circles per pin:
    // a translucent base disk that lies flat on the surface (pitch-aligned to
    // the map) + a smaller viewport-aligned dot on top — mimicking the original
    // 3D cylinder + base disk.
    const features = placedSlots.map((p, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: { type: p.project.type, slotIndex: i },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    }));
    let hoveredFeatureId: number | null = null;

    const setupLayers = () => {
      const dark = isDarkRef.current;
      const archColor = dark ? ARCH_DARK : ARCH_LIGHT;
      const cartoColor = dark ? CARTO_DARK : CARTO_LIGHT;
      const colorExpr: maplibregl.ExpressionSpecification = [
        'match', ['get', 'type'], 'architecture', archColor, cartoColor,
      ];

      if (!map.getSource('pins')) {
        map.addSource('pins', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });
      }

      if (!map.getLayer('pins-base')) {
        map.addLayer({
          id: 'pins-base',
          type: 'circle',
          source: 'pins',
          paint: {
            'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 18, 13],
            'circle-color': colorExpr,
            'circle-opacity': 0.32,
            'circle-pitch-alignment': 'map',
            'circle-stroke-width': 1,
            'circle-stroke-color': colorExpr,
            'circle-stroke-opacity': 0.55,
          },
        });
      }

      if (!map.getLayer('pins-dot')) {
        map.addLayer({
          id: 'pins-dot',
          type: 'circle',
          source: 'pins',
          paint: {
            'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 8, 6],
            'circle-color': colorExpr,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.92,
          },
        });
      }
    };

    // ── Pin event handlers ───────────────────────────────────────────────────
    const onPinEnter = (e: maplibregl.MapLayerMouseEvent) => {
      if (isTouchDevice) return;
      const f = e.features?.[0];
      if (!f) return;
      const idx = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];
      map.getCanvas().style.cursor = 'pointer';
      if (hoveredFeatureId !== null && hoveredFeatureId !== idx) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
      }
      hoveredFeatureId = idx;
      map.setFeatureState({ source: 'pins', id: idx }, { hover: true });
      setHoverState({
        project: placed.project,
        label: placed.label,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        clusterCenter: placed.clusterCenter,
      });
    };
    const onPinMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (isTouchDevice) return;
      setHoverState((prev) =>
        prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : prev,
      );
    };
    const onPinLeave = () => {
      if (isTouchDevice) return;
      map.getCanvas().style.cursor = '';
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        hoveredFeatureId = null;
      }
      setHoverState(null);
    };
    const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault(); // suppress the map-wide 'click' (which closes the preview)
      const f = e.features?.[0];
      if (!f) return;
      const idx = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];
      if (isTouchDevice) {
        if (lastTappedRef.current === placed.project) return;
        if (hoveredFeatureId !== null && hoveredFeatureId !== idx) {
          map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        }
        hoveredFeatureId = idx;
        map.setFeatureState({ source: 'pins', id: idx }, { hover: true });
        lastTappedRef.current = placed.project;
        const [lat, lng] = placed.clusterCenter;
        map.flyTo({ center: [lng, lat], zoom: CITY_ZOOM, speed: 1.4, curve: 1.6 });
        const rect = container.getBoundingClientRect();
        setHoverState({
          project: placed.project,
          label: placed.label,
          clusterCenter: placed.clusterCenter,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height * 0.75,
        });
      } else {
        navigate(`/projects/${placed.project.id}`);
      }
    };
    const onPinDblClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;
      const idx = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];
      const [lat, lng] = placed.clusterCenter;
      map.flyTo({ center: [lng, lat], zoom: CITY_ZOOM, speed: 1.4, curve: 1.6 });
    };

    map.on('mouseenter', 'pins-dot', onPinEnter);
    map.on('mousemove', 'pins-dot', onPinMove);
    map.on('mouseleave', 'pins-dot', onPinLeave);
    map.on('click', 'pins-dot', onPinClick);
    map.on('dblclick', 'pins-dot', onPinDblClick);

    // Map-wide click closes any open preview (unless we clicked a pin).
    map.on('click', (e) => {
      if (e.defaultPrevented) return;
      lastTappedRef.current = null;
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        hoveredFeatureId = null;
      }
      setHoverState(null);
    });

    // Run on initial style load AND after every setStyle (theme swap).
    map.on('style.load', () => {
      applyGlobe();
      setupLayers();
      hoveredFeatureId = null;
    });

    return () => {
      cancelAnimationFrame(rafId);
      canvasEl.removeEventListener('mousemove', onMouseMove);
      canvasEl.removeEventListener('mouseleave', onCanvasLeave);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── Theme hot-swap (style.load re-adds the pin layers with new colors) ────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
  }, [isDark]);

  // ── Zoom controls ──────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    const m = mapRef.current; if (!m) return;
    m.easeTo({ zoom: Math.min(ZOOM_MAX, m.getZoom() + ZOOM_STEP), duration: 250 });
  };
  const handleZoomOut = () => {
    const m = mapRef.current; if (!m) return;
    m.easeTo({ zoom: Math.max(ZOOM_MIN, m.getZoom() - ZOOM_STEP), duration: 250 });
  };
  const handleZoomReset = () => {
    const m = mapRef.current; if (!m) return;
    m.easeTo({ zoom: ZOOM_DEFAULT, duration: 350 });
  };
  const setZoomFromPointer = (clientY: number, trackEl: HTMLElement) => {
    const m = mapRef.current; if (!m) return;
    const rect = trackEl.getBoundingClientRect();
    const tt = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    // Top of track = max zoom (closest), bottom = min zoom.
    const z = ZOOM_MAX - tt * (ZOOM_MAX - ZOOM_MIN);
    m.setZoom(z);
  };
  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setZoomFromPointer(e.clientY, e.currentTarget);
  };
  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setZoomFromPointer(e.clientY, e.currentTarget);
  };
  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const zoomPct = (zoomDisplay - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);

  // ── Hover card positioning ─────────────────────────────────────────────────
  const getCardPos = (x: number, y: number) => {
    const CW = 280, CH = 355, PAD = 20, GAP = 36;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (isTouchDevice) {
      let left = x - CW / 2;
      let top = y - CH - GAP;
      if (left < PAD) left = PAD;
      if (left + CW > vw - PAD) left = vw - CW - PAD;
      if (top < PAD) top = PAD;
      return { left, top };
    }
    let left = x + 20, top = y - CH / 2;
    if (left + CW > vw - PAD) left = x - CW - 20;
    if (top < PAD) top = PAD;
    if (top + CH > vh - PAD) top = vh - CH - PAD;
    return { left, top };
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Zoom Controls */}
      <div className="absolute bottom-42 right-4 z-[1100] hidden md:flex flex-col items-center gap-1" style={{ userSelect: 'none' }}>
        <button onClick={handleZoomIn} title="Zoom in"
          style={{ width: 30, height: 30, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)')}>+</button>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 7, margin: '3px 0' }}>
          <div style={{ position: 'relative', height: 120, width: 26, fontSize: '0.45rem', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}>
            {[ZOOM_MIN, 5, 10, ZOOM_MAX].map((z) => {
              const pct = (z - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
              return (
                <div key={z} style={{ position: 'absolute', right: 0, bottom: `calc(${pct * 100}% - 4px)`, lineHeight: 1, textAlign: 'right' }}>
                  {z.toFixed(1)}
                </div>
              );
            })}
          </div>

          <div
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            title={`zoom ${zoomDisplay.toFixed(2)}`}
            style={{ position: 'relative', width: 6, height: 120, borderRadius: 3, cursor: 'pointer', touchAction: 'none', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.25)' }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: `${(1 - zoomPct) * 100}%`, background: 'rgba(120,200,255,0.35)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: `calc(${zoomPct * 100}% - 4px)`, width: 10, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 4px rgba(0,0,0,0.55)', transition: 'bottom 0.12s', pointerEvents: 'none' }} />
          </div>

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

            </div>
          </div>
        </div>
      )}

      {/* City-scale hint — visible only when very zoomed in */}
      {zoomDisplay > CITY_ZOOM - 0.5 && (
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
