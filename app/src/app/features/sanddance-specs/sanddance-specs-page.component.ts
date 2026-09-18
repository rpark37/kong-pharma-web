import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as vega from 'vega';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { INSIGHTS, INSIGHT_DIR } from './insights';

/** Vendored UMD, served from public/. See public/vendor/UPSTREAM.json for provenance. */
const VENDOR_SRC = 'vendor/sanddance-specs.js';
/** Every insight in the set is written against this dataset. */
const DATA_URL = 'https://microsoft.github.io/SandDance/sample-data/demovote.tsv';

/** The slice of `@msrvida/sanddance-specs` this page uses; the UMD ships no types. */
interface SandDanceSpecsUmd {
  getColumnsFromData(inferTypes: unknown, data: unknown[]): unknown;
  getSpecColumns(insight: unknown, columns: unknown): unknown;
  build(context: unknown, data: unknown[]): { vegaSpec?: Record<string, unknown>; errors?: string[] };
}

/**
 * A port of https://microsoft.github.io/SandDance/tests/sanddance-specs/v2/.
 *
 * A SandDance *Insight* is a short description of intent — which column is x, which is colour,
 * which chart, 2d or 3d — and says nothing about marks or scales. This page picks one, compiles it
 * against a dataset, and shows both halves: the insight going in, and the several-hundred-line Vega
 * specification coming out. The gap between the two is the point.
 *
 * Unlike /transition, nothing special renders this. `build()` returns an ordinary Vega spec, so it
 * goes through the app's own <app-vega-chart> like every other chart here. Only the compiler is
 * vendored, 200 KB, loaded on this route alone.
 */
@Component({
  selector: 'app-sanddance-specs-page',
  imports: [SpecEditorComponent, VegaChartComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>sanddance-specs · insight compiler · demovote.tsv</p>
    </section>

    <div class="client chart-shell">
      <div class="chart-column">
        <div class="chart-toolbar">
          <label class="field">
            <select [value]="selected()" (change)="pick($any($event.target).value)" [disabled]="!ready()">
              @for (i of insights; track i.file) { <option [value]="i.file">{{ i.label }}</option> }
            </select>
          </label>
          <h1>Sanddance Specs</h1>
          <span class="spacer"></span>
          @if (!ready() && !fatal()) { <span class="status">Loading compiler…</span> }
          @if (error()) { <span class="status err">{{ error() }}</span> }
        </div>
        <div class="chart-stage">
          @if (fatal()) {
            <div class="fallback"><p>{{ fatal() }}</p></div>
          } @else if (vegaSpec(); as spec) {
            <app-vega-chart [spec]="spec" renderer="canvas" [fill]="true" />
          }
        </div>
      </div>

      <div class="chart-column">
        <div class="chart-pane">
          <div class="chart-pane-head">
            <span class="eyebrow">Insight · in</span>
            <button type="button" class="btn small" (click)="applyInsight()" [disabled]="!ready()">Update</button>
          </div>
          <app-spec-editor #editor [value]="insightJson()" />
        </div>

        <div class="chart-pane">
          <div class="chart-pane-head">
            <span class="eyebrow">Vega specification · out{{ outLines() ? ' · ' + outLines() + ' lines' : '' }}</span>
            <button type="button" class="btn small" (click)="copy()" [disabled]="!vegaJson()">{{ copied() ? 'copied' : 'copy' }}</button>
          </div>
          <app-spec-editor [value]="vegaJson()" />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: calc(100vh - var(--nav-h)); display: flex; flex-direction: column; }
    .head { padding: clamp(0.75rem, 2vh, 1.1rem) var(--pad-x) 0; }
    /* Shell, column, toolbar, stage and panes come from styles.scss, shared with the MorphCharts
       and Vega Charts clients. This page has no divider, so it sets its own column widths. */
    .client { grid-template-columns: 1fr 460px; }
    .field { display: inline-flex; }
    .status { font-size: 12px; color: var(--on-ink-faint); }
    .status.err { color: var(--rose); }
    .fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; color: var(--rose); font-size: 13px; }

    /* Same treatment as /transition: the plot takes the whole box and Vega's signal bindings float
       over its bottom-left corner instead of stacking underneath and pushing it out of view.
       ::ng-deep because vega-embed's DOM belongs to <app-vega-chart>, not to this component. */
    :host ::ng-deep app-vega-chart { position: absolute; inset: 0; }
    :host ::ng-deep .vega-embed { position: absolute; inset: 0; }
    /* Vega sizes the canvas inline from the spec's own width, which overflows a narrower box and
       gets clipped. Contained rather than stretched: it scales down to fit and keeps its aspect,
       so a wide facet grid stays whole. !important because the inline style would otherwise win. */
    :host ::ng-deep .vega-embed { display: flex; align-items: center; justify-content: center; padding: 8px; }
    :host ::ng-deep .vega-embed canvas.marks,
    :host ::ng-deep .vega-embed svg {
      display: block;
      width: auto !important; height: auto !important;
      max-width: 100% !important; max-height: 100% !important;
    }
    :host ::ng-deep .vega-bindings {
      position: absolute; left: 12px; bottom: 12px; width: auto; max-width: min(340px, 60%);
      max-height: calc(100% - 24px); overflow: auto; z-index: 2;
      padding: 10px 12px; border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      border: 1px solid var(--hairline); box-shadow: var(--shadow-sm);
      font-size: 12px; color: var(--on-ink-dim);
    }
    :host ::ng-deep .vega-bind { display: flex; align-items: center; gap: 6px; }
    :host ::ng-deep .vega-bind input[type="range"] { max-width: 120px; }
    :host ::ng-deep .vega-bind-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    app-spec-editor { flex: 1; min-height: 140px; }
    @media (max-width: 1000px) { .client { grid-template-columns: 1fr; } :host { height: auto; } .chart-stage { min-height: 60vh; } }
  `,
})
export class SanddanceSpecsPageComponent {
  readonly insights = INSIGHTS;
  readonly selected = signal(INSIGHTS[0].file);
  readonly insightJson = signal('{}');
  readonly vegaJson = signal('');
  readonly vegaSpec = signal<Record<string, unknown> | null>(null);
  readonly ready = signal(false);
  readonly error = signal('');
  readonly fatal = signal('');
  readonly copied = signal(false);

  readonly outLines = () => (this.vegaJson() ? this.vegaJson().split('\n').length : 0);

  private readonly editor = viewChild.required('editor', { read: SpecEditorComponent });
  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  private umd: SandDanceSpecsUmd | null = null;
  private rows: unknown[] = [];
  private columns: unknown = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.short });
      void this.boot();
    });
  }

  pick(file: string): void {
    this.selected.set(file);
    void this.loadInsight(file);
  }

  /** Recompile from whatever is in the editor, so the insight can be edited by hand. */
  applyInsight(): void {
    try {
      this.compile(this.editor().parseJSON());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  copy(): void {
    void navigator.clipboard.writeText(this.vegaJson()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private async boot(): Promise<void> {
    try {
      this.umd = await loadVendorUmd();
      // The compiler needs the data up front: it infers each column's type to choose scales.
      const tsv = await firstValueFrom(this.http.get(DATA_URL, { responseType: 'text' }));
      this.rows = vega.read(tsv, { type: 'tsv', parse: 'auto' }) as unknown[];
      this.columns = this.umd.getColumnsFromData(vega.inferTypes, this.rows);
      this.ready.set(true);
      await this.loadInsight(this.selected());
    } catch (e) {
      this.fatal.set(`The insight compiler could not start: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async loadInsight(file: string): Promise<void> {
    try {
      const insight = await firstValueFrom(this.http.get<Record<string, unknown>>(`${INSIGHT_DIR}/${file}`));
      this.compile(insight);
    } catch (e) {
      this.error.set(`Could not load ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private compile(insight: unknown): void {
    const umd = this.umd;
    if (!umd) return;
    this.insightJson.set(JSON.stringify(insight, null, 2));
    try {
      const resolved = withVendoredImage(insight);
      const specColumns = umd.getSpecColumns(resolved, this.columns);
      const result = umd.build({ specColumns, insight: resolved, specViewOptions: VIEW_OPTIONS }, this.rows);
      if (result.errors?.length) {
        this.error.set(result.errors.join('\n'));
        return;
      }
      this.error.set('');
      this.vegaSpec.set(result.vegaSpec ?? null);
      this.vegaJson.set(displaySpec(result.vegaSpec));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}

/** Where the vendored copy of the insights' background image lives. */
const IMG_DIR = 'data/sanddance/img';

/**
 * Four of the insights lay a US counties map under the plot, referenced as `img/<file>` relative to
 * the page it was written for. Resolved here against the vendored copy, leaving the insight files
 * byte-identical to upstream — and leaving the editor showing the original path, which is what the
 * insight actually says.
 *
 * Absolute on purpose. The rendered spec goes through the shared chart component, whose Vega loader
 * carries `baseURL` pointing at vega.github.io so gallery datasets resolve there; a relative image
 * path would be resolved against that host instead of this app, load nothing, and take the whole
 * canvas down with it — Vega aborts the draw on a broken image rather than skipping it.
 */
function withVendoredImage(insight: unknown): unknown {
  const i = insight as { backgroundImage?: { url?: string } };
  const url = i?.backgroundImage?.url;
  if (!url?.startsWith('img/')) return insight;
  const absolute = new URL(`${IMG_DIR}/${url.slice('img/'.length)}`, document.baseURI).href;
  return { ...i, backgroundImage: { ...i.backgroundImage, url: absolute } };
}

/**
 * The compiled spec carries the whole dataset inline — every row of demovote.tsv, which runs to
 * half a million lines of JSON and is useless to read. For display it is swapped for the URL the
 * rows came from, exactly as the original page does, leaving a spec that is legible and still
 * runnable. The rendered spec keeps its values; only this copy is trimmed.
 */
function displaySpec(spec: Record<string, unknown> | undefined): string {
  if (!spec) return '';
  const shown = { ...spec };
  const data = shown['data'];
  if (Array.isArray(data) && data.length) {
    const [first, ...rest] = data as Record<string, unknown>[];
    const { values: _dropped, ...keep } = first;
    shown['data'] = [{ ...keep, url: DATA_URL, format: { parse: 'auto', type: 'tsv' } }, ...rest];
  }
  return JSON.stringify(shown, null, 2);
}

/** The demo hardcodes steelblue on black; these are the app's own tokens instead. */
const VIEW_OPTIONS = {
  colors: { defaultCube: '#00705D', axisLine: '#8A8A8A', axisText: '#5A5A5A' },
  language: { count: 'Count' },
  maxLegends: 20,
  tickSize: 10,
};

let umdPromise: Promise<SandDanceSpecsUmd> | null = null;

/** Injects the vendored UMD once per page load and resolves with its global. */
function loadVendorUmd(): Promise<SandDanceSpecsUmd> {
  const existing = (globalThis as unknown as { SandDanceSpecs?: SandDanceSpecsUmd }).SandDanceSpecs;
  if (existing) return Promise.resolve(existing);
  umdPromise ??= new Promise<SandDanceSpecsUmd>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = VENDOR_SRC;
    el.async = true;
    el.onload = () => {
      const g = (globalThis as unknown as { SandDanceSpecs?: SandDanceSpecsUmd }).SandDanceSpecs;
      g ? resolve(g) : reject(new Error(`${VENDOR_SRC} loaded but exposed no SandDanceSpecs global`));
    };
    el.onerror = () => reject(new Error(`could not load ${VENDOR_SRC}`));
    document.head.appendChild(el);
  });
  return umdPromise;
}
