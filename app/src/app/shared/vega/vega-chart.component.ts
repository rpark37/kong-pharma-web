import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { View } from 'vega';
import { VEGA_DARK_CONFIG } from './theme';

export type VegaSpecInput = Record<string, unknown>;

/**
 * Renders a Vega or Vega-Lite specification with vega-embed. Vega draws to SVG through D3's
 * scales and shapes, so every chart here is a Vega spec first and a D3 drawing second.
 *
 * Named datasets can be pushed without re-embedding: `data` maps dataset names to rows and is
 * applied with `view.data(name, rows)` whenever it changes.
 */
@Component({
  selector: 'app-vega-chart',
  template: `
    <div class="chart" #chart [style.minHeight.px]="height()"></div>
    @if (error()) { <p class="err">{{ error() }}</p> }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .chart { width: 100%; }
    .chart :global(svg) { overflow: visible; }
    .err { color: var(--rose); font-size: 12px; }
  `,
})
export class VegaChartComponent implements OnDestroy {
  readonly spec = input.required<VegaSpecInput>();
  readonly data = input<Record<string, unknown[]> | null>(null);
  readonly height = input(260);
  readonly renderer = input<'svg' | 'canvas'>('svg');
  readonly viewReady = output<View>();
  readonly error = signal<string | null>(null);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private view: View | null = null;
  private resize: ResizeObserver | null = null;
  private embedToken = 0;

  constructor() {
    afterNextRender(() => {
      effectSafe(() => void this.embed(this.spec()));
    });
    effect(() => {
      const spec = this.spec();
      untracked(() => { if (this.view) void this.embed(spec); });
    });
    effect(() => {
      const data = this.data();
      untracked(() => this.applyData(data));
    });
  }

  private async embed(spec: VegaSpecInput): Promise<void> {
    const token = ++this.embedToken;
    const container = this.el.nativeElement.querySelector<HTMLElement>('.chart');
    if (!container) return;
    try {
      const { default: vegaEmbed } = await import('vega-embed');
      if (token !== this.embedToken) return;
      this.view?.finalize();
      const result = await vegaEmbed(container, spec as never, { actions: false, renderer: this.renderer(), config: VEGA_DARK_CONFIG as never, tooltip: { theme: 'dark' } });
      if (token !== this.embedToken) { result.finalize(); return; }
      this.view = result.view;
      this.error.set(null);
      this.applyData(this.data());
      this.observe(container);
      this.viewReady.emit(this.view);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  private applyData(data: Record<string, unknown[]> | null): void {
    if (!this.view || !data) return;
    let changed = false;
    for (const [name, rows] of Object.entries(data)) {
      try { this.view.data(name, rows); changed = true; } catch { /* dataset not in this spec */ }
    }
    if (changed) void this.view.runAsync();
  }

  private observe(container: HTMLElement): void {
    this.resize?.disconnect();
    let lastWidth = -1;
    this.resize = new ResizeObserver(() => {
      if (!this.view) return;
      const w = container.clientWidth - 16;
      if (w <= 0 || w === lastWidth) return; // only react to width changes; height follows the chart
      lastWidth = w;
      requestAnimationFrame(() => { if (this.view) void this.view.width(w).runAsync().catch(() => undefined); });
    });
    this.resize.observe(container);
  }

  ngOnDestroy(): void {
    this.embedToken++;
    this.resize?.disconnect();
    this.view?.finalize();
    this.view = null;
  }
}

function effectSafe(fn: () => void): void {
  try { fn(); } catch (e) { console.error(e); }
}
