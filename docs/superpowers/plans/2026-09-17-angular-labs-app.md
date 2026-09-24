# Angular 22 visualization app: MorphCharts client, Ares/Vega, Google Merchandise, Human Atlas

## Context

The repo is a static GitHub Pages marketing site for Kong's Pharmaceutical (no npm, no build,
no CI; GSAP 3.13 and three.js from CDN; tokens in `styles.css`). The user wants a new Angular
application (latest = Angular 22.1) hosting four visualization pages, animated with GreenSock
Quad tweens with explicit delays and transitions, every visualization defined as a Vega-style
JSON spec, and a DuckDB backend behind a FastAPI (Python) API. Decisions confirmed with the user:

- App lives in `app/`, published to `/app/` on GitHub Pages beside the existing site.
- Backend: FastAPI + Python `duckdb` (hosted separately; Pages cannot run it).
- "Ares" = OHDSI Ares (Vue + Vega/Vega-Lite/vega-embed + D3 + DuckDB-WASM). The "Vega/D3 example
  page" recreates Ares-style data-characterization reports with Vega (whose SVG renderer is
  D3-based). The "Google Merchandise" page uses the public GA4 Google Merchandise Store sample.
- Human Atlas is a data-driven reinterpretation of https://github.com/ashemag/human-atlas built
  from its `atlas.json` catalogue (2,234 parts, 15 systems, 3,432 concepts, per-part 3D bounds in
  metres) rendered with MorphCharts marks, since MorphCharts renders procedural primitives.

Verified facts that shape the design:
- The MorphCharts client page uses three unpublished monorepo packages (`core`, `spec`,
  `renderers/webgpuraytrace`; ~25k lines TS, MIT, ES modules, only dep `@webgpu/types`, ~600
  uninitialised class fields so it cannot compile under Angular strict). npm `morphcharts@1.3.2`
  is an older core-only API without the Vega spec parser. Pinned upstream commit
  `508deab66bb7e2dffe7f7cfc45ee6a06c4b6d8e9`. Reference clone:
  `/tmp/claude-0/-home-user-kong-pharma-web/a4c3945a-51ae-5a5c-b023-18ddc1ce1c5f/scratchpad/morphcharts`.
- Render flow: `new WebGPURenderer.Main(canvas)` → `initializeAsync({atlasOptions:{width:4096,
  height:4096,type:"font"}, glyphRasterizerOptions:{size:192,border:0x18,edgeValue:
  Core.Config.sdfBuffer,maxDistance:0x40}})` → `Spec.Plot.fromJSONAsync(json,{datasets,images})`
  → `plot.createSceneAsync()` → `renderer.loadScene(scene)` → rAF loop (`camera.update`,
  `renderer.copyCamera`, `updateAsync`, `renderAsync`). Datasets inject by `file` key
  (`{"name":"parts","file":"parts.csv"}` reads `datasets["parts.csv"]`). Spec signals are
  evaluated once at parse time. No GPU pick readback (only segment/pick render modes). Marks
  become `Core.Buffer`s whose `dataView` can be mutated with `Core.UnitVertex.setTranslation/
  setScale`; calling the public `buffer.hasChangedCallback()` flags the visual for re-upload.
  `renderMode` "color" renders in one frame; "raytrace" accumulates and resets on change.
- Only four small CSVs (<13 KB) are referenced by sample specs; large data files belong to
  demos/gallery and are not needed.
- human-atlas pinned commit `1c38bf35c254a891200d3cedecfd57abebe83d8d`; `atlas.json` (1.3 MB) is
  fetchable from raw.githubusercontent.com. Data: BodyParts3D, CC BY 4.0 (attribution required).
  Reference clone: `.../scratchpad/human-atlas` (`app/anatomy.ts`, `app/page.tsx`,
  `app/scene.tsx`, `app/explosion-layout.ts`). Explode in scene.tsx is two-stage: t ≤ 0.45 radial
  by system angle (r 0.48, y compressed 0.28), t > 0.45 lerp to grid cell from
  `createExplosionLayout`.
- Versions: @angular/cli 22.1.8 (needs Node ≥ 22.22.3 or 24.15; sandbox has 22.22.2 → install
  Node 24 LTS from nodejs.org into the scratchpad, add `.nvmrc` = 24), gsap 3.15, vega 6.4,
  vega-lite 6.4, vega-embed 7.2, d3 7.9, duckdb 1.5.5, fastapi 0.141, Python 3.11.

## Repository layout to create

```
.nvmrc  .github/workflows/{pages.yml,ci.yml}  404.html (deep-link redirect snippet)
app/                                Angular 22 workspace (standalone, signals, zoneless, Vitest)
  package.json (workspaces → vendor pkgs)  angular.json  tsconfig*.json  proxy.conf.json
  scripts/vendor-morphcharts.sh     pinned sparse copy of core/spec/webgpuraytrace + sample assets
  vendor/morphcharts/{core,spec,renderers/webgpuraytrace}/{src,package.json,tsconfig.json}
  vendor/morphcharts/{tsconfig-base.json,globals.d.ts,LICENSE,UPSTREAM.json}
  vendor/tsconfig.{core,spec,webgpuraytrace}.json   wrapper tsconfigs → dist (prebuild)
  public/samples/{specs,images}     36 specs + index.json, 640x360 thumbnails only (~2 MB)
  public/data/                      4 small CSVs, atlas parts/concepts JSON, API snapshots
  src/app/
    app.config.ts  app.routes.ts   lazy routes: '', morphcharts, ares, merchandise, atlas, **
    shared/layout/shell.component.ts
    shared/styles/_tokens.scss      mirrors styles.css tokens (teal/ink/paper, fonts), dark only
    shared/animation/gsap.service.ts + route-transition.directive.ts
    shared/vega/vega-chart.component.ts + theme.ts
    shared/morphcharts/morphcharts-host.ts + morphcharts-canvas.component.ts + input/*.ts
    shared/webgpu/webgpu-support.ts + webgpu-fallback.component.ts
    shared/api/api.service.ts + models.ts (openapi-typescript output)
    shared/ui/ (tabs, divider, switch, slider, sheet, kpi-tile)
    features/home, features/morphcharts, features/ares, features/merchandise, features/atlas
api/                                FastAPI + DuckDB
  pyproject.toml  app/{main.py,db.py,models.py,routers/{merchandise,ares,atlas}.py,queries/*.sql}
  scripts/{extract_ga4.py,generate_omop_synthetic.py,build_atlas.py,export_openapi.py,snapshot_api.py}
  tests/  Dockerfile  openapi.json  data/ (generated parquet, gitignored)
```

## 1. Workspace, tooling, vendoring

- Node 24 tarball → scratchpad, PATH prefix. `npx @angular/cli@22.1.8 new app --directory app
  --style=scss --ssr=false --zoneless --skip-git`. Add gsap, vega, vega-lite, vega-embed, d3;
  dev: @webgpu/types, @playwright/test, openapi-typescript.
- `angular.json`: `@angular/build:application`, `baseHref "/app/"`, `outputPath dist/app`,
  `proxyConfig proxy.conf.json` (`/api` → `http://127.0.0.1:8000`), budgets (initial ≤ 600 kB
  warn; lazy morphcharts ≤ 1.2 MB, vega ≤ 1.5 MB), `fileReplacements` for
  `environment.production.ts` (`apiBase`, `snapshotFallback: true`).
- `tsconfig.app.json`: strict, `types: ["@webgpu/types"]`, `skipLibCheck: true`.
- Vendoring (recommended after evaluating submodule vs source `paths`): script-driven sparse
  copy at the pinned SHA into `app/vendor/morphcharts/` (no gallery/docs/data), `UPSTREAM.json`
  records repo/commit/date; update = bump SHA, re-run, review diff. npm workspaces link the three
  packages as `@microsoft/morphcharts-core|spec|webgpuraytrace`. Wrapper tsconfigs extend the
  upstream ones (`moduleResolution: bundler`, `incremental: false`, `declarationMap`), compiled
  core → spec → renderer by `npm run vendor:build`, wired into `prebuild`/`prestart`/`pretest`/
  `postinstall`. Angular consumes emitted JS + `.d.ts` only, so the non-strict upstream code is
  never type-checked under Angular strict. All `@microsoft/*` imports live behind
  `await import()` in `morphcharts-host.ts` so the renderer chunk is lazy and shared by
  `/morphcharts` and `/atlas`.
- `.gitignore` additions: `app/node_modules/`, `app/dist/`, `app/.angular/`,
  `app/vendor/morphcharts/**/dist/`, `*.tsbuildinfo`, `api/.venv/`, `api/data/**/*.parquet`.

## 2. Shell, GSAP service, route transitions, home

- Shell: top nav (brand mark copied from `assets/kongs-mark.png`), links to the four pages and
  "Back to site", footer attributions (MorphCharts MIT, BodyParts3D CC BY 4.0, GA4 sample,
  OHDSI Ares inspiration). SCSS tokens mirrored from `styles.css`; Google Fonts as in index.html.
- `GsapService`: `QUAD = {in:'quad.in', out:'quad.out', inOut:'quad.inOut'}`; one `MOTION`
  const for durations/delays/stagger; helpers `reveal(els,{delay,stagger:0.06})`,
  `slideIn(panel, from)`, `tweenNumber(signal, to, {duration, delay})`, `tweenObject`,
  `pageLeave()` / `pageEnter(host)` (teal wipe: quad.in 0.18 s out, quad.out 0.32 s in, then
  staggered `[data-reveal]` children). Honors `prefers-reduced-motion` (durations → 0).
- `RouteTransitionDirective` on the `router-outlet` host: `NavigationStart` → wipe out,
  outlet `activate` → wipe in + reveal. No `withViewTransitions` (keeps all easing in GSAP).
- Home hub: four cards, staggered entrance.
- Deep links under `/app/` on Pages: root `404.html` gets a snippet redirecting
  `/app/<path>` → `/app/?r=<path>`; `main.ts` navigates to `r` after bootstrap.

## 3. `/morphcharts` client recreation (`features/morphcharts/`)

- Port 1:1 into `shared/morphcharts/input/`: `pointers.ts`, `mousewheel.ts`, `manipulator.ts`,
  `manipulationprocessor.ts`, `keyboard.ts` (strict-mode fixes only). Logic-preserving ports:
  `editor.ts` → `SpecEditorComponent` (line numbers, current-line highlight, JSON error line
  highlight, drag-drop), `data.ts` → `DataTabComponent` (CSV/JSON/image upload into
  `datasets`/`images`, dataset select, 20-row paging, CSV/JSON export), `debug.ts` →
  `DebugOverlayComponent`.
- `MorphChartsHost` (plain class, one per canvas): `isSupported`, `initAsync(canvas)`,
  `loadSpecAsync(json,{datasets,images,includeCamera})`, `start/stop` rAF loop identical to
  `_tickAsync` (manipulation → camera → `copyCamera` → `updateAsync` → `renderAsync`,
  auto-capture/stop at max frames, tile advance), `resize`, `capture` (PNG via `toBlob`),
  `frameCount` signal (throttled), `signals()`/`datasets()` walkers over `plot.root`, passthrough
  setters for renderMode, idSource, cameraMode, maxBounceDepth, edge/depth options, tiles,
  fov/aperture/focus, `deviceLostCallback` → error signal, dispose on destroy/`beforeunload`.
- Page mirrors `client.html`: left canvas, draggable divider (min 320 px, default 480 px), right
  tabs Plot / Render / Data / Signals / Tiles, error strip, loading pill (200 ms show delay,
  500 ms min display). Plot tab: Start/Stop, Reset camera, Capture, Show Examples dialog (grid
  by category from `index.json`), Include camera, spec editor, `?plot=`/`?spec=` query param.
  Render tab: Debug, Size presets fit/HD/FHD/4K/8K/custom + Resize with device-limit checks,
  Mode ray/color/normal/edge/depth/segment, Max frames, FOV, Aperture, Focus, Max bounces, edge
  thickness/colours, depth auto/min/max, segment id source, Camera perspective/cylindrical.
  GSAP: tab cross-fade (quad.out 0.2 s), dialog scale-in, panel slide-in, frame counter tween.
- WebGPU fallback: explanatory card with thumbnails; the editor stays usable.

## 4. FastAPI + DuckDB API (`api/`)

- `pyproject.toml` (uv; fastapi, uvicorn, duckdb, pyarrow, pydantic; dev pytest, httpx, ruff).
  `db.py`: one read-only connection at startup with `read_parquet` views, per-request cursor,
  all filters as `?` parameters; CORS from `API_CORS_ORIGINS`; `/api/health`.
- Data scripts: `extract_ga4.py` (BigQuery `bigquery-public-data.ga4_obfuscated_sample_ecommerce`
  2020-11-01..2021-01-31 when credentials exist, else a seeded schema-faithful synthetic
  generator with the same columns: event_date, event_timestamp, event_name, user_pseudo_id,
  ga_session_id, device.category/os, geo.country, traffic_source.source/medium/name,
  ecommerce.transaction_id/purchase_revenue/total_item_quantity; plus `items.parquet` from
  `UNNEST(items)`); `generate_omop_synthetic.py` (seed 42: person, observation_period,
  condition_occurrence, drug_exposure, visit_occurrence, measurement, concept, dq_results;
  ~5k persons); `build_atlas.py` (download `atlas.json` at the pinned commit → parts/concepts
  parquet + trimmed `app/public/data/atlas/{parts,concepts}.json`); `export_openapi.py` →
  `api/openapi.json` → `npm run api:types`; `snapshot_api.py` → `app/public/data/snapshot/*.json`
  so the Pages build works when the API is offline (UI shows a "showing snapshot" banner).
- Endpoints (GET): `/api/merchandise/{kpis,daily,by-country,by-device,traffic-sources,funnel,
  top-items,revenue-cube}` with `from/to/limit`; `/api/ares/{summary,person/*,
  observation-period/*,density/*,concepts/{domain}/top,concepts/{id}/prevalence,quality}`;
  `/api/atlas/{parts,systems,concepts?q=,stats}`. Pydantic response models; pytest + httpx
  `TestClient` on a tiny generated dataset. `Dockerfile` runs the data scripts at build and
  serves with uvicorn; README notes for Fly/Render/Cloud Run and `environment.production.ts`.

## 5. `/merchandise` (GA4 sample)

- Date-range control (signals) re-queries; KPI tiles (sessions, users, purchases, revenue,
  conversion) with GSAP number tweens and staggered delays; `VegaChartComponent`
  (vega-embed, `renderer:'svg'`, dark config, named-data updates via `view.data().runAsync()`,
  ResizeObserver) rendering typed spec builders: daily sessions/revenue line+area, funnel bars
  with conversion labels, country bars, device donut, traffic-source stacked bars, top items.
- One MorphCharts 3D bar chart (revenue by country × month from `/revenue-cube`) built from the
  upstream `bar7`/`bar9` pattern, reusing `MorphChartsHost`, with fallback.

## 6. `/ares` (Vega + D3 reports over a synthetic OMOP-style dataset)

Ares report semantics are clinical, so the page uses the synthetic OMOP dataset rather than
GA4 data. Ares-style left report menu + card grid, cards revealed with staggered quad.out.
Reports as Vega 6 spec builders (`features/ares/specs/*.ts`): records by domain; person (age at
first observation, year of birth, sex, race); observation period (cumulative duration, length
distribution, age-by-sex pyramid); data density (records per month by domain, records per
person, concepts per person); concept prevalence (top-N by domain with selector, prevalence by
month for a selected concept); data quality overview (pass/fail by category) with KPI tiles.
D3 is used through Vega plus `d3-format`/`d3-time-format` for tile labels.

## 7. `/atlas` (Human Atlas)

- Data: static `public/data/atlas/*.json` first, API for search/stats. Port `SYSTEMS` (15 colours
  + descriptions), `DEFAULT_VISIBLE`, `EXPLANATIONS`, `explanation()`, and `explosion-layout.ts`.
- `build-atlas-spec.ts(state)` → MorphCharts JSON: plot in mm (700×1750×300, widened when
  exploded), `data:[{name:"parts",file:"parts.csv"}]` (CSV built in TS: id, name, system,
  cx/cy/cz, sx/sy/sz, exploded ex/ey/ez, angle, colour, selected; visibility/isolate filtering in
  TS), `rect` mark `geometry:"sphere"` (cuboid as option) with `xc/yc/zc` and
  `width/height/depth`, ordinal `fill` by system, `segmentId` = part index, integumentary
  low-opacity, floor `xzrect`, lights, background `#121c24`, camera preset via
  `{altitude, azimuth, worldDistance, worldTarget}` (three-quarter az 35° alt 8°, front 0°,
  side 90°, back 180°; explode > 0.8 forces front and fits the layout).
- Explode animation: keep `assembled[]` and `exploded[]` translations (two-stage formula as in
  scene.tsx). GSAP tweens `t` (quad.inOut 0.9 s; slider scrubs `t` directly); per tick write
  lerped translations with `Core.UnitVertex.setTranslation(buffer.dataView, i, v)` then
  `buffer.hasChangedCallback()`; renderer in `color` mode during motion, back to `raytrace`
  300 ms after rest. Fallback if the buffer path misbehaves: coalesced spec rebuild once per
  frame with the `explode` signal. Hidden/isolated parts via `setScale` to zero.
- Selection: CPU ray–sphere picking (camera position/forward/right/up/fov + canvas px, parts in
  camera space via `plot.worldToCameraPosition`), tap-vs-drag logic from `pointer-tap.ts`;
  highlight by brightening fill. Camera presets tween `{altitude, azimuth, distance}` (quad.inOut
  0.8 s) → `Spec.Camera.fromJSON` → `camera.copyFrom`; auto-rotate via `gsap.ticker`.
- UI parity with `page.tsx`: header, systems panel (All/Skeleton/Organs presets, rows with dot,
  count, switch, show-only, Hide all, pieces-visible count), search panel (`/` shortcut,
  concept combobox, default suggestions, ≤ 80 results sorted by name length), view controls
  (¾/F/S/B, rotate, reset with the same disabled rules), scene caption, bottom dock explode
  slider, detail sheet (system accent, explanation, atlas reference, included structures ≤ 50,
  Isolate/Clear), about sheet with CC BY 4.0 links, footer hints, loading/error states.
- Fallback without WebGPU: Vega treemap (systems → parts by volume) + system bars.

## 8. Build and deploy

- `.github/workflows/pages.yml` (push to `master`, manual dispatch): setup-node 24, `npm ci`,
  `npm run build` in `app/` (runs `vendor:build`), assemble `_site/` from an allowlist of root
  static files + `app/dist/app/browser` → `_site/app/`, `configure-pages` /
  `upload-pages-artifact` / `deploy-pages`. Tell the user to switch the Pages source to
  "GitHub Actions". `ci.yml` on PRs: vitest, `ng build`, pytest, Playwright smoke.
- Root: `404.html` redirect snippet, "Labs" nav link to `/app/` in `index.html`, README section,
  `docs/superpowers/plans/2026-09-17-angular-app.md` in the repo's plan format.

## Verification

1. `node -v` (24); `cd app && npm run build` (vendor tsc + `ng build`, budgets pass; confirm
   `@microsoft/*` and `vega*` absent from the initial chunk); `npm test` (Vitest: GSAP service
   eases/reduced-motion, spec builders snapshot, explosion layout, VegaChart data update, API
   client fallback, editor error-line parsing, manipulation maths).
2. `cd api && uv run pytest`; `uv run uvicorn app.main:app`; `curl localhost:8000/api/merchandise/kpis`.
3. `npm start` with proxy; Playwright (pre-installed Chromium) from a local static server of
   `_site` with `/app/` base: all routes render, Vega SVG nodes present, merchandise with mocked
   `/api` routes, MorphCharts fallback asserted when `navigator.gpu` is absent; second project
   with `--enable-unsafe-webgpu --use-angle=swiftshader` loads `bar2.json`, Start, asserts
   `frameCount > 0` and a non-blank canvas pixel, else `test.skip`. Screenshots saved.
4. Manual: 4K preset gating, device-lost message, divider drag, samples grid, spec error
   highlight, atlas explode at 0/45/100 %, isolate + camera fit, search `/`, reduced motion,
   mobile layout, deep link `/app/atlas`, API-offline banner.

## Implementation order

1. Node 24, workspace, tokens, shell, GSAP service, routes, home. 2. Vendoring + prebuild + a bare
canvas rendering `bar2.json`. 3. `MorphChartsHost`, canvas, input ports, fallback. 4. MorphCharts
client page. 5. API skeleton, DuckDB layer, GA4 extract/synthetic, merchandise endpoints, tests,
OpenAPI types. 6. VegaChart + merchandise page. 7. OMOP synthetic data, Ares endpoints + page.
8. Atlas pipeline, spec builders, scene service, picking, UI. 9. Workflows, 404 redirect,
Dockerfile, environments, README. 10. Tests, Playwright, budgets, final build, commit, push.

## Risks

- WebGPU unavailable in headless/Linux CI and some browsers: every MorphCharts view has a
  fallback and handles `deviceLostCallback`; presets gated by device limits.
- ~25k lines vendored: kept out of strict type-checking by precompiling; pinned SHA + UPSTREAM.json.
- Vega 6 vs Ares's Vega 5 (ESM-only, `params` instead of `selection`): specs authored fresh for 6.
- GA4 without credentials: synthetic but schema-faithful, labelled "synthetic sample" in the UI.
- FastAPI needs its own host; the Pages build stays usable via JSON snapshots.
- MorphCharts `.d.ts` types are non-nullable where runtime values can be null; guard in app code.

## Progress (plan mode was re-entered mid-implementation; resume from here)

Done so far (uncommitted, in the working tree):
- Node 24.21 installed in the scratchpad (`.../scratchpad/node24/bin`, prepend to PATH); `.nvmrc` = 24 at root and in `app/`.
- `app/` scaffolded with Angular CLI 22.1.8 (standalone, zoneless, SCSS, Vitest); deps gsap 3.15, vega 6.4,
  vega-lite 6.4, vega-embed 7.2, d3 7.9; dev deps @webgpu/types, @types/d3, @playwright/test.
  `openapi-typescript` skipped (peer-requires TypeScript 5; the scaffold uses TypeScript 6.0), so API
  models will be hand-written in `shared/api/models.ts`.
- `app/scripts/vendor-morphcharts.sh` written and run (supports `MORPHCHARTS_SRC` to reuse a local clone);
  `app/vendor/morphcharts/{core,spec,renderers/webgpuraytrace}` + `UPSTREAM.json`, samples specs,
  34 thumbnails and 4 CSVs copied into `app/public`. npm workspaces link the three packages.
- `angular.json` (baseHref `/app/`, budgets, proxy, fileReplacements), `package.json` scripts
  (`vendor:build` as pre-step), `proxy.conf.json`, environments, `index.html`, tokens, global styles,
  `GsapService` + `motion.ts` + `RouteTransitionDirective`, routes, `app.config.ts`, `main.ts` (deep-link
  `?r=` handling), shell (`app.ts/html/scss`), home page.

Known failure to fix first when resuming:
- `npm run vendor:build` fails with 154 errors because TypeScript 6 defaults `strict` to true and the
  upstream `tsconfig-base.json` never sets it. Fix in the three wrapper tsconfigs
  (`app/vendor/tsconfig.*.json`): add `"strict": false`, `"strictNullChecks": false`,
  `"strictPropertyInitialization": false`, `"noImplicitAny": true`, and re-run the build (core → spec →
  renderer). Then `ng build` to confirm the app compiles before continuing with task 3.

Remaining tasks in order: 3 MorphChartsHost/canvas/input/fallback → 4 client page → 5 API → 6 merchandise
→ 7 ares → 8 atlas → 9 workflows/docs → 10 verification, commit, push to `claude/sharp-lamport-4usi0o`.
