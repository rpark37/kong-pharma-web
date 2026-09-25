import { Component, ElementRef, afterNextRender, inject, signal, viewChildren } from '@angular/core';
import type { Selection } from '@uwdata/mosaic-core';
import { GsapService } from '../../shared/animation/gsap.service';
import { DuckDbService } from '../../shared/duck/duckdb.service';
import { DuckGridComponent } from '../../shared/duck/duck-grid.component';
import { LinkedChartComponent } from '../../shared/duck/linked-chart.component';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DEFAULT_ROWS, SCREEN_COLUMNS, SCREEN_TABLE, SEED, screenGeneratorSql } from './screen-data';
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
    } @else if (!brush()) {
      <p class="status mono" data-reveal aria-live="polite">{{ statusText() }}</p>
    }
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
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 16px; }
    .status { font-size: 12px; color: var(--on-ink-dim); }
    .fallback-wrap { padding: 24px; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; height: clamp(420px, calc(100dvh - var(--nav-h) - 300px), 760px); }
    .charts { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; }
    .fig { margin: 0; min-width: 0; padding-top: 8px; border-top: 1px solid var(--hairline); }
    .fig figcaption { margin-bottom: 2px; }
    @media (max-width: 960px) { .stage { grid-template-columns: 1fr; height: auto; } app-duck-grid { height: 480px; } }
  `,
})
export class ScreenPageComponent {
  readonly duck = inject(DuckDbService);
  readonly statusText = signal('Booting DuckDB…');
  readonly rows = signal(DEFAULT_ROWS);
  readonly genMs = signal<number | null>(null);
  readonly generating = signal(false);
  readonly columns = SCREEN_COLUMNS;
  readonly table = SCREEN_TABLE;
  /** One crossfilter for the page; charts write clauses, the grid and charts read predicates. Recreated on regenerate. */
  readonly brush = signal<Selection | null>(null);
  readonly charts = SCREEN_CHARTS;
  private readonly chartRefs = viewChildren(LinkedChartComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

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
      this.genMs.set(Math.round(performance.now() - t0));
      this.statusText.set(`${rows.toLocaleString()} wells in ${this.genMs()} ms`);
      // The table changed under the coordinator's cache: drop it, then a fresh brush mounts fresh clients.
      (await this.duck.ready()).clear({ cache: true, clients: false });
      await this.newBrush();
    } catch (err) {
      this.statusText.set(`Could not build ${rows.toLocaleString()} wells (${err instanceof Error ? err.message : String(err)}). Back to ${previous.toLocaleString()}.`);
      if (rows !== previous) { this.rows.set(previous); await this.generate(previous); }
    } finally {
      this.generating.set(false);
    }
  }
}
