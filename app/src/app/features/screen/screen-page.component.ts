import { Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { DuckDbService } from '../../shared/duck/duckdb.service';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DEFAULT_ROWS, SEED, screenGeneratorSql } from './screen-data';

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
  readonly rows = signal(DEFAULT_ROWS);
  readonly genMs = signal<number | null>(null);
  readonly generating = signal(false);
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
}
