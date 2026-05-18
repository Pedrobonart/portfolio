// ─────────────────────────────────────────────────────────────────────────────
// Globe3D.tsx
//
// Renders an interactive 3-D globe using MapLibre GL JS in "globe" projection.
// Vector tiles are loaded from external tile servers (MapTiler / OpenFreeMap).
// Portfolio projects are drawn as native GL circle layers so they sit firmly
// on the sphere surface, occlude on the back side, and rotate with the globe.
//
// High-level structure:
//   1. Constants & types
//   2. Slot / cluster helpers  (run once at module load)
//   3. Globe3D component
//      a. Map initialisation
//      b. Auto-rotation
//      c. Pin layers & event handlers
//      d. Theme hot-swap
//      e. Zoom-control handlers
//      f. JSX
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { projects, Project } from '../data/projects';
import { useLanguage } from '../context/LanguageContext';
import { pickL } from '../utils/project';

interface Globe3DProps {
  isDark: boolean;
}

// ── 1. Map style URLs ─────────────────────────────────────────────────────────
// Light: custom JSON served from /public/styles/. BASE_URL prefix handles the
//   /portfolio/ sub-path on GitHub Pages (dev = '/', prod = '/portfolio/').
// Dark: hosted OpenFreeMap fallback until a matching dark JSON is ready.
// Both styles are local JSONs in /public/styles/, served at BASE_URL + styles/.
const LIGHT_STYLE = `${import.meta.env.BASE_URL}styles/globe-light.json`;
const DARK_STYLE  = `${import.meta.env.BASE_URL}styles/globe-dark.json`;

// ── 2a. Types ─────────────────────────────────────────────────────────────────

// A single pin position on the globe. A project can have multiple slots when
// it has extra locations (p.extraLocations), each with its own coordinates.
interface ProjectSlot {
  project: Project;
  coordinates: [number, number]; // [lat, lng]
  label?: string;                // shown in the preview card for extra locations
}

// A slot after cluster-spreading: lat/lng may have shifted slightly so pins
// don't visually overlap, but clusterCenter records the original geographic
// centroid so fly-to targets the right place.
interface PlacedSlot {
  project: Project;
  label?: string;
  lat: number;
  lng: number;
  clusterCenter: [number, number]; // [lat, lng] — fly-to target
}

// What the hover/preview card needs to know.
interface HoverState {
  project: Project;
  label?: string;
  x: number; // cursor X in viewport px (used to position the card)
  y: number; // cursor Y in viewport px
  clusterCenter: [number, number];
}

// ── 2b. Slot expansion ────────────────────────────────────────────────────────
// Flatten each project (which may have a main location + extra locations)
// into a flat list of individual pin slots.
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

// ── 2c. Cluster detection + force-directed pin spreading ──────────────────────
// Pins that are within CLUSTER_DIST degrees of each other belong to the same
// cluster. Their clusterCenter is the mean of all cluster members' coordinates
// (used as the fly-to target when a pin is tapped).
//
// After clustering, a simple force-directed simulation pushes any pair of pins
// that are closer than MIN_PUSH degrees apart, so they don't visually overlap
// at globe zoom.
const CLUSTER_DIST = 0.8; // degrees — below this, pins are considered co-located

function buildPlacedSlots(slots: ProjectSlot[]): PlacedSlot[] {
  // — Step 1: group pins that are within CLUSTER_DIST of each other
  const n = slots.length;
  const used = new Array(n).fill(false);
  const groups: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const g = [i];
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const [la, lo]   = slots[i].coordinates;
      const [lb, lob]  = slots[j].coordinates;
      if (Math.hypot(lb - la, lob - lo) < CLUSTER_DIST) {
        g.push(j);
        used[j] = true;
      }
    }
    groups.push(g);
  }

  // — Step 2: compute each cluster's geographic centroid (fly-to target)
  const result: PlacedSlot[] = [];
  for (const g of groups) {
    const clat = g.reduce((s, i) => s + slots[i].coordinates[0], 0) / g.length;
    const clng = g.reduce((s, i) => s + slots[i].coordinates[1], 0) / g.length;
    const clusterCenter: [number, number] = [clat, clng];
    g.forEach((idx) => {
      const s = slots[idx];
      result.push({ project: s.project, label: s.label, lat: s.coordinates[0], lng: s.coordinates[1], clusterCenter });
    });
  }

  // — Step 3: iterative force repulsion so overlapping pins spread apart visually
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
    if (!anyMoved) break; // converged early
  }
  return result;
}

// Run once at module load — result is stable for the lifetime of the page.
const placedSlots = buildPlacedSlots(expandToSlots(projects));

// ── 2d. Zoom constants ────────────────────────────────────────────────────────
// MapLibre uses a logarithmic zoom scale: 0 = whole world, ~10 = city block.
const ZOOM_MIN             = 1;    // minimum allowed zoom (globe fills roughly the viewport)
const ZOOM_MAX             = 15;   // maximum zoom (street-level detail)
const ZOOM_DEFAULT         = 1.1;  // initial zoom on load
const CITY_ZOOM            = 6;    // zoom used when flying to a pin cluster
const ZOOM_STEP            = 0.5;  // increment per +/− button press
const AUTO_ROTATE_BELOW_ZOOM = 3.5; // auto-rotation only active below this zoom

// ── 2e. Pin colour palette ────────────────────────────────────────────────────
// Two project types, two themes — colours are injected into the GL paint
// expressions inside setupLayers() after each style load.
const ARCH_LIGHT  = '#c07830', ARCH_DARK  = '#8a5424'; // architecture pins
const CARTO_LIGHT = '#2a6e9a', CARTO_DARK = '#1f4f70'; // cartography pins

// ═════════════════════════════════════════════════════════════════════════════
// 3. Component
// ═════════════════════════════════════════════════════════════════════════════
export function Globe3D({ isDark }: Globe3DProps) {
  // containerRef is the plain <div> that MapLibre mounts into.
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate     = useNavigate();
  const { t, language } = useLanguage();

  // hoverState drives the preview card; null means no card is shown.
  const [hoverState, setHoverState]   = useState<HoverState | null>(null);
  // zoomDisplay mirrors map.getZoom() so the slider thumb re-renders live.
  const [zoomDisplay, setZoomDisplay] = useState(ZOOM_DEFAULT);

  // mapRef lets the zoom-button handlers (outside the init effect) call the map.
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Detect touch-only devices once. On touch: first tap opens preview, second
  // tap navigates. On pointer: hover shows preview, click navigates directly.
  const [isTouchDevice] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches,
  );

  // lastTappedRef remembers which project the user tapped last so a second tap
  // on the same pin navigates instead of re-opening the same preview.
  const lastTappedRef = useRef<Project | null>(null);

  // isDarkRef lets the pin-click handler (inside the init effect's closure)
  // read the current theme without the effect needing to re-run on every toggle.
  const isDarkRef = useRef(isDark);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  // ── 3a. Map initialisation ──────────────────────────────────────────────────
  // Runs once on mount. Sets up the MapLibre instance, auto-rotation, pin
  // layers, and all event listeners. Returns a cleanup function.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const map = new maplibregl.Map({
      container,
      style:   isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
      center:  [10, 25],  // [lng, lat] — centred on Europe/Africa at startup
      zoom:    ZOOM_DEFAULT,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Expose the map instance on window for browser-console debugging.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__map = map;

    // Force globe projection after every style load.
    // The loaded style JSON can specify its own projection and override the
    // constructor option, so we re-apply after each style.load event instead.
    const applyGlobe = () => {
      // setProjection is available in MapLibre GL JS v4+.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection?.({ type: 'globe' });
    };
    map.on('style.load', applyGlobe);

    // Keep zoomDisplay in sync so the slider thumb moves as the user scrolls.
    map.on('zoom', () => setZoomDisplay(map.getZoom()));

    // ── 3b. Auto-rotation ────────────────────────────────────────────────────
    // A requestAnimationFrame loop nudges the globe longitude every frame when
    // the user has been idle for >1.5 s, the zoom is low enough, and the mouse
    // is not over the globe sphere.
    let lastInteraction = performance.now();
    let mouseOverGlobe  = false;

    // Any user gesture resets the idle timer.
    const bumpInteraction = () => { lastInteraction = performance.now(); };
    map.on('mousedown', bumpInteraction);
    map.on('touchstart', bumpInteraction);
    map.on('wheel',      bumpInteraction);
    // movestart fires for both programmatic and user-initiated moves; only bump
    // for user gestures (those carry an originalEvent).
    map.on('movestart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) bumpInteraction(); });

    // Detect whether the cursor is over the visible globe sphere (not just the
    // full-screen canvas). map.getCanvasContainer() is the inner div MapLibre
    // creates; its CSS height is 0 (the <canvas> inside it is absolutely
    // positioned), so we cannot use min(w,h)/2. Instead we project a point at
    // the equatorial horizon (89° from the current center longitude) — its
    // screen-x distance from the projected center gives the true pixel radius.
    const canvasEl = map.getCanvasContainer();
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect(); // top/left are 0 (full-page canvas)
      const c    = map.getCenter();
      const cp   = map.project(c as maplibregl.LngLat);          // globe center in canvas px
      const ep   = map.project(new maplibregl.LngLat(c.lng + 89, 0)); // equatorial horizon
      const globeR = Math.hypot(ep.x - cp.x, ep.y - cp.y);       // sphere radius in px
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseOverGlobe = Math.hypot(mx - cp.x, my - cp.y) <= globeR;
    };
    // Reset when the cursor leaves the canvas entirely (e.g. moves to a
    // different browser window), so rotation resumes immediately.
    const onCanvasLeave = () => { mouseOverGlobe = false; };
    canvasEl.addEventListener('mousemove', onMouseMove);
    canvasEl.addEventListener('mouseleave', onCanvasLeave);

    let rafId = 0;
    const tick = () => {
      const idleFor = performance.now() - lastInteraction;
      const blocked = mouseOverGlobe;
      if (
        !blocked &&
        idleFor > 1500 &&                           // user has been idle ≥1.5 s
        map.getZoom() < AUTO_ROTATE_BELOW_ZOOM &&   // not zoomed in too far
        !map.isMoving()                             // no fly-to / ease in progress
      ) {
        const c = map.getCenter();
        map.setCenter([c.lng + 0.06, c.lat]); // nudge east by 0.06° per frame
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // ── 3c. GeoJSON source + GL circle layers ────────────────────────────────
    // Each pin is a GeoJSON Feature with a numeric id (used for feature-state).
    // Two stacked circle layers per pin:
    //   • pins-base  — large translucent disk, pitch-aligned to the map surface
    //                  so it lies flat on the globe like a shadow/halo.
    //   • pins-dot   — small opaque dot, viewport-aligned (always faces camera)
    //                  giving a 3-D "standing pin" feel.
    // Both layers use a MapLibre expression to switch colour by project type,
    // and feature-state 'hover' to grow the radius on mouseover.
    const features = placedSlots.map((p, i) => ({
      type:       'Feature' as const,
      id:         i,   // integer id required for setFeatureState
      properties: { type: p.project.type, slotIndex: i },
      geometry:   { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    }));

    // hoveredFeatureId tracks which pin currently has the hover state so we
    // can clear it before highlighting a new one.
    let hoveredFeatureId: number | null = null;

    const setupLayers = () => {
      const dark       = isDarkRef.current;
      const archColor  = dark ? ARCH_DARK  : ARCH_LIGHT;
      const cartoColor = dark ? CARTO_DARK : CARTO_LIGHT;

      // GL expression: pick colour based on the feature's 'type' property.
      const colorExpr: maplibregl.ExpressionSpecification = [
        'match', ['get', 'type'], 'architecture', archColor, cartoColor,
      ];

      // Guard against duplicate sources/layers on re-entry (style.load fires
      // again after setStyle for the theme swap).
      if (!map.getSource('pins')) {
        map.addSource('pins', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });
      }

      if (!map.getLayer('pins-base')) {
        map.addLayer({
          id:     'pins-base',
          type:   'circle',
          source: 'pins',
          paint: {
            // Grows from 13 → 18 px radius on hover.
            'circle-radius':  ['case', ['boolean', ['feature-state', 'hover'], false], 18, 13],
            'circle-color':   colorExpr,
            'circle-opacity': 0.32,
            // 'map' alignment pins the disk to the globe surface (rotates with it).
            'circle-pitch-alignment': 'map',
            'circle-stroke-width':   1,
            'circle-stroke-color':   colorExpr,
            'circle-stroke-opacity': 0.55,
          },
        });
      }

      if (!map.getLayer('pins-dot')) {
        map.addLayer({
          id:     'pins-dot',
          type:   'circle',
          source: 'pins',
          paint: {
            // Grows from 6 → 8 px on hover.
            'circle-radius':        ['case', ['boolean', ['feature-state', 'hover'], false], 8, 6],
            'circle-color':         colorExpr,
            'circle-stroke-color':  '#ffffff',
            'circle-stroke-width':  2,
            'circle-stroke-opacity': 0.92,
            // Default 'viewport' alignment keeps the dot facing the camera.
          },
        });
      }
    };

    // ── Pin event handlers ───────────────────────────────────────────────────

    // Desktop: hover over pins-dot shows the preview card and highlights the pin.
    const onPinEnter = (e: maplibregl.MapLayerMouseEvent) => {
      if (isTouchDevice) return;
      const f = e.features?.[0];
      if (!f) return;
      const idx    = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];
      map.getCanvas().style.cursor = 'pointer';
      // Clear the previous hover state before setting the new one.
      if (hoveredFeatureId !== null && hoveredFeatureId !== idx) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
      }
      hoveredFeatureId = idx;
      map.setFeatureState({ source: 'pins', id: idx }, { hover: true });
      setHoverState({
        project: placed.project,
        label:   placed.label,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        clusterCenter: placed.clusterCenter,
      });
    };

    // Desktop: keep the card anchored to the cursor as the mouse moves.
    const onPinMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (isTouchDevice) return;
      setHoverState((prev) =>
        prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : prev,
      );
    };

    // Desktop: leaving the pin closes the preview and removes the highlight.
    const onPinLeave = () => {
      if (isTouchDevice) return;
      map.getCanvas().style.cursor = '';
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        hoveredFeatureId = null;
      }
      setHoverState(null);
    };

    // Click / tap handler — behaviour differs by device:
    //   Desktop : navigate directly to the project page.
    //   Touch   : first tap opens preview (+ flies to cluster); second tap navigates.
    const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
      // Prevent the map-wide click listener below from immediately closing the card.
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;
      const idx    = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];

      if (isTouchDevice) {
        // Second tap on the same pin → navigate.
        if (lastTappedRef.current === placed.project) return;
        // First tap → highlight pin, fly to cluster center, show card at screen center.
        if (hoveredFeatureId !== null && hoveredFeatureId !== idx) {
          map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        }
        hoveredFeatureId = idx;
        map.setFeatureState({ source: 'pins', id: idx }, { hover: true });
        lastTappedRef.current = placed.project;
        const [lat, lng] = placed.clusterCenter;
        map.flyTo({ center: [lng, lat], zoom: CITY_ZOOM, speed: 1.4, curve: 1.6 });
        // Position the card above the bottom quarter of the screen on mobile.
        const rect = container.getBoundingClientRect();
        setHoverState({
          project: placed.project,
          label:   placed.label,
          clusterCenter: placed.clusterCenter,
          x: rect.left + rect.width  / 2,
          y: rect.top  + rect.height * 0.75,
        });
      } else {
        navigate(`/projects/${placed.project.id}`);
      }
    };

    // Double-click flies to the cluster center without navigating.
    const onPinDblClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;
      const idx    = f.properties!.slotIndex as number;
      const placed = placedSlots[idx];
      const [lat, lng] = placed.clusterCenter;
      map.flyTo({ center: [lng, lat], zoom: CITY_ZOOM, speed: 1.4, curve: 1.6 });
    };

    // Wire pin events to the dot layer (the top-most, hittable layer).
    map.on('mouseenter', 'pins-dot', onPinEnter);
    map.on('mousemove',  'pins-dot', onPinMove);
    map.on('mouseleave', 'pins-dot', onPinLeave);
    map.on('click',      'pins-dot', onPinClick);
    map.on('dblclick',   'pins-dot', onPinDblClick);

    // Clicking anywhere on the map that isn't a pin closes the preview.
    // Pin clicks call e.preventDefault() so this handler sees defaultPrevented=true
    // and skips, avoiding a race condition where the card opens and closes at once.
    map.on('click', (e) => {
      if (e.defaultPrevented) return;
      lastTappedRef.current = null;
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'pins', id: hoveredFeatureId }, { hover: false });
        hoveredFeatureId = null;
      }
      setHoverState(null);
    });

    // style.load fires on initial load AND after every setStyle (theme swap).
    // Re-applying globe projection + layers here ensures they survive theme changes.
    map.on('style.load', () => {
      applyGlobe();
      setupLayers();
      hoveredFeatureId = null; // reset stale hover after style reload
    });

    // Cleanup: cancel the animation loop and remove the MapLibre instance.
    return () => {
      cancelAnimationFrame(rafId);
      canvasEl.removeEventListener('mousemove', onMouseMove);
      canvasEl.removeEventListener('mouseleave', onCanvasLeave);
      map.remove();
      mapRef.current = null;
    };
    // navigate is stable; isDark is handled via isDarkRef to avoid re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── 3d. Theme hot-swap ──────────────────────────────────────────────────────
  // Calling setStyle replaces the entire style (tiles, colours, fonts). The
  // 'style.load' listener inside the init effect re-adds the pin layers and
  // re-applies the globe projection automatically after the new style loads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
  }, [isDark]);

  // ── 3e. Zoom-control handlers ───────────────────────────────────────────────

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

  // Convert a pointer Y position on the slider track to a zoom level and apply
  // it. Track top = ZOOM_MAX (most zoomed in), track bottom = ZOOM_MIN.
  const setZoomFromPointer = (clientY: number, trackEl: HTMLElement) => {
    const m = mapRef.current; if (!m) return;
    const rect = trackEl.getBoundingClientRect();
    const tt   = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    m.setZoom(ZOOM_MAX - tt * (ZOOM_MAX - ZOOM_MIN));
  };

  // Pointer capture ensures drag works even when the cursor leaves the narrow track.
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

  // zoomPct is 0 (min zoom) → 1 (max zoom), used to position the slider thumb.
  const zoomPct = (zoomDisplay - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);

  // ── 3f. Preview card positioning ────────────────────────────────────────────
  // On desktop the card appears next to the cursor; on touch it floats above
  // the bottom of the screen. Both paths clamp to viewport edges.
  const getCardPos = (x: number, y: number) => {
    const CW = 280, CH = 355, PAD = 20, GAP = 36;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (isTouchDevice) {
      let left = x - CW / 2;
      let top  = y - CH - GAP;
      if (left < PAD)            left = PAD;
      if (left + CW > vw - PAD)  left = vw - CW - PAD;
      if (top  < PAD)            top  = PAD;
      return { left, top };
    }
    let left = x + 20, top = y - CH / 2;
    if (left + CW > vw - PAD)  left = x - CW - 20;
    if (top  < PAD)            top  = PAD;
    if (top  + CH > vh - PAD)  top  = vh - CH - PAD;
    return { left, top };
  };

  // ── 3g. JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full">

      {/* MapLibre mounts the <canvas> and its container div into this element. */}
      <div ref={containerRef} className="h-full w-full" />

      {/* ── Zoom controls (desktop only) ─────────────────────────────────── */}
      <div className="absolute bottom-42 right-4 z-[1100] hidden md:flex flex-col items-center gap-1" style={{ userSelect: 'none' }}>

        <button onClick={handleZoomIn} title="Zoom in"
          style={{ width: 30, height: 30, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)')}>+</button>

        {/* Slider row: left labels | track | live zoom readout */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 7, margin: '3px 0' }}>

          {/* Fixed tick labels at ZOOM_MIN, 5, 10, ZOOM_MAX */}
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

          {/* Draggable track */}
          <div
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            title={`zoom ${zoomDisplay.toFixed(2)}`}
            style={{ position: 'relative', width: 6, height: 120, borderRadius: 3, cursor: 'pointer', touchAction: 'none', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.25)' }}
          >
            {/* Filled portion below the thumb */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: `${(1 - zoomPct) * 100}%`, background: 'rgba(120,200,255,0.35)', borderRadius: 2 }} />
            {/* Thumb handle */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: `calc(${zoomPct * 100}% - 4px)`, width: 10, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 4px rgba(0,0,0,0.55)', transition: 'bottom 0.12s', pointerEvents: 'none' }} />
          </div>

          {/* Live zoom value that tracks the thumb */}
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

      {/* ── Hover / tap preview card ──────────────────────────────────────── */}
      {/* On touch: pointer-events-auto so the card itself is tappable to navigate.
          On desktop: pointer-events-none so it doesn't interfere with the map. */}
      {hoverState && (
        <div
          className={`fixed z-[1500] ${isTouchDevice ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={getCardPos(hoverState.x, hoverState.y)}
          onClick={isTouchDevice ? () => navigate(`/projects/${hoverState.project.id}`) : undefined}
        >
          <div style={{ width: 280, background: 'var(--site-surface)', border: '1px solid var(--site-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', cursor: isTouchDevice ? 'pointer' : 'default' }}>
            <div style={{ height: 155, overflow: 'hidden' }}>
              <img src={hoverState.project.image} alt={pickL(hoverState.project.title, language)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-sans)', letterSpacing: '0.15em', textTransform: 'uppercase', color: hoverState.project.type === 'architecture' ? 'var(--site-arch)' : 'var(--site-carto)', fontWeight: 500 }}>
                  {hoverState.project.type === 'architecture' ? t.landing.arch : t.landing.carto}
                </span>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-sans)', color: 'var(--site-muted)' }}>{hoverState.project.year}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 400, lineHeight: 1.3, color: 'var(--site-text)', marginBottom: 4 }}>
                {pickL(hoverState.project.title, language)}
              </h3>
              {/* Extra-location sub-label (e.g. "London office" vs "Paris office") */}
              {hoverState.label && (
                <p style={{ fontSize: '0.6rem', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--site-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--site-muted)', flexShrink: 0 }} />
                  {hoverState.label}
                </p>
              )}
              <p style={{ fontSize: '0.7rem', fontFamily: 'var(--font-sans)', color: 'var(--site-muted)', marginBottom: 10 }}>
                {pickL(hoverState.project.location, language)}, {pickL(hoverState.project.country, language)}
              </p>
              <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-sans)', color: 'var(--site-text2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', marginBottom: 12 }}>
                {pickL(hoverState.project.shortDescription, language)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── City-scale usage hint ─────────────────────────────────────────── */}
      {/* Fades in once the user zooms past CITY_ZOOM to remind them of gestures. */}
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
