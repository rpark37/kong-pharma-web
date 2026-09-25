import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { MorphchartsSceneComponent } from '../../shared/morphcharts/morphcharts-scene.component';
import { MorphchartsCameraComponent } from '../../shared/morphcharts/morphcharts-camera.component';
import { CameraRig } from '../../shared/morphcharts/camera-rig';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { ThemeService } from '../../shared/theme/theme.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { PURCHASES_FILE, salesSpec } from './google-specs';

const CSV_PATH = `data/${PURCHASES_FILE}`;
const fmtDay = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

interface Purchase {
  category: string;
  price: number;
  day: string;
}

/** `category,price,date` with an ISO timestamp; the original parsed it just as loosely. */
function parseCsv(text: string): Purchase[] {
  const out: Purchase[] = [];
  for (const line of text.split('\n').slice(1)) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const price = Number(parts[1]);
    if (!isFinite(price)) continue;
    out.push({ category: parts[0], price, day: parts[2].slice(0, 10) });
  }
  return out;
}

/**
 * Google Merchandise Store sales as a path-traced unit chart: one block per purchase, stacked
 * within its day × category bin. Ported from the a21-ares merchandise page, rebuilt on this
 * app's MorphCharts spec pipeline instead of its imperative StackTreeMap service.
 */
@Component({
  selector: 'app-google-page',
  imports: [DecimalPipe, KpiTileComponent, MorphchartsSceneComponent, MorphchartsCameraComponent],
  template: `
    <div class="scene-bg" [attr.aria-busy]="loading() || null">
      <app-morphcharts-scene
        [spec]="spec()"
        [datasets]="datasets()"
        [label]="sceneLabel()"
        hint="Drag to orbit · right-drag to pan · wheel to zoom · or use the camera keys"
        fallbackTitle="The sales landscape needs WebGPU"
        fallbackImage="samples/images/bar10_raytrace_640x360.jpg"
        (hostReady)="onHost($event)"
        (loaded)="rig()?.apply(); rig()?.applyRenderMode()"
      >
        <p class="small">{{ rows().length | number }} purchases across {{ categories() }} categories.</p>
      </app-morphcharts-scene>
    </div>
    <app-morphcharts-camera class="scene-camera glass" [rig]="rig()" layout="row" />

    <div class="overlay">
      <section class="head">
        <p class="eyebrow" data-reveal aria-live="polite">MorphCharts · path traced · {{ loading() ? 'Loading…' : range() }}</p>
        <h1 data-reveal>Every Google Merchandise Store Purchase</h1>
      </section>

      <section class="kpis">
        <app-kpi-tile label="Purchases" [value]="rows().length" hint="one block each" />
        <app-kpi-tile label="Revenue" [value]="revenue()" format="currency" hint="sum of item price" />
        <app-kpi-tile label="Categories" [value]="categories()" hint="depth axis" />
        <app-kpi-tile label="Days" [value]="days()" hint="width axis" />
      </section>

      @if (error()) { <p class="error" role="alert">{{ error() }} Reload the page, or check that the CSV is deployed under <code>data/</code>.</p> }
    </div>
  `,
  styles: `
    /* Sits on the landscape opposite the scene's drag hint, on the same glass as the tiles. */
    .scene-camera { position: absolute; right: var(--pad-x); bottom: 12px; z-index: 1; padding: 8px 12px; border: 1px solid var(--hairline); border-radius: 8px; }
    /* The landscape is the page: it fills the viewport under the nav and everything else sits on it. */
    :host { display: block; position: relative; width: 100%; height: calc(100dvh - var(--nav-h)); overflow: hidden; }
    .scene-bg { position: absolute; inset: 0; z-index: 0; }
    /* Full bleed, so the scene's own card chrome is suppressed. ::ng-deep because those styles
       belong to <app-morphcharts-scene>; same reach-in pattern the atlas page already uses. */
    :host ::ng-deep .scene { border: 0; border-radius: 0; min-height: 0; }

    /* Transparent to the pointer so the scene can still be orbited between the tiles — only the
       text and the tiles themselves take input. */
    .overlay { position: relative; z-index: 1; pointer-events: none; padding: clamp(1rem, 3vh, 2rem) var(--pad-x) env(safe-area-inset-bottom); max-width: 1400px; margin: 0 auto;
               display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
    .overlay > * { pointer-events: auto; }

    .head { flex: 1 1 300px; min-width: 0; }
    h1 { font-size: clamp(1.25rem, 2.2vw, 1.75rem); margin: 4px 0 0; text-wrap: balance; }
    .kpis { display: flex; gap: 8px; flex: 0 1 auto; }

    /* Compact enough to share the row with the title. The tile is shared by 18 call sites across
       four pages, so it is shrunk here rather than in the component. */
    :host ::ng-deep app-kpi-tile .tile { padding: 8px 12px; gap: 1px; }
    :host ::ng-deep app-kpi-tile .label { font-size: 10px; letter-spacing: 0.06em; }
    :host ::ng-deep app-kpi-tile .value { font-size: 18px; }
    :host ::ng-deep app-kpi-tile .hint { font-size: 10px; white-space: nowrap; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    /* Third flex item in .overlay — given its own line rather than squeezed beside the tiles. */
    .error { flex: 1 0 100%; margin-top: 12px; color: var(--rose); font-size: 13px; code { font-size: 12px; } }
    /* Phones: the camera panel joins the flow under the tiles instead of covering them, and tile hints may wrap. */
    @media (max-width: 700px) {
      .scene-camera { position: static; margin: 8px var(--pad-x) calc(8px + env(safe-area-inset-bottom)); }
      :host { height: auto; min-height: calc(100dvh - var(--nav-h)); }
      .scene-bg { position: relative; height: 60vh; }
      :host ::ng-deep app-kpi-tile .hint { white-space: normal; }
    }
  `,
})
export class GooglePageComponent {
  readonly csv = signal('');
  readonly error = signal<string | null>(null);

  readonly rows = computed(() => parseCsv(this.csv()));
  readonly revenue = computed(() => this.rows().reduce((sum, r) => sum + r.price, 0));
  readonly categories = computed(() => new Set(this.rows().map((r) => r.category)).size);
  readonly days = computed(() => new Set(this.rows().map((r) => r.day)).size);
  readonly range = computed(() => {
    const days = [...new Set(this.rows().map((r) => r.day))].sort();
    return days.length ? `${fmtDay.format(new Date(days[0]))} – ${fmtDay.format(new Date(days[days.length - 1]))}` : '';
  });
  readonly loading = computed(() => !this.csv() && !this.error());
  readonly sceneLabel = computed(() => `${this.rows().length.toLocaleString()} Google Merchandise Store purchases as one block each, stacked by day and category, ${this.range()}`);

  // The scene only loads once the text is here, and the spec reads it from `datasets` rather
  // than fetching the CSV a second time.
  readonly datasets = computed<Record<string, string>>(() => {
    const text = this.csv();
    const out: Record<string, string> = {};
    if (text) out[PURCHASES_FILE] = text;
    return out;
  });
  /** Rebuilt on theme change too: the spec bakes in the paper colour. */
  readonly spec = computed(() => { this.theme.theme(); return this.csv() ? salesSpec() : null; });

  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly theme = inject(ThemeService);
  readonly rig = signal<CameraRig | null>(null);

  onHost(host: MorphChartsHost): void {
    this.rig.set(new CameraRig(host, { reducedMotion: () => this.gsap.reducedMotion }));
  }
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.load();
    });
  }

  private async load(): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(CSV_PATH, { responseType: 'text' }));
      if (!parseCsv(text).length) throw new Error('the file has no purchase rows');
      this.csv.set(text);
    } catch (err) {
      this.error.set(`Could not load ${CSV_PATH}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
