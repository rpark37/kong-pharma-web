/**
 * Capture one frame of the world for the /app/gev page.
 *
 * The page replays this offline — flights are dead-reckoned forward and satellites propagated from
 * their elements — so the only thing that has to be live is this script. Run it by hand when the
 * snapshot starts to look stale; nothing in the build depends on it.
 *
 *   node scripts/capture-gev-snapshot.mjs
 *
 * Sources: adsb.lol (flights, ODbL), Celestrak (elements), USGS (earthquakes). None need a key.
 * Celestrak sends no CORS header, which is why satellites are captured here rather than fetched by
 * the browser — and TLEs are reduced to plain elements here too, so the page needs no SGP4 library.
 *
 * Output is `public/data/gev/tracks.json`, NOT `public/data/snapshot/` — that directory means
 * "cached API routes" and is written by `api/scripts/snapshot_api.py`. This is page-owned data.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'gev');

/** Busy airspace, so the globe shows clusters rather than an even scatter. */
const HUBS = [
  [42.36, -71.06], // Boston
  [51.47, -0.45], // London
  [35.55, 139.78], // Tokyo
  [25.25, 55.36], // Dubai
  [33.94, -118.4], // Los Angeles
  [-33.94, 151.18], // Sydney
  [1.36, 103.99], // Singapore
  [-23.43, -46.47], // São Paulo
];

const MAX_CRAFT = 700;
/** Per-hub cap. Without it Los Angeles alone returns ~470 and the globe looks lopsided. */
const PER_HUB = 90;
const MAX_SATS = 140;
const MAX_QUAKES = 160;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** adsb.lol rate-limits a rapid sweep, so back off and retry rather than lose a whole region. */
async function get(url, as = 'json', tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'kong-atlas-gev-snapshot' } });
      if (res.status === 429 && attempt < tries) {
        await sleep(attempt * 4000);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return as === 'json' ? res.json() : res.text();
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(attempt * 2000);
    }
  }
}

/** Evenly strided sample, so a subset still spans whatever the list was ordered by. */
function stride(list, take) {
  if (list.length <= take) return list;
  const step = list.length / take;
  const out = [];
  for (let i = 0; out.length < take && Math.floor(i) < list.length; i += step) out.push(list[Math.floor(i)]);
  return out;
}

/** adsb.lol reports a parked aircraft's altitude as the string "ground". */
const feet = (v) => (typeof v === 'number' ? Math.round(v) : 0);

function toFlight(ac) {
  const hdg = ac.track ?? ac.true_heading ?? ac.mag_heading;
  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number' || typeof hdg !== 'number') return null;
  const id = (ac.flight || ac.r || ac.hex || '').trim();
  if (!id) return null;
  return {
    id,
    lat: Number(ac.lat.toFixed(4)),
    lon: Number(ac.lon.toFixed(4)),
    alt: feet(ac.alt_baro),
    hdg: Number(hdg.toFixed(1)),
    spd: Math.round(ac.gs ?? 0),
    type: ac.t || '—',
  };
}

async function captureFlights() {
  const seen = new Map();
  const urls = [
    'https://api.adsb.lol/v2/mil',
    ...HUBS.map(([lat, lon]) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`),
  ];
  for (const url of urls) {
    try {
      const { ac = [] } = await get(url);
      // Airborne only: a ramp full of parked aircraft is not what the page is showing.
      const flying = ac.map(toFlight).filter((f) => f && f.spd > 40 && !seen.has(f.id));
      for (const f of stride(flying, PER_HUB)) seen.set(f.id, f);
      console.log(`  ${String(seen.size).padStart(4)} craft after ${new URL(url).pathname} (+${Math.min(flying.length, PER_HUB)} of ${flying.length})`);
    } catch (err) {
      // One dead hub must not cost the whole capture.
      console.log(`  skipped ${new URL(url).pathname}: ${err.message}`);
    }
    await sleep(1500);
  }
  return [...seen.values()].slice(0, MAX_CRAFT);
}

const MU = 398600.4418;
const EARTH_KM = 6371;

/** Mean motion (rev/day) → circular orbit altitude, km. Mirrors `altitudeFromMeanMotion` in tracks.ts. */
function altitudeKm(revsPerDay) {
  const n = (revsPerDay * 2 * Math.PI) / 86400;
  return Math.cbrt(MU / (n * n)) - EARTH_KM;
}

/** TLE epoch field is `YYDDD.dddddddd`; the two-digit year rolls at 57 per the NORAD convention. */
function epochMs(field) {
  const yy = Number(field.slice(0, 2));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const doy = Number(field.slice(2));
  return Date.UTC(year, 0, 1) + (doy - 1) * 86400000;
}

/**
 * A TLE is fixed-column, not delimited — split() would break on the many blank-padded fields.
 * Only the terms a circular orbit needs are kept; eccentricity and argument of perigee are dropped
 * on purpose (see the `ponytail:` note on `Sat` in tracks.ts).
 */
function toSat(name, l1, l2) {
  const revsPerDay = Number(l2.slice(52, 63));
  if (!Number.isFinite(revsPerDay) || revsPerDay <= 0) return null;
  const sat = {
    name: name.replace(/\s+/g, ' ').trim(),
    inc: Number(l2.slice(8, 16)),
    raan: Number(l2.slice(17, 25)),
    ma: Number(l2.slice(43, 51)),
    revsPerDay: Number(revsPerDay.toFixed(6)),
    altKm: Math.round(altitudeKm(revsPerDay)),
    epoch: epochMs(l1.slice(18, 32)),
  };
  return Object.values(sat).every((v) => v === sat.name || Number.isFinite(v)) ? sat : null;
}

/**
 * Groups chosen to give the globe a low shell, a mid shell and the geostationary ring. The low
 * shell is what reads as movement — those satellites cross the disc in a couple of minutes.
 * Celestrak throttles with a 403 rather than a 429, so the alternates are tried in turn and the
 * first that answers wins.
 */
const SAT_GROUPS = [
  [['stations'], 10],
  [['gps-ops'], 30],
  [['geo'], 40],
  [['starlink', 'oneweb', 'iridium-NEXT'], 60],
];

function parseTles(raw) {
  const lines = raw.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const all = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    if (!lines[i + 1]?.startsWith('1 ') || !lines[i + 2]?.startsWith('2 ')) continue;
    const s = toSat(lines[i], lines[i + 1], lines[i + 2]);
    if (s) all.push(s);
  }
  return all;
}

async function captureSats() {
  const sats = [];
  for (const [alternates, take] of SAT_GROUPS) {
    for (const group of alternates) {
      try {
        const raw = await get(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, 'text');
        const all = parseTles(raw);
        if (!all.length) throw new Error('no elements parsed');
        // Even stride rather than the first N, so a shell is sampled all the way round its plane.
        for (const s of stride(all, take)) if (sats.length < MAX_SATS) sats.push(s);
        console.log(`  ${String(sats.length).padStart(4)} sats after ${group} (+${Math.min(all.length, take)} of ${all.length})`);
        break;
      } catch (err) {
        console.log(`  skipped ${group}: ${err.message}`);
      }
    }
    await sleep(3000);
  }
  return sats.slice(0, MAX_SATS);
}

async function captureQuakes() {
  const { features } = await get(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
  );
  return features
    .map((f) => ({
      lat: Number(f.geometry.coordinates[1].toFixed(3)),
      lon: Number(f.geometry.coordinates[0].toFixed(3)),
      depth: Math.round(f.geometry.coordinates[2]),
      mag: Number((f.properties.mag ?? 0).toFixed(1)),
      time: f.properties.time,
      place: (f.properties.place ?? '').toUpperCase(),
    }))
    .filter((q) => q.mag > 0 && Number.isFinite(q.lat) && Number.isFinite(q.lon))
    .sort((a, b) => b.mag - a.mag)
    .slice(0, MAX_QUAKES);
}

console.log('flights…');
const craft = await captureFlights();
console.log('satellites…');
const sats = await captureSats();
console.log('earthquakes…');
const quakes = await captureQuakes();

if (!craft.length || !sats.length) throw new Error('capture produced no flights or no satellites — refusing to overwrite a good snapshot');

await mkdir(OUT, { recursive: true });
const body = { captured: Date.now(), craft, sats, quakes };
const path = join(OUT, 'tracks.json');
const json = JSON.stringify(body);
await writeFile(path, `${json}\n`);
console.log(`\nwrote ${path}  ${(json.length / 1024).toFixed(1)} kB`);
console.log(`${craft.length} craft · ${sats.length} satellites · ${quakes.length} quakes`);
