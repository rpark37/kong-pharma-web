# DuckDB Screen Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/app/screen` route where a virtualised grid and four linked Vega charts each query an in-browser DuckDB holding millions of generated assay wells, with brushing coordinated by Mosaic and the benchmark numbers shown on the page.

**Architecture:** `DuckDbService` boots duckdb-wasm in a worker and a Mosaic `Coordinator` over it. Charts and the grid are Mosaic clients filtered by one crossfilter `Selection`. Charts run grouped aggregates and feed the existing `VegaChartComponent`; the grid runs `count(*)` through Mosaic and windowed `LIMIT/OFFSET` queries for the rows on screen. Nothing passes through the grid to the charts.

**Tech Stack:** Angular 22 (zoneless, signals), `@uwdata/mosaic-core` 0.31, `@uwdata/mosaic-sql` 0.31, `@duckdb/duckdb-wasm` (pinned by Mosaic), `@uwdata/flechette` (Arrow decoding, via Mosaic), Vega-Lite via the repo's `VegaChartComponent`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-duckdb-screen-design.md`

## Spec amendment (made by Task 1)

The spec says the grid is "own component on `@angular/cdk` virtual scroll". CDK's fixed-size strategy maps rows to scroll height linearly. At 10M rows × 28 px that is 280M px, past Chrome's ~33.5M px element-height limit, and even 5M rows exceeds it. The grid therefore uses its own scroller with a **scaled scrollbar**: the spacer is capped at 15M px and scroll position maps proportionally to a row index; wheel and keys move the row index directly. Task 1 edits the spec's decision row to say so. Everything else in the spec stands.

## Global Constraints

- No full result set ever leaves the worker as row objects. Only the grid's visible window plus overscan is converted to display strings.
- Every query on the page goes through the Mosaic coordinator (`coordinator.query`, or a `MosaicClient`). Never call `connection.query` directly.
- Grid window queries: `SELECT <cols> FROM screen WHERE <predicate> ORDER BY <sort>, well_id LIMIT n OFFSET k`, uncached.
- Chart queries are grouped aggregates built with `@uwdata/mosaic-sql` `Query` objects (not strings), with `filterBy` set to the brush.
- Generated columns are `BIGINT`, `INTEGER`, `VARCHAR`, `DOUBLE`, `BOOLEAN`, `TIMESTAMP`. No `DECIMAL`.
- Nothing outside `app/src/app/features/screen/` and `app/src/app/shared/duck/` imports `@duckdb/duckdb-wasm` or `@uwdata/*`.
- duckdb-wasm `eh` bundle only; wasm and worker files are Angular assets under `duckdb/`, resolved against `document.baseURI`. No CDN URLs.
- The app is zoneless: no `NgZone`. State changes go through signals.
- Motion only through `GsapService`. Colours only through CSS tokens and `VEGA_COLORS`.
- Row counts offered: `1_000_000` (default), `5_000_000`, `10_000_000`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Commands run from `app/`: `npx tsc -p tsconfig.app.json --noEmit`, `npx ng test --watch=false`.

## Review Focus

1. **A brush that selects nothing** (drag off the bars, or a bin with zero rows): the grid shows `0` rows and dashes, charts show empty bars, nothing throws. Pinned in Task 4 (`windowRange` with `total = 0`) and Task 5 (spec has `n: 0` rows).
2. **A stale window response arriving after the predicate changed** must not paint old rows over new ones. Pinned in Task 4 (`RowWindow.accept` token test).
3. **Scrollbar at 10M rows**: the last row must be reachable and the first row must map to scrollTop 0. Pinned in Task 3 (`scrollToStart`/`startToScroll` round-trip tests at the extremes).
4. **Sort while scrolled** keeps the row index and refetches with the new order. Pinned in Task 4 (`windowSql` includes `ORDER BY` and the `OFFSET` of the current start).
5. **`?rows=` with garbage** (`?rows=abc`, `?rows=999`) falls back to the default count and never generates an unsupported size. Pinned in Task 6 (`parseRows` test).

---

## File structure

```
app/src/app/shared/duck/
  duckdb.service.ts          boot duckdb-wasm + Mosaic coordinator; query/exec
  window-sql.ts              pure: quoteIdent, windowSql
  window-sql.spec.ts
  row-window.ts              pure: scaled-scrollbar math + RowWindow cache with tokens
  row-window.spec.ts
  duck-grid.component.ts     <app-duck-grid>: scroller, header, Mosaic count client
  linked-chart.component.ts  <app-linked-chart>: Vega chart as a Mosaic client + brush clauses
  bench.ts                   pure median, BrushTimer, Bench class with signals
  bench.spec.ts
app/src/app/features/screen/
  screen-data.ts             SCREEN_TABLE, screenGeneratorSql, SCREEN_COLUMNS, ROW_COUNTS, parseRows
  screen-data.spec.ts
  screen-specs.ts            four Vega-Lite specs + their mosaic-sql query builders
  screen-page.component.ts   the route
app/angular.json             duckdb assets
app/src/app/app.routes.ts    route
app/src/app/app.ts           nav entry
app/src/app/shared/ui/nav-icon.component.ts   'screen' icon
app/e2e/smoke-screens.mjs    route + wait for FIRST ROW
docs/superpowers/specs/2026-09-24-duckdb-screen-design.md   amendment + measurements
```

---

### Task 1: Packages, assets, `DuckDbService`, and a page shell that boots the engine

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-duckdb-screen-design.md` (Decisions table, Grid row)
- Modify: `app/package.json` (via `npm install`)
- Modify: `app/angular.json` (assets)
- Create: `app/src/app/shared/duck/duckdb.service.ts`
- Create: `app/src/app/features/screen/screen-page.component.ts` (shell only)
- Modify: `app/src/app/app.routes.ts`
- Modify: `app/src/app/app.ts`
- Modify: `app/src/app/shared/ui/nav-icon.component.ts`

**Interfaces:**
- Produces: `DuckDbService` with `status: Signal<'idle'|'booting'|'ready'|'failed'>`, `error: Signal<string|null>`, `ready(): Promise<Coordinator>`, `query(sql: string, opts?: { cache?: boolean }): Promise<Table>`, `exec(sql: string): Promise<void>`, `bootMs: Signal<number|null>`.

- [ ] **Step 1: Amend the spec's grid decision**

In `docs/superpowers/specs/2026-09-24-duckdb-screen-design.md`, replace the Grid row of the Decisions table:

```markdown
| Grid | Own component: a scroller with a scaled scrollbar (spacer capped at 15M px, scroll position mapped to a row index; wheel and keys move the index directly) | CDK's fixed-size strategy needs `rows × 28 px` of scroll height; at 5M rows that passes Chrome's ~33.5M px element limit. FUI styling stays native |
```

And in "Components and interfaces → `duck-grid.component.ts`", replace the sentence beginning "Template: a sticky header row" through "the scrollbar length is right" with:

```markdown
Template: a sticky header row of `<button>` sort headers (`aria-sort`), then a scroller (`tabindex="0"`, `role="grid"`, `aria-rowcount`) containing a sticky window of rendered rows and a spacer whose height is `min(total × rowHeight, 15,000,000)`. Scroll position maps proportionally to a row index; wheel and arrow keys move the index directly and write the matching scroll position back.
```

- [ ] **Step 2: Install the packages**

Run from `app/`:

```bash
npm install @uwdata/mosaic-core@0.31.0 @uwdata/mosaic-sql@0.31.0
ls node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js
```

Expected: both files listed. `postinstall` runs `vendor:build`; a failure there is a TypeScript error in the vendored MorphCharts, unrelated to this install.

- [ ] **Step 3: Copy the wasm and worker as assets**

In `app/angular.json`, under `projects.app.architect.build.options.assets`, after the existing `public` glob entry add:

```json
{ "glob": "duckdb-eh.wasm", "input": "node_modules/@duckdb/duckdb-wasm/dist", "output": "duckdb" },
{ "glob": "duckdb-browser-eh.worker.js", "input": "node_modules/@duckdb/duckdb-wasm/dist", "output": "duckdb" }
```

- [ ] **Step 4: Write `DuckDbService`**

Create `app/src/app/shared/duck/duckdb.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import type { Coordinator } from '@uwdata/mosaic-core';
import type { Table } from '@uwdata/flechette';

export type DuckStatus = 'idle' | 'booting' | 'ready' | 'failed';

/**
 * One DuckDB in a worker, one Mosaic coordinator over it. Nothing loads until a page calls
 * `ready()`; the wasm is ~36 MB, so only the routes that need it pay for it.
 *
 * Every query goes through the coordinator: one Arrow decoder (flechette), one result cache,
 * and the pre-aggregation optimizer sees every client. Nothing here calls the raw connection.
 */
@Injectable({ providedIn: 'root' })
export class DuckDbService {
  readonly status = signal<DuckStatus>('idle');
  readonly error = signal<string | null>(null);
  /** Wall time of the first boot, for the bench strip. */
  readonly bootMs = signal<number | null>(null);
  private booting: Promise<Coordinator> | null = null;
  private coordinator: Coordinator | null = null;

  ready(): Promise<Coordinator> {
    if (!this.booting) this.booting = this.boot().catch((err) => { this.booting = null; throw err; });
    return this.booting;
  }

  async query(sql: string, opts: { cache?: boolean } = {}): Promise<Table> {
    const c = await this.ready();
    return c.query(sql, { type: 'arrow', cache: opts.cache ?? true }) as Promise<Table>;
  }

  async exec(sql: string): Promise<void> {
    const c = await this.ready();
    await c.exec(sql);
  }

  private async boot(): Promise<Coordinator> {
    const t0 = performance.now();
    this.status.set('booting');
    this.error.set(null);
    try {
      const [duckdb, mosaic] = await Promise.all([import('@duckdb/duckdb-wasm'), import('@uwdata/mosaic-core')]);
      // Local assets (angular.json copies them to duckdb/); resolved against the base href so
      // both the dev server and the Pages deploy under /app/ find them.
      const wasm = new URL('duckdb/duckdb-eh.wasm', document.baseURI).href;
      const workerUrl = new URL('duckdb/duckdb-browser-eh.worker.js', document.baseURI).href;
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(wasm);
      const connection = await db.connect();
      const coordinator = new mosaic.Coordinator();
      coordinator.databaseConnector(mosaic.wasmConnector({ duckdb: db, connection }));
      this.coordinator = coordinator;
      this.bootMs.set(Math.round(performance.now() - t0));
      this.status.set('ready');
      return coordinator;
    } catch (err) {
      this.status.set('failed');
      this.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
```

If `coordinator.exec` does not exist in the installed build, replace the body of `exec` with `await c.query(sql, { type: 'exec', cache: false });`. Check with `grep -n "exec(" node_modules/@uwdata/mosaic-core/dist/src/Coordinator.d.ts`.

- [ ] **Step 5: Add the nav icon**

In `app/src/app/shared/ui/nav-icon.component.ts`, inside `NAV_ICONS` after the `merchandise` entry, add:

```ts
  screen: { motion: 'pulse', d: 'M2 3h12v10H2zM2 6.5h12M2 10h12M6 3v10M10 3v10' },
```

- [ ] **Step 6: Add the route and nav entry**

In `app/src/app/app.routes.ts`, after the `merchandise` route add:

```ts
  { path: 'screen', loadComponent: () => import('./features/screen/screen-page.component').then((m) => m.ScreenPageComponent), title: 'Screen' },
```

In `app/src/app/app.ts`, in the `Data` group's `children` after Merchandise add:

```ts
        { path: '/screen', label: 'Screen', icon: 'screen' },
```

- [ ] **Step 7: Write the page shell**

Create `app/src/app/features/screen/screen-page.component.ts`:

```ts
import { Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { DuckDbService } from '../../shared/duck/duckdb.service';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';

/**
 * High-throughput screen results, millions of wells, entirely in the browser: DuckDB in a
 * worker, a windowed grid and linked charts that each query it, coordinated by Mosaic.
 */
@Component({
  selector: 'app-screen-page',
  imports: [WebGpuFallbackComponent],
  template: `
    <header class="head">
      <p class="eyebrow" data-reveal>Assay wells · DuckDB in the browser</p>
      <h1 data-reveal>Screen</h1>
    </header>
    @if (duck.status() === 'failed') {
      <div class="fallback-wrap glass" data-reveal>
        <app-webgpu-fallback title="The screen needs WebAssembly"><p class="small">{{ duck.error() }}</p></app-webgpu-fallback>
      </div>
    } @else {
      <p class="status mono" data-reveal aria-live="polite">{{ statusText() }}</p>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 16px; }
    .status { font-size: 12px; color: var(--on-ink-dim); }
    .fallback-wrap { padding: 24px; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
  `,
})
export class ScreenPageComponent {
  readonly duck = inject(DuckDbService);
  readonly statusText = signal('Booting DuckDB…');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.duck.ready().then(() => this.statusText.set(`DuckDB ready in ${this.duck.bootMs()} ms`)).catch(() => undefined);
    });
  }
}
```

- [ ] **Step 8: Typecheck and check the boot in a browser**

Run from `app/`:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: exit 0. Then with the dev server running (`npm start` in `app/`, port 4200), open `http://localhost:4200/screen`. Expected: the status line changes from "Booting DuckDB…" to "DuckDB ready in N ms" within a few seconds, and the Network panel shows `duckdb/duckdb-eh.wasm` served with status 200 from localhost. No console errors.

If the worker fails with a cross-origin or MIME error, confirm the asset paths by opening `http://localhost:4200/duckdb/duckdb-browser-eh.worker.js` directly.

- [ ] **Step 9: Run the test suite and commit**

```bash
npx ng test --watch=false
```

Expected: all existing tests pass (133 at the time of writing).

```bash
git add app/package.json app/package-lock.json app/angular.json app/src/app/shared/duck/duckdb.service.ts app/src/app/features/screen/screen-page.component.ts app/src/app/app.routes.ts app/src/app/app.ts app/src/app/shared/ui/nav-icon.component.ts docs/superpowers/specs/2026-09-24-duckdb-screen-design.md
git commit -m "screen: DuckDB in a worker behind a Mosaic coordinator, page shell and route

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The generated dataset

**Files:**
- Create: `app/src/app/features/screen/screen-data.ts`
- Create: `app/src/app/features/screen/screen-data.spec.ts`
- Modify: `app/src/app/features/screen/screen-page.component.ts`

**Interfaces:**
- Consumes: `DuckDbService.exec`, `GENE_ORDER` from `features/science/gene-stories.ts`.
- Produces: `SCREEN_TABLE: 'screen'`, `ROW_COUNTS: readonly [1_000_000, 5_000_000, 10_000_000]`, `DEFAULT_ROWS = 1_000_000`, `screenGeneratorSql(rows: number, seed: number): string`, `parseRows(raw: string | null): number`, `SCREEN_COLUMNS: ColumnDef[]`, `ColumnDef` type (defined here, re-exported by the grid in Task 4).

- [ ] **Step 1: Write the failing tests**

Create `app/src/app/features/screen/screen-data.spec.ts`:

```ts
import { DEFAULT_ROWS, ROW_COUNTS, SCREEN_COLUMNS, SCREEN_TABLE, parseRows, screenGeneratorSql } from './screen-data';

describe('screenGeneratorSql', () => {
  it('creates the screen table from a range of the requested size', () => {
    const sql = screenGeneratorSql(1_000_000, 7);
    expect(sql).toContain(`CREATE OR REPLACE TABLE ${SCREEN_TABLE}`);
    expect(sql).toContain('range(1000000)');
  });

  it('is deterministic for a seed and differs across seeds', () => {
    expect(screenGeneratorSql(1000, 7)).toBe(screenGeneratorSql(1000, 7));
    expect(screenGeneratorSql(1000, 7)).not.toBe(screenGeneratorSql(1000, 8));
  });

  it('selects every grid column by name', () => {
    const sql = screenGeneratorSql(1000, 1);
    for (const c of SCREEN_COLUMNS) expect(sql).toContain(`AS ${c.key}`);
  });

  it('rejects unsupported row counts', () => {
    expect(() => screenGeneratorSql(123, 1)).toThrow(/row count/);
  });
});

describe('parseRows', () => {
  it('accepts the offered counts and falls back to the default otherwise', () => {
    expect(parseRows('5000000')).toBe(5_000_000);
    expect(parseRows('10000000')).toBe(10_000_000);
    expect(parseRows('999')).toBe(DEFAULT_ROWS);
    expect(parseRows('abc')).toBe(DEFAULT_ROWS);
    expect(parseRows(null)).toBe(DEFAULT_ROWS);
    expect(ROW_COUNTS).toContain(DEFAULT_ROWS);
  });
});

describe('SCREEN_COLUMNS', () => {
  it('formats a timestamp cell from epoch milliseconds or a Date', () => {
    const readAt = SCREEN_COLUMNS.find((c) => c.key === 'read_at')!;
    const ms = Date.UTC(2026, 0, 5, 8, 0, 0);
    expect(readAt.format!(ms)).toBe(readAt.format!(new Date(ms)));
    expect(readAt.format!(ms)).toMatch(/2026/);
  });

  it('formats inhibition to one decimal and hits as a mark', () => {
    expect(SCREEN_COLUMNS.find((c) => c.key === 'inhibition')!.format!(12.345)).toBe('12.3');
    expect(SCREEN_COLUMNS.find((c) => c.key === 'hit')!.format!(true)).toBe('HIT');
    expect(SCREEN_COLUMNS.find((c) => c.key === 'hit')!.format!(false)).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx ng test --watch=false --include='**/screen-data.spec.ts'
```

Expected: FAIL, module `./screen-data` not found.

- [ ] **Step 3: Write `screen-data.ts`**

```ts
import { GENE_ORDER } from '../science/gene-stories';

export const SCREEN_TABLE = 'screen';
export const ROW_COUNTS = [1_000_000, 5_000_000, 10_000_000] as const;
export const DEFAULT_ROWS = 1_000_000;
export const SEED = 2026;

/** One grid column: which table column, how wide, how to show a cell. */
export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  format?: (v: unknown) => string;
  sortable?: boolean;
}

const LIBRARIES = ['LIB-A', 'LIB-B', 'LIB-C', 'LIB-D'];
const SITES = ['Boston', 'Basel', 'Shanghai', 'Seoul', 'Oxford'];
const CONCENTRATIONS = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];
/** Mean inhibition shift per target, in GENE_ORDER order: some targets are simply more druggable in this screen. */
const TARGET_SHIFT = [12, 4, 6, 18, 9, 3, 15, 2, 5, 7, 11, 8, 14, 6];
const SD = 12;

const list = (xs: readonly (string | number)[]) => `[${xs.map((x) => (typeof x === 'string' ? `'${x}'` : x)).join(', ')}]`;
/** A uniform in [0, 1) from the row index: hash is a stable 64-bit mix, so the table is identical for a seed. */
const uniform = (mult: number, seed: number) => `(hash(i * ${mult} + ${seed}) % 1000000)::DOUBLE / 1e6`;

/**
 * The whole dataset as one CREATE TABLE. Every random-looking column is a pure function of the
 * row index and the seed. `zscore` standardises against the generating distribution (mean per
 * target and concentration, sd 12), which is what a plate-level z-score estimates.
 */
export function screenGeneratorSql(rows: number, seed: number): string {
  if (!(ROW_COUNTS as readonly number[]).includes(rows)) throw new Error(`unsupported row count ${rows}`);
  return `
CREATE OR REPLACE TABLE ${SCREEN_TABLE} AS
WITH base AS (
  SELECT i,
    ${uniform(7919, seed)} AS u1,
    ${uniform(104729, seed)} AS u2,
    ${uniform(1299709, seed)} AS u3,
    ${uniform(15485863, seed)} AS u4,
    ${uniform(32452843, seed)} AS u5
  FROM range(${rows}) t(i)
), wells AS (
  SELECT i,
    1 + floor(u3 * ${GENE_ORDER.length})::INTEGER AS target_ix,
    list_extract(${list(CONCENTRATIONS)}, 1 + (i % 8)::INTEGER) AS conc_um,
    sqrt(-2 * ln(greatest(u1, 1e-9))) * cos(2 * pi() * u2) AS z,
    u4, u5
  FROM base
), shaped AS (
  SELECT i, target_ix, conc_um, z, u4, u5,
    8 + 10 * log10(conc_um * 100) + list_extract(${list(TARGET_SHIFT)}, target_ix) AS mean
  FROM wells
)
SELECT
  i AS well_id,
  (i // 384)::INTEGER AS plate,
  chr(65 + ((i % 384) // 24)::INTEGER) || lpad(((i % 384) % 24 + 1)::VARCHAR, 2, '0') AS well,
  list_extract(${list(GENE_ORDER)}, target_ix) AS target,
  list_extract(${list(LIBRARIES)}, 1 + floor(u4 * ${LIBRARIES.length})::INTEGER) AS library,
  list_extract(${list(SITES)}, 1 + floor(u5 * ${SITES.length})::INTEGER) AS site,
  conc_um::DOUBLE AS conc_um,
  greatest(-20, least(120, mean + ${SD} * z))::DOUBLE AS inhibition,
  ((greatest(-20, least(120, mean + ${SD} * z)) - mean) / ${SD})::DOUBLE AS zscore,
  (((greatest(-20, least(120, mean + ${SD} * z)) - mean) / ${SD}) > 3) AS hit,
  TIMESTAMP '2026-01-05 08:00:00' + to_seconds(i * 2) AS read_at
FROM shaped`;
}

/** `?rows=` from the URL: one of the offered counts, else the default. */
export function parseRows(raw: string | null): number {
  const n = Number(raw);
  return (ROW_COUNTS as readonly number[]).includes(n) ? n : DEFAULT_ROWS;
}

const int = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const asDate = (v: unknown) => (v instanceof Date ? v : new Date(Number(v)));

export const SCREEN_COLUMNS: ColumnDef[] = [
  { key: 'well_id', label: 'Well ID', width: 96, align: 'right', format: (v) => int.format(Number(v)), sortable: true },
  { key: 'plate', label: 'Plate', width: 72, align: 'right', format: (v) => int.format(Number(v)), sortable: true },
  { key: 'well', label: 'Well', width: 60, sortable: true },
  { key: 'target', label: 'Target', width: 84, sortable: true },
  { key: 'library', label: 'Library', width: 72, sortable: true },
  { key: 'site', label: 'Site', width: 92, sortable: true },
  { key: 'conc_um', label: 'µM', width: 64, align: 'right', format: (v) => two.format(Number(v)), sortable: true },
  { key: 'inhibition', label: 'Inhibition %', width: 104, align: 'right', format: (v) => one.format(Number(v)), sortable: true },
  { key: 'zscore', label: 'Z', width: 72, align: 'right', format: (v) => two.format(Number(v)), sortable: true },
  { key: 'hit', label: 'Hit', width: 52, format: (v) => (v ? 'HIT' : ''), sortable: true },
  { key: 'read_at', label: 'Read at', width: 150, format: (v) => when.format(asDate(v)), sortable: true },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx ng test --watch=false --include='**/screen-data.spec.ts'
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Generate on the page**

In `screen-page.component.ts` add imports and replace the constructor's `ready()` call:

```ts
import { DEFAULT_ROWS, SEED, screenGeneratorSql } from './screen-data';
```

```ts
  readonly rows = signal(DEFAULT_ROWS);
  readonly genMs = signal<number | null>(null);
  readonly generating = signal(false);

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.start();
    });
  }

  private async start(): Promise<void> {
    try {
      await this.duck.ready();
      await this.generate(this.rows());
    } catch { /* status/error signals already carry it */ }
  }

  /** Rebuilds the table at a new size. On failure (out of memory at 10M) falls back to the previous size. */
  async generate(rows: number): Promise<void> {
    const previous = this.rows();
    this.rows.set(rows);
    this.generating.set(true);
    this.statusText.set(`Generating ${rows.toLocaleString()} wells…`);
    const t0 = performance.now();
    try {
      await this.duck.exec(screenGeneratorSql(rows, SEED));
      this.genMs.set(Math.round(performance.now() - t0));
      this.statusText.set(`${rows.toLocaleString()} wells in ${this.genMs()} ms`);
    } catch (err) {
      this.statusText.set(`Could not build ${rows.toLocaleString()} wells (${err instanceof Error ? err.message : String(err)}). Back to ${previous.toLocaleString()}.`);
      if (rows !== previous) { this.rows.set(previous); await this.generate(previous); }
    } finally {
      this.generating.set(false);
    }
  }
```

- [ ] **Step 6: Check in the browser, run all tests, commit**

Open `http://localhost:4200/screen`. Expected: status reads "1,000,000 wells in N ms" with N under 1500 on a laptop. In DevTools console run nothing; there is no console access to the worker yet and none is needed.

```bash
npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false
git add app/src/app/features/screen/screen-data.ts app/src/app/features/screen/screen-data.spec.ts app/src/app/features/screen/screen-page.component.ts
git commit -m "screen: seeded HTS dataset generated inside DuckDB

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure grid math — window SQL and the scaled scrollbar

**Files:**
- Create: `app/src/app/shared/duck/window-sql.ts`, `window-sql.spec.ts`
- Create: `app/src/app/shared/duck/row-window.ts`, `row-window.spec.ts`

**Interfaces:**
- Produces:
  - `quoteIdent(name: string): string`
  - `interface Sort { key: string; dir: 'asc' | 'desc' }`
  - `interface Range { start: number; end: number }` (end exclusive)
  - `windowSql(table: string, columns: string[], predicate: string | null, sort: Sort | null, stableKey: string, range: Range): string`
  - `MAX_SCROLL_PX = 15_000_000`
  - `spacerHeight(total, rowHeight): number`
  - `startToScroll(start, total, visible, rowHeight, viewportHeight): number`
  - `scrollToStart(scrollTop, total, visible, rowHeight, viewportHeight): number`
  - `windowRange(start, visible, total, overscan): Range`
  - `class RowWindow { begin(): number; accept(token, range, rows: unknown[][]): boolean; get(i): unknown[] | undefined; clear(): void; size: number }`

- [ ] **Step 1: Write the failing tests**

`app/src/app/shared/duck/window-sql.spec.ts`:

```ts
import { quoteIdent, windowSql } from './window-sql';

describe('windowSql', () => {
  const cols = ['well_id', 'target', 'inhibition'];

  it('selects quoted columns for the window and orders by the stable key', () => {
    const sql = windowSql('screen', cols, null, null, 'well_id', { start: 0, end: 60 });
    expect(sql).toBe('SELECT "well_id", "target", "inhibition" FROM screen ORDER BY "well_id" LIMIT 60 OFFSET 0');
  });

  it('applies the predicate, the sort, then the stable key as a tiebreak', () => {
    const sql = windowSql('screen', cols, '("inhibition" BETWEEN 10 AND 50)', { key: 'zscore', dir: 'desc' }, 'well_id', { start: 1200, end: 1260 });
    expect(sql).toBe('SELECT "well_id", "target", "inhibition" FROM screen WHERE ("inhibition" BETWEEN 10 AND 50) ORDER BY "zscore" DESC, "well_id" LIMIT 60 OFFSET 1200');
  });

  it('does not repeat the stable key when it is the sort key', () => {
    const sql = windowSql('screen', cols, null, { key: 'well_id', dir: 'asc' }, 'well_id', { start: 0, end: 10 });
    expect(sql).toContain('ORDER BY "well_id" ASC LIMIT 10');
  });

  it('quotes identifiers and escapes embedded quotes', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});
```

`app/src/app/shared/duck/row-window.spec.ts`:

```ts
import { MAX_SCROLL_PX, RowWindow, scrollToStart, spacerHeight, startToScroll, windowRange } from './row-window';

describe('scaled scrollbar', () => {
  const rowH = 28, viewport = 560, visible = 20;

  it('is linear while the content fits under the cap', () => {
    expect(spacerHeight(1000, rowH)).toBe(28_000);
    expect(startToScroll(10, 1000, visible, rowH, viewport)).toBe(280);
    expect(scrollToStart(280, 1000, visible, rowH, viewport)).toBe(10);
  });

  it('caps the spacer and still reaches both ends at 10M rows', () => {
    const total = 10_000_000;
    expect(spacerHeight(total, rowH)).toBe(MAX_SCROLL_PX);
    expect(startToScroll(0, total, visible, rowH, viewport)).toBe(0);
    const last = total - visible;
    const bottom = startToScroll(last, total, visible, rowH, viewport);
    expect(bottom).toBe(MAX_SCROLL_PX - viewport);
    expect(scrollToStart(bottom, total, visible, rowH, viewport)).toBe(last);
    expect(scrollToStart(0, total, visible, rowH, viewport)).toBe(0);
  });

  it('never returns a start past the last page or below zero', () => {
    expect(scrollToStart(-50, 100, visible, rowH, viewport)).toBe(0);
    expect(scrollToStart(1e9, 100, visible, rowH, viewport)).toBe(80);
    expect(scrollToStart(0, 0, visible, rowH, viewport)).toBe(0);
    expect(scrollToStart(0, 5, visible, rowH, viewport)).toBe(0); // fewer rows than the viewport
  });
});

describe('windowRange', () => {
  it('adds overscan on both sides and clamps to the table', () => {
    expect(windowRange(100, 20, 1000, 20)).toEqual({ start: 80, end: 140 });
    expect(windowRange(0, 20, 1000, 20)).toEqual({ start: 0, end: 40 });
    expect(windowRange(990, 20, 1000, 20)).toEqual({ start: 970, end: 1000 });
    expect(windowRange(0, 20, 0, 20)).toEqual({ start: 0, end: 0 });
  });
});

describe('RowWindow', () => {
  it('stores accepted rows by absolute index and serves them back', () => {
    const w = new RowWindow();
    const t = w.begin();
    expect(w.accept(t, { start: 10, end: 12 }, [['a'], ['b']])).toBe(true);
    expect(w.get(10)).toEqual(['a']);
    expect(w.get(11)).toEqual(['b']);
    expect(w.get(12)).toBeUndefined();
  });

  it('drops a response whose token is stale', () => {
    const w = new RowWindow();
    const old = w.begin();
    w.begin();
    expect(w.accept(old, { start: 0, end: 1 }, [['stale']])).toBe(false);
    expect(w.get(0)).toBeUndefined();
  });

  it('clear() forgets rows and invalidates outstanding tokens', () => {
    const w = new RowWindow();
    const t = w.begin();
    w.accept(t, { start: 0, end: 1 }, [['x']]);
    w.clear();
    expect(w.get(0)).toBeUndefined();
    expect(w.accept(t, { start: 0, end: 1 }, [['x']])).toBe(false);
  });

  it('evicts everything once the cache passes its cap', () => {
    const w = new RowWindow(100);
    const t = w.begin();
    w.accept(t, { start: 0, end: 101 }, Array.from({ length: 101 }, (_, i) => [i]));
    expect(w.size).toBeLessThanOrEqual(101);
    const t2 = w.begin();
    w.accept(t2, { start: 500, end: 501 }, [['new']]);
    expect(w.get(0)).toBeUndefined();
    expect(w.get(500)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx ng test --watch=false --include='**/window-sql.spec.ts' --include='**/row-window.spec.ts'
```

Expected: FAIL, modules not found.

- [ ] **Step 3: Write `window-sql.ts`**

```ts
export interface Sort { key: string; dir: 'asc' | 'desc' }
export interface Range { start: number; end: number }

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * The grid's window query. OFFSET, not keyset: a scrollbar needs random access, and DuckDB runs
 * ORDER BY … LIMIT … OFFSET as a top-N heap, low milliseconds even at 10M rows. The stable key
 * breaks ties so a page never shifts under the reader between two fetches.
 */
export function windowSql(table: string, columns: string[], predicate: string | null, sort: Sort | null, stableKey: string, range: Range): string {
  const select = columns.map(quoteIdent).join(', ');
  const where = predicate ? ` WHERE ${predicate}` : '';
  const order = sort
    ? `${quoteIdent(sort.key)} ${sort.dir.toUpperCase()}${sort.key === stableKey ? '' : `, ${quoteIdent(stableKey)}`}`
    : quoteIdent(stableKey);
  return `SELECT ${select} FROM ${table}${where} ORDER BY ${order} LIMIT ${range.end - range.start} OFFSET ${range.start}`;
}
```

- [ ] **Step 4: Write `row-window.ts`**

```ts
import type { Range } from './window-sql';

/** Chrome stops laying out elements past ~33.5M px; keep well under it. */
export const MAX_SCROLL_PX = 15_000_000;

export function spacerHeight(total: number, rowHeight: number): number {
  return Math.min(total * rowHeight, MAX_SCROLL_PX);
}

function maxStart(total: number, visible: number): number { return Math.max(0, total - visible); }
function maxScrollTop(total: number, rowHeight: number, viewportHeight: number): number { return Math.max(0, spacerHeight(total, rowHeight) - viewportHeight); }

/** The scroll position that shows row `start` at the top. Linear under the cap, proportional above it. */
export function startToScroll(start: number, total: number, visible: number, rowHeight: number, viewportHeight: number): number {
  const ms = maxStart(total, visible), mt = maxScrollTop(total, rowHeight, viewportHeight);
  if (ms === 0 || mt === 0) return 0;
  return Math.round((Math.min(ms, Math.max(0, start)) / ms) * mt);
}

/** The first visible row for a scroll position. Inverse of startToScroll, clamped to the table. */
export function scrollToStart(scrollTop: number, total: number, visible: number, rowHeight: number, viewportHeight: number): number {
  const ms = maxStart(total, visible), mt = maxScrollTop(total, rowHeight, viewportHeight);
  if (ms === 0 || mt === 0) return 0;
  const t = Math.min(mt, Math.max(0, scrollTop));
  return Math.round((t / mt) * ms);
}

/** The rows to fetch for a first visible row: the screen plus `overscan` rows either side. */
export function windowRange(start: number, visible: number, total: number, overscan: number): Range {
  return { start: Math.max(0, start - overscan), end: Math.min(total, start + visible + overscan) };
}

/**
 * Fetched rows by absolute index, with a token per fetch so a slow response for an old window or
 * an old predicate is dropped rather than painted. Bounded: once past `cap` rows the whole cache
 * is evicted, which is cheaper and simpler than LRU for a viewport that only ever needs one screen.
 */
export class RowWindow {
  private rows = new Map<number, unknown[]>();
  private token = 0;
  private valid = 0;
  constructor(private readonly cap = 4000) {}

  get size(): number { return this.rows.size; }

  /** Start a fetch; the returned token must be presented with the result. Invalidates earlier tokens. */
  begin(): number { this.valid = ++this.token; return this.token; }

  accept(token: number, range: Range, rows: unknown[][]): boolean {
    if (token !== this.valid) return false;
    if (this.rows.size > this.cap) this.rows.clear();
    rows.forEach((r, i) => this.rows.set(range.start + i, r));
    return true;
  }

  get(index: number): unknown[] | undefined { return this.rows.get(index); }

  clear(): void { this.rows.clear(); this.valid = ++this.token; }
}
```

- [ ] **Step 5: Run the tests to verify they pass, commit**

```bash
npx ng test --watch=false --include='**/window-sql.spec.ts' --include='**/row-window.spec.ts'
git add app/src/app/shared/duck/window-sql.ts app/src/app/shared/duck/window-sql.spec.ts app/src/app/shared/duck/row-window.ts app/src/app/shared/duck/row-window.spec.ts
git commit -m "duck: window SQL builder and scaled-scrollbar row window

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `<app-duck-grid>`

**Files:**
- Create: `app/src/app/shared/duck/duck-grid.component.ts`
- Modify: `app/src/app/features/screen/screen-page.component.ts`

**Interfaces:**
- Consumes: Task 3 exports; `ColumnDef` from `features/screen/screen-data.ts` (move the interface to `shared/duck/column-def.ts` and re-export it from `screen-data.ts` so the shared grid does not import a feature file); `DuckDbService.ready()`; `Selection`, `MosaicClient`, `Coordinator` from `@uwdata/mosaic-core`; `Query`, `count` from `@uwdata/mosaic-sql`.
- Produces: `DuckGridComponent` with inputs `table`, `columns`, `brush`, `stableKey` (default `'well_id'`), and signals `total`, `sort`, `firstRowAt`, `error`, `scrolling`; method `setSort(sort: Sort | null)`.

- [ ] **Step 1: Move `ColumnDef` to the shared folder**

Create `app/src/app/shared/duck/column-def.ts`:

```ts
/** One grid column: which table column, how wide, how to show a cell. */
export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  format?: (v: unknown) => string;
  sortable?: boolean;
}
```

In `screen-data.ts` delete the interface and add `export type { ColumnDef } from '../../shared/duck/column-def'; import type { ColumnDef } from '../../shared/duck/column-def';` at the top. Run `npx ng test --watch=false --include='**/screen-data.spec.ts'`; expected PASS.

- [ ] **Step 2: Write the grid component**

Create `app/src/app/shared/duck/duck-grid.component.ts`:

```ts
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { MosaicClient, type Coordinator, type Selection } from '@uwdata/mosaic-core';
import { Query, count, type FilterExpr } from '@uwdata/mosaic-sql';
import type { Table } from '@uwdata/flechette';
import type { ColumnDef } from './column-def';
import { DuckDbService } from './duckdb.service';
import { RowWindow, scrollToStart, spacerHeight, startToScroll, windowRange } from './row-window';
import { windowSql, type Range, type Sort } from './window-sql';

const DEBOUNCE_MS = 30;

/** Mosaic client whose only job is the row count under the current brush. */
class CountClient extends MosaicClient {
  constructor(brush: Selection, private readonly table: string, private readonly onCount: (n: number) => void, private readonly onError: (m: string) => void) { super(brush); }
  override query(filter: FilterExpr | null = null) { return Query.from(this.table).select({ n: count() }).where(filter ?? []); }
  override queryResult(data: unknown) { this.onCount(Number((data as Table).getChild('n')?.at(0) ?? 0)); return this; }
  override queryError(err: { message?: string }) { this.onError(err.message ?? String(err)); return this; }
}

/**
 * A windowed grid over a DuckDB table. The scroller owns a row index, not a pixel offset: the
 * spacer is capped (see row-window.ts) and scroll position maps proportionally to a row, while
 * the wheel and the keyboard move the row index directly. Only the rows on screen, plus one
 * screen of overscan each side, are ever fetched, and only those become strings.
 */
@Component({
  selector: 'app-duck-grid',
  template: `
    <div class="grid" role="grid" [attr.aria-rowcount]="total()" [attr.aria-colcount]="columns().length" [style.--row-h.px]="rowHeight">
      <div class="header" role="row" [style.gridTemplateColumns]="template()">
        @for (c of columns(); track c.key) {
          <button type="button" role="columnheader" class="th" [class.right]="c.align === 'right'" [attr.aria-sort]="ariaSort(c.key)" [disabled]="c.sortable === false" (click)="cycleSort(c.key)">
            <span>{{ c.label }}</span>@if (sort()?.key === c.key) { <i aria-hidden="true">{{ sort()?.dir === 'asc' ? '▲' : '▼' }}</i> }
          </button>
        }
      </div>
      <div class="scroller" #scroller tabindex="0" aria-label="Rows; arrow keys and Page Up/Down move, Home and End jump" (scroll)="onScroll()" (wheel)="onWheel($event)" (keydown)="onKey($event)">
        <div class="window" [style.gridTemplateColumns]="template()">
          @for (row of windowRows(); track $index) {
            <div class="tr" role="row" [attr.aria-rowindex]="start() + $index + 1">
              @for (c of columns(); track c.key; let ci = $index) {
                <span class="td" role="gridcell" [class.right]="c.align === 'right'">{{ row ? cell(c, row[ci]) : '—' }}</span>
              }
            </div>
          }
        </div>
        <div class="spacer" [style.height.px]="spacer()"></div>
      </div>
      <div class="foot mono">
        <span>{{ total() | number }} rows</span>
        <span>{{ start() + 1 | number }}–{{ (start() + windowRows().length) | number }}</span>
        @if (error()) { <span class="err" role="alert">{{ error() }}</span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    .grid { display: flex; flex-direction: column; height: 100%; min-height: 0; border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--panel); overflow: hidden; font-size: 12px; }
    .header, .tr { display: grid; column-gap: 0; min-width: max-content; }
    .header { border-bottom: 1px solid var(--hairline); background: var(--well); }
    .th { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 0; border-right: 1px solid var(--hairline); background: none; color: var(--on-ink-dim); font: 500 10px/1 var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase; text-align: left; cursor: pointer; touch-action: manipulation; }
    .th:hover { color: var(--on-ink); background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .th:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    .th:disabled { cursor: default; color: var(--on-ink-faint); }
    .th.right { justify-content: flex-end; }
    .th i { color: var(--teal); font-style: normal; }
    .scroller { position: relative; flex: 1; min-height: 0; overflow: auto; outline: none; }
    .scroller:focus-visible { box-shadow: inset 0 0 0 2px var(--teal); }
    .window { position: sticky; top: 0; z-index: 1; }
    .spacer { width: 1px; }
    .tr { height: var(--row-h); border-bottom: 1px solid color-mix(in srgb, var(--hairline) 60%, transparent); }
    .tr:hover { background: color-mix(in srgb, var(--teal) 6%, transparent); }
    .td { display: flex; align-items: center; padding: 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .td.right { justify-content: flex-end; font-family: var(--font-mono); }
    .foot { display: flex; gap: 16px; padding: 6px 10px; border-top: 1px solid var(--hairline); font-size: 10px; letter-spacing: 0.08em; color: var(--on-ink-dim); }
    .err { color: var(--rose); letter-spacing: 0; }
  `,
})
export class DuckGridComponent {
  readonly table = input.required<string>();
  readonly columns = input.required<ColumnDef[]>();
  readonly brush = input.required<Selection>();
  readonly stableKey = input('well_id');
  readonly rowHeight = 28;

  readonly total = signal(0);
  readonly sort = signal<Sort | null>(null);
  readonly start = signal(0);
  readonly error = signal<string | null>(null);
  /** performance.now() when the first window painted; the bench reads it. Reset on regenerate via reset(). */
  readonly firstRowAt = signal<number | null>(null);
  readonly scrolling = signal(false);

  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly duck = inject(DuckDbService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cache = new RowWindow();
  private readonly version = signal(0);
  private readonly viewportHeight = signal(560);
  private client: CountClient | null = null;
  private coordinator: Coordinator | null = null;
  private fetchTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private expectedScrollTop = 0;
  private resize: ResizeObserver | null = null;

  readonly visible = computed(() => Math.max(1, Math.ceil(this.viewportHeight() / this.rowHeight)));
  readonly spacer = computed(() => spacerHeight(this.total(), this.rowHeight));
  readonly template = computed(() => this.columns().map((c) => `${c.width}px`).join(' '));
  readonly windowRows = computed(() => {
    this.version();
    const n = Math.min(this.visible(), Math.max(0, this.total() - this.start()));
    return Array.from({ length: n }, (_, i) => this.cache.get(this.start() + i));
  });

  constructor() {
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      this.viewportHeight.set(el.clientHeight || 560);
      this.resize = new ResizeObserver(() => { this.viewportHeight.set(el.clientHeight || 560); this.scheduleFetch(); });
      this.resize.observe(el);
      void this.connect();
    });
    // A new brush object (regenerate) reconnects the count client.
    effect(() => { this.brush(); untracked(() => { if (this.coordinator) void this.connect(); }); });
    this.destroyRef.onDestroy(() => { this.disconnect(); this.resize?.disconnect(); if (this.fetchTimer) clearTimeout(this.fetchTimer); });
  }

  private async connect(): Promise<void> {
    this.disconnect();
    this.coordinator = await this.duck.ready();
    this.client = new CountClient(this.brush(), this.table(), (n) => this.onCount(n), (m) => this.error.set(m));
    this.coordinator.connect(this.client);
  }

  private disconnect(): void {
    if (this.client && this.coordinator) this.coordinator.disconnect(this.client);
    this.client = null;
  }

  /** Forget everything and start from the top; the page calls this after regenerating the table. */
  reset(): void {
    this.cache.clear();
    this.firstRowAt.set(null);
    this.moveTo(0);
    this.version.update((v) => v + 1);
  }

  private onCount(n: number): void {
    this.error.set(null);
    this.total.set(n);
    this.cache.clear();
    this.moveTo(Math.min(this.start(), Math.max(0, n - this.visible())));
    this.version.update((v) => v + 1);
    this.scheduleFetch();
  }

  cell(c: ColumnDef, v: unknown): string {
    if (v === null || v === undefined) return '';
    return c.format ? c.format(v) : String(v);
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  cycleSort(key: string): void {
    const s = this.sort();
    this.setSort(s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null);
  }

  setSort(sort: Sort | null): void {
    this.sort.set(sort);
    this.cache.clear();
    this.version.update((v) => v + 1);
    this.scheduleFetch();
  }

  /** Set the first visible row and write the matching scroll position, remembering it so onScroll ignores the echo. */
  private moveTo(start: number): void {
    const s = Math.max(0, Math.min(start, Math.max(0, this.total() - this.visible())));
    this.start.set(s);
    const el = this.scroller().nativeElement;
    this.expectedScrollTop = startToScroll(s, this.total(), this.visible(), this.rowHeight, this.viewportHeight());
    if (Math.abs(el.scrollTop - this.expectedScrollTop) >= 1) el.scrollTop = this.expectedScrollTop;
    this.markScrolling();
    this.scheduleFetch();
  }

  onScroll(): void {
    const el = this.scroller().nativeElement;
    if (Math.abs(el.scrollTop - this.expectedScrollTop) < 1) return; // our own write
    this.expectedScrollTop = el.scrollTop;
    this.start.set(scrollToStart(el.scrollTop, this.total(), this.visible(), this.rowHeight, this.viewportHeight()));
    this.markScrolling();
    this.scheduleFetch();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rows = Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / this.rowHeight));
    this.moveTo(this.start() + rows);
  }

  onKey(e: KeyboardEvent): void {
    const page = this.visible() - 1;
    const next = e.key === 'ArrowDown' ? this.start() + 1 : e.key === 'ArrowUp' ? this.start() - 1
      : e.key === 'PageDown' ? this.start() + page : e.key === 'PageUp' ? this.start() - page
      : e.key === 'Home' ? 0 : e.key === 'End' ? this.total() : null;
    if (next === null) return;
    e.preventDefault();
    this.moveTo(next);
  }

  private markScrolling(): void {
    this.scrolling.set(true);
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => this.scrolling.set(false), 300);
  }

  private scheduleFetch(): void {
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = setTimeout(() => void this.fetch(), DEBOUNCE_MS);
  }

  private async fetch(): Promise<void> {
    const total = this.total();
    if (!this.coordinator || !this.client || total === 0) return;
    const range: Range = windowRange(this.start(), this.visible(), total, this.visible());
    // Skip when every row in range is cached already.
    let missing = false;
    for (let i = range.start; i < range.end && !missing; i++) if (!this.cache.get(i)) missing = true;
    if (!missing) return;
    const predicate = this.brush().predicate(this.client);
    const sql = windowSql(this.table(), this.columns().map((c) => c.key), predicate ? String(predicate) : null, this.sort(), this.stableKey(), range);
    const token = this.cache.begin();
    try {
      const t = (await this.coordinator.query(sql, { type: 'arrow', cache: false })) as Table;
      const cols = t.toColumns() as Record<string, ArrayLike<unknown>>;
      const keys = this.columns().map((c) => c.key);
      const rows: unknown[][] = Array.from({ length: t.numRows }, (_, i) => keys.map((k) => cols[k][i]));
      if (!this.cache.accept(token, range, rows)) return;
      this.error.set(null);
      this.version.update((v) => v + 1);
      if (this.firstRowAt() === null) requestAnimationFrame(() => this.firstRowAt.set(performance.now()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
```

Add `DecimalPipe` to the component's `imports` (`imports: [DecimalPipe]`) and `import { DecimalPipe } from '@angular/common';`.

- [ ] **Step 3: Mount the grid on the page**

In `screen-page.component.ts`:

```ts
import { DuckGridComponent } from '../../shared/duck/duck-grid.component';
import { SCREEN_COLUMNS, SCREEN_TABLE } from './screen-data';
import type { Selection } from '@uwdata/mosaic-core';
```

Add `DuckGridComponent` to `imports`. Add state:

```ts
  readonly columns = SCREEN_COLUMNS;
  readonly table = SCREEN_TABLE;
  /** One crossfilter for the page; charts write clauses, the grid and charts read predicates. Recreated on regenerate. */
  readonly brush = signal<Selection | null>(null);
  private readonly grid = viewChild(DuckGridComponent);
```

In `start()`, after `ready()` and before `generate`, create the brush: `const { Selection } = await import('@uwdata/mosaic-core'); this.brush.set(Selection.crossfilter());`. At the end of a successful `generate`, call `this.grid()?.reset()` and, because the table changed underneath the coordinator's cache, `(await this.duck.ready()).clear({ cache: true, clients: false })`, then recreate the brush the same way so every client re-queries.

Template, under the status line:

```html
    @if (brush(); as b) {
      <section class="stage" data-reveal>
        <app-duck-grid [table]="table" [columns]="columns" [brush]="b" />
      </section>
    }
```

Style: `.stage { height: clamp(420px, calc(100dvh - var(--nav-h) - 300px), 760px); }`.

- [ ] **Step 4: Check in the browser**

Open `http://localhost:4200/screen`. Expected: after generation the grid shows rows 1–N with real values, the footer reads "1,000,000 rows"; dragging the scrollbar to the bottom shows well IDs near 999,999; the wheel moves one row per 28 px of delta; focusing the scroller and pressing End reaches the last page; clicking "Z" sorts descending on the second click with Z values in the 4s at the top. Switching the count is not on the page yet. Console has no errors.

- [ ] **Step 5: Typecheck, tests, commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false
git add app/src/app/shared/duck/column-def.ts app/src/app/shared/duck/duck-grid.component.ts app/src/app/features/screen/screen-data.ts app/src/app/features/screen/screen-page.component.ts
git commit -m "duck: windowed grid with a scaled scrollbar over the screen table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `<app-linked-chart>`, the four specs, and brushing

**Files:**
- Create: `app/src/app/shared/duck/linked-chart.component.ts`
- Create: `app/src/app/features/screen/screen-specs.ts`
- Modify: `app/src/app/features/screen/screen-page.component.ts`

**Interfaces:**
- Consumes: `VegaChartComponent` (`spec`, `data`, `height`, `viewReady`), `VEGA_COLORS`, `DuckDbService`, Mosaic `MosaicClient`, `Selection`, `clauseInterval`, `clausePoints`; mosaic-sql `Query`, `count`, `sum`, `cast`, `column`, `floor`, `div`, `mul`, `literal`, `sql`.
- Produces: `LinkedChartComponent` with inputs `spec`, `query`, `brush`, `field`, `kind: 'interval' | 'point'`, `dataset = 'rows'`, `height = 180`, `bench?: Bench`; method `clearBrush()`. `screen-specs.ts` exports `SCREEN_CHARTS: ChartDef[]` where `ChartDef = { id, title, field, kind, height, spec, query }`.

- [ ] **Step 1: Write the linked chart**

`app/src/app/shared/duck/linked-chart.component.ts`:

```ts
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { MosaicClient, clauseInterval, clausePoints, type Coordinator, type Selection } from '@uwdata/mosaic-core';
import type { FilterExpr, Query } from '@uwdata/mosaic-sql';
import type { Table } from '@uwdata/flechette';
import type { View } from 'vega';
import { VegaChartComponent, type VegaSpecInput } from '../vega/vega-chart.component';
import { DuckDbService } from './duckdb.service';
import type { Bench } from './bench';

export type BrushKind = 'interval' | 'point';

/** A Mosaic client that hands its aggregate to a callback and reports settle time to the bench. */
class ChartClient extends MosaicClient {
  constructor(brush: Selection, private readonly build: (filter: FilterExpr) => Query, private readonly onData: (rows: Record<string, unknown>[]) => void, private readonly onError: (m: string) => void) { super(brush); }
  override query(filter: FilterExpr | null = null) { return this.build(filter ?? []); }
  override queryResult(data: unknown) { this.onData((data as Table).toArray() as Record<string, unknown>[]); return this; }
  override queryError(err: { message?: string }) { this.onError(err.message ?? String(err)); return this; }
}

/**
 * A Vega-Lite chart that is also a Mosaic client. Its aggregate query runs under the brush, so
 * every other chart's selection filters it; its own `brush` param becomes a Mosaic clause, so it
 * filters everything else. The clause carries the x scale, which lets Mosaic pre-aggregate the
 * query at pixel resolution and answer drags from a materialised view.
 */
@Component({
  selector: 'app-linked-chart',
  imports: [VegaChartComponent],
  template: `<app-vega-chart [spec]="spec()" [data]="data()" [height]="height()" (viewReady)="onView($event)" />`,
  styles: `:host { display: block; }`,
})
export class LinkedChartComponent {
  readonly spec = input.required<VegaSpecInput>();
  readonly query = input.required<(filter: FilterExpr) => Query>();
  readonly brush = input.required<Selection>();
  readonly field = input.required<string>();
  readonly kind = input<BrushKind>('interval');
  readonly dataset = input('rows');
  readonly height = input(180);
  readonly bench = input<Bench | null>(null);
  readonly error = signal<string | null>(null);

  private readonly data = signal<Record<string, unknown[]> | null>(null);
  private readonly duck = inject(DuckDbService);
  private client: ChartClient | null = null;
  private coordinator: Coordinator | null = null;
  private view: View | null = null;
  private readonly onSignal = (_: string, value: unknown) => this.onBrush(value);

  constructor() {
    effect(() => { this.brush(); this.query(); untracked(() => void this.connect()); });
    inject(DestroyRef).onDestroy(() => { this.disconnect(); this.view?.removeSignalListener('brush', this.onSignal); });
  }

  private async connect(): Promise<void> {
    this.disconnect();
    this.coordinator = await this.duck.ready();
    this.client = new ChartClient(this.brush(), this.query(), (rows) => { this.data.set({ [this.dataset()]: rows }); this.bench()?.settled(); }, (m) => this.error.set(m));
    this.coordinator.connect(this.client);
  }

  private disconnect(): void {
    if (this.client && this.coordinator) this.coordinator.disconnect(this.client);
    this.client = null;
  }

  onView(view: View): void {
    this.view?.removeSignalListener('brush', this.onSignal);
    this.view = view;
    view.addSignalListener('brush', this.onSignal);
  }

  /** Empty this chart's Vega selection and drop its clause. The page calls it from Reset. */
  async clearBrush(): Promise<void> {
    if (this.view) { this.view.data('brush_store', []); await this.view.runAsync(); }
    if (this.client) this.brush().update(this.kind() === 'interval' ? clauseInterval(this.field(), null, { source: this.client }) : clausePoints([this.field()], null, { source: this.client }));
  }

  private onBrush(value: unknown): void {
    if (!this.client || !this.view) return;
    const v = (value ?? {}) as Record<string, unknown>;
    this.bench()?.brushed();
    if (this.kind() === 'point') {
      const picked = Object.values(v)[0] as unknown[] | undefined;
      this.brush().update(clausePoints([this.field()], picked?.length ? picked.map((p) => [p]) : null, { source: this.client }));
      return;
    }
    const range = Object.values(v)[0] as [number, number] | [Date, Date] | undefined;
    const x = this.view.scale('x') as { domain(): unknown[]; range(): number[]; type?: string } | undefined;
    const isTime = range?.[0] instanceof Date;
    const scale = x ? { type: isTime ? 'utc' : 'linear', domain: x.domain() as [number, number], range: x.range() as [number, number] } : undefined;
    this.brush().update(clauseInterval(this.field(), range && range.length === 2 ? range : null, { source: this.client, scale, pixelSize: 1 }));
  }
}
```

Note: `Bench` is created in Task 6; until then create `app/src/app/shared/duck/bench.ts` containing only `export class Bench { brushed(): void {} settled(): void {} }` so this compiles. Task 6 replaces it.

- [ ] **Step 2: Write the specs and query builders**

`app/src/app/features/screen/screen-specs.ts`:

```ts
import { Query, cast, column, count, div, floor, literal, mul, sql, sum, type FilterExpr } from '@uwdata/mosaic-sql';
import type { VegaSpecInput } from '../../shared/vega/vega-chart.component';
import { VEGA_COLORS } from '../../shared/vega/theme';
import type { BrushKind } from '../../shared/duck/linked-chart.component';
import { SCREEN_TABLE } from './screen-data';

export interface ChartDef {
  id: string;
  title: string;
  field: string;
  kind: BrushKind;
  height: number;
  spec: VegaSpecInput;
  query: (filter: FilterExpr) => Query;
}

const T = SCREEN_TABLE;
const brushParam = (kind: BrushKind, field: string) => (kind === 'interval'
  ? [{ name: 'brush', select: { type: 'interval', encodings: ['x'] } }]
  : [{ name: 'brush', select: { type: 'point', fields: [field], toggle: 'event.shiftKey' } }]);

/** Pre-binned histogram: the query groups by floor(x/step)*step, Vega draws bar x0→x1. */
function histogram(field: string, step: number, title: string, color: string): ChartDef {
  return {
    id: field, title, field, kind: 'interval', height: 150,
    query: (filter) => Query.from(T).select({ x0: mul(literal(step), floor(div(column(field), literal(step)))), n: count() }).where(filter).groupby('x0'),
    spec: {
      width: 'container', height: 110, padding: 4,
      data: { name: 'rows' },
      params: brushParam('interval', field),
      transform: [{ calculate: `datum.x0 + ${step}`, as: 'x1' }],
      mark: { type: 'bar', color, opacity: 0.9 },
      encoding: {
        x: { field: 'x0', type: 'quantitative', bin: { binned: true, step }, title: null },
        x2: { field: 'x1' },
        y: { field: 'n', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
      },
    },
  };
}

export const SCREEN_CHARTS: ChartDef[] = [
  histogram('inhibition', 5, 'Inhibition %', VEGA_COLORS.teal),
  histogram('zscore', 0.5, 'Z-score', VEGA_COLORS.violet),
  {
    id: 'target', title: 'Hits by target', field: 'target', kind: 'point', height: 190,
    query: (filter) => Query.from(T).select({ target: 'target', hits: sum(cast(column('hit'), 'INTEGER')), n: count() }).where(filter).groupby('target'),
    spec: {
      width: 'container', height: 150, padding: 4,
      data: { name: 'rows' },
      params: brushParam('point', 'target'),
      mark: { type: 'bar', color: VEGA_COLORS.ember },
      encoding: {
        x: { field: 'target', type: 'nominal', sort: '-y', title: null, axis: { labelAngle: 0, labelFontSize: 9 } },
        y: { field: 'hits', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
        tooltip: [{ field: 'target' }, { field: 'hits', format: ',' }, { field: 'n', title: 'wells', format: ',' }],
      },
    },
  },
  {
    id: 'read_at', title: 'Hits per week', field: 'read_at', kind: 'interval', height: 150,
    query: (filter) => Query.from(T).select({ week: sql`date_trunc('week', "read_at")`, hits: sum(cast(column('hit'), 'INTEGER')) }).where(filter).groupby('week'),
    spec: {
      width: 'container', height: 110, padding: 4,
      data: { name: 'rows' },
      params: brushParam('interval', 'read_at'),
      mark: { type: 'bar', color: VEGA_COLORS.sky },
      encoding: {
        x: { field: 'week', type: 'temporal', timeUnit: 'yearweek', title: null, axis: { format: '%b %d', labelFontSize: 9 } },
        y: { field: 'hits', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
      },
    },
  },
];
```

If `cast` from mosaic-sql does not accept `'INTEGER'` as a plain string type, use `int32(column('hit'))` instead (`int32` is exported).

- [ ] **Step 3: Mount the charts and the Reset key**

In `screen-page.component.ts` add imports `LinkedChartComponent`, `SCREEN_CHARTS`, `GlyphComponent`, and `viewChildren`. Add `readonly charts = SCREEN_CHARTS;` and `private readonly chartRefs = viewChildren(LinkedChartComponent);`. Add:

```ts
  async resetBrush(): Promise<void> {
    await Promise.all(this.chartRefs().map((c) => c.clearBrush()));
    this.brush()?.reset();
  }
```

Template: wrap the grid and a charts column in a two-column layout, with a toolbar above:

```html
    @if (brush(); as b) {
      <div class="toolbar" data-reveal>
        <button type="button" class="key lone" (click)="resetBrush()" aria-label="Clear the brush" title="Clear the brush"><app-glyph name="reset" /></button>
        <p class="status mono" aria-live="polite">{{ statusText() }}</p>
      </div>
      <section class="stage" data-reveal>
        <app-duck-grid [table]="table" [columns]="columns" [brush]="b" />
        <aside class="charts">
          @for (c of charts; track c.id) {
            <figure class="fig">
              <figcaption class="eyebrow">{{ c.title }}</figcaption>
              <app-linked-chart [spec]="c.spec" [query]="c.query" [brush]="b" [field]="c.field" [kind]="c.kind" [height]="c.height" />
            </figure>
          }
        </aside>
      </section>
    }
```

Styles: `.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }`, `.stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; height: clamp(420px, calc(100dvh - var(--nav-h) - 300px), 760px); }`, `.charts { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; }`, `.fig { margin: 0; min-width: 0; padding-top: 8px; border-top: 1px solid var(--hairline); }`, `.fig figcaption { margin-bottom: 2px; }`, and `@media (max-width: 960px) { .stage { grid-template-columns: 1fr; height: auto; } app-duck-grid { height: 480px; } }`. Remove the earlier single-column `.stage` rule.

- [ ] **Step 4: Check in the browser**

Open `http://localhost:4200/screen`. Expected: four charts render with data. Drag across the inhibition histogram: the grid footer count drops, the z-score, target and weekly charts change, the inhibition chart itself keeps its full bars with the brushed range at full opacity. Click a target bar: the grid shows only that target; shift-click adds another. Reset clears everything and the count returns to 1,000,000. Drag a brush off the data (below zero inhibition): count shows 0, grid shows dashes, no console error. Toggle the theme with the nav key: charts re-embed and keep working (brush again after the toggle).

- [ ] **Step 5: Typecheck, tests, commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false
git add app/src/app/shared/duck/linked-chart.component.ts app/src/app/shared/duck/bench.ts app/src/app/features/screen/screen-specs.ts app/src/app/features/screen/screen-page.component.ts
git commit -m "screen: four Vega charts as Mosaic clients, brushing filters the grid and each other

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Bench readout, row-count keys, URL state, e2e route

**Files:**
- Replace: `app/src/app/shared/duck/bench.ts`
- Create: `app/src/app/shared/duck/bench.spec.ts`
- Modify: `app/src/app/features/screen/screen-page.component.ts`
- Modify: `app/e2e/smoke-screens.mjs`

**Interfaces:**
- Consumes: `DuckDbService.bootMs`, `DuckGridComponent.firstRowAt`/`scrolling`, `LinkedChartComponent.bench` input, `readQuery`/`writeQuery` from `shared/url-state.ts`, `parseRows`.
- Produces: `median(xs: number[]): number | null`, `class BrushTimer { brushed(now): void; settled(now): void; samples: number[] }`, `class Bench { boot, gen, firstRow, brush, scrollFps, longTasks: Signal<number|null>; brushed(); settled(); setBoot(ms); setGen(ms); setFirstRow(ms); startScrollSampling(scrolling: Signal<boolean>); dispose() }`.

- [ ] **Step 1: Write the failing tests**

`app/src/app/shared/duck/bench.spec.ts`:

```ts
import { BrushTimer, median } from './bench';

describe('median', () => {
  it('handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('BrushTimer', () => {
  it('measures from a brush to the last settle before the next brush', () => {
    const t = new BrushTimer();
    t.brushed(100);
    t.settled(130);   // first client
    t.settled(160);   // last client: the sample becomes 60
    expect(t.samples).toEqual([60]);
    t.brushed(200);
    t.settled(210);
    expect(t.samples).toEqual([60, 10]);
  });

  it('ignores settles with no brush in flight and keeps only the last ten samples', () => {
    const t = new BrushTimer();
    t.settled(50);
    expect(t.samples).toEqual([]);
    for (let i = 0; i < 12; i++) { t.brushed(i * 100); t.settled(i * 100 + i); }
    expect(t.samples.length).toBe(10);
    expect(t.samples[0]).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx ng test --watch=false --include='**/bench.spec.ts'
```

Expected: FAIL (`median` is not exported by the stub).

- [ ] **Step 3: Write `bench.ts`**

```ts
import { effect, signal, type Signal } from '@angular/core';

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * One brush produces several settles (one per client). The sample for a brush is the time to
 * its last settle, so it keeps growing until the next brush starts. Ten samples are kept.
 */
export class BrushTimer {
  readonly samples: number[] = [];
  private startAt: number | null = null;
  private open = false;

  brushed(now: number): void { this.startAt = now; this.open = false; }

  settled(now: number): void {
    if (this.startAt === null) return;
    const ms = now - this.startAt;
    if (this.open) this.samples[this.samples.length - 1] = ms; else { this.samples.push(ms); this.open = true; }
    if (this.samples.length > 10) this.samples.shift();
  }
}

/** The page's readout: every number the acceptance section of the spec asks for, as signals. */
export class Bench {
  readonly boot = signal<number | null>(null);
  readonly gen = signal<number | null>(null);
  readonly firstRow = signal<number | null>(null);
  readonly brush = signal<number | null>(null);
  readonly scrollFps = signal<number | null>(null);
  readonly longTasks = signal(0);
  private readonly timer = new BrushTimer();
  private observer: PerformanceObserver | null = null;
  private raf = 0;

  constructor() {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      this.observer = new PerformanceObserver((list) => this.longTasks.update((n) => n + list.getEntries().filter((e) => e.duration > 50).length));
      this.observer.observe({ type: 'longtask', buffered: false });
    }
  }

  setBoot(ms: number | null): void { this.boot.set(ms); }
  setGen(ms: number): void { this.gen.set(ms); this.longTasks.set(0); this.firstRow.set(null); }
  setFirstRow(ms: number): void { this.firstRow.set(Math.round(ms)); }
  brushed(): void { this.timer.brushed(performance.now()); }
  settled(): void { this.timer.settled(performance.now()); const m = median(this.timer.samples); this.brush.set(m === null ? null : Math.round(m)); }

  /** Samples requestAnimationFrame while `scrolling` is true and reports frames per second. */
  startScrollSampling(scrolling: Signal<boolean>): void {
    effect(() => {
      const on = scrolling();
      cancelAnimationFrame(this.raf);
      if (!on) return;
      let frames = 0, t0 = performance.now();
      const tick = () => {
        frames++;
        const dt = performance.now() - t0;
        if (dt >= 1000) { this.scrollFps.set(Math.round((frames / dt) * 1000)); frames = 0; t0 = performance.now(); }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  dispose(): void { this.observer?.disconnect(); cancelAnimationFrame(this.raf); }
}
```

`startScrollSampling` uses `effect`, so call it from the page's constructor (an injection context).

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx ng test --watch=false --include='**/bench.spec.ts'
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the bench, row-count keys and URL into the page**

In `screen-page.component.ts`:

```ts
import { Bench } from '../../shared/duck/bench';
import { readQuery, writeQuery } from '../../shared/url-state';
import { DEFAULT_ROWS, ROW_COUNTS, SEED, parseRows, screenGeneratorSql } from './screen-data';
```

State and constructor additions:

```ts
  readonly bench = new Bench();
  readonly rowCounts = ROW_COUNTS;
  readonly rows = signal(parseRows(readQuery().get('rows')));

  constructor() {
    this.bench.startScrollSampling(computed(() => this.grid()?.scrolling() ?? false));
    // The route remembers its size and sort: ?rows=5000000&sort=zscore:desc. Defaults leave it bare.
    effect(() => {
      const rows = this.rows(), sort = this.grid()?.sort() ?? null;
      writeQuery({ rows: rows !== DEFAULT_ROWS ? rows : null, sort: sort ? `${sort.key}:${sort.dir}` : null });
    });
    // First painted row → bench, measured from the end of generation.
    effect(() => { const at = this.grid()?.firstRowAt(); if (at != null && this.genEndAt) this.bench.setFirstRow(at - this.genEndAt); });
    inject(DestroyRef).onDestroy(() => this.bench.dispose());
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.start();
    });
  }
  private genEndAt = 0;
  private pendingSort: Sort | null = null;
```

Imports needed for the above: `computed, effect, DestroyRef, viewChild, viewChildren` from `@angular/core`, and `type Sort` from `../../shared/duck/window-sql`.

In `start()`, after `ready()`: `this.bench.setBoot(this.duck.bootMs());` and restore the sort: `const s = readQuery().get('sort')?.split(':'); if (s?.length === 2 && this.columns.some((c) => c.key === s[0]) && (s[1] === 'asc' || s[1] === 'desc')) this.pendingSort = { key: s[0], dir: s[1] };` — apply it with `this.grid()?.setSort(this.pendingSort)` right after the grid's `reset()` in `generate`. In `generate`, after a successful `exec`: `this.genEndAt = performance.now(); this.bench.setGen(this.genMs()!)`.

Pass the bench to each chart: `[bench]="bench"` on `<app-linked-chart>`.

Toolbar additions (before the Reset key):

```html
        <div class="keyrail" role="group" aria-label="Row count">
          @for (n of rowCounts; track n) {
            <button type="button" class="key code" [class.on]="rows() === n" [attr.aria-pressed]="rows() === n" [attr.aria-disabled]="generating() || null" (click)="!generating() && generate(n)" [attr.aria-describedby]="n === 10000000 ? 'screen-10m-note' : null" [title]="n === 10000000 ? 'About 500 MB of browser memory. Desktop only.' : (n / 1000000) + ' million wells'">{{ n / 1000000 }}M</button>
          }
        </div>
        <small id="screen-10m-note" class="sr-only">About 500 MB of browser memory. Desktop only.</small>
        @if (generating()) { <span class="gen" role="progressbar" aria-label="Generating wells" aria-valuetext="Generating"></span> }
```

Bench strip, after the toolbar:

```html
      <dl class="bench mono" data-reveal aria-label="Benchmark">
        <div><dt>BOOT</dt><dd>{{ ms(bench.boot()) }}</dd></div>
        <div><dt>GEN</dt><dd>{{ ms(bench.gen()) }}</dd></div>
        <div><dt>FIRST ROW</dt><dd>{{ ms(bench.firstRow()) }}</dd></div>
        <div><dt>BRUSH</dt><dd>{{ ms(bench.brush()) }}</dd></div>
        <div><dt>SCROLL FPS</dt><dd>{{ bench.scrollFps() ?? '—' }}</dd></div>
        <div><dt>LONG TASKS</dt><dd>{{ bench.longTasks() }}</dd></div>
      </dl>
```

```ts
  ms(v: number | null): string { return v === null ? '—' : `${v.toLocaleString()} ms`; }
```

Styles: `.bench { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 0 0 12px; font-size: 10px; letter-spacing: 0.1em; } .bench div { display: flex; gap: 8px; } .bench dt { color: var(--on-ink-faint); } .bench dd { margin: 0; color: var(--teal); font-variant-numeric: tabular-nums; }`, `.gen { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--teal); border-top-color: transparent; animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .gen { animation: none; border-top-color: var(--teal); } }`, `.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }`.

- [ ] **Step 6: Add the route to the e2e smoke**

In `app/e2e/smoke-screens.mjs` add `'/app/screen'` to `routes`, and after the morphcharts block add:

```js
  if (path === '/app/screen') {
    await page.locator('.bench dd').nth(2).filter({ hasText: 'ms' }).waitFor({ timeout: 30000 }).catch(() => console.log('  FIRST ROW never appeared'));
    console.log('  bench:', (await page.locator('.bench').innerText()).replace(/\n/g, ' '));
  }
```

- [ ] **Step 7: Check in the browser and record the measurements**

Open `http://localhost:4200/screen`. Expected: the bench strip fills BOOT, GEN and FIRST ROW after load; brushing fills BRUSH; scrolling fills SCROLL FPS; LONG TASKS stays at 0 during scrolling. Click `10M`: status shows generating, then the grid reports 10,000,000 rows, dragging to the bottom reaches well IDs near 9,999,999, brushing still updates. Reload with the URL now ending `?rows=10000000`: it regenerates at 10M. Sort a column, reload: the sort is restored.

Record the six values at 1M and 10M in the spec's appendix:

```markdown
## Appendix: measurements

Chrome, this machine, 2026-09-24.

| rows | BOOT | GEN | FIRST ROW | BRUSH (median) | SCROLL FPS | LONG TASKS |
| --- | --- | --- | --- | --- | --- | --- |
| 1M | … | … | … | … | … | … |
| 10M | … | … | … | … | … | … |
```

Fill the dots with the observed numbers. If BRUSH at 10M exceeds 100 ms, note whether Mosaic's pre-aggregation is active: in the console `performance.getEntriesByType('resource')` is not useful; instead check that the coordinator issued `CREATE TEMP TABLE` statements by enabling `wasmConnector({ …, log: true })` temporarily and looking for `preagg_` in the log. Record the finding either way.

- [ ] **Step 8: Typecheck, tests, commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false
git add app/src/app/shared/duck/bench.ts app/src/app/shared/duck/bench.spec.ts app/src/app/features/screen/screen-page.component.ts app/e2e/smoke-screens.mjs docs/superpowers/specs/2026-09-24-duckdb-screen-design.md
git commit -m "screen: bench readout, row-count keys, URL state, e2e route, measurements

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: README and guidelines pass

**Files:**
- Modify: `README.md` (Labs page list)
- Modify: `app/src/app/features/screen/screen-page.component.ts` (only if the review finds something)

- [ ] **Step 1: Document the page**

In `README.md`, in the list of Labs pages, add after Merchandise:

```markdown
- **Screen** (`/app/screen`) — millions of generated assay wells in DuckDB-wasm, a windowed grid and four linked Vega charts that each query it, coordinated by Mosaic. No API. Bench numbers on the page.
```

In the commands section, no new commands. In the "traps" list of `CLAUDE.md` under `app/`, add:

```markdown
- **`/app/screen` ships a 36 MB wasm** from `node_modules/@duckdb/duckdb-wasm/dist` via an
  `angular.json` asset entry. Mosaic pins the exact duckdb-wasm build; do not add a second copy.
```

- [ ] **Step 2: Review the page against the Web Interface Guidelines**

Run `/web-design-guidelines review /screen` (the project skill), apply mechanical findings, re-run `npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false`.

- [ ] **Step 3: Commit and push**

```bash
git add README.md CLAUDE.md app/src/app/features/screen/screen-page.component.ts
git commit -m "screen: document the page; guidelines pass

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Push only when the human partner asks.
