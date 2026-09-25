import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { readQuery, writeQuery } from '../../shared/url-state';
import { GsapService } from '../../shared/animation/gsap.service';
import { ApiService } from '../../shared/api/api.service';
import type * as M from '../../shared/api/models';
import { MorphchartsSceneComponent } from '../../shared/morphcharts/morphcharts-scene.component';
import { MorphchartsCameraComponent } from '../../shared/morphcharts/morphcharts-camera.component';
import { CameraRig } from '../../shared/morphcharts/camera-rig';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { ThemeService } from '../../shared/theme/theme.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { countrySpec, dailySpec, deviceSpec, funnelSpec, itemsSpec, revenueCubeSpec, sourceSpec } from './merchandise-specs';

@Component({
  selector: 'app-merchandise-page',
  imports: [VegaChartComponent, KpiTileComponent, MorphchartsSceneComponent, MorphchartsCameraComponent],
  template: `
    <section class="head">
      <div>
        <p class="eyebrow" data-reveal>GA4 · Google Merchandise Store</p>
        <h1 data-reveal>Merchandise analytics</h1>
        <p class="lede" data-reveal>
          The public GA4 e-commerce sample, queried by DuckDB behind FastAPI. Every chart is a Vega-Lite
          specification; the revenue cube is a MorphCharts specification.
          <span aria-live="polite">
            @if (kpis()?.source === 'synthetic') { <span class="tag">synthetic sample (no BigQuery credentials)</span> }
            @if (api.usingSnapshot()) { <span class="tag warn">API offline · showing snapshot</span> }
          </span>
        </p>
      </div>
      <form class="range glass" data-reveal aria-label="Date range" [attr.aria-busy]="loading() || null" (submit)="$event.preventDefault(); apply()">
        <label>From <input type="date" name="from" autocomplete="off" [value]="from()" [max]="to() || null" (change)="from.set($any($event.target).value)"></label>
        <label>To <input type="date" name="to" autocomplete="off" [value]="to()" [min]="from() || null" (change)="to.set($any($event.target).value)"></label>
        <button type="submit" class="btn small" [attr.aria-disabled]="loading() || null">{{ loading() ? 'Loading…' : 'Apply' }}</button>
        <button type="button" class="btn small" [attr.aria-disabled]="loading() || null" (click)="clearRange()">All</button>
        @if (rangeError()) { <p class="field-error" role="alert">{{ rangeError() }}</p> }
      </form>
    </section>

    <section class="kpis">
      <app-kpi-tile label="Sessions" [value]="kpis()?.sessions ?? 0" />
      <app-kpi-tile label="Users" [value]="kpis()?.users ?? 0" />
      <app-kpi-tile label="Purchases" [value]="kpis()?.purchases ?? 0" />
      <app-kpi-tile label="Revenue" [value]="kpis()?.revenue ?? 0" format="currency" />
      <app-kpi-tile label="Conversion" [value]="kpis()?.conversion_rate ?? 0" format="percent" [decimals]="2" />
      <app-kpi-tile label="Avg order" [value]="kpis()?.avg_order_value ?? 0" format="currency" [decimals]="2" />
    </section>

    <section class="grid">
      <!-- Each chart is a figure named by its caption; the Vega title inside the SVG is hidden from the tree. -->
      @for (c of charts; track c.key) {
        <figure class="card glass" [class.wide]="c.wide" data-reveal>
          <figcaption class="sr-only">{{ c.title }}</figcaption>
          @if (rows(c.key).length) {
            <app-vega-chart [spec]="c.spec" [data]="chartData()[c.key]" [height]="c.height" />
          } @else {
            <p class="empty mono">{{ loading() ? 'Loading…' : 'No ' + c.title.toLowerCase() + ' for this range.' }}</p>
          }
        </figure>
      }
      <div class="card glass wide cube" data-reveal>
        <div class="card-head"><span class="eyebrow">MorphCharts · path traced</span><h2>Revenue by country and month</h2></div>
        <div class="cube-scene" role="img" aria-label="Revenue by country and month as path-traced 3D bars; the camera keys below move the view">
          <app-morphcharts-scene [spec]="cubeSpec()" fallbackTitle="Revenue cube needs WebGPU" fallbackImage="samples/images/bar7_raytrace_640x360.jpg" (hostReady)="onCubeHost($event)" (loaded)="cubeRig()?.apply(); cubeRig()?.applyRenderMode()" />
        </div>
        <app-morphcharts-camera class="cube-camera" [rig]="cubeRig()" layout="row" />
      </div>
    </section>
    @if (error()) { <p class="error" role="alert">Could not load the merchandise data ({{ error() }}). Start the API with <code>make serve</code> in <code>api/</code>, or reload to use the committed snapshot.</p> }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 1.5rem; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: 6px 0 10px; text-wrap: balance; }
    .lede { color: var(--on-ink-dim); max-width: 720px; }
    .tag { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-family: var(--font-mono); border: 1px solid var(--hairline); color: var(--on-ink-dim); }
    .tag.warn { border-color: var(--amber); color: var(--amber); }
    .range { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 14px; font-size: 13px; }
    .range label { display: flex; gap: 6px; align-items: center; color: var(--on-ink-dim); }
    .range input { font: inherit; color: var(--on-ink); background: var(--well); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; color-scheme: light dark; }
    .range input:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
    .range .btn[aria-disabled="true"] { opacity: 0.5; cursor: default; }
    .field-error { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--rose); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    figure { margin: 0; }
    .empty { margin: 0; padding: 40px 0; text-align: center; font-size: 12px; color: var(--on-ink-faint); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { padding: 14px 16px; min-width: 0; }
    .wide { grid-column: 1 / -1; }
    .card-head { margin-bottom: 10px; h2 { font-size: 18px; } }
    .cube-scene { height: 460px; }
    .cube-camera { margin-top: 12px; }
    .error { color: var(--rose); margin-top: 12px; code { font-size: 12px; } }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class MerchandisePageComponent {
  readonly api = inject(ApiService);
  private readonly gsap = inject(GsapService);
  private readonly theme = inject(ThemeService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `?from=&to=` come from the URL and go back to it on Apply; the inputs edit them before that. */
  readonly from = signal(readQuery().get('from') ?? '');
  readonly to = signal(readQuery().get('to') ?? '');
  readonly loading = signal(false);
  readonly rangeError = computed(() => (this.from() && this.to() && this.from() > this.to() ? 'The start date is after the end date.' : null));
  readonly kpis = signal<M.MerchandiseKpis | null>(null);
  readonly daily = signal<M.DailyRow[]>([]);
  readonly funnel = signal<M.FunnelRow[]>([]);
  readonly countries = signal<M.CountryRow[]>([]);
  readonly devices = signal<M.DeviceRow[]>([]);
  readonly sources = signal<M.SourceRow[]>([]);
  readonly items = signal<M.ItemRow[]>([]);
  readonly cube = signal<M.RevenueCubeRow[]>([]);
  readonly error = signal<string | null>(null);
  /** Rebuilt on theme change too: the spec bakes in the paper colour. */
  readonly cubeSpec = computed(() => { this.theme.theme(); return this.cube().length ? revenueCubeSpec(this.cube()) : null; });
  readonly cubeRig = signal<CameraRig | null>(null);

  onCubeHost(host: MorphChartsHost): void {
    this.cubeRig.set(new CameraRig(host, { reducedMotion: () => this.gsap.reducedMotion }));
  }

  readonly specs = { daily: dailySpec(), funnel: funnelSpec(), country: countrySpec(), device: deviceSpec(), source: sourceSpec(), items: itemsSpec() };
  /** The six Vega figures in reading order. `dataset` is the name the spec binds; `key` is the signal that feeds it. */
  readonly charts = [
    { key: 'daily', dataset: 'daily', title: 'Sessions and revenue by day', spec: this.specs.daily, height: 280, wide: true },
    { key: 'funnel', dataset: 'funnel', title: 'Session funnel', spec: this.specs.funnel, height: 240, wide: false },
    { key: 'devices', dataset: 'devices', title: 'Sessions by device', spec: this.specs.device, height: 240, wide: false },
    { key: 'countries', dataset: 'countries', title: 'Sessions by country', spec: this.specs.country, height: 340, wide: false },
    { key: 'items', dataset: 'items', title: 'Top products by revenue', spec: this.specs.items, height: 340, wide: false },
    { key: 'sources', dataset: 'sources', title: 'Traffic sources', spec: this.specs.source, height: 260, wide: true },
  ] as const;

  rows(key: (typeof this.charts)[number]['key']): unknown[] { return this[key](); }
  /** One `{ dataset: rows }` object per chart, rebuilt only when a reload lands, so Vega is not re-fed on every render. */
  readonly chartData = computed(() => Object.fromEntries(this.charts.map((c) => [c.key, { [c.dataset]: this.rows(c.key) }])) as Record<string, Record<string, unknown[]>>);

  apply(): void { if (!this.loading() && !this.rangeError()) void this.reload(); }
  clearRange(): void { if (this.loading()) return; this.from.set(''); this.to.set(''); void this.reload(); }

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    const range = { from: this.from() || undefined, to: this.to() || undefined };
    writeQuery({ from: range.from ?? null, to: range.to ?? null });
    this.error.set(null);
    this.loading.set(true);
    try {
      const [kpis, daily, funnel, countries, devices, sources, items, cube] = await Promise.all([
        this.api.merchandiseKpis(range), this.api.merchandiseDaily(range), this.api.merchandiseFunnel(range), this.api.merchandiseByCountry(range),
        this.api.merchandiseByDevice(range), this.api.merchandiseSources(range), this.api.merchandiseTopItems(range), this.api.merchandiseRevenueCube(range),
      ]);
      this.kpis.set(kpis); this.daily.set(daily); this.funnel.set(funnel); this.countries.set(countries);
      this.devices.set(devices); this.sources.set(sources); this.items.set(items); this.cube.set(cube);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
