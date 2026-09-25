# DuckDB in the browser: the Screen page — design

Status: approved design, 2026-09-24. Supersedes the decisions in the imported note
`duckdb-grid-architecture.md` where they differ (grid choice, chart grammar, pagination, zones).

## Purpose

A new Labs route, `/app/screen`, that proves one architecture on millions of rows inside the
browser: a data grid and linked charts that are **siblings, each querying DuckDB**, with Arrow
columns as the transport and windowed SQL for the grid. The page is a showcase first. Its engine
is written so People (`/ares`) and Merchandise (`/merchandise`) can move onto it later and stop
depending on the FastAPI service; that migration is not part of this spec.

Readers are hiring managers and engineers evaluating the work from a link. The numbers on the page
are the exhibit: boot time, generation time, time to first row, brush latency, scroll frame rate.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Engine | `@duckdb/duckdb-wasm` in its worker, `eh` bundle | `coi` needs cross-origin isolation headers GitHub Pages cannot set |
| Coordination | `@uwdata/mosaic-core` `Coordinator` + one `Selection.crossfilter()` | Selections carry state; the coordinator's data-cube optimizer pre-aggregates grouped queries so brushing at 10M rows stays interactive |
| Charts | The existing `VegaChartComponent`, fed by Mosaic clients | One chart grammar on the site; no vgplot |
| Grid | Own component: a scroller with a scaled scrollbar (spacer capped at 15M px, scroll position mapped to a row index; wheel and keys move the index directly) | CDK's fixed-size strategy needs `rows × 28 px` of scroll height; at 5M rows that passes Chrome's ~33.5M px element limit. FUI styling stays native |
| Pagination | `ORDER BY … LIMIT n OFFSET k` | A scrollbar needs random access; keyset only fits sequential scrolling. DuckDB runs the offset as a top-N in low milliseconds at 10M rows |
| Arrow decoding | Whatever the coordinator returns (`flechette`) | Every query goes through the coordinator, so one decoder and one cache |
| Zones | None | The app is zoneless; signals drive change detection. There is no `runOutsideAngular` to call |
| Data | Generated in DuckDB from `range(n)` with a seed | Nothing to download, no repo bloat, deterministic, row count is a control |

New packages: `@uwdata/mosaic-core`, `@uwdata/mosaic-sql`. They bring `@duckdb/duckdb-wasm`
(pinned to an exact `1.33.1-dev` build by Mosaic) and `@uwdata/flechette`.

## Hard constraints

- No full result set ever leaves the worker as row objects. Only the grid's visible window plus
  one screen of overscan is converted to display strings.
- Every query on the page goes through the Mosaic coordinator.
- Grid window queries are `SELECT <cols> FROM screen WHERE <predicate> ORDER BY <sort> LIMIT n OFFSET k`,
  uncached.
- Chart queries are grouped aggregates with `filterBy` set to the brush, so the optimizer can index them.
- `DECIMAL` is never produced; generated columns are `DOUBLE`, `BIGINT`, `INTEGER`, `VARCHAR`,
  `BOOLEAN`, `TIMESTAMP`.
- Nothing outside `features/screen` and `shared/duck` imports the engine. The shell bundle does not grow.
- The wasm and worker files are local Angular assets, not CDN URLs.

## Dataset

Table `screen`, one row per assay well of a high-throughput screen, created by
`CREATE OR REPLACE TABLE screen AS SELECT … FROM range(:rows) t(i)`. All randomness is
`hash(i * k + seed)` scaled to `[0, 1)`, so the table is identical for a given `rows` and `seed`.

| column | type | derivation |
| --- | --- | --- |
| `well_id` | BIGINT | `i` |
| `plate` | INTEGER | `i // 384` |
| `well` | VARCHAR | `A01`…`P24` from `i % 384` |
| `target` | VARCHAR | one of the 14 symbols in `features/science/gene-stories.ts` (`GENE_ORDER`) |
| `library` | VARCHAR | one of 4 library names |
| `site` | VARCHAR | one of 5 site names |
| `conc_um` | DOUBLE | 8 log-spaced values, `0.01` to `30` µM |
| `inhibition` | DOUBLE | Box–Muller normal from two uniforms; mean shifted per target and per concentration, sd 12; clamped to `[-20, 120]` |
| `zscore` | DOUBLE | `(inhibition - avg) / stddev` over the plate, via a window function |
| `hit` | BOOLEAN | `zscore > 3` |
| `read_at` | TIMESTAMP | `TIMESTAMP '2026-01-05 08:00:00' + i * INTERVAL 2 SECOND` |

Row count control: `1,000,000` (default), `5,000,000`, `10,000,000`. The 10M key carries help
copy: "About 500 MB of browser memory. Desktop only." Generation runs single-threaded in the
worker and is expected in one to two seconds at 10M.

## Architecture

```
features/screen/screen-page          shared/duck/duckdb.service          worker
  ├─ toolbar (rows · reset · status)    ├─ AsyncDuckDB + connection  ⇄   duckdb-eh.wasm
  ├─ <app-duck-grid>  ── MosaicClient ─▶├─ Coordinator(wasmConnector)
  ├─ <app-linked-chart> ×4 ── clients ─▶│     └─ data-cube indexes for grouped queries
  └─ bench readout        ◀── marks ────┘
                 ▲
     Selection.crossfilter() "brush": charts write clauses, grid and charts read predicates
```

### Data flow

1. Route entry calls `DuckDbService.ready()`, which boots the worker and the coordinator once.
2. The page runs the generator (`exec`), then creates the brush.
3. Each `<app-linked-chart>` connects a Mosaic client with `filterBy = brush`. The coordinator
   runs its aggregate, the client pushes the small result into Vega.
4. `<app-duck-grid>` connects its own client with `filterBy = brush`. Its `query` is
   `SELECT count(*)`. On result it sets `total`, clears its sparse array and fetches the visible
   window with the current predicate.
5. Dragging on a chart fires Vega's `brush` signal. The chart converts it to a Mosaic clause and
   calls `brush.update(clause)`. The coordinator re-queries every other client. The grid re-counts
   and refetches; the charts refill.
6. Scrolling the grid emits viewport ranges. Debounced 30 ms, each range becomes one uncached
   window query. Rows arrive as an Arrow table; only that window is turned into strings.

The grid never feeds the charts. The charts never feed the grid.

## Components and interfaces

### `shared/duck/duckdb.service.ts` — `DuckDbService`, `providedIn: 'root'`

```ts
status: Signal<'idle' | 'booting' | 'ready' | 'failed'>
error: Signal<string | null>
ready(): Promise<Coordinator>                                   // idempotent; dynamic-imports duckdb-wasm and mosaic-core
query(sql: string, opts?: { cache?: boolean }): Promise<Table>  // through the coordinator
exec(sql: string): Promise<void>                                // DDL, uncached
```

Boot sequence: resolve bundle URLs against `document.baseURI` (`duckdb/duckdb-eh.wasm`,
`duckdb/duckdb-browser-eh.worker.js`), `new Worker(url)`, `new AsyncDuckDB(logger, worker)`,
`instantiate(wasmUrl)`, `connect()`, `new Coordinator()`,
`coordinator.databaseConnector(wasmConnector({ duckdb, connection }))`. Any throw sets `failed`
with the message and rejects `ready()`.

### `shared/duck/linked-chart.component.ts` — `<app-linked-chart>`

```ts
spec:    input.required<VegaSpecInput>()   // Vega-Lite spec with params: [{ name: 'brush', select: { type: 'interval' | 'point', … } }]
query:   input.required<(filter: FilterExpr[]) => Query>()   // grouped aggregate built with @uwdata/mosaic-sql
brush:   input.required<Selection>()
field:   input.required<string>()          // the column the chart's brush constrains
dataset: input('rows')                     // Vega dataset name to fill
height:  input(180)
```

Owns a `MosaicClient` subclass (`filterBy = brush`). `queryResult(table)` converts the aggregate
to rows and passes them to `VegaChartComponent` through its `data` input. On `viewReady` it adds a
signal listener for `brush`: an interval becomes `clauseInterval(field, [lo, hi], { source: client })`,
a point becomes `clausePoint(field, values, { source: client })`; an empty selection clears the
clause. Crossfilter resolution keeps a chart unfiltered by its own clause. `ngOnDestroy`
disconnects the client and removes the listener.

### `shared/duck/duck-grid.component.ts` — `<app-duck-grid>`

```ts
table:   input.required<string>()
columns: input.required<ColumnDef[]>()
brush:   input.required<Selection>()
rowHeight = 28
sort:       Signal<{ key: string; dir: 'asc' | 'desc' } | null>
total:      Signal<number>
firstRowAt: Signal<number | null>          // performance.now() when the first window painted
error:      Signal<string | null>

interface ColumnDef { key: string; label: string; width: number; align?: 'left' | 'right'; format?: (v: unknown) => string; sortable?: boolean }
```

Template: a sticky header row of `<button>` sort headers (`aria-sort`), then a scroller (`tabindex="0"`, `role="grid"`, `aria-rowcount`) containing a sticky window of rendered rows and a spacer whose height is `min(total × rowHeight, 15,000,000)`. Scroll position maps proportionally to a row index; wheel and arrow keys move the index directly and write the matching scroll position back. Unfetched rows render each cell as a dash. `viewChange` ranges are debounced 30 ms and
turned into one window query with one screen of overscan each side; a stale response (a newer
range or predicate has since been issued) is dropped by token. The component's Mosaic client
runs `count(*)`; its `queryResult` sets `total`, resets the array and refetches. Header click
cycles `asc → desc → none` and refetches the same window. Numbers are formatted per column with
`Intl.NumberFormat`, mono, `font-variant-numeric: tabular-nums`. Column widths are fixed from
`ColumnDef`; the grid scrolls horizontally if they exceed the viewport.

### `shared/duck/bench.ts` — `Bench`

`performance.mark`/`measure` helpers plus signals: `boot`, `generate`, `firstRow`, `brush`
(rolling median of the last 10 round-trips, clause update to the last client's `queryResult`),
`scrollFps` (rAF frames in the last second while the viewport scrolled), `longTasks`
(`PerformanceObserver` on `longtask`, entries over 50 ms since generate). Pure functions for the
median and the counting are exported for tests.

### `features/screen/`

- `screen-data.ts`: `SCREEN_TABLE = 'screen'`, `screenGeneratorSql(rows: number, seed: number): string`,
  `SCREEN_COLUMNS: ColumnDef[]`, `ROW_COUNTS = [1_000_000, 5_000_000, 10_000_000]`.
- `screen-specs.ts`: four Vega-Lite specs on the app's `vegaConfig(theme)`:
  `inhibition` histogram (interval), `zscore` histogram (interval), `hits by target` bars (point),
  `hits over time` by week (interval on `read_at`). Each with the matching `query` builder.
- `screen-page.component.ts`: toolbar (row-count `.keyrail` 1M · 5M · 10M, Reset key clearing the
  brush, status), the grid, a charts column, the bench readout strip. `?rows=` and `?sort=` in
  the URL through `shared/url-state.ts`. Reveal through `GsapService`.
- Route `screen` (`app.routes.ts`, title "Screen"), nav entry in the data group with People and
  Merchandise, icon added to `NAV_ICONS`.
- `angular.json`: asset entry copying `node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm` and
  `duckdb-browser-eh.worker.js` to `duckdb/`.

### Reuse

`VegaChartComponent` (`spec`, `data`, `viewReady`), `vegaConfig`, `ThemeService`, `GsapService`,
`.keyrail`/`.key`, `.eyebrow`, `glass`, `GlyphComponent`, `url-state.ts`,
`GENE_ORDER` from `gene-stories.ts`.

## Failure modes

- **Wasm fails to load or instantiate.** `status = 'failed'`; the page shows the site's fallback
  panel with "The screen needs WebAssembly" and the message; no grid or charts render. No other
  route imports the engine, so nothing else is affected.
- **Out of memory at 10M.** `exec` rejects; the page shows an inline `role="alert"` naming the
  count and re-runs the generator at the previous count.
- **A window or count query fails.** The grid keeps its rows, shows the message in its footer
  strip, and clears it on the next successful window. Charts keep their last aggregate.
- **Slow generation.** Status "Generating 10,000,000 wells…" with an indeterminate
  `role="progressbar"`; controls are `aria-disabled`, not `disabled`, so focus survives.
- **Reduced motion.** Only the shared reveal animates and it already honours the flag. Rows never animate.

## Benchmark

Shown on the page as a mono key/value strip, so the numbers are part of the exhibit.

| key | measured as |
| --- | --- |
| `BOOT` | `ready()` resolved − route entry |
| `GEN` | generator `exec` duration |
| `FIRST ROW` | first grid window painted (rAF after the source emits) − generate end |
| `BRUSH` | median of the last 10 brush round-trips |
| `SCROLL FPS` | rAF frames per second while the viewport scrolled in the last second |
| `LONG TASKS` | `longtask` entries over 50 ms since generate |

Targets: 60 fps scrolling, zero long tasks over 50 ms, reported at 1M and 10M rows. Measured
values are appended to this document after implementation (this machine, Chrome).

## Testing

- **Vitest (existing runner):** `screenGeneratorSql` is deterministic and embeds `rows` and
  `seed`; the window-SQL builder emits `WHERE`/`ORDER BY`/`LIMIT`/`OFFSET` correctly and omits an
  empty `WHERE`; `ColumnDef` formatters; `Bench` median and long-task counting; `GridSource`
  sparse-array fill given a window result and a stale-token drop.
- **Not unit-tested:** duckdb-wasm and Mosaic. They need a worker and a wasm binary jsdom lacks.
- **e2e smoke:** `/app/screen` added to `e2e/smoke-screens.mjs`, waiting for the `FIRST ROW`
  value before the screenshot. This exercises the worker, the asset path and the generator in Chromium.
- **Browser check before commit:** boot, brush a histogram, confirm the grid count and the other
  charts change, scroll to the bottom at 1M, switch to 10M, zero console errors.

## Deploy

- Same asset path in dev and in the Pages build; worker URL resolved against `document.baseURI`
  so `<base href="./">` and the `404.html` `?r=` shim keep working.
- Everything lazy: the route chunk imports the engine; the engine dynamic-imports duckdb-wasm and
  mosaic-core.
- No API required, so this route never shows the "API offline" badge.

## Out of scope

WebGPU scatter of a filtered sample (MorphCharts is already present; a later addition),
Perspective, People/Merchandise migration, Parquet-over-HTTP loading.

## Appendix: measurements

Chrome, this machine (macOS), 2026-09-24, dev server build. BOOT is with the 36 MB wasm already
in the browser cache; the first-ever visit adds the download.

| rows | BOOT | GEN | FIRST ROW | BRUSH (median) | SCROLL FPS | LONG TASKS |
| --- | --- | --- | --- | --- | --- | --- |
| 1M | 297 ms | 384 ms | 137 ms | 5 ms | 60 | 0 |
| 5M | 245 ms | 1,687 ms | 312 ms | — | — | 0 |
| 10M | 234 ms | 3,359 ms | 521 ms | 6 ms | 60 | 0 |

BRUSH at 5–6 ms on 10M rows means Mosaic's pre-aggregation is active: drags are answered from
materialised views, not by re-scanning the table. Re-measured after switching 10M → 1M → 10M, with
the views dropped and rebuilt on each regenerate: 5 ms, and the brushed count matches a fresh
`count(*)` under the same predicate.

One cost worth knowing: a window query far down a *sorted* 10M-row table (`ORDER BY zscore …
OFFSET 7,243,157`) takes 700–830 ms, because DuckDB's top-N heap has to hold the offset; the
same offset on the stable key takes 284 ms, and a shallow offset 53 ms. The grid shows dashes
until the rows arrive, so scrolling stays at 60 fps, but a scrollbar jump to the bottom of a
sorted 10M table is not instant.
