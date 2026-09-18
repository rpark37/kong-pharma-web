import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as vega from 'vega';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { VEGA_DATA_BASE, patchLoader } from '../../shared/vega/data-uri';

/** Vendored UMD, served from public/. See public/vendor/UPSTREAM.json for provenance. */
const VENDOR_SRC = 'vendor/vega-morphcharts.js';
const LEFT_SPEC = 'data/vega/specs/scatter3D.json';
const RIGHT_SPEC = 'data/vega/specs/titanic.json';

/** The slice of `@msrvida/vega-morphcharts` this page uses; the UMD ships no types. */
interface Presenter { finalize?: () => void }
interface ViewGlInstance {
  presenter?: Presenter;
  renderer(name: string): ViewGlInstance;
  initialize(el: Element): ViewGlInstance;
  run(): ViewGlInstance;
  /** Inherited from Vega's View: resizes the scene rather than stretching its canvas. */
  width(w: number): ViewGlInstance;
  height(h: number): ViewGlInstance;
  finalize?: () => void;
}
interface VegaMorphChartsUmd {
  use(v: unknown): void;
  ViewGl: new (runtime: unknown, options: Record<string, unknown>) => ViewGlInstance;
}

/**
 * A port of https://microsoft.github.io/SandDance/tests/v4/umd/transition.html.
 *
 * Two Vega specs, and applying one morphs the marks into it from whatever is already on screen
 * rather than redrawing. The mechanism is a single line: the new view is constructed with the
 * PREVIOUS view's `presenter`, so the renderer keeps its marks and tweens them to their new
 * positions. Drop that and you get a cut.
 *
 * On the library: this renders through `ViewGl`, the Vega-scenegraph-to-MorphCharts adapter, which
 * is vendored as a UMD rather than bundled — it is ~1 MB and would otherwise breach the app's
 * initial-bundle budget, so it loads only when this route is visited. It is also NOT the MorphCharts
 * in app/vendor/morphcharts: that is the newer WebGPU ray-tracing lineage, and no Vega adapter
 * exists for it. `ViewGl` is pinned to the older WebGL `morphcharts@1.x`, which the UMD bundles.
 *
 * Only the adapter is vendored, not SandDance itself — 995 KB against 1.38 MB, since none of
 * sanddance-specs, search-expression or chart-types is used here.
 */
@Component({
  selector: 'app-transition-page',
  imports: [SpecEditorComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>vega-morphcharts · ViewGl · WebGL</p>
    </section>

    <div class="client">
      <div class="left" #stage>
        @if (fatal()) {
          <div class="fallback"><p>{{ fatal() }}</p></div>
        }
      </div>
      <div class="right">
        <div class="toolbar">
          <button type="button" class="btn small" [class.active]="viewType() === '3d'" (click)="toggleView()" [disabled]="!ready()">
            {{ viewType() === '3d' ? '3D' : '2D' }}
          </button>
          <span class="spacer"></span>
          @if (!ready() && !fatal()) { <span class="status">Loading renderer…</span> }
          @if (error()) { <span class="status err">{{ error() }}</span> }
        </div>

        <div class="pane">
          <div class="pane-head">
            <span class="eyebrow">Spec A · scatter3D</span>
            <button type="button" class="btn small" (click)="apply('a')" [disabled]="!ready()">Apply this spec</button>
          </div>
          <app-spec-editor #editorA [value]="specA()" />
        </div>

        <div class="pane">
          <div class="pane-head">
            <span class="eyebrow">Spec B · titanic</span>
            <button type="button" class="btn small" (click)="apply('b')" [disabled]="!ready()">Apply this spec</button>
          </div>
          <app-spec-editor #editorB [value]="specB()" />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: calc(100vh - var(--nav-h)); display: flex; flex-direction: column; }
    .head { padding: clamp(0.75rem, 2vh, 1.1rem) var(--pad-x) 0; }
    .client { flex: 1; display: grid; grid-template-columns: 1fr 460px; gap: 16px; padding: 14px var(--pad-x) 16px; min-height: 0; }
    .left { position: relative; border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--ink-2); overflow: hidden; }

    /* ViewGl builds its own DOM inside the host, so these are reached with ::ng-deep — the same
       way atlas-page reaches the canvas it does not own. The renderer stacks a gl surface above a
       controls panel; here the surface takes the whole box and the controls float over it. */
    :host ::ng-deep .vega-morphcharts-root { position: absolute; inset: 0; }
    :host ::ng-deep .vega-morphcharts-gl,
    :host ::ng-deep .vega-morphcharts-gl canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    :host ::ng-deep .vega-morphcharts-panel {
      position: absolute; left: 12px; bottom: 12px; right: auto; top: auto; width: auto; max-width: min(340px, 60%);
      max-height: calc(100% - 24px); overflow: auto; z-index: 2;
      padding: 10px 12px; border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      border: 1px solid var(--hairline); box-shadow: var(--shadow-sm);
      font-size: 12px; color: var(--on-ink-dim);
    }
    :host ::ng-deep .vega-morphcharts-panel select,
    :host ::ng-deep .vega-morphcharts-panel input { font: inherit; max-width: 150px; }
    :host ::ng-deep .vega-morphcharts-legend:empty { display: none; }
    .fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; color: var(--rose); font-size: 13px; }
    .right { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .spacer { flex: 1; }
    .status { font-size: 12px; color: var(--on-ink-faint); }
    .status.err { color: var(--rose); }
    .pane { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 6px; }
    .pane-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    app-spec-editor { flex: 1; min-height: 140px; }
    @media (max-width: 1000px) { .client { grid-template-columns: 1fr; } :host { height: auto; } .left { height: 60vh; } }
  `,
})
export class TransitionPageComponent {
  readonly specA = signal('{}');
  readonly specB = signal('{}');
  readonly viewType = signal<'2d' | '3d'>('3d');
  readonly ready = signal(false);
  readonly error = signal('');
  readonly fatal = signal('');

  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly editorA = viewChild.required('editorA', { read: SpecEditorComponent });
  private readonly editorB = viewChild.required('editorB', { read: SpecEditorComponent });
  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  private umd: VegaMorphChartsUmd | null = null;
  private view: ViewGlInstance | null = null;
  /** The spec last applied, so the 2D/3D toggle can rebuild without re-reading an editor. */
  private lastSpec: unknown = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.short });
      void this.boot();
      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(this.stage().nativeElement);
    });
    inject(DestroyRef).onDestroy(() => { this.resize?.disconnect(); this.view?.finalize?.(); });
  }

  toggleView(): void {
    this.viewType.set(this.viewType() === '3d' ? '2d' : '3d');
    if (this.lastSpec) this.render(this.lastSpec);
  }

  apply(which: 'a' | 'b'): void {
    const editor = which === 'a' ? this.editorA() : this.editorB();
    try {
      const spec = editor.parseJSON();
      this.error.set('');
      this.render(spec);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private async boot(): Promise<void> {
    try {
      const [a, b] = await Promise.all([
        firstValueFrom(this.http.get(LEFT_SPEC, { responseType: 'text' })),
        firstValueFrom(this.http.get(RIGHT_SPEC, { responseType: 'text' })),
      ]);
      this.specA.set(a);
      this.specB.set(b);

      // The UMD calls `use(vega)` against a global. The app already bundles vega@6, so it is handed
      // over directly rather than downloading a second copy.
      (globalThis as unknown as { vega: unknown }).vega = vega;
      this.umd = await loadVendorUmd();
      this.umd.use(vega);
      this.ready.set(true);
      this.render(JSON.parse(a));
    } catch (e) {
      this.fatal.set(`The transition renderer could not start: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * The specs declare their own 700x700, which leaves the scene floating in a corner of a wider
   * panel. Resizing the view redraws at the panel's size rather than stretching a fixed buffer,
   * so the result stays crisp.
   */
  private fit(): void {
    const el = this.stage().nativeElement;
    const w = Math.max(64, Math.floor(el.clientWidth));
    const h = Math.max(64, Math.floor(el.clientHeight));
    try { this.view?.width(w).height(h).run(); } catch { /* spec without resizable size signals */ }
  }

  private render(spec: unknown): void {
    const umd = this.umd;
    if (!umd) return;
    try {
      // Handing the previous presenter to the new view is the whole point: the renderer keeps its
      // marks and tweens them instead of starting from nothing.
      this.view = new umd.ViewGl(vega.parse(spec as never), {
        presenter: this.view?.presenter,
        getView: () => this.viewType(),
        loader: patchLoader(vega.loader({ baseURL: VEGA_DATA_BASE })),
      })
        .renderer('morphcharts')
        .initialize(this.stage().nativeElement)
        .run();
      this.lastSpec = spec;
      this.fit();
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}

let umdPromise: Promise<VegaMorphChartsUmd> | null = null;

/** Injects the vendored UMD once per page load and resolves with its global. */
function loadVendorUmd(): Promise<VegaMorphChartsUmd> {
  const existing = (globalThis as unknown as { VegaMorphCharts?: VegaMorphChartsUmd }).VegaMorphCharts;
  if (existing) return Promise.resolve(existing);
  umdPromise ??= new Promise<VegaMorphChartsUmd>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = VENDOR_SRC;
    el.async = true;
    el.onload = () => {
      const g = (globalThis as unknown as { VegaMorphCharts?: VegaMorphChartsUmd }).VegaMorphCharts;
      g ? resolve(g) : reject(new Error(`${VENDOR_SRC} loaded but exposed no VegaMorphCharts global`));
    };
    el.onerror = () => reject(new Error(`could not load ${VENDOR_SRC}`));
    document.head.appendChild(el);
  });
  return umdPromise;
}
