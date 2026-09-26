/**
 * Capture the hazard layers for the /app/osiris page: active fires and NASA's open natural events.
 *
 * The page replays this offline, so the only thing that has to be live is this script. Run it by
 * hand when the board starts to look stale; nothing in the build depends on it. Flights, satellites
 * and earthquakes are NOT captured here — the page reads `data/gev/tracks.json`, which
 * `capture-gev-snapshot.mjs` owns.
 *
 *   node scripts/capture-osiris-snapshot.mjs
 *
 * Sources, neither needing a key:
 *   FIRMS  https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv
 *          (~21k rows / 1.6 MB; the VIIRS file is the same shape at 118k rows and adds nothing at world scale)
 *   EONET  https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200
 *
 * Output is `public/data/osiris/hazards.json`, NOT `public/data/snapshot/` — that directory means
 * "cached API routes" and is written by `api/scripts/snapshot_api.py`. This is page-owned data.
 *
 * ponytail: `get()` is copied from capture-gev-snapshot.mjs rather than shared — extracting a module
 * would edit the gev script for no runtime gain. Share it the day a third capture script appears.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'osiris');

const FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200';

/** The board is a world map; 1 500 of the hottest detections read as the fire belts without the JSON ballooning. */
const MAX_FIRES = 1500;
/** MODIS confidence is 0–100; below 30 is mostly sun glint and hot rooftops. */
const MIN_CONF = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'json', tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'kong-atlas-osiris-snapshot' } });
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

/** FIRMS CSV has no quoted fields, so a split on commas is a parse. Columns are read by header name. */
async function captureFires() {
  const csv = await get(FIRMS_URL, 'text');
  const [head, ...rows] = csv.trim().split('\n');
  const col = Object.fromEntries(head.split(',').map((k, i) => [k.trim(), i]));
  for (const k of ['latitude', 'longitude', 'frp', 'confidence', 'daynight']) if (!(k in col)) throw new Error(`FIRMS column ${k} missing`);
  const fires = rows
    .map((r) => {
      const c = r.split(',');
      return {
        lat: Number(Number(c[col.latitude]).toFixed(3)),
        lon: Number(Number(c[col.longitude]).toFixed(3)),
        frp: Number(Number(c[col.frp]).toFixed(1)),
        conf: Number(c[col.confidence]),
        day: c[col.daynight].trim() === 'D',
      };
    })
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon) && Number.isFinite(f.frp) && f.conf >= MIN_CONF)
    .sort((a, b) => b.frp - a.frp)
    .slice(0, MAX_FIRES);
  console.log(`  ${fires.length} fires kept of ${rows.length} rows`);
  return fires;
}

/** One mark per event at its latest position; EONET wildfires are kept — unlike FIRMS pixels they are named. */
async function captureEvents() {
  const { events = [] } = await get(EONET_URL);
  const out = [];
  for (const e of events) {
    const g = e.geometry?.at(-1);
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue;
    const [lon, lat] = g.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: e.id,
      title: e.title,
      cat: e.categories?.[0]?.id ?? 'unknown',
      lat: Number(lat.toFixed(3)),
      lon: Number(lon.toFixed(3)),
      date: g.date,
      ...(e.sources?.[0]?.url ? { url: e.sources[0].url } : {}),
    });
  }
  console.log(`  ${out.length} events kept of ${events.length}`);
  return out;
}

console.log('fires…');
const fires = await captureFires();
console.log('events…');
const events = await captureEvents();

if (!fires.length) throw new Error('capture produced no fires — refusing to overwrite a good snapshot');

await mkdir(OUT, { recursive: true });
const body = { captured: Date.now(), fires, events };
const path = join(OUT, 'hazards.json');
const json = JSON.stringify(body);
await writeFile(path, `${json}\n`);
console.log(`\nwrote ${path}  ${(json.length / 1024).toFixed(1)} kB`);
console.log(`${fires.length} fires · ${events.length} events`);
