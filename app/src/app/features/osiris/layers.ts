/**
 * The framework-free core of the OSIRIS board: what a layer is, how each snapshot row becomes a
 * mark on the map, and how a pointer finds the nearest one. `osiris-scene.ts` paints these;
 * nothing here touches a canvas or the DOM, so it is all unit-tested.
 */
import { type Flight, type Quake, type Sat, deadReckon, satelliteAt } from '../gev/tracks';
import { type LatLon, formatCoord } from '../map/sites';
import { PALETTE } from '../../shared/fui/fui-panels';
import { CONFLICT_ZONES, SEVERITY_COLOR } from './conflict-zones';
import { NEWS_FEEDS, embedUrl, externalUrl } from './news-feeds';

export type LayerId = 'craft' | 'sats' | 'quakes' | 'fires' | 'events' | 'news' | 'zones';

export interface LayerMeta {
  id: LayerId;
  label: string;
  color: string;
  glyph: 'dot' | 'ring' | 'square' | 'diamond';
  /** Named marks are listed in the rail; mass layers (fires, craft, sats) are only hit-testable. */
  named: boolean;
  /** Moving layers are re-reckoned every frame from the tracks snapshot; the rest are painted once. */
  moving: boolean;
  defaultOn: boolean;
}

/** Draw order: dense, dim layers first so the sparse named ones sit on top. */
export const LAYERS: LayerMeta[] = [
  { id: 'fires', label: 'Fires', color: '#f2884e', glyph: 'dot', named: false, moving: false, defaultOn: true },
  { id: 'events', label: 'NASA events', color: PALETTE.amber, glyph: 'diamond', named: true, moving: false, defaultOn: false },
  { id: 'quakes', label: 'Earthquakes', color: PALETTE.rose, glyph: 'ring', named: false, moving: false, defaultOn: true },
  { id: 'zones', label: 'Conflict zones', color: PALETTE.rose, glyph: 'square', named: true, moving: false, defaultOn: true },
  { id: 'news', label: 'News bureaus', color: PALETTE.teal, glyph: 'square', named: true, moving: false, defaultOn: false },
  { id: 'sats', label: 'Satellites', color: PALETTE.text, glyph: 'dot', named: false, moving: true, defaultOn: false },
  { id: 'craft', label: 'Aircraft', color: PALETTE.amber, glyph: 'dot', named: false, moving: true, defaultOn: true },
];

export const DEFAULT_ON: Set<LayerId> = new Set(LAYERS.filter((l) => l.defaultOn).map((l) => l.id));

/** Reference-space chrome margins (900 px tall frame): header above, footer below, the right column for the DOM rail. */
export const MAP = { left: 48, top: 110, right: 360, bottom: 96 } as const;

/**
 * The rectangle the map is fitted into, in stage px, for a stage of `w` × `h` CSS px. Chrome is
 * laid out against a 900-high reference frame, so margins scale with `h / 900` — but on a stage
 * narrower than 6:5 the reserved right column would eat the whole width, so there the rail
 * overlays the map (its CSS already gives it a backdrop below 17:10) and the scale is floored on
 * the width so the painted chrome cannot outgrow the stage.
 */
export function mapExtent(w: number, h: number): { scale: number; portrait: boolean; extent: [[number, number], [number, number]] } {
  const portrait = w / h < 1.2;
  const scale = Math.min(h, w) / 900;
  const right = portrait ? MAP.left : MAP.right;
  return {
    scale,
    portrait,
    extent: [
      [MAP.left * scale, MAP.top * scale],
      [w - right * scale, h - MAP.bottom * scale],
    ],
  };
}

/** Wall-clock speed would take ten minutes to visibly move an airliner; 60x keeps the board alive (same as gev). */
export const REPLAY = 60;

export interface Mark extends LatLon {
  layer: LayerId;
  id: string;
  label: string;
  /** Detail rows, uppercase mono, as the painted callout and the DOM detail panel show them. */
  lines: string[];
  url?: string;
  /** iframe src for an embeddable news stream. */
  embed?: string;
  /** Radius in CSS px at the reference 900 px stage height. */
  size: number;
  /** Per-mark override of the layer colour (conflict severity). */
  color?: string;
}

export interface Fire extends LatLon {
  frp: number;
  conf: number;
  day: boolean;
}

export interface EonetEvent extends LatLon {
  id: string;
  title: string;
  cat: string;
  date: string;
  url?: string;
}

export interface Hazards {
  captured: number;
  fires: Fire[];
  events: EonetEvent[];
}

const HDG = (h: number) => String(Math.round(h)).padStart(3, '0');

export function marksFromCraft(craft: Flight[], elapsedSec: number): Mark[] {
  const dt = elapsedSec * REPLAY;
  return craft.map((c0) => {
    const c = deadReckon(c0, dt);
    return {
      layer: 'craft',
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      label: c.id,
      lines: [`${c.type} · ${c.alt.toLocaleString('en-US')} FT · ${c.spd} KTS`, `HDG ${HDG(c.hdg)}`, formatCoord(c)],
      size: 1.6,
    };
  });
}

export function marksFromSats(sats: Sat[], captured: number, elapsedSec: number): Mark[] {
  const at = captured + elapsedSec * REPLAY * 1000;
  return sats.map((s) => {
    const p = satelliteAt(s, at);
    return {
      layer: 'sats',
      id: s.name,
      lat: p.lat,
      lon: p.lon,
      label: s.name,
      lines: [`ALT ${s.altKm} KM · INC ${s.inc.toFixed(1)}°`, formatCoord(p)],
      size: 1.4,
    };
  });
}

export function marksFromQuakes(quakes: Quake[]): Mark[] {
  return quakes.map((q, i) => ({
    layer: 'quakes',
    id: `q${i}`,
    lat: q.lat,
    lon: q.lon,
    label: `M${q.mag.toFixed(1)}`,
    lines: [`DEPTH ${q.depth} KM`, new Date(q.time).toISOString().slice(0, 16).replace('T', ' ') + 'Z', formatCoord(q)],
    size: 2 + Math.max(0, q.mag - 2.5) * 1.6,
  }));
}

export function marksFromFires(fires: Fire[]): Mark[] {
  return fires.map((f, i) => ({
    layer: 'fires',
    id: `f${i}`,
    lat: f.lat,
    lon: f.lon,
    label: `FRP ${f.frp.toFixed(1)}`,
    lines: [`CONF ${f.conf}% · ${f.day ? 'DAY' : 'NIGHT'}`, formatCoord(f)],
    size: 1.2 + Math.min(3, f.frp / 100),
  }));
}

export function marksFromEvents(events: EonetEvent[]): Mark[] {
  return events.map((e) => ({
    layer: 'events',
    id: e.id,
    lat: e.lat,
    lon: e.lon,
    label: e.title,
    lines: [e.cat.replace(/([A-Z])/g, ' $1').toUpperCase().trim(), e.date.slice(0, 10), formatCoord(e)],
    url: e.url,
    size: 3.5,
  }));
}

export function marksFromFeeds(): Mark[] {
  return NEWS_FEEDS.map((f) => ({
    layer: 'news',
    id: f.id,
    lat: f.lat,
    lon: f.lon,
    label: f.name,
    lines: [`${f.city.toUpperCase()} · ${f.country.toUpperCase()}`, f.embed ? 'LIVE · EMBEDDED' : 'LIVE · EXTERNAL'],
    url: externalUrl(f),
    embed: embedUrl(f) ?? undefined,
    size: 3,
  }));
}

export function marksFromZones(): Mark[] {
  return CONFLICT_ZONES.map((z) => ({
    layer: 'zones',
    id: z.id,
    lat: z.lat,
    lon: z.lon,
    label: z.label,
    lines: [z.severity.toUpperCase(), z.description.toUpperCase(), formatCoord(z)],
    url: z.sourceUrl,
    size: 4,
    color: SEVERITY_COLOR[z.severity],
  }));
}

/** The closest projected point within `radius` px, or null; ties keep list order. */
export function nearest<T extends { x: number; y: number }>(pts: T[], x: number, y: number, radius: number): T | null {
  let best: T | null = null;
  let bestD = radius * radius;
  for (const p of pts) {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
