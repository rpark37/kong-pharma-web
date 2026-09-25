import { Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import type { Selection } from '@uwdata/mosaic-core';
import { GsapService } from '../../shared/animation/gsap.service';
import { DuckDbService } from '../../shared/duck/duckdb.service';
import { DuckGridComponent } from '../../shared/duck/duck-grid.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DEFAULT_ROWS, SCREEN_COLUMNS, SCREEN_TABLE, SEED, screenGeneratorSql } from './screen-data';

/**
 * High-throughput screen results, millions of wells, entirely in the browser: DuckDB in a
 * worker, a windowed grid and linked charts that each query it, coordinated by Mosaic.
 */
@Component({
  selector: 'app-screen-page',
  imports: [WebGpuFallbackComponent, DuckGridComponent],
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
    @if (brush(); as b) {
      <section class="stage" data-reveal>
        <app-duck-grid [table]="table" [columns]="columns" [brush]="b" />
      </section>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 16px; }
    .status { font-size: 12px; color: var(--on-ink-dim); }
    .fallback-wrap { padding: 24px; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .stage { height: clamp(420px, calc(100dvh - var(--nav-h) - 300px), 760px); }
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
