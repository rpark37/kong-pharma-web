# OSIRIS board (`/app/osiris`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Labs console at `/app/osiris` — a flat world map with seven toggleable OSINT layers (flights, satellites, earthquakes, fires, NASA events, news bureaus, conflict zones) drawn on Canvas 2D from committed snapshots, in the painted-chrome style of `/app/gev`.

**Architecture:** One Angular page component projects a `<canvas>` and DOM islands into the shared `ConsoleStageComponent`. A framework-free `OsirisScene` class paints coastlines (d3-geo equirectangular, antimeridian clipping for free) and layer marks, replaying flights/satellites forward from the snapshot's `captured` instant. A pure `layers.ts` holds the layer registry, the JSON→`Mark` mappers and the hit-test, and is the unit-tested core. A hand-run node script captures fires (NASA FIRMS MODIS) and open events (NASA EONET) into `public/data/osiris/hazards.json`; flights/sats/quakes reuse `public/data/gev/tracks.json` untouched.

**Tech Stack:** Angular 22 standalone components + signals, `@angular/cdk` listbox + `LiveAnnouncer`, `d3-geo` 3.1 (already installed transitively via `d3` 7.9, typed via `@types/d3`), Canvas 2D, Vitest via `ng test`, Node 24 for the capture script.

**Spec:** `docs/superpowers/specs/2026-09-21-osiris-console-design.md`

## Global Constraints

- Zero new npm dependencies. `d3-geo` is imported as `from 'd3-geo'` (present in `node_modules`, v3.1.1, typed).
- No runtime network fetches beyond the app's own assets under `public/`. No API keys.
- Nothing in `app/src/app/features/gev/` changes. `tracks.ts` is imported read-only.
- Route path is a single segment: `osiris` (baseHref is `./`).
- Component styles under the 24 kB `anyComponentStyle` error budget; target ≤ 7 kB.
- The `capture-osiris-snapshot.mjs` script is hand-run, never part of the build; it refuses to overwrite when it captured no fires.
- `public/data/osiris/` is page-owned snapshot data; do **not** write into `public/data/snapshot/` (reserved for cached FastAPI routes).
- All commands run from `app/` with Node 24 (`.nvmrc`). Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run a single spec file with `npx ng test --include='src/app/features/osiris/<file>.spec.ts'`; the full suite is `npm test`.

---

### Task 1: Static tables — news feeds and conflict zones

**Files:**
- Create: `app/src/app/features/osiris/news-feeds.ts`
- Create: `app/src/app/features/osiris/conflict-zones.ts`
- Test: `app/src/app/features/osiris/tables.spec.ts`

**Interfaces:**
- Consumes: `LatLon` from `../map/sites`; `PALETTE` from `../../shared/fui/fui-panels`.
- Produces: `NewsFeed`, `NEWS_FEEDS`, `embedUrl(feed)`, `externalUrl(feed)`; `Severity`, `ConflictZone`, `CONFLICT_ZONES`, `SEVERITY_COLOR`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/app/features/osiris/tables.spec.ts
import { CONFLICT_ZONES, SEVERITY_COLOR } from './conflict-zones';
import { NEWS_FEEDS, embedUrl, externalUrl } from './news-feeds';

const onGlobe = (p: { lat: number; lon: number }) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

describe('NEWS_FEEDS', () => {
  it('has unique ids and coordinates on the globe', () => {
    expect(new Set(NEWS_FEEDS.map((f) => f.id)).size).toBe(NEWS_FEEDS.length);
    expect(NEWS_FEEDS.every(onGlobe)).toBe(true);
  });

  it('stores YouTube channel ids, not urls', () => {
    for (const f of NEWS_FEEDS.filter((f) => f.channel)) expect(f.channel).toMatch(/^UC[\w-]{22}$/);
  });

  it('builds a nocookie embed url only for embeddable feeds', () => {
    const sky = NEWS_FEEDS.find((f) => f.id === 'skynews')!;
    expect(embedUrl(sky)).toBe('https://www.youtube-nocookie.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ&autoplay=1&mute=1');
    const nbc = NEWS_FEEDS.find((f) => f.id === 'nbcnews')!;
    expect(embedUrl(nbc)).toBeNull();
    expect(externalUrl(nbc)).toBe('https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg/live');
  });

  it('keeps a feed without a YouTube channel as an external link', () => {
    const rt = NEWS_FEEDS.find((f) => f.id === 'rt')!;
    expect(rt.channel).toBe('');
    expect(embedUrl(rt)).toBeNull();
    expect(externalUrl(rt)).toBe('https://rumble.com/c/RTNewsEN');
  });
});

describe('CONFLICT_ZONES', () => {
  it('has unique ids and coordinates on the globe', () => {
    expect(new Set(CONFLICT_ZONES.map((z) => z.id)).size).toBe(CONFLICT_ZONES.length);
    expect(CONFLICT_ZONES.every(onGlobe)).toBe(true);
  });

  it('has a colour for every severity in use', () => {
    for (const z of CONFLICT_ZONES) expect(SEVERITY_COLOR[z.severity]).toMatch(/^(#|rgba?\()/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/features/osiris/tables.spec.ts'`
Expected: FAIL — cannot resolve `./conflict-zones` / `./news-feeds`.

- [ ] **Step 3: Write the tables**

```ts
// app/src/app/features/osiris/news-feeds.ts
import type { LatLon } from '../map/sites';

/**
 * Broadcasters with a 24/7 live stream, copied from OSIRIS's `LIVE_FEEDS`
 * (https://github.com/simplifaisoul/osiris, MIT). `embed` mirrors upstream's `embed_allowed`,
 * verified by them in 2026-09: YouTube refuses to iframe the others, so those open externally.
 * Only the channel id is stored; the two URL shapes are built below so they are written once.
 */
export interface NewsFeed extends LatLon {
  id: string;
  name: string;
  city: string;
  country: string;
  /** YouTube channel id, or '' when the stream is not on YouTube (`url` then carries the link). */
  channel: string;
  embed: boolean;
  url?: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  { id: 'nbcnews', name: 'NBC News NOW', city: 'New York', country: 'US', lat: 40.759, lon: -73.98, channel: 'UCeY0bbntWzzVIaj2z3QigXg', embed: false },
  { id: 'cbsnews', name: 'CBS News 24/7', city: 'New York', country: 'US', lat: 40.764, lon: -73.973, channel: 'UC8p1vwvWtl6T73JiExfWs1g', embed: false },
  { id: 'abcnews', name: 'ABC News Live', city: 'New York', country: 'US', lat: 40.763, lon: -73.979, channel: 'UCBi2mrWuNuyYy4gbM6fU18Q', embed: false },
  { id: 'bloomberg', name: 'Bloomberg TV', city: 'New York', country: 'US', lat: 40.756, lon: -73.988, channel: 'UC_vQ72b7v5n2938v9d5c80w', embed: false },
  { id: 'cspan', name: 'C-SPAN', city: 'Washington DC', country: 'US', lat: 38.897, lon: -77.036, channel: 'UCb--64Gl51jIEVE-GLDAVTg', embed: false },
  { id: 'cbc', name: 'CBC News', city: 'Toronto', country: 'CA', lat: 43.644, lon: -79.387, channel: 'UCKy1dAqELon0zgzZPOz9SVw', embed: false },
  { id: 'skynews', name: 'Sky News', city: 'London', country: 'GB', lat: 51.5, lon: -0.118, channel: 'UCoMdktPbSTixAyNGwb-UYkQ', embed: true },
  { id: 'france24en', name: 'France 24 EN', city: 'Paris', country: 'FR', lat: 48.83, lon: 2.28, channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', embed: true },
  { id: 'dwnews', name: 'DW News', city: 'Berlin', country: 'DE', lat: 52.508, lon: 13.376, channel: 'UCknLrEdhRCp1aegoMqRaCZg', embed: true },
  { id: 'aljazeera', name: 'Al Jazeera EN', city: 'Doha', country: 'QA', lat: 25.286, lon: 51.534, channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', embed: true },
  { id: 'nhkworld', name: 'NHK World', city: 'Tokyo', country: 'JP', lat: 35.69, lon: 139.692, channel: 'UCSPEjw8F2nQDtmUKPFNF7_A', embed: true },
  { id: 'cna', name: 'CNA 24/7', city: 'Singapore', country: 'SG', lat: 1.29, lon: 103.852, channel: 'UC83jt4dlz1Gjl58fzQrrKZg', embed: true },
  { id: 'wion', name: 'WION', city: 'New Delhi', country: 'IN', lat: 28.614, lon: 77.209, channel: 'UC_gUM8rL-Lrg6O3adPW9K1g', embed: true },
  { id: 'cgtn', name: 'CGTN', city: 'Beijing', country: 'CN', lat: 39.904, lon: 116.407, channel: 'UCgrNz-aDmcr2uuto8_DL2jg', embed: false },
  { id: 'rt', name: 'RT News', city: 'Moscow', country: 'RU', lat: 55.755, lon: 37.617, channel: '', embed: false, url: 'https://rumble.com/c/RTNewsEN' },
];

/** The iframe src, or null when the broadcaster blocks embedding. nocookie keeps YouTube from setting cookies until play. */
export function embedUrl(f: NewsFeed): string | null {
  return f.embed && f.channel ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${f.channel}&autoplay=1&mute=1` : null;
}

export function externalUrl(f: NewsFeed): string {
  return f.url ?? `https://www.youtube.com/channel/${f.channel}/live`;
}
```

```ts
// app/src/app/features/osiris/conflict-zones.ts
import { PALETTE } from '../../shared/fui/fui-panels';
import type { LatLon } from '../map/sites';

export type Severity = 'war' | 'high' | 'elevated' | 'moderate';

/**
 * Editorial anchors copied from OSIRIS's `KNOWN_CONFLICTS` (https://github.com/simplifaisoul/osiris,
 * MIT) as of 2026-09. Upstream enriches these live from GDELT; here they are a dated snapshot, and
 * the Info panel says so. `queries` and `bounds` (the GDELT inputs) are dropped.
 */
export interface ConflictZone extends LatLon {
  id: string;
  label: string;
  severity: Severity;
  description: string;
  sourceUrl: string;
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  war: PALETTE.rose,
  high: PALETTE.amber,
  elevated: PALETTE.teal,
  moderate: PALETTE.dim,
};

export const CONFLICT_ZONES: ConflictZone[] = [
  { id: 'ukraine', label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lon: 31.2, description: 'Ongoing Russian invasion of Ukraine — active frontlines across eastern and southern regions.', sourceUrl: 'https://liveuamap.com/' },
  { id: 'gaza', label: 'GAZA CONFLICT', severity: 'war', lat: 31.35, lon: 34.35, description: 'Active military operations and humanitarian crisis in Gaza Strip.', sourceUrl: 'https://israelpalestine.liveuamap.com/' },
  { id: 'lebanon', label: 'LEBANON BORDER', severity: 'high', lat: 33.377, lon: 35.483, description: 'Active cross-border military operations in southern Lebanon.', sourceUrl: 'https://lebanon.liveuamap.com/' },
  { id: 'sudan', label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lon: 30.0, description: 'Armed conflict between SAF and RSF factions across Sudan.', sourceUrl: 'https://sudan.liveuamap.com/' },
  { id: 'myanmar', label: 'MYANMAR CONFLICT', severity: 'war', lat: 19.5, lon: 96.5, description: 'Internal conflict — military junta vs opposition forces.', sourceUrl: 'https://myanmar.liveuamap.com/' },
  { id: 'yemen', label: 'YEMEN WAR', severity: 'war', lat: 15.5, lon: 48.0, description: 'Houthi militant operations, Red Sea maritime threats, and coalition strikes.', sourceUrl: 'https://yemen.liveuamap.com/' },
  { id: 'syria', label: 'SYRIA', severity: 'high', lat: 35.0, lon: 38.5, description: 'Ongoing civil conflict and localized insurgencies.', sourceUrl: 'https://syria.liveuamap.com/' },
  { id: 'drc', label: 'DRC EASTERN CONFLICT', severity: 'war', lat: -1.0, lon: 28.5, description: 'M23 rebel offensive and regional instability in eastern Congo.', sourceUrl: 'https://drc.liveuamap.com/' },
  { id: 'red-sea', label: 'RED SEA THREAT', severity: 'high', lat: 16.0, lon: 40.0, description: 'Houthi anti-ship missile and drone attacks on maritime traffic.', sourceUrl: 'https://yemen.liveuamap.com/' },
  { id: 'taiwan-strait', label: 'TAIWAN STRAIT', severity: 'elevated', lat: 24.0, lon: 119.5, description: 'Elevated military drills and regional tension.', sourceUrl: 'https://china.liveuamap.com/' },
  { id: 'korean-dmz', label: 'KOREAN DMZ', severity: 'elevated', lat: 38.3, lon: 127.0, description: 'Ongoing cross-border tension and military posturing.', sourceUrl: 'https://liveuamap.com/' },
  { id: 'sahel', label: 'SAHEL INSTABILITY', severity: 'high', lat: 14.0, lon: 5.0, description: 'Insurgencies and military coups across Mali, Burkina Faso, Niger.', sourceUrl: 'https://africa.liveuamap.com/' },
  { id: 'somalia', label: 'SOMALIA', severity: 'high', lat: 5.0, lon: 46.0, description: 'Al-Shabaab insurgency and counter-terrorism operations.', sourceUrl: 'https://africa.liveuamap.com/' },
  { id: 'iraq', label: 'IRAQ INSTABILITY', severity: 'elevated', lat: 33.3, lon: 44.4, description: 'Ongoing militia activity and counter-terrorism operations.', sourceUrl: 'https://iraq.liveuamap.com/' },
  { id: 'ethiopia', label: 'ETHIOPIA', severity: 'elevated', lat: 9.0, lon: 38.7, description: 'Ethnic tensions and regional conflicts across multiple regions.', sourceUrl: 'https://africa.liveuamap.com/' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/features/osiris/tables.spec.ts'`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/osiris/news-feeds.ts src/app/features/osiris/conflict-zones.ts src/app/features/osiris/tables.spec.ts
git commit -m "osiris: static news-bureau and conflict-zone tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `layers.ts` — registry, mappers, hit-test

**Files:**
- Create: `app/src/app/features/osiris/layers.ts`
- Test: `app/src/app/features/osiris/layers.spec.ts`

**Interfaces:**
- Consumes: `Snapshot`, `Flight`, `Sat`, `Quake`, `deadReckon`, `satelliteAt` from `../gev/tracks`; `formatCoord`, `LatLon` from `../map/sites`; Task 1 exports.
- Produces (used by Tasks 4 and 5):
  - `type LayerId = 'craft' | 'sats' | 'quakes' | 'fires' | 'events' | 'news' | 'zones'`
  - `interface LayerMeta { id: LayerId; label: string; color: string; glyph: 'dot' | 'ring' | 'square' | 'diamond'; named: boolean; defaultOn: boolean }`
  - `const LAYERS: LayerMeta[]` (in draw order), `const DEFAULT_ON: Set<LayerId>`
  - `interface Mark extends LatLon { layer: LayerId; id: string; label: string; lines: string[]; url?: string; embed?: string; size: number; color?: string }`
  - `interface Fire { lat; lon; frp; conf; day: boolean }`, `interface EonetEvent { id; title; cat; lat; lon; date; url?: string }`, `interface Hazards { captured: number; fires: Fire[]; events: EonetEvent[] }`
  - `const REPLAY = 60` (replay speed-up, same as gev)
  - `marksFromCraft(craft: Flight[], elapsedSec: number): Mark[]`
  - `marksFromSats(sats: Sat[], captured: number, elapsedSec: number): Mark[]`
  - `marksFromQuakes(quakes: Quake[]): Mark[]`
  - `marksFromFires(fires: Fire[]): Mark[]`, `marksFromEvents(events: EonetEvent[]): Mark[]`
  - `marksFromFeeds(): Mark[]`, `marksFromZones(): Mark[]`
  - `nearest<T extends { x: number; y: number }>(pts: T[], x: number, y: number, radius: number): T | null`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/app/features/osiris/layers.spec.ts
import type { Flight, Quake, Sat } from '../gev/tracks';
import { CONFLICT_ZONES } from './conflict-zones';
import {
  DEFAULT_ON,
  LAYERS,
  marksFromCraft,
  marksFromEvents,
  marksFromFeeds,
  marksFromFires,
  marksFromQuakes,
  marksFromSats,
  nearest,
} from './layers';
import { NEWS_FEEDS } from './news-feeds';

const jet: Flight = { id: 'ASI993', lat: 0, lon: 0, alt: 7475, hdg: 90, spd: 600, type: 'PA-28' };
const iss: Sat = { name: 'ISS (ZARYA)', inc: 51.6, raan: 0, ma: 0, revsPerDay: 15.5, altKm: 420, epoch: Date.UTC(2026, 8, 21) };
const quake: Quake = { lat: 36.1, lon: 140.2, mag: 5.4, depth: 42, time: Date.UTC(2026, 8, 20, 3, 4) };

describe('LAYERS', () => {
  it('lists seven layers with unique ids and the default set is a subset', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['fires', 'events', 'quakes', 'zones', 'news', 'sats', 'craft']);
    for (const id of DEFAULT_ON) expect(LAYERS.some((l) => l.id === id)).toBe(true);
    expect(DEFAULT_ON.has('craft')).toBe(true);
    expect(DEFAULT_ON.has('news')).toBe(false);
  });
});

describe('mappers', () => {
  it('leaves craft where captured at elapsed 0 and moves them east afterwards', () => {
    const [still] = marksFromCraft([jet], 0);
    expect(still.lon).toBe(0);
    expect(still.layer).toBe('craft');
    expect(still.label).toBe('ASI993');
    const [moved] = marksFromCraft([jet], 60);
    // 60 s of replay at 60x is one hour: 600 kts ≈ 9.99° of arc eastwards.
    expect(moved.lon).toBeCloseTo(9.99, 1);
    expect(moved.lat).toBeCloseTo(0, 6);
  });

  it('propagates satellites and keeps them on the globe', () => {
    const [m] = marksFromSats([iss], iss.epoch, 120);
    expect(Math.abs(m.lat)).toBeLessThanOrEqual(51.7);
    expect(Math.abs(m.lon)).toBeLessThanOrEqual(180);
    expect(m.lines[0]).toContain('420 KM');
  });

  it('sizes quakes by magnitude and labels with magnitude', () => {
    const [m] = marksFromQuakes([quake]);
    expect(m.label).toBe('M5.4');
    expect(m.size).toBeGreaterThan(marksFromQuakes([{ ...quake, mag: 3 }])[0].size);
    expect(m.lines.some((l) => l.includes('42 KM'))).toBe(true);
  });

  it('maps fires, events, feeds and zones one-to-one', () => {
    expect(marksFromFires([{ lat: 1, lon: 2, frp: 12.5, conf: 80, day: true }])[0]).toMatchObject({ layer: 'fires', lat: 1, lon: 2, label: 'FRP 12.5' });
    const [ev] = marksFromEvents([{ id: 'EONET_1', title: 'Hurricane Polo', cat: 'severeStorms', lat: 15.1, lon: -104.8, date: '2026-09-21T00:00:00Z', url: 'https://x' }]);
    expect(ev).toMatchObject({ layer: 'events', label: 'Hurricane Polo', url: 'https://x' });
    expect(marksFromFeeds()).toHaveLength(NEWS_FEEDS.length);
    expect(marksFromFeeds().find((m) => m.id === 'skynews')?.embed).toContain('youtube-nocookie.com');
    expect(marksFromZones()).toHaveLength(CONFLICT_ZONES.length);
    expect(marksFromZones().every((m) => m.color)).toBe(true);
  });
});

describe('nearest', () => {
  const pts = [
    { id: 'a', x: 10, y: 10 },
    { id: 'b', x: 30, y: 10 },
  ];
  it('picks the closer point inside the radius', () => {
    expect(nearest(pts, 24, 10, 12)?.id).toBe('b');
    expect(nearest(pts, 14, 10, 12)?.id).toBe('a');
  });
  it('returns null outside the radius', () => {
    expect(nearest(pts, 100, 100, 12)).toBeNull();
  });
  it('breaks a tie by list order', () => {
    expect(nearest(pts, 20, 10, 12)?.id).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/features/osiris/layers.spec.ts'`
Expected: FAIL — cannot resolve `./layers`.

- [ ] **Step 3: Write `layers.ts`**

```ts
// app/src/app/features/osiris/layers.ts
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
  defaultOn: boolean;
}

/** Draw order: dense, dim layers first so the sparse named ones sit on top. */
export const LAYERS: LayerMeta[] = [
  { id: 'fires', label: 'Fires', color: '#f2884e', glyph: 'dot', named: false, defaultOn: true },
  { id: 'events', label: 'NASA events', color: PALETTE.amber, glyph: 'diamond', named: true, defaultOn: false },
  { id: 'quakes', label: 'Earthquakes', color: PALETTE.rose, glyph: 'ring', named: false, defaultOn: true },
  { id: 'zones', label: 'Conflict zones', color: PALETTE.rose, glyph: 'square', named: true, defaultOn: true },
  { id: 'news', label: 'News bureaus', color: PALETTE.teal, glyph: 'square', named: true, defaultOn: false },
  { id: 'sats', label: 'Satellites', color: PALETTE.text, glyph: 'dot', named: false, defaultOn: false },
  { id: 'craft', label: 'Aircraft', color: PALETTE.amber, glyph: 'dot', named: false, defaultOn: true },
];

export const DEFAULT_ON: Set<LayerId> = new Set(LAYERS.filter((l) => l.defaultOn).map((l) => l.id));

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
    lines: [`${f.city.toUpperCase()} · ${f.country}`, f.embed ? 'LIVE · EMBEDDED' : 'LIVE · EXTERNAL'],
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
    lines: [z.severity.toUpperCase(), z.description, formatCoord(z)],
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/features/osiris/layers.spec.ts'`
Expected: PASS (8 tests). If the craft test's longitude is off, check `REPLAY * elapsedSec` = 3600 s and `spd` 600 kts → 1111.2 km → 9.9933°.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/osiris/layers.ts src/app/features/osiris/layers.spec.ts
git commit -m "osiris: layer registry, snapshot-to-mark mappers and hit-test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Snapshot script and committed `hazards.json`

**Files:**
- Create: `app/scripts/capture-osiris-snapshot.mjs`
- Create (generated): `app/public/data/osiris/hazards.json`
- Test: `app/src/app/features/osiris/hazards.spec.ts`

**Interfaces:**
- Produces: `public/data/osiris/hazards.json` with the `Hazards` shape from Task 2 (`{ captured: number, fires: Fire[], events: EonetEvent[] }`), fetched by the scene in Task 4 at `data/osiris/hazards.json`.

- [ ] **Step 1: Write the script**

```js
// app/scripts/capture-osiris-snapshot.mjs
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
```

- [ ] **Step 2: Run the script**

Run: `node scripts/capture-osiris-snapshot.mjs`
Expected: prints `1500 fires kept of ~21000 rows`, `~90 events kept of ~90`, `wrote …/public/data/osiris/hazards.json  ~75 kB`. If FIRMS returns 403/5xx, retry once later; do not commit an empty file.

- [ ] **Step 3: Write the invariant test against the committed file**

```ts
// app/src/app/features/osiris/hazards.spec.ts
import hazards from '../../../../public/data/osiris/hazards.json';
import type { Hazards } from './layers';

const h = hazards as Hazards;
const onGlobe = (p: { lat: number; lon: number }) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

describe('public/data/osiris/hazards.json', () => {
  it('was captured, with fires sorted hottest first and capped', () => {
    expect(Number.isFinite(h.captured)).toBe(true);
    expect(h.fires.length).toBeGreaterThan(0);
    expect(h.fires.length).toBeLessThanOrEqual(1500);
    for (let i = 1; i < h.fires.length; i++) expect(h.fires[i - 1].frp).toBeGreaterThanOrEqual(h.fires[i].frp);
  });

  it('keeps every row on the globe with the fields the mappers read', () => {
    expect(h.fires.every((f) => onGlobe(f) && f.conf >= 30 && typeof f.day === 'boolean')).toBe(true);
    expect(h.events.every((e) => onGlobe(e) && e.id && e.title && e.cat && /^\d{4}-\d{2}-\d{2}/.test(e.date))).toBe(true);
    expect(new Set(h.events.map((e) => e.id)).size).toBe(h.events.length);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/features/osiris/hazards.spec.ts'`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-osiris-snapshot.mjs public/data/osiris/hazards.json src/app/features/osiris/hazards.spec.ts
git commit -m "osiris: capture script and committed fire/event snapshot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `osiris-scene.ts` — the canvas painter

**Files:**
- Create: `app/src/app/features/osiris/osiris-scene.ts`

**Interfaces:**
- Consumes: Task 2 (`LAYERS`, `Mark`, `LayerId`, `Hazards`, `DEFAULT_ON`, `marksFrom*`, `nearest`); `Snapshot`, `Topology`, `decodeArcs` from `../gev/tracks`; `* as P` from `../../shared/fui/fui-panels`; `geoEquirectangular`, `geoPath` from `d3-geo`.
- Produces (used by Task 5):
  ```ts
  class OsirisScene {
    constructor(canvas: HTMLCanvasElement, reduced?: boolean);
    load(): Promise<void>;                 // fetches world + tracks + hazards; a missing hazards file leaves fires/events empty, not fatal
    resize(w: number, h: number): void;    // CSS px
    start(): void;
    setVisible(ids: Set<LayerId>): void;
    hover(nx: number, ny: number): void;   // stage-normalised -1..1
    pick(): Mark | null;                   // the hovered mark, for click
    select(m: Mark | null): void;
    count(id: LayerId): number | null;     // null when that layer's snapshot failed to load
    named(): Mark[];                       // marks of layers with `named: true`, for the rail
    captured(): number;
    dispose(): void;
  }
  ```

- [ ] **Step 1: Write the scene**

```ts
// app/src/app/features/osiris/osiris-scene.ts
/**
 * The OSIRIS board painter: a flat world map with the layers from `layers.ts` on top and the FUI
 * chrome around it, all on one 2D canvas. No three.js — every mark is a point, so Canvas 2D at
 * these counts (a few thousand arcs a frame) is cheaper than a WebGL setup.
 *
 * d3-geo does two things the hand-rolled `(lon + 180) / 360` cannot: `fitExtent` sizes the map to
 * whatever rectangle the chrome leaves free, and `geoPath` clips the coastline arcs at the
 * antimeridian, so no arc draws a line across the whole Pacific.
 *
 * Static layers (everything but aircraft and satellites) are painted once to an offscreen canvas
 * whenever the size or the visible set changes, then blitted; the two moving layers are
 * re-reckoned every frame. Chrome is painted in a 900-high reference space scaled to the stage,
 * the same convention as gev, so the DOM islands positioned in cqh line up with it.
 */
import { geoEquirectangular, geoPath, type GeoProjection } from 'd3-geo';
import * as P from '../../shared/fui/fui-panels';
import { type Snapshot, type Topology, decodeArcs } from '../gev/tracks';
import {
  DEFAULT_ON,
  type Hazards,
  LAYERS,
  type LayerId,
  type Mark,
  marksFromCraft,
  marksFromEvents,
  marksFromFeeds,
  marksFromFires,
  marksFromQuakes,
  marksFromSats,
  marksFromZones,
  nearest,
} from './layers';

const OH = 900;
/** Reference-space margins: header above, footer below, the right column for the DOM rail. */
const MAP = { left: 48, top: 110, right: 360, bottom: 96 };
const HIT_PX = 10;

interface Projected {
  x: number;
  y: number;
  mark: Mark;
}

export class OsirisScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly still: HTMLCanvasElement;
  private readonly stillCtx: CanvasRenderingContext2D;
  private readonly projection: GeoProjection = geoEquirectangular();
  private coast: GeoJSON.MultiLineString | null = null;
  private snapshot: Snapshot | null = null;
  private hazards: Hazards | null = null;
  private hazardsFailed = false;
  private staticMarks = new Map<LayerId, Mark[]>();
  private visible = new Set<LayerId>(DEFAULT_ON);
  private projected: Projected[] = [];
  private hovered: Projected | null = null;
  private selected: Mark | null = null;

  private w = 1600;
  private h = OH;
  private dpr = 1;
  private frame = 0;
  private raf = 0;
  private disposed = false;
  private stillDirty = true;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly reduced = false) {
    this.ctx = canvas.getContext('2d')!;
    this.still = document.createElement('canvas');
    this.stillCtx = this.still.getContext('2d')!;
  }

  async load(): Promise<void> {
    const json = <T>(url: string) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${r.status} ${url}`))));
    const [topo, snap, hazards] = await Promise.all([
      json<Topology>('data/gev/world-110m.json'),
      json<Snapshot>('data/gev/tracks.json'),
      json<Hazards>('data/osiris/hazards.json').catch(() => null),
    ]);
    if (this.disposed) return;
    this.coast = { type: 'MultiLineString', coordinates: decodeArcs(topo) };
    this.snapshot = snap;
    this.hazards = hazards;
    this.hazardsFailed = hazards === null;
    this.staticMarks.set('quakes', marksFromQuakes(snap.quakes));
    this.staticMarks.set('fires', hazards ? marksFromFires(hazards.fires) : []);
    this.staticMarks.set('events', hazards ? marksFromEvents(hazards.events) : []);
    this.staticMarks.set('news', marksFromFeeds());
    this.staticMarks.set('zones', marksFromZones());
    this.stillDirty = true;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.still]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
    }
    const s = this.scale();
    this.projection.fitExtent(
      [
        [MAP.left * s, MAP.top * s],
        [w - MAP.right * s, h - MAP.bottom * s],
      ],
      { type: 'Sphere' },
    );
    this.stillDirty = true;
    if (this.reduced) this.paint();
  }

  start(): void {
    if (this.reduced) {
      this.paint();
      return;
    }
    const tick = () => {
      if (this.disposed) return;
      if (!document.hidden) {
        this.frame += 1;
        this.paint();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setVisible(ids: Set<LayerId>): void {
    this.visible = new Set(ids);
    this.stillDirty = true;
    if (this.selected && !this.visible.has(this.selected.layer)) this.selected = null;
    if (this.reduced) this.paint();
  }

  hover(nx: number, ny: number): void {
    const x = ((nx + 1) / 2) * this.w;
    const y = ((ny + 1) / 2) * this.h;
    this.hovered = nearest(this.projected, x, y, HIT_PX * this.scale());
    if (this.reduced) this.paint();
  }

  pick(): Mark | null {
    return this.hovered?.mark ?? null;
  }

  select(m: Mark | null): void {
    this.selected = m;
    if (this.reduced) this.paint();
  }

  count(id: LayerId): number | null {
    if (id === 'craft') return this.snapshot?.craft.length ?? null;
    if (id === 'sats') return this.snapshot?.sats.length ?? null;
    if ((id === 'fires' || id === 'events') && this.hazardsFailed) return null;
    return this.staticMarks.get(id)?.length ?? null;
  }

  named(): Mark[] {
    return LAYERS.filter((l) => l.named).flatMap((l) => this.staticMarks.get(l.id) ?? []);
  }

  captured(): number {
    return this.snapshot?.captured ?? 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  /** Stage px per reference px: chrome is laid out against a 900-high frame. */
  private scale(): number {
    return this.h / OH;
  }

  /** Seconds of replay elapsed. Reduced motion freezes the snapshot at its captured instant. */
  private elapsed(): number {
    return this.reduced ? 0 : this.frame / 60;
  }

  private glyph(ctx: CanvasRenderingContext2D, m: Mark, x: number, y: number, color: string): void {
    const r = m.size * this.scale();
    const meta = LAYERS.find((l) => l.id === m.layer)!;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    switch (meta.glyph) {
      case 'ring':
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        return;
      case 'square':
        ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.stroke();
        return;
      case 'diamond':
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.stroke();
        return;
      default:
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  /** Coastlines and the static layers, painted once per size/visibility change. */
  private paintStill(): void {
    const ctx = this.stillCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.coast) {
      ctx.strokeStyle = P.PALETTE.tealDim;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      geoPath(this.projection, ctx)(this.coast);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    for (const l of LAYERS) {
      if (l.id === 'craft' || l.id === 'sats' || !this.visible.has(l.id)) continue;
      for (const m of this.staticMarks.get(l.id) ?? []) {
        const p = this.projection([m.lon, m.lat]);
        if (!p) continue;
        this.glyph(ctx, m, p[0], p[1], m.color ?? l.color);
      }
    }
    ctx.globalAlpha = 1;
    this.stillDirty = false;
  }

  private paint(): void {
    const ctx = this.ctx;
    const snap = this.snapshot;
    if (this.stillDirty) this.paintStill();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#05090c';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(this.still, 0, 0, this.w, this.h);

    // Moving layers, and the hit-test list rebuilt from whatever is on screen this frame.
    this.projected = [];
    const push = (m: Mark) => {
      const p = this.projection([m.lon, m.lat]);
      if (p) this.projected.push({ x: p[0], y: p[1], mark: m });
    };
    if (snap) {
      const t = this.elapsed();
      if (this.visible.has('craft')) for (const m of marksFromCraft(snap.craft, t)) push(m);
      if (this.visible.has('sats')) for (const m of marksFromSats(snap.sats, snap.captured, t)) push(m);
      for (const p of this.projected) this.glyph(ctx, p.mark, p.x, p.y, LAYERS.find((l) => l.id === p.mark.layer)!.color);
      for (const l of LAYERS) {
        if (l.id === 'craft' || l.id === 'sats' || !this.visible.has(l.id)) continue;
        for (const m of this.staticMarks.get(l.id) ?? []) push(m);
      }
    }

    this.paintChrome(ctx);
    this.paintCallouts(ctx);
  }

  private paintChrome(ctx: CanvasRenderingContext2D): void {
    const s = this.scale();
    const ow = this.w / s;
    const f = this.frame;
    ctx.save();
    ctx.scale(s, s);

    P.corners(ctx, 26, 26, ow - 52, OH - 52, 26, P.PALETTE.tealDim);
    P.font(ctx, 20, 600, 0.1);
    P.text(ctx, 'OSIRIS BOARD', 48, 60, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, 'GLOBAL SITUATION · KONG ATLAS LABS', 48, 78, P.PALETTE.tealDim);

    const captured = this.captured();
    ctx.textAlign = 'right';
    const stamp = new Date(captured + this.elapsed() * 60000);
    P.font(ctx, 10, 500);
    P.text(ctx, `● REC ${stamp.toISOString().slice(0, 19).replace('T', ' ')}Z`, ow - 48, 60, f % 60 < 40 ? P.PALETTE.rose : P.PALETTE.dim);
    P.font(ctx, 9, 400);
    P.text(ctx, `SNAPSHOT ${new Date(captured).toISOString().slice(0, 10)} · REPLAY 60X`, ow - 48, 78, P.PALETTE.tealDim);
    ctx.textAlign = 'left';

    // Left foot: layer channel panel painted from the same registry the DOM checkboxes use.
    P.channelPanel(
      ctx,
      48,
      OH - 88 - LAYERS.length * 18 - 16,
      210,
      LAYERS.map((l) => [`${l.label.toUpperCase()} ${String(this.count(l.id) ?? '—').padStart(5)}`, this.visible.has(l.id)] as [string, boolean]),
      'L01',
    );

    ctx.textAlign = 'center';
    P.font(ctx, 9, 400, 0.14);
    P.text(ctx, 'ADSB.LOL · CELESTRAK · USGS · NASA FIRMS · NASA EONET — SNAPSHOT REPLAY, NO NETWORK', (ow - MAP.right + MAP.left) / 2, OH - 34, P.PALETTE.faint);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private paintCallouts(ctx: CanvasRenderingContext2D): void {
    const s = this.scale();
    const mid = (this.w - MAP.right * s + MAP.left * s) / 2;
    const draw = (p: Projected, strong: boolean) => {
      ctx.save();
      ctx.scale(s, s);
      const x = p.x / s;
      const y = p.y / s;
      if (strong) {
        P.callout(ctx, x, y, p.mark.label, p.mark.lines, p.x > mid ? -1 : 1, 96);
        P.corners(ctx, x - 26, y - 26, 52, 52, 10, P.PALETTE.teal);
      } else {
        ctx.strokeStyle = P.PALETTE.tealDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 6, y - 6, 12, 12);
        P.font(ctx, 8, 400);
        P.text(ctx, p.mark.label, x + 10, y + 3, P.PALETTE.dim);
      }
      ctx.restore();
    };
    if (this.selected) {
      const sel = this.projected.find((p) => p.mark.layer === this.selected!.layer && p.mark.id === this.selected!.id);
      if (sel) draw(sel, true);
    }
    if (this.hovered && this.hovered.mark !== this.selected) draw(this.hovered, false);
  }
}
```

- [ ] **Step 2: Type-check it**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors. If `GeoJSON` is not found, add `/// <reference types="geojson" />` at the top of the file — `@types/geojson` is a dependency of `@types/d3-geo` and is already in `node_modules`.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/osiris/osiris-scene.ts
git commit -m "osiris: canvas scene — d3-geo world map, layer marks, painted chrome

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Page component, route, e2e route, README

**Files:**
- Create: `app/src/app/features/osiris/osiris-page.component.ts`
- Modify: `app/src/app/app.routes.ts` (insert before the `'**'` line)
- Modify: `app/e2e/smoke-screens.mjs:10` (append `'/app/osiris'` to `routes`)
- Modify: `README.md` (root; one bullet after the `/app/gev` bullet, line 18)

**Interfaces:**
- Consumes: Task 4 `OsirisScene`; Task 2 `LAYERS`, `LayerId`, `Mark`, `DEFAULT_ON`; `ConsoleStageComponent` (`fill`, `track`, `stageElement()`, `[console-info]`, `console-island`); `GsapService` (`reveal`, `reducedMotion`, `MOTION.delay.medium`); `LiveAnnouncer`; `CdkListbox`/`CdkOption`; `DomSanitizer`.

- [ ] **Step 1: Write the component**

```ts
// app/src/app/features/osiris/osiris-page.component.ts
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import { DEFAULT_ON, LAYERS, type LayerId, type Mark } from './layers';
import type { OsirisScene } from './osiris-scene';

/**
 * A situational-awareness board after OSIRIS (github.com/simplifaisoul/osiris): a flat world map
 * with toggleable intelligence layers and click-to-inspect. Nothing here is live — every layer is
 * a committed snapshot, so the page works with the network off.
 *
 * The canvas is decorative. Everything with a payload is reachable in the DOM: the layer toggles
 * are native checkboxes, the named marks (bureaus, zones, events) are a `cdkListbox`, and the
 * selected mark's details are a region beside the map. Selecting from the rail and clicking on
 * the map both land in the same `selected` signal.
 */
@Component({
  selector: 'app-osiris-page',
  imports: [CdkListbox, CdkOption, ConsoleStageComponent],
  template: `
    <app-console-stage background="#05090c" label="Osiris board" [fill]="true" (track)="scene?.hover($event.nx, $event.ny)">
      <canvas #canvas role="img" [attr.aria-label]="summary()" (click)="pickFromMap()"></canvas>

      <div class="rail" console-island (keydown.escape)="select(null)">
        <fieldset class="layers">
          <legend class="rail-title">Layers</legend>
          @for (l of layers; track l.id) {
            <label class="layer-row" [class.off]="counts()[l.id] === null">
              <input type="checkbox" [checked]="enabled().has(l.id)" [disabled]="counts()[l.id] === null" (change)="toggle(l.id)" />
              <span class="swatch" [style.background]="l.color"></span>
              <span class="name">{{ l.label }}</span>
              <span class="count" [attr.title]="counts()[l.id] === null ? 'snapshot missing' : null">{{ counts()[l.id] ?? '—' }}</span>
            </label>
          }
        </fieldset>

        <p class="rail-title" id="osiris-rail-title">Named marks</p>
        @if (named().length) {
          <ul class="rail-list" cdkListbox aria-labelledby="osiris-rail-title" [cdkListboxValue]="selectedKeys()" (cdkListboxValueChange)="pickFromRail($event.value)">
            @for (m of named(); track key(m)) {
              <li class="rail-row" [cdkOption]="key(m)">
                <span class="id">{{ m.label }}</span>
                <span class="km">{{ layerLabel(m.layer) }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="rail-empty">No named layers on</p>
        }

        @if (selected(); as sel) {
          <div class="rail-detail" role="region" aria-label="Selected item">
            <p class="rail-sub">{{ layerLabel(sel.layer) }}</p>
            <p class="rail-callsign">{{ sel.label }}</p>
            <ul class="lines">
              @for (line of sel.lines; track $index) { <li>{{ line }}</li> }
            </ul>
            @if (embed(); as src) {
              <iframe [src]="src" [title]="sel.label + ' live stream'" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
            }
            <p class="rail-actions">
              @if (sel.url) { <a [href]="sel.url" target="_blank" rel="noopener">{{ sel.embed ? 'Open on YouTube' : 'Source' }}</a> }
              <button type="button" class="chip" (click)="select(null)">Close</button>
            </p>
          </div>
        }
      </div>

      @if (error()) { <p class="error">{{ error() }}</p> }

      <div console-info>
        <p class="eyebrow">canvas 2d · d3-geo · snapshot replay</p>
        <p class="lede">
          A global situation board in the console vocabulary the other pages share: a flat world map
          with toggleable intelligence layers. Aircraft are dead-reckoned from a captured frame,
          satellites propagated from their elements; fires, quakes and NASA events sit where they
          were captured. Toggle layers on the right and pick a mark to read it.
        </p>
        <p class="note">
          After <a href="https://github.com/simplifaisoul/osiris" target="_blank" rel="noopener">OSIRIS</a>
          by simplifaisoul (MIT) — an independent reimplementation of a subset on this app's stack; the
          news-bureau and conflict-zone tables are copied from upstream as of September 2026 and are
          editorial snapshots, not live. Data captured from adsb.lol, Celestrak, USGS, NASA FIRMS and
          NASA EONET; each remains the property of its source.
        </p>
      </div>
    </app-console-stage>
  `,
  styles: `
    :host { display: block; }
    canvas { display: block; width: 100%; height: 100%; }

    /* The right column the scene leaves unpainted (MAP.right = 360 of 900 → 40cqh), top 12cqh so the
       Info / Fullscreen chips (at 11cqh) sit above it. */
    .rail { position: absolute; right: 5.33cqh; top: 12cqh; width: 33cqh; max-height: 80cqh; overflow-y: auto; box-sizing: border-box; color: #e6f6f3; font-family: 'JetBrains Mono', ui-monospace, monospace; cursor: default; }
    .rail-title { margin: 0; font-size: max(9px, 1.87cqh); font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
    .rail-sub { margin: 0.53cqh 0 0; font-size: max(9px, 1.42cqh); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    .layers { margin: 0 0 2cqh; padding: 0; border: 0; }
    .layers legend { padding: 0; margin-bottom: 0.8cqh; }
    .layer-row { display: flex; align-items: center; gap: 1cqh; padding: 0.4cqh 0; font-size: max(10px, 1.53cqh); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
    .layer-row.off { color: rgba(230, 246, 243, 0.3); cursor: default; }
    .layer-row input { accent-color: #44e0cc; margin: 0; }
    .layer-row input:focus-visible { outline: 1px solid #44e0cc; outline-offset: 2px; }
    .swatch { width: 1.2cqh; height: 1.2cqh; border-radius: 1px; }
    .name { flex: 1; }
    .count { color: rgba(230, 246, 243, 0.62); font-variant-numeric: tabular-nums; }
    .rail-list { list-style: none; margin: 0.8cqh 0 0; padding: 0.36cqh 0 0; border-top: 1px dashed rgba(68, 224, 204, 0.35); max-height: 28cqh; overflow-y: auto; }
    .rail-row { display: flex; justify-content: space-between; gap: 1.42cqh; padding: 0.46cqh 0.62cqh; font-size: max(10px, 1.42cqh); letter-spacing: 0.1em; cursor: pointer; }
    .rail-row:hover { background: rgba(68, 224, 204, 0.10); }
    .rail-row[aria-selected='true'] { background: rgba(68, 224, 204, 0.18); color: #fff; }
    .rail-row:focus-visible { outline: 1px solid #44e0cc; outline-offset: -1px; }
    .rail-row .km { color: rgba(230, 246, 243, 0.62); white-space: nowrap; }
    .rail-empty { margin: 1cqh 0 0; font-size: max(9px, 1.42cqh); letter-spacing: 0.1em; color: rgba(230, 246, 243, 0.3); text-transform: uppercase; }
    .rail-detail { margin-top: 2cqh; padding-top: 1cqh; border-top: 1px dashed rgba(68, 224, 204, 0.35); }
    .rail-callsign { margin: 0.62cqh 0 0.98cqh; font-size: max(13px, 2.4cqh); font-weight: 500; letter-spacing: 0.04em; }
    .lines { list-style: none; margin: 0; padding: 0; font-size: max(10px, 1.42cqh); letter-spacing: 0.08em; text-transform: uppercase; color: rgba(230, 246, 243, 0.62); }
    .lines li { margin: 0.3cqh 0; }
    iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid rgba(68, 224, 204, 0.35); margin-top: 1cqh; background: #000; }
    .rail-actions { display: flex; gap: 1cqh; align-items: center; margin: 1cqh 0 0; font-size: max(10px, 1.42cqh); }
    .rail-actions a { color: #44e0cc; }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }

    /* Projected content carries its own copy of the chip rule (component styles stop at the stage boundary). */
    .chip {
      font: 500 max(10px, 1.24cqh)/1 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 0.14em; text-transform: uppercase;
      padding: max(6px, 0.98cqh) max(10px, 1.6cqh);
      border-radius: 2px; border: 1px solid rgba(68, 224, 204, 0.35);
      background: rgba(5, 9, 12, 0.72); color: rgba(230, 246, 243, 0.72); cursor: pointer;
    }
    .chip:hover { color: #fff; border-color: #44e0cc; }
    .chip:focus-visible { outline: 1px solid #44e0cc; outline-offset: 2px; }

    @container (max-aspect-ratio: 17/10) {
      .rail { background: rgba(5, 9, 12, 0.82); padding: 1.2cqh 1.4cqh; box-shadow: 0 0 0 1px rgba(68, 224, 204, 0.14); }
    }
    @container (max-aspect-ratio: 1/1) {
      .rail { right: 3%; width: 50%; }
    }
  `,
})
export class OsirisPageComponent {
  readonly layers = LAYERS;
  readonly error = signal<string | null>(null);
  readonly enabled = signal<Set<LayerId>>(new Set(DEFAULT_ON));
  readonly counts = signal<Record<LayerId, number | null>>(Object.fromEntries(LAYERS.map((l) => [l.id, null])) as Record<LayerId, number | null>);
  readonly named = signal<Mark[]>([]);
  readonly selected = signal<Mark | null>(null);

  readonly selectedKeys = computed(() => {
    const s = this.selected();
    return s ? [this.key(s)] : [];
  });

  readonly summary = computed(() => {
    const c = this.counts();
    const parts = LAYERS.filter((l) => this.enabled().has(l.id) && c[l.id]).map((l) => `${c[l.id]} ${l.label.toLowerCase()}`);
    return `Decorative world map showing ${parts.join(', ') || 'coastlines'}; toggle layers and pick marks in the panel beside it.`;
  });

  /** Only a static-table channel id ever reaches this, never user input, so trusting it is safe. */
  readonly embed = computed(() => {
    const src = this.selected()?.embed;
    return src ? this.sanitizer.bypassSecurityTrustResourceUrl(src) : null;
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: OsirisScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => {
      this.scene?.dispose();
      this.resize?.disconnect();
    });
  }

  key(m: Mark): string {
    return `${m.layer}:${m.id}`;
  }

  layerLabel(id: LayerId): string {
    return LAYERS.find((l) => l.id === id)!.label;
  }

  toggle(id: LayerId): void {
    const next = new Set(this.enabled());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.enabled.set(next);
    this.scene?.setVisible(next);
    this.refreshNamed();
    void this.announcer.announce(`${this.layerLabel(id)} ${next.has(id) ? 'on' : 'off'}, ${this.counts()[id] ?? 0} marks`, 'polite');
  }

  pickFromMap(): void {
    const m = this.scene?.pick() ?? null;
    if (m) this.select(m);
  }

  pickFromRail(keys: readonly string[]): void {
    const k = keys[0];
    const m = k ? this.named().find((n) => this.key(n) === k) ?? null : null;
    this.select(m);
  }

  select(m: Mark | null): void {
    this.selected.set(m);
    this.scene?.select(m);
    if (m) void this.announcer.announce(`Selected ${m.label}. ${m.lines.join('. ')}`, 'polite');
  }

  private refreshNamed(): void {
    const on = this.enabled();
    this.named.set((this.scene?.named() ?? []).filter((m) => on.has(m.layer)));
  }

  private async boot(): Promise<void> {
    try {
      const { OsirisScene } = await import('./osiris-scene');
      const scene = new OsirisScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.console().stageElement();
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.console().stageElement());
      await scene.load();
      scene.setVisible(this.enabled());
      scene.start();
      this.counts.set(Object.fromEntries(LAYERS.map((l) => [l.id, scene.count(l.id)])) as Record<LayerId, number | null>);
      this.refreshNamed();
    } catch (err) {
      this.error.set(`The board could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

- [ ] **Step 2: Add the route**

In `app/src/app/app.routes.ts`, insert before `{ path: '**', redirectTo: '' },`:

```ts
  { path: 'osiris', loadComponent: () => import('./features/osiris/osiris-page.component').then((m) => m.OsirisPageComponent), title: 'Osiris board' },
```

- [ ] **Step 3: Add the e2e route**

In `app/e2e/smoke-screens.mjs` line 10, append `'/app/osiris'` to the `routes` array:

```js
const routes = ['/app/', '/app/morphcharts?plot=bar2', '/app/ares', '/app/merchandise', '/app/atlas', '/app/bayes', '/app/vega-charts', '/app/google', '/app/hud', '/app/site-map', '/app/controls', '/app/gev', '/app/osiris'];
```

- [ ] **Step 4: Add the README bullet**

In root `README.md`, after the `/app/gev` bullet (line 18), add:

```md
- `/app/osiris` — a global situation board after [OSIRIS](https://github.com/simplifaisoul/osiris): a flat d3-geo world map on Canvas 2D with seven toggleable layers — aircraft and satellites replayed from the `/app/gev` snapshot, earthquakes, NASA FIRMS fires and EONET events from `public/data/osiris/hazards.json` (`scripts/capture-osiris-snapshot.mjs`), plus static news-bureau and conflict-zone tables. Layer toggles, a listbox of named marks and the detail panel are DOM; the map is decorative. Shares the console frame with the other consoles.
```

- [ ] **Step 5: Type-check and run the whole unit suite**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm test`
Expected: no type errors; all specs pass, including the three new files and the untouched `gev/tracks.spec.ts`.

- [ ] **Step 6: Start the dev server and check the page in a browser**

Run: `npm start` (leave running) and open `http://localhost:4200/app/osiris`.
Check, in order:
1. Coastlines draw with no line across the Pacific; aircraft (amber dots) drift; fires (orange) cluster on the fire belts; rose rings for quakes; rose/amber/teal squares for zones.
2. Every checkbox toggles its layer and its count is non-zero (`Fires 1500`, `Aircraft ~600`, …).
3. Turn on `News bureaus`, click the Sky News mark → detail panel with a muted playing iframe; `Close` removes it. Click NBC → an `Open on YouTube` link, no iframe.
4. Tab from the page: checkboxes → listbox (arrow keys move, Enter selects, the callout follows) → detail links/Close. `Esc` in the rail clears the selection.
5. `Fullscreen` chip; resize the window — the map refits, the rail stays in the right column.
6. DevTools → Network → Offline → reload: the page still renders (all data is local).
7. DevTools → Console: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/osiris/osiris-page.component.ts src/app/app.routes.ts e2e/smoke-screens.mjs ../README.md
git commit -m "osiris: the board page, route, e2e route and README entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Production build, budgets and e2e

**Files:** none new.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds; no `anyComponentStyle` warning for `osiris-page.component`; the initial bundle is unchanged (the page is a lazy chunk). Note the `osiris-page-component` lazy chunk size in the output — expect under ~150 kB (d3-geo is ~60 kB).

- [ ] **Step 2: e2e smoke**

Run: `npm run e2e`
Expected: the loop prints `/app/osiris | title: Osiris board | webgpu: …` with no `pageerror:` or `console.error:` lines before it, and `test-results/shot_app_osiris.png` exists.

- [ ] **Step 3: Look at the screenshot**

Open `test-results/shot_app_osiris.png`. It must show coastlines and marks, not a black frame. (A blank frame means the RAF loop never painted — check `start()` ran after `load()`.)

- [ ] **Step 4: Commit anything the build touched**

`git status` should be clean apart from `test-results/` (ignored). If `package-lock.json` or `public/` changed, stop and investigate before committing — nothing in this task should modify them.
