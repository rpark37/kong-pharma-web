import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { ApiService } from '../../shared/api/api.service';
import type * as M from '../../shared/api/models';
import { MorphchartsSceneComponent } from '../../shared/morphcharts/morphcharts-scene.component';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { countrySpec, dailySpec, deviceSpec, funnelSpec, itemsSpec, revenueCubeSpec, sourceSpec } from './merchandise-specs';

@Component({
  selector: 'app-merchandise-page',
  imports: [VegaChartComponent, KpiTileComponent, MorphchartsSceneComponent],
  template: `
    <section class="head">
      <div>
        <p class="eyebrow" data-reveal>GA4 · Google Merchandise Store</p>
        <h1 data-reveal>Merchandise analytics</h1>
        <p class="lede" data-reveal>
          The public GA4 e-commerce sample, queried by DuckDB behind FastAPI. Every chart is a Vega-Lite
          specification; the revenue cube is a MorphCharts specification.
          @if (kpis()?.source === 'synthetic') { <span class="tag">synthetic sample (no BigQuery credentials)</span> }
          @if (api.usingSnapshot()) { <span class="tag warn">API offline · showing snapshot</span> }
        </p>
      </div>
      <form class="range glass" data-reveal (submit)="$event.preventDefault(); reload()">
        <label>From <input type="date" [value]="from()" (change)="from.set($any($event.target).value)"></label>
        <label>To <input type="date" [value]="to()" (change)="to.set($any($event.target).value)"></label>
        <button type="submit" class="btn small">Apply</button>
        <button type="button" class="btn small" (click)="from.set(''); to.set(''); reload()">All</button>
      </form>
    </section>

    <section class="kpis">
      <app-kpi-tile label="Sessions" [value]="kpis()?.sessions ?? 0" />
      <app-kpi-tile label="Users" [value]="kpis()?.users ?? 0" />
      <app-kpi-tile label="Purchases" [value]="kpis()?.purchases ?? 0" />
      <app-kpi-tile label="Revenue" [value]="kpis()?.revenue ?? 0" prefix="$" />
      <app-kpi-tile label="Conversion" [value]="(kpis()?.conversion_rate ?? 0) * 100" suffix="%" [decimals]="2" />
      <app-kpi-tile label="Avg order" [value]="kpis()?.avg_order_value ?? 0" prefix="$" [decimals]="2" />
    </section>

    <section class="grid">
      <div class="card glass wide" data-reveal><app-vega-chart [spec]="specs.daily" [data]="{ daily: daily() }" [height]="280" /></div>
      <div class="card glass" data-reveal><app-vega-chart [spec]="specs.funnel" [data]="{ funnel: funnel() }" [height]="240" /></div>
      <div class="card glass" data-reveal><app-vega-chart [spec]="specs.device" [data]="{ devices: devices() }" [height]="240" /></div>
      <div class="card glass" data-reveal><app-vega-chart [spec]="specs.country" [data]="{ countries: countries() }" [height]="340" /></div>
      <div class="card glass" data-reveal><app-vega-chart [spec]="specs.items" [data]="{ items: items() }" [height]="340" /></div>
      <div class="card glass wide" data-reveal><app-vega-chart [spec]="specs.source" [data]="{ sources: sources() }" [height]="260" /></div>
      <div class="card glass wide cube" data-reveal>
        <div class="card-head"><span class="eyebrow">MorphCharts · path traced</span><h3>Revenue by country and month</h3></div>
        <div class="cube-scene">
          <app-morphcharts-scene [spec]="cubeSpec()" fallbackTitle="Revenue cube needs WebGPU" fallbackImage="samples/images/bar7_raytrace_640x360.jpg" />
        </div>
      </div>
    </section>
    @if (error()) { <p class="error">{{ error() }}</p> }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 1.5rem; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: 6px 0 10px; }
    .lede { color: var(--on-ink-dim); max-width: 720px; }
    .tag { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-family: var(--font-mono); border: 1px solid var(--hairline); color: var(--on-ink-dim); }
    .tag.warn { border-color: var(--amber); color: var(--amber); }
    .range { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 13px; }
    .range label { display: flex; gap: 6px; align-items: center; color: var(--on-ink-dim); }
    .range input { font: inherit; color: var(--on-ink); background: rgba(0,0,0,0.25); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; color-scheme: dark; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { padding: 14px 16px; min-width: 0; }
    .wide { grid-column: 1 / -1; }
    .card-head { margin-bottom: 10px; h3 { font-size: 18px; } }
    .cube-scene { height: 460px; }
    .error { color: var(--rose); margin-top: 12px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class MerchandisePageComponent {
  readonly api = inject(ApiService);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly from = signal('');
  readonly to = signal('');
  readonly kpis = signal<M.MerchandiseKpis | null>(null);
  readonly daily = signal<M.DailyRow[]>([]);
  readonly funnel = signal<M.FunnelRow[]>([]);
  readonly countries = signal<M.CountryRow[]>([]);
  readonly devices = signal<M.DeviceRow[]>([]);
  readonly sources = signal<M.SourceRow[]>([]);
  readonly items = signal<M.ItemRow[]>([]);
  readonly cube = signal<M.RevenueCubeRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly cubeSpec = computed(() => (this.cube().length ? revenueCubeSpec(this.cube()) : null));

  readonly specs = { daily: dailySpec(), funnel: funnelSpec(), country: countrySpec(), device: deviceSpec(), source: sourceSpec(), items: itemsSpec() };

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    const range = { from: this.from() || undefined, to: this.to() || undefined };
    this.error.set(null);
    try {
      const [kpis, daily, funnel, countries, devices, sources, items, cube] = await Promise.all([
        this.api.merchandiseKpis(range), this.api.merchandiseDaily(range), this.api.merchandiseFunnel(range), this.api.merchandiseByCountry(range),
        this.api.merchandiseByDevice(range), this.api.merchandiseSources(range), this.api.merchandiseTopItems(range), this.api.merchandiseRevenueCube(range),
      ]);
      this.kpis.set(kpis); this.daily.set(daily); this.funnel.set(funnel); this.countries.set(countries);
      this.devices.set(devices); this.sources.set(sources); this.items.set(items); this.cube.set(cube);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
