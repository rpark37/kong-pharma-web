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
