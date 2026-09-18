/**
 * The trial-site network. Same coordinates the marketing globe plots (`/globe.js`, SITES) — the
 * root site has no build step, so the two cannot share a module and this is a deliberate copy.
 * Keep them in step if a site moves.
 */
export interface Site {
  code: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  enrolled: number;
}

export const ORIGIN: Site = { code: 'HQ-01', name: 'LOWELL', place: 'Lowell, MA', lat: 42.6334, lon: -71.3162, enrolled: 0 };

export const SITES: Site[] = [
  { code: 'US-114', name: 'BOSTON', place: 'XtalPi demo lab', lat: 42.3601, lon: -71.0589, enrolled: 128 },
  { code: 'US-207', name: 'LAHEY', place: 'Burlington, MA', lat: 42.5048, lon: -71.1956, enrolled: 96 },
  { code: 'US-311', name: 'UMASS', place: 'Chan Medical School', lat: 42.2762, lon: -71.7612, enrolled: 74 },
  { code: 'US-402', name: 'EXETER', place: 'Green Campsites', lat: 42.9814, lon: -70.9478, enrolled: 41 },
  { code: 'CN-018', name: 'SHANGHAI', place: 'Shanghai', lat: 31.2304, lon: 121.4737, enrolled: 212 },
  { code: 'CN-042', name: 'SHENZHEN', place: 'XtalPi', lat: 22.5431, lon: 114.0579, enrolled: 187 },
  { code: 'HK-007', name: 'HONG KONG', place: 'Hong Kong', lat: 22.3193, lon: 114.1694, enrolled: 63 },
  { code: 'AU-021', name: 'BRISBANE', place: 'Brisbane', lat: -27.4698, lon: 153.0251, enrolled: 58 },
  { code: 'AU-033', name: 'SYDNEY', place: 'Novotech', lat: -33.8688, lon: 151.2093, enrolled: 91 },
];

/** Equirectangular projection into plane coordinates, x/z in [-1, 1]. */
export function project(site: Site): { x: number; z: number } {
  return { x: site.lon / 180, z: -site.lat / 90 };
}

export function bearing(a: Site, b: Site): number {
  const pa = project(a);
  const pb = project(b);
  return Math.atan2(pb.z - pa.z, pb.x - pa.x);
}

/** Great-circle distance, km. */
export function distanceKm(a: Site, b: Site): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function formatCoord(site: Site): string {
  const ns = site.lat >= 0 ? 'N' : 'S';
  const ew = site.lon >= 0 ? 'E' : 'W';
  const d = (v: number) => {
    const a = Math.abs(v);
    const deg = Math.floor(a);
    const min = Math.floor((a - deg) * 60);
    const sec = Math.round((((a - deg) * 60) - min) * 60);
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
  };
  return `${d(site.lat)} ${ns}  ${d(site.lon)} ${ew}`;
}
