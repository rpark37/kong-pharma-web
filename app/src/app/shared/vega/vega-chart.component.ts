import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { View } from 'vega';
import { VEGA_CONFIG } from './theme';

export type VegaSpecInput = Record<string, unknown>;

/**
 * Renders a Vega or Vega-Lite specification with vega-embed. Vega draws to SVG through D3's
 * scales and shapes, so every chart here is a Vega spec first and a D3 drawing second.
 *
 * Named datasets can be pushed without re-embedding: `data` maps dataset names to rows and is
 * applied with `view.data(name, rows)` whenever it changes.
 *
 * `fill` opts into filling the host's box instead of sizing to the spec, for specs written with
 * `width`/`height` of `"container"`. Vega-Lite needs a definite container height for that, which
 * is why it is a mode rather than the default — every other page sizes from its spec.
 */
@Component({
  selector: 'app-vega-chart',
  host: { '[class.fill]': 'fill()' },
  template: `
    <div class="chart" #chart [style.minHeight.px]="height()"></div>
    @if (error()) { <p class="err">{{ error() }}</p> }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .chart { width: 100%; }
    .chart :global(svg) { overflow: visible; }
    .err { color: var(--rose); font-size: 12px; }
    :host(.fill) { height: 100%; }
    :host(.fill) .chart { height: 100%; }
  `,
})
export class VegaChartComponent implements OnDestroy {
  readonly spec = input.required<VegaSpecInput>();
  readonly data = input<Record<string, unknown[]> | null>(null);
  readonly height = input(260);
  /** Fill the host box rather than the spec's size; pair with `"container"` width/height. */
  readonly fill = input(false);
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

  /**
   * Resolves the relative dataset URLs in gallery specs against Vega's own host, and rewrites the
   * two path conventions that do not live there. All of it happens here rather than in the
   * vendored JSON so those files stay byte-identical to what upstream published — an edit there
   * would be silently clobbered the next time the specs are re-vendored.
   */
  private static patchLoader(loader: typeof import('vega').loader): ReturnType<typeof import('vega').loader> {
    const base = loader({ baseURL: 'https://vega.github.io/vega/' });
    const sanitize = base.sanitize.bind(base);
    base.sanitize = (uri, options) => sanitize(VegaChartComponent.resolveDataUri(String(uri)), options);
    return base;
  }

  /** Specs from the Vega Editor say `assets/data/<file>`; on vega.github.io it is `data/<file>`. */
  private static resolveDataUri(uri: string): string {
    if (uri.startsWith('assets/data/')) return uri.slice('assets/'.length);
    // scatter3D is a SandDance spec — its dataset is not on Vega's host at all.
    if (uri.startsWith('../../sample-data/')) {
      return `https://microsoft.github.io/SandDance/sample-data/${uri.slice('../../sample-data/'.length)}`;
    }
    return uri;
  }

  private async embed(spec: VegaSpecInput): Promise<void> {
    const token = ++this.embedToken;
    const container = this.el.nativeElement.querySelector<HTMLElement>('.chart');
    if (!container) return;
    try {
      const { default: vegaEmbed } = await import('vega-embed');
      if (token !== this.embedToken) return;
      this.view?.finalize();
      // Gallery specs reference their datasets as relative `data/*.json`. Those live on Vega's own
      // host — 56 MB of them — so the loader resolves relative URLs there rather than vendoring
      // the lot. Specs with inlined `data.values` are unaffected.
      const { loader } = await import('vega');
      const result = await vegaEmbed(container, spec as never, {
        actions: false,
        renderer: this.renderer(),
        config: VEGA_CONFIG as never,
        tooltip: { theme: 'light' },
        loader: VegaChartComponent.patchLoader(loader),
      });
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
    let lastHeight = -1;
    this.resize = new ResizeObserver(() => {
      if (!this.view) return;
      const w = container.clientWidth - 16;
      const h = container.clientHeight - 16;
      // Without `fill`, only width is tracked and height follows the chart, as it always has.
      const widthChanged = w > 0 && w !== lastWidth;
      const heightChanged = this.fill() && h > 0 && h !== lastHeight;
      if (!widthChanged && !heightChanged) return;
      if (widthChanged) lastWidth = w;
      if (heightChanged) lastHeight = h;
      const fill = this.fill();
      requestAnimationFrame(() => {
        if (!this.view) return;
        const sized = fill ? this.view.width(w).height(h) : this.view.width(w);
        void sized.runAsync().catch(() => undefined);
      });
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
