# OSIRIS console (`/app/osiris`) — design

Date: 2026-09-21. Status: approved design, awaiting implementation plan.

## Why

[OSIRIS](https://github.com/simplifaisoul/osiris) (MIT) is a Next.js 16 / React 19 / MapLibre GL
OSINT dashboard: a world map with toggleable live-data layers (flights, satellites, earthquakes,
fires, weather, news streams, conflict zones, CCTV, …) and HUD panels. Kong's Labs (`app/`) is
Angular 22, so OSIRIS cannot be dropped in as a component, and its data layer is 147 Next.js server
routes that proxy and scrape third-party sources. A full port is a rewrite.

What is worth having is the *board*: a flat world map, a handful of layers with live entity counts,
and click-to-inspect. This page ports that subset as a sibling of the existing consoles
(`/app/gev`, `/app/hud`, `/app/site-map`, `/app/controls`), in their painted-chrome style, fed by
committed snapshots so it works on GitHub Pages with the network off.

## Decisions

| Question | Decision |
| --- | --- |
| Integrate vs port | Port a subset as an Angular page. No iframe, no Docker. |
| Layers | Flights, satellites, earthquakes (reuse gev snapshot); fires (NASA FIRMS); severe weather (NASA EONET); news streams and conflict zones (static tables copied from OSIRIS). CCTV and the RECON toolkit are out of scope. |
| Look | Labs console look: `ConsoleStageComponent` frame, `fui-panels` chrome, `PALETTE` teal. Not OSIRIS's Tailwind/cyan look. |
| Map engine | Flat equirectangular map on d3-geo + Canvas 2D. Zero new dependencies. MapLibre rejected (remote tiles, +800 kB, no offline). Reusing the three.js globe from `gev-scene.ts` rejected (a globe hides half the world; refactoring gev risks regressions). |
| Data | Committed JSON + static TS. No live fetches, no API keys, no FastAPI routes. |

## Data sources (all verified keyless on 2026-09-21)

| Layer | Source | Snapshot |
| --- | --- | --- |
| Flights, satellites, earthquakes | `app/public/data/gev/tracks.json`, written by `app/scripts/capture-gev-snapshot.mjs` (adsb.lol, Celestrak, USGS) | reused as-is; gev untouched |
| Fires | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv` — 1.6 MB, ~21 k rows (the VIIRS file is the same shape at 9.6 MB / 118 k rows; MODIS is enough at world scale) | drop `confidence < 30`, keep the 1 500 highest-`frp` detections → `fires` in `app/public/data/osiris/hazards.json` |
| Severe weather | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200` (~90 open events; wildfires kept — they are named, unlike FIRMS pixels) | `events` in `app/public/data/osiris/hazards.json`; last geometry entry, Points only |
| News streams | `LIVE_FEEDS` in OSIRIS `src/app/api/live-news/route.ts` (15 broadcasters, 8 with `embed_allowed: true`) | static `news-feeds.ts` storing only the YouTube channel id; URLs are built in code |
| Conflict zones | `KNOWN_CONFLICTS` in OSIRIS `src/app/api/conflicts/route.ts` (15 zones: id, label, severity `war\|high\|elevated\|moderate`, lat, lng, description, sourceUrl) | static `conflict-zones.ts`; `queries`/`bounds` and the GDELT live enrichment are dropped |

Coastlines come from the existing `app/public/data/gev/world-110m.json` via `decodeArcs()`.

## Architecture

- **Route** `osiris` → lazy `OsirisPageComponent`. Single segment, like every route (baseHref `./`).
- **Frame**: `<app-console-stage [fill]="true" (track)>`. The page projects one `<canvas>` and
  four DOM islands: a **layer panel** (checkboxes with live counts), a **rail** (`cdkListbox` of
  the named marks — news, zones, events — the keyboard path to everything with a payload), a
  **detail panel** (selected mark), and `[console-info]` attribution.
- **Scene** (`OsirisScene`): owns the canvas; fits a `geoEquirectangular` projection to the stage
  with a right-hand band reserved for painted chrome; draws coastlines, then each enabled layer's
  marks, then chrome (`slab`, `statusBar`, `microRail`, `channelPanel`, `callout`, `corners` from
  `fui-panels`). `geoPath` clips coastline arcs at the antimeridian, which is the reason to use
  d3-geo rather than a hand-rolled `(lon+180)/360` projection.
  One `requestAnimationFrame` loop advances flights with `deadReckon()` and satellites with
  `satelliteAt()` from `features/gev/tracks.ts`; static layers are drawn once to an offscreen
  canvas and blitted. Paused on `visibilitychange`.
- **Layer registry** (`layers.ts`): `LAYERS: LayerMeta[]`, each metadata only —
  `{ id, label, colour, glyph, named, moving, defaultOn }`. `Mark` is
  `{ layer, id, lat, lon, label, lines, url?, embed?, size, color? }`. Pure mappers
  (`marksFromCraft`, `marksFromSats`, `marksFromQuakes`, `marksFromFires`, `marksFromEvents`,
  `marksFromFeeds`, `marksFromZones`) and a `nearest(pts, x, y, radius)` hit-test. No DOM; the
  scene wires each layer's mapper in its own `load()`. Adding a layer is a registry entry, a
  mapper, and one line in `load()`.
- **Page state**: signals `enabled: Set<LayerId>`, `counts: Record<LayerId, number | null>`,
  `selected: Mark | null`.

## Files

Under `app/src/app/features/osiris/` unless noted.

| File | Responsibility |
| --- | --- |
| `osiris-page.component.ts` | Standalone component: template, islands, signals, `afterNextRender` lazy-imports `./osiris-scene`, `ResizeObserver` on `stageElement()`, `LiveAnnouncer` on selection, `GsapService` reveal. Component styles must stay under the 24 kB `anyComponentStyle` budget. |
| `osiris-scene.ts` | `class OsirisScene { resize(w,h); setLayers(marks); setEnabled(set); track(nx,ny); pick(); dispose() }` — canvas painting, projection, replay loop, hover callout. |
| `layers.ts` | Types, `LAYERS` registry, mappers, `nearest()`. |
| `layers.spec.ts` | Vitest, mirrors `features/gev/tracks.spec.ts`. |
| `news-feeds.ts`, `conflict-zones.ts` | Typed static tables copied from OSIRIS (MIT; attribution in the Info panel). Siblings, not a `data/` subfolder — gev keeps its tables flat too. |
| `app/scripts/capture-osiris-snapshot.mjs` | Hand-run capture of fires and events, same `get()`/retry/`user-agent` idiom as `capture-gev-snapshot.mjs`. Not part of the build. |
| `app/public/data/osiris/hazards.json` | Committed snapshot `{ captured, fires, events }`, ~75 kB. The script refuses to overwrite when `fires` is empty, as gev's does. |
| Modified: `app/src/app/app.routes.ts` (+1 route), `app/e2e/smoke-screens.mjs` (+`/app/osiris`), root `README.md` (+1 Labs bullet). | Home cards untouched; the other consoles are not listed there either. |

Nothing in `features/gev/` changes. `tracks.ts` is imported across features the way
`gev-scene.ts` already imports `features/map/sites`.

## Interaction

- **Layer toggles**: a `<fieldset>` of native checkboxes, label + live count (`Flights 612`).
  Default on: flights, quakes, fires, conflicts. Default off: sats, weather, news.
- **Hover**: stage `(track)` → `scene.track()` → nearest enabled mark within 10 px → painted
  callout.
- **Select**: click on the canvas, or arrow/Enter in the rail listbox → `selected` → detail panel
  shows kind-specific fields — quake: magnitude,
  depth, time; fire: FRP, confidence, satellite; event: category, date; zone: severity,
  description, source link; feed: name, city, embed or external link. `LiveAnnouncer` speaks
  "Selected: …". `Esc` clears the selection.
- **News embeds**: only `embed_allowed: true` feeds get an `<iframe>` (`youtube-nocookie.com`,
  `mute=1`, `loading="lazy"`, `sandbox="allow-scripts allow-same-origin"`, `title`), created on
  click and removed on deselect — nothing autoplays on load. Others are an external
  `<a target="_blank" rel="noopener">`. The `embed_allowed` flags are copied from upstream and
  labelled as verified upstream in 2026-09.
- **Mass layers** (fires, quakes, aircraft, satellites) are selectable only by pointer on the
  canvas — an accepted limitation; named layers are the keyboard path.
- **Time**: the painted status bar shows `SNAPSHOT · <captured date> · REPLAY +hh:mm:ss`.
  Flights and satellites replay forward from `captured`; static layers show captured values.

## Error handling

- A layer whose JSON fails to load reads `—` for its count and its checkbox is disabled with
  `title="snapshot missing"`. Other layers still draw. Coastlines draw with zero layers.
- Each snapshot file degrades on its own: a missing world file means no coastlines, a missing
  tracks file means aircraft, satellites and quakes read `—`, a missing hazards file means fires
  and events read `—`. Every failure is one `console.warn`; `load()` never rejects.
- No layer is fatal; there is no network path to fail at runtime beyond the app's own assets.

## Accessibility and motion

- `<canvas role="img" aria-label="Decorative map: …">` with the counts in the label, as gev does.
  Everything actionable is real DOM (checkboxes, detail panel, links).
- `prefers-reduced-motion`: replay frozen at `captured`; reveal goes through `GsapService`'s
  existing gate.

## Testing and verification

- `layers.spec.ts`: each mapper yields valid `Mark[]` from fixture JSON; fire downsample keeps the
  highest `frp` and caps at 1 500; `nearest()` returns the right mark and `null` outside the
  radius; severity → colour is total.
- `npm test`; `npm run build` (initial budget unaffected — the page is lazy; component styles
  under 24 kB, target ≤ 7 kB like gev's 4.8 kB); `npm start` and open `/app/osiris`: toggle every
  layer, select one mark of each kind by mouse and by keyboard, no line across the Pacific,
  Fullscreen, `Esc`, DevTools Offline + reload still renders.
- `npm run e2e` with `/app/osiris` in the route list; the screenshot must not be blank.
- Run `capture-osiris-snapshot.mjs` once, commit the output, confirm `fires.length ≤ 1500` and
  size under 200 kB.

## Out of scope

CCTV (70 regional scrapers), the RECON toolkit (port/DNS/WHOIS/vuln scanning), crypto and
sanctions lookups, Telegram, markets, live GDELT enrichment, a FastAPI proxy for live data,
pan/zoom on the map.
