import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, viewChild, viewChildren } from '@angular/core';
import type { Selection } from '@uwdata/mosaic-core';
import { GsapService } from '../../shared/animation/gsap.service';
import { Bench } from '../../shared/duck/bench';
import { DuckDbService } from '../../shared/duck/duckdb.service';
import { DuckGridComponent } from '../../shared/duck/duck-grid.component';
import { LinkedChartComponent } from '../../shared/duck/linked-chart.component';
import type { Sort } from '../../shared/duck/window-sql';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { readQuery, writeQuery } from '../../shared/url-state';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DEFAULT_ROWS, ROW_COUNTS, SCREEN_COLUMNS, SCREEN_TABLE, SEED, fallbackRows, parseRows, screenGeneratorSql } from './screen-data';
import { SCREEN_CHARTS } from './screen-specs';

/**
 * High-throughput screen results, millions of wells, entirely in the browser: DuckDB in a
 * worker, a windowed grid and linked charts that each query it, coordinated by Mosaic.
 */
@Component({
  selector: 'app-screen-page',
  imports: [WebGpuFallbackComponent, DuckGridComponent, LinkedChartComponent, GlyphComponent],
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
      <div class="toolbar" data-reveal [attr.aria-busy]="generating() || null">
        <div class="keyrail" role="group" aria-label="Row count">
          @for (n of rowCounts; track n) {
            <button type="button" class="key code" [class.on]="rows() === n" [attr.aria-pressed]="rows() === n" [attr.aria-disabled]="busy() || null" (click)="pick(n)" [attr.aria-label]="(n / 1000000) + ' million wells'" [attr.aria-describedby]="n === 10000000 ? 'screen-10m-note' : null" [title]="n === 10000000 ? 'About 500 MB of browser memory. Desktop only.' : (n / 1000000) + ' million wells'">{{ n / 1000000 }}M</button>
          }
        </div>
        <small id="screen-10m-note" class="sr-only">About 500 MB of browser memory. Desktop only.</small>
        <button type="button" class="key lone" (click)="resetBrush()" [attr.aria-disabled]="!brush() || null" aria-label="Clear the brush" title="Clear the brush"><app-glyph name="reset" /></button>
        @if (generating()) { <span class="gen" role="progressbar" aria-label="Generating wells" aria-valuetext="Generating"></span> }
        <p class="status mono" aria-live="polite">{{ statusText() }}</p>
        @if (genError(); as e) { <p class="status err mono" role="alert">{{ e }}</p> }
      </div>
      <dl class="bench mono" data-reveal role="group" aria-label="Benchmark">
        <div><dt>BOOT</dt><dd>{{ ms(bench.boot()) }}</dd></div>
        <div><dt>GEN</dt><dd>{{ ms(bench.gen()) }}</dd></div>
        <div><dt>FIRST ROW</dt><dd>{{ ms(bench.firstRow()) }}</dd></div>
        <div><dt>BRUSH</dt><dd>{{ ms(bench.brush()) }}</dd></div>
        <div><dt>SCROLL FPS</dt><dd>{{ bench.scrollFps() ?? '—' }}</dd></div>
        <div><dt>LONG TASKS</dt><dd>{{ bench.longTasks() }}</dd></div>
      </dl>
    }
    @if (brush(); as b) {
      <section class="stage" data-reveal>
        <app-duck-grid [table]="table" [columns]="columns" [brush]="b" [initialSort]="sortState()" />
        <aside class="charts" aria-describedby="screen-brush-note">
          <p id="screen-brush-note" class="sr-only">Drag across a chart to filter everything else by that range; click a target bar to filter by target, Shift-click to add another. The grid's sort keys and the Clear key are the keyboard route.</p>
          @for (c of charts; track c.id) {
            <figure class="fig">
              <figcaption class="eyebrow">{{ c.title }}</figcaption>
              <app-linked-chart [spec]="c.spec" [query]="c.query" [brush]="b" [field]="c.field" [kind]="c.kind" [height]="c.height" [bench]="bench" />
            </figure>
          }
        </aside>
      </section>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 16px; }
    .head h1 { text-wrap: balance; }
    .status { margin: 0; font-size: 12px; color: var(--on-ink-dim); }
    .status.err { color: var(--rose); flex-basis: 100%; }
    .fallback-wrap { padding: 24px; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
    .keyrail .key[aria-disabled="true"] { opacity: 0.5; cursor: default; }
    .key.lone[aria-disabled="true"] { opacity: 0.4; cursor: default; }
    .gen { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--teal); border-top-color: transparent; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .gen { animation: none; border-top-color: var(--teal); } }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    /* The readout strip: the acceptance numbers, as part of the exhibit. */
    .bench { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 0 0 12px; font-size: 10px; letter-spacing: 0.1em; }
    .bench div { display: flex; gap: 8px; }
    .bench dt { color: var(--on-ink-faint); }
    .bench dd { margin: 0; color: var(--teal); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; height: clamp(420px, calc(100dvh - var(--nav-h) - 300px), 760px); }
    .charts { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; overscroll-behavior: contain; }
    .fig { margin: 0; min-width: 0; padding-top: 8px; border-top: 1px solid var(--hairline); }
    .fig figcaption { margin-bottom: 2px; }
    @media (max-width: 960px) { .stage { grid-template-columns: 1fr; height: auto; } app-duck-grid { height: 480px; } }
  `,
})
export class ScreenPageComponent {
  readonly duck = inject(DuckDbService);
  readonly bench = new Bench();
  readonly statusText = signal('Booting DuckDB…');
  readonly rowCounts = ROW_COUNTS;
  readonly rows = signal(parseRows(readQuery().get('rows')));
  readonly genMs = signal<number | null>(null);
  readonly generating = signal(false);
  readonly genError = signal<string | null>(null);
  readonly columns = SCREEN_COLUMNS;
  readonly table = SCREEN_TABLE;
  /** One crossfilter for the page; charts write clauses, the grid and charts read predicates. Recreated on regenerate. */
  readonly brush = signal<Selection | null>(null);
  readonly charts = SCREEN_CHARTS;
  /** The grid's sort, kept here so a regenerated grid starts where the old one was, and so the URL can carry it. */
  readonly sortState = signal<Sort | null>(sortFromUrl());
  private readonly grid = viewChild(DuckGridComponent);
  private readonly chartRefs = viewChildren(LinkedChartComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private genEndAt = 0;

  constructor() {
    this.bench.startScrollSampling(computed(() => this.grid()?.scrolling() ?? false));
    effect(() => { const s = this.grid()?.sort(); if (s !== undefined) this.sortState.set(s); });
    // The route remembers its size and sort: ?rows=5000000&sort=zscore:desc. Defaults leave it bare.
    effect(() => {
      const rows = this.rows(), sort = this.sortState();
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

  ms(v: number | null): string { return v === null ? '—' : `${v.toLocaleString()} ms`; }

  /** The size keys wait for the engine and for a build in progress; the active size is a no-op. */
  readonly busy = computed(() => this.generating() || this.duck.status() !== 'ready');
  pick(n: number): void { if (!this.busy() && n !== this.rows()) void this.generate(n); }

  private async start(): Promise<void> {
    try {
      await this.duck.ready();
      this.bench.setBoot(this.duck.bootMs());
      await this.generate(this.rows());
    } catch { /* the service's status and error signals already carry it */ }
  }

  async resetBrush(): Promise<void> {
    await Promise.all(this.chartRefs().map((c) => c.clearBrush()));
    this.brush()?.reset();
  }

  private async newBrush(): Promise<void> {
    const { Selection } = await import('@uwdata/mosaic-core');
    this.brush.set(Selection.crossfilter());
  }

  /** Rebuilds the table at a new size. On failure (out of memory at 10M) falls back to the previous size. */
  async generate(rows: number): Promise<void> {
    const previous = this.rows();
    this.rows.set(rows);
    this.generating.set(true);
    // No brush means no grid and no charts, so nothing is connected while the table is rebuilt.
    this.brush.set(null);
    this.statusText.set(`Generating ${rows.toLocaleString()} wells…`);
    const t0 = performance.now();
    try {
      await this.duck.exec(screenGeneratorSql(rows, SEED));
      this.genEndAt = performance.now();
      this.genMs.set(Math.round(this.genEndAt - t0));
      this.bench.setGen(this.genMs()!);
      this.statusText.set(`${rows.toLocaleString()} wells in ${this.genMs()} ms`);
      // The table changed under the coordinator: drop its result cache and the pre-aggregated views
      // (they are keyed by query text, not by table contents, so they would answer for the old rows),
      // then a fresh brush mounts fresh clients.
      const coordinator = await this.duck.ready();
      coordinator.clear({ cache: true, clients: false });
      await coordinator.preaggregator.dropSchema();
      this.genError.set(null);
      await this.newBrush();
    } catch (err) {
      const next = fallbackRows(rows, previous);
      const message = err instanceof Error ? err.message : String(err);
      this.genError.set(`Could not build ${rows.toLocaleString()} wells (${message}).${next ? ` Back to ${next.toLocaleString()}.` : ''}`);
      if (next) { this.rows.set(next); await this.generate(next); }
    } finally {
      this.generating.set(false);
    }
  }
}

/** `?sort=zscore:desc`, validated against the column list. */
function sortFromUrl(): Sort | null {
  const s = readQuery().get('sort')?.split(':');
  if (!s || s.length !== 2 || !SCREEN_COLUMNS.some((c) => c.key === s[0]) || (s[1] !== 'asc' && s[1] !== 'desc')) return null;
  return { key: s[0], dir: s[1] };
}
