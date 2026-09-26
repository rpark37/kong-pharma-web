/**
 * The arithmetic behind the God's Eye View page, kept apart from three.js so it stays testable:
 * moving a snapshot forward in time, picking the contacts near a point, and the sensor ramps.
 *
 * Geometry helpers are NOT redefined here — `../map/sites.ts` already carries `distanceKm`,
 * `bearing`, `project` and `formatCoord`, and they take any `LatLon`.
 */
import { type LatLon, distanceKm } from '../map/sites';

const EARTH_KM = 6371;
const KM_PER_KNOT_SECOND = 1.852 / 3600;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** One aircraft as captured: altitude in feet, heading in degrees true, speed in knots. */
export interface Flight extends LatLon {
  id: string;
  alt: number;
  hdg: number;
  spd: number;
  type: string;
}

export interface Quake extends LatLon {
  mag: number;
  depth: number;
  time: number;
}

/**
 * Orbital elements reduced from a TLE at capture time. Only the terms a circular orbit needs
 * survive; `capture-gev-snapshot.mjs` does the parsing so the browser never sees a TLE.
 *
 * ponytail: circular orbit — no eccentricity, no J2 nodal regression, no drag. Real LEO recon
 * orbits run e≈0.001, so at globe scale this is indistinguishable from SGP4 over a session and it
 * saves a 650 kB dependency. Swap in satellite.js only if a true pass prediction is ever needed.
 */
export interface Sat {
  name: string;
  /** Degrees. */
  inc: number;
  raan: number;
  /** Mean anomaly at epoch, degrees. */
  ma: number;
  revsPerDay: number;
  altKm: number;
  /** Epoch, ms since the Unix epoch. */
  epoch: number;
}

export interface Snapshot {
  captured: number;
  craft: Flight[];
  sats: Sat[];
  quakes: Quake[];
}

/** Wrap a longitude into [-180, 180). A track crossing the antimeridian must not run off to 540°. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Advance a contact along its great circle by `dt` seconds — the dead reckoning that keeps a
 * frozen snapshot moving. Standard destination-point formula; `asin` is fed a clamped argument so
 * floating-point drift near a pole cannot produce NaN.
 */
export function deadReckon(craft: Flight, dt: number): Flight {
  if (dt === 0 || craft.spd === 0) return craft;
  const delta = (craft.spd * KM_PER_KNOT_SECOND * dt) / EARTH_KM;
  const lat1 = craft.lat * RAD;
  const lon1 = craft.lon * RAD;
  const hdg = craft.hdg * RAD;
  const sinLat = Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(hdg);
  const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat)));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(hdg) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { ...craft, lat: lat2 * DEG, lon: wrapLon(lon2 * DEG) };
}

export interface Contact {
  craft: Flight;
  km: number;
}

/**
 * The CONTACTS rail: everything within `radiusKm` of a point, nearest first. GEV lists a 250 km
 * window, which is roughly what an airliner covers in twenty minutes.
 */
export function nearbyContacts(origin: LatLon, craft: Flight[], radiusKm = 250, limit = 12): Contact[] {
  return craft
    .map((c) => ({ craft: c, km: distanceKm(origin, c) }))
    .filter((c) => c.km <= radiusKm)
    .sort((a, b) => a.km - b.km || a.craft.id.localeCompare(b.craft.id))
    .slice(0, limit);
}

const J2000 = Date.UTC(2000, 0, 1, 12);
const EARTH_RADIUS_KM = 6371;

/** Greenwich mean sidereal time in degrees — what turns an inertial position into a ground track. */
export function gmst(atMs: number): number {
  const days = (atMs - J2000) / 86400000;
  return (((280.46061837 + 360.98564736629 * days) % 360) + 360) % 360;
}

/**
 * Where a satellite is at `atMs`, as a sub-point on the globe. Circular orbit: mean anomaly is
 * taken as the true anomaly, which is exact for e = 0 and within a pixel for the near-circular
 * orbits this page plots.
 */
export function satelliteAt(sat: Sat, atMs: number): LatLon & { altKm: number } {
  const days = (atMs - sat.epoch) / 86400000;
  const u = (sat.ma + sat.revsPerDay * 360 * days) * RAD;
  const raan = sat.raan * RAD;
  const inc = sat.inc * RAD;
  const x = Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(inc);
  const y = Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(inc);
  const z = Math.sin(u) * Math.sin(inc);
  return {
    lat: Math.asin(Math.min(1, Math.max(-1, z))) * DEG,
    lon: wrapLon(Math.atan2(y, x) * DEG - gmst(atMs)),
    altKm: sat.altKm,
  };
}

/** Mean motion in revolutions per day → circular orbit altitude in km. */
export function altitudeFromMeanMotion(revsPerDay: number): number {
  const MU = 398600.4418;
  const n = (revsPerDay * 2 * Math.PI) / 86400;
  return Math.cbrt(MU / (n * n)) - EARTH_RADIUS_KM;
}

/** The subset of a TopoJSON topology this page reads. */
export interface Topology {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: Array<Array<[number, number]>>;
}

/**
 * Quantized TopoJSON arcs → absolute [lon, lat] rings.
 *
 * Drawing coastlines as *lines* rather than filled land is what makes this eight lines instead of
 * a dependency: the negative-index reversal and ring-stitching that `topojson-client` exists for
 * only matter when assembling polygons. Every arc drawn also yields country borders for free.
 */
export function decodeArcs(topo: Topology): Array<Array<[number, number]>> {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as [number, number];
    });
  });
}

export type SensorMode = 'normal' | 'nvg' | 'flir' | 'crt';

export interface SensorSpec {
  id: SensorMode;
  label: string;
  /** How far to blend the source frame toward the ramp: 0 keeps the teal palette untouched. */
  lut: number;
  scan: number;
}

export const SENSORS: SensorSpec[] = [
  { id: 'normal', label: 'NORMAL', lut: 0, scan: 0 },
  { id: 'crt', label: 'CRT', lut: 0, scan: 1 },
  { id: 'nvg', label: 'NVG', lut: 1, scan: 0.25 },
  { id: 'flir', label: 'FLIR', lut: 1, scan: 0 },
];

type Stop = readonly [number, number, number, number];

/** Phosphor: black through two greens to a blown-out white-green highlight. */
const NVG_STOPS: Stop[] = [
  [0, 0, 0, 0],
  [0.25, 0.02, 0.18, 0.06],
  [0.7, 0.18, 0.95, 0.35],
  [1, 0.82, 1, 0.85],
];

/** Ironbow, the standard thermal ramp: black, purple, red, orange, yellow, white. */
const FLIR_STOPS: Stop[] = [
  [0, 0, 0, 0.05],
  [0.22, 0.24, 0.02, 0.38],
  [0.45, 0.72, 0.09, 0.2],
  [0.66, 0.95, 0.4, 0.02],
  [0.85, 1, 0.82, 0.12],
  [1, 1, 1, 0.95],
];

/**
 * Sample a sensor ramp at a luminance in [0, 1]. The scene bakes this into a 256-pixel LUT
 * texture, so this function is the single source of truth for the ramps and the shader merely
 * samples it — no ramp is ever written twice, once here and once in GLSL.
 */
export function gradeLut(mode: SensorMode, l: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, l));
  const stops = mode === 'nvg' ? NVG_STOPS : mode === 'flir' ? FLIR_STOPS : null;
  if (!stops) return [x, x, x];
  for (let i = 1; i < stops.length; i++) {
    const [p1, r1, g1, b1] = stops[i];
    if (x > p1 && i < stops.length - 1) continue;
    const [p0, r0, g0, b0] = stops[i - 1];
    const t = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
    return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t];
  }
  return [x, x, x];
}

/**
 * The ramp as three `tableValues` strings for an SVG `<feComponentTransfer>`.
 *
 * This is why the sensor modes are a CSS `filter: url(#…)` and not a WebGL post pass: an SVG
 * filter grades the composited canvas *and* any DOM chrome in one declaration, with no render
 * target, while `feFuncR/G/B` carries an arbitrary lookup table — so the real multi-hue ironbow
 * ramp survives, which `hue-rotate()` could never express. `gradeLut` above stays the only place
 * a ramp is written down.
 */
export function lutTable(mode: SensorMode, samples = 17): [string, string, string] {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < samples; i++) {
    const [cr, cg, cb] = gradeLut(mode, i / (samples - 1));
    r.push(cr);
    g.push(cg);
    b.push(cb);
  }
  const fmt = (v: number[]) => v.map((n) => n.toFixed(3)).join(' ');
  return [fmt(r), fmt(g), fmt(b)];
}
