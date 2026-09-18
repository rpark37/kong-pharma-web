import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { PRESETS, bayes, predictiveCurve } from './bayes';
import { LAYOUT_NAMES, type FormConfig } from './bayes-data.model';
import { generateBayesData } from './bayes-data-generator';
import type { BayesScene } from './bayes-scene';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { curveSpec, iconArraySpec, outcomeSpec } from './bayes-specs';

/**
 * Therapeutic Tests (Bayes' Theorem): the user's original MorphCharts morphing visualization,
 * ported into the labs app, followed by Vega-Lite companions that share the same inputs.
 */
@Component({
  selector: 'app-bayes-page',
  imports: [DecimalPipe, PercentPipe, KpiTileComponent, VegaChartComponent, MorphchartsCanvasComponent, WebGpuFallbackComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>Therapeutic tests · Bayes' theorem</p>
    </section>

    <section class="layout">
      <form class="controls glass" data-reveal (submit)="$event.preventDefault()">
        <div class="presets">
          @for (p of presets; track p.id) { <button type="button" class="btn small" [class.active]="preset() === p.id" (click)="apply(p.id)" [title]="p.note">{{ p.name }}</button> }
        </div>
        <label>
          <span>Count <output>{{ form().count | number }}</output></span>
          <input type="number" min="1" max="20000" step="1" [value]="form().count" (change)="setCount(+$any($event.target).value)">
          <small>People in the synthetic population (blocks in the grid)</small>
        </label>
        <label>
          <span>Prior <output>{{ form().prior | percent: '1.1-2' }}</output></span>
          <input type="range" min="0" max="1" step="0.001" [value]="form().prior" (input)="set('prior', +$any($event.target).value)">
          <small>Prevalence: 1 in {{ 1 / (form().prior || 0.0001) | number: '1.0-0' }} have the disease</small>
        </label>
        <label>
          <span>Sensitivity <output>{{ form().sensitivity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="form().sensitivity" (input)="set('sensitivity', +$any($event.target).value)">
          <small>Of people with the condition, the share the test catches</small>
        </label>
        <label>
          <span>Specificity <output>{{ form().specificity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="form().specificity" (input)="set('specificity', +$any($event.target).value)">
          <small>Of people without it, the share the test clears</small>
        </label>
        <label>
          <span>Transition duration <output>{{ form().transitionDuration }}ms</output></span>
          <input type="range" min="0" max="10000" step="100" [value]="form().transitionDuration" (input)="set('transitionDuration', +$any($event.target).value)">
        </label>
        <label>
          <span>Transition staggering <output>{{ form().transitionStaggering }}ms</output></span>
          <input type="range" min="0" max="10000" step="100" [value]="form().transitionStaggering" (input)="set('transitionStaggering', +$any($event.target).value)">
          <small>Blocks start moving one after another; GSAP eases the whole morph with quad.inOut</small>
        </label>
        <p class="formula mono">PPV = Se·P / (Se·P + (1−Sp)·(1−P))</p>
        <p class="formula mono">post-test odds = pre-test odds × LR</p>
      </form>

      <div class="results">
        <div class="viz glass wide" data-reveal>
          <div class="viz-head">
            <div>
              <span class="eyebrow">View {{ layoutIndex() + 1 }} of 4</span>
              <h2>{{ layoutName() }}</h2>
            </div>
            <div class="button-group">
              <button type="button" class="btn small" (click)="onReset()" title="Reset the camera">Reset</button>
              <button type="button" class="btn small" (click)="onPrev()" [disabled]="transitioning()">‹ Prev</button>
              <button type="button" class="btn" [class.active]="true" (click)="onNext()" [disabled]="transitioning()">Next ›</button>
            </div>
          </div>
          <div #morphchartsContainer class="morphcharts-container">
            @if (!fallback()) {
              <app-morphcharts-canvas (hostReady)="onHost($event)" (failed)="fallback.set($event)" />
              <span class="hint">Drag to orbit · wheel to zoom · Reset returns the camera</span>
            } @else {
              <div class="fallback-wrap"><app-webgpu-fallback title="The block views need WebGPU"><p class="small">{{ fallback() }} The Vega charts below show the same numbers.</p></app-webgpu-fallback></div>
            }
          </div>
          @if (morphError()) { <p class="err">{{ morphError() }}</p> }
          <ol class="steps">
            @for (name of layoutNames; track name; let i = $index) {
              <li [class.active]="i === layoutIndex()"><button type="button" (click)="goTo(i)" [disabled]="transitioning()">{{ name }}</button></li>
            }
          </ol>
        </div>

        <div class="kpis">
          <app-kpi-tile label="Positive predictive value" [value]="out().ppv * 100" suffix="%" [decimals]="1" hint="P(disease | positive)" />
          <app-kpi-tile label="Negative predictive value" [value]="out().npv * 100" suffix="%" [decimals]="1" hint="P(no disease | negative)" />
          <app-kpi-tile label="LR+" [value]="lrPlus()" [decimals]="1" hint="sensitivity / (1 − specificity)" />
          <app-kpi-tile label="LR−" [value]="out().lrNegative" [decimals]="2" hint="(1 − sensitivity) / specificity" />
        </div>

        <div class="tree glass" data-reveal>
          <p class="eyebrow">Natural frequencies · {{ form().count | number }} people</p>
          <div class="tree-grid">
            <div class="node root"><strong>{{ form().count | number }}</strong><span>people tested</span></div>
            <div class="branch">
              <div class="node sick"><strong>{{ out().diseased | number: '1.0-0' }}</strong><span>have the condition</span></div>
              <div class="leaves">
                <div class="node tp"><strong>{{ out().truePositives | number: '1.0-0' }}</strong><span>true positive</span></div>
                <div class="node fn"><strong>{{ out().falseNegatives | number: '1.0-0' }}</strong><span>false negative (missed)</span></div>
              </div>
            </div>
            <div class="branch">
              <div class="node well"><strong>{{ out().healthy | number: '1.0-0' }}</strong><span>do not</span></div>
              <div class="leaves">
                <div class="node fp"><strong>{{ out().falsePositives | number: '1.0-0' }}</strong><span>false positive (alarm)</span></div>
                <div class="node tn"><strong>{{ out().trueNegatives | number: '1.0-0' }}</strong><span>true negative</span></div>
              </div>
            </div>
          </div>
          <p class="reading">
            Of the <strong>{{ out().positives | number: '1.0-0' }}</strong> people who test positive, <strong>{{ out().truePositives | number: '1.0-0' }}</strong> actually have the condition
            ({{ out().ppv | percent: '1.1-1' }}). Of the <strong>{{ out().negatives | number: '1.0-0' }}</strong> who test negative, <strong>{{ out().falseNegatives | number: '1.0-0' }}</strong> are missed.
          </p>
        </div>

        <div class="card glass" data-reveal><app-vega-chart [spec]="specs.outcome" [data]="{ outcomes: outcomes() }" [height]="200" /></div>
        <div class="card glass" data-reveal><app-vega-chart [spec]="specs.icons" [data]="{ icons: icons() }" [height]="220" /></div>
        <div class="card glass wide" data-reveal><app-vega-chart [spec]="specs.curve" [data]="{ curve: curve(), marker: marker() }" [height]="260" /></div>
      </div>
    </section>
    <p class="note" data-reveal>Presets are rounded illustrative figures for learning, not clinical guidance. Ported from the therapeutic-tests-bayes-theorem project; the block views are MorphCharts specifications path-traced on WebGPU, the companions are Vega-Lite specifications.</p>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    .viz { padding: 16px; }
    .viz-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .viz-head h2 { font-size: 20px; margin-top: 2px; }
    .button-group { display: flex; gap: 8px; }
    .morphcharts-container { position: relative; width: 100%; height: 620px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--hairline); background: var(--ink-2); }
    .morphcharts-container app-morphcharts-canvas { position: absolute; inset: 0; }
    .hint { position: absolute; left: 12px; bottom: 8px; font-size: 11px; color: var(--on-ink-faint); pointer-events: none; }
    .fallback-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .steps { list-style: none; margin: 10px 0 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; }
    .steps button { font: inherit; font-size: 12px; background: none; border: 1px solid var(--hairline); border-radius: 999px; padding: 4px 10px; color: var(--on-ink-dim); cursor: pointer; }
    .steps .active button { border-color: var(--teal); color: var(--teal); }
    .err { color: var(--rose); font-size: 12px; margin-top: 6px; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px; align-items: start; }
    .controls { position: sticky; top: calc(var(--nav-h) + 16px); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    label span { display: flex; justify-content: space-between; color: var(--on-ink); }
    input[type=number] { font: inherit; color: var(--on-ink); background: rgba(0,0,0,0.25); border: 1px solid var(--hairline); border-radius: 6px; padding: 5px 8px; width: 120px; }
    output { font-family: var(--font-mono); color: var(--teal); }
    small { color: var(--on-ink-faint); font-size: 11px; }
    .formula { font-size: 11px; color: var(--on-ink-dim); }
    .results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .kpis { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .tree { grid-column: 1 / -1; padding: 16px; }
    .tree-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
    .root { grid-column: 1 / -1; }
    .branch { display: flex; flex-direction: column; gap: 8px; }
    .leaves { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .node { border: 1px solid var(--hairline); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; background: rgba(0,0,0,0.18); }
    .node strong { font-family: var(--font-display); font-size: 20px; }
    .node span { font-size: 12px; color: var(--on-ink-dim); }
    .sick { border-color: rgba(239,122,138,0.6); } .well { border-color: rgba(68,224,204,0.6); }
    .tp { background: rgba(239,122,138,0.18); } .fn { background: rgba(184,95,107,0.18); } .fp { background: rgba(242,193,78,0.16); } .tn { background: rgba(68,224,204,0.14); }
    .reading { margin-top: 12px; font-size: 14px; color: var(--on-ink-dim); strong { color: var(--on-ink); } }
    .card { padding: 14px 16px; min-width: 0; }
    .wide { grid-column: 1 / -1; }
    .note { margin-top: 16px; font-size: 12px; color: var(--on-ink-faint); }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .controls { position: static; } .results { grid-template-columns: 1fr; } .morphcharts-container { height: 400px; } }
  `,
})
export class BayesPageComponent {
  readonly presets = PRESETS;
  readonly layoutNames = LAYOUT_NAMES;
  readonly preset = signal<string>('mammography');
  readonly form = signal<FormConfig>({ count: 1000, sensitivity: 0.9, specificity: 0.91, prior: 0.01, transitionDuration: 2000, transitionStaggering: 1000 });
  readonly layoutIndex = signal(0);
  readonly transitioning = signal(false);
  readonly morphError = signal<string | null>(null);
  readonly fallback = signal<string | null>(null);
  readonly layoutName = computed(() => LAYOUT_NAMES[this.layoutIndex()]);

  readonly inputs = computed(() => ({ prevalence: this.form().prior, sensitivity: this.form().sensitivity, specificity: this.form().specificity, population: this.form().count }));
  readonly data = computed(() => generateBayesData(this.form()));
  readonly out = computed(() => bayes(this.inputs()));
  readonly lrPlus = computed(() => Math.min(999, this.out().lrPositive));
  readonly curve = computed(() => predictiveCurve(this.form().sensitivity, this.form().specificity));
  readonly marker = computed(() => [{ prevalence: this.form().prior, ppv: this.out().ppv }]);
  readonly outcomes = computed(() => {
    const o = this.out();
    return [
      { result: 'Test positive', truth: 'Diseased', people: o.truePositives, order: 0, label: 'true positives' },
      { result: 'Test positive', truth: 'Healthy', people: o.falsePositives, order: 1, label: 'false positives' },
      { result: 'Test negative', truth: 'Diseased', people: o.falseNegatives, order: 0, label: 'false negatives' },
      { result: 'Test negative', truth: 'Healthy', people: o.trueNegatives, order: 1, label: 'true negatives' },
    ];
  });
  readonly icons = computed(() => {
    const o = bayes({ ...this.inputs(), population: 100 });
    const counts: Array<[string, number]> = [['True positive', o.truePositives], ['False negative', o.falseNegatives], ['False positive', o.falsePositives], ['True negative', o.trueNegatives]];
    const cells: Array<{ col: number; row: number; outcome: string }> = [];
    let k = 0;
    for (const [outcome, n] of counts) for (let i = 0; i < Math.round(n) && k < 100; i++, k++) cells.push({ col: k % 20, row: Math.floor(k / 20), outcome });
    while (k < 100) { cells.push({ col: k % 20, row: Math.floor(k / 20), outcome: 'True negative' }); k++; }
    return cells;
  });
  readonly specs = { outcome: outcomeSpec(), curve: curveSpec(), icons: iconArraySpec() };

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('morphchartsContainer');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: BayesScene | null = null;
  private host: MorphChartsHost | null = null;
  private resize: ResizeObserver | null = null;
  private relayout: Promise<void> = Promise.resolve();

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
    });
    inject(DestroyRef).onDestroy(() => { this.scene?.dispose(); this.resize?.disconnect(); });
    // Re-lay out the current view (no transition) whenever the inputs change.
    effect(() => {
      const config = this.form();
      const data = this.data();
      untracked(() => { if (this.scene) this.queue(() => this.scene!.layout(this.layoutIndex(), data, config, false)); });
    });
  }

  async onHost(host: MorphChartsHost): Promise<void> {
    this.host = host;
    this.fit();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(this.container().nativeElement);
    try {
      const { BayesScene } = await import('./bayes-scene');
      const scene = new BayesScene(host);
      scene.reducedMotion = this.gsap.reducedMotion;
      scene.onTransitionEnd = () => this.transitioning.set(false);
      this.scene = scene;
      await this.queue(() => scene.layout(this.layoutIndex(), this.data(), this.form(), false));
    } catch (err) {
      this.morphError.set(`The 3D view could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private fit(): void {
    const host = this.host;
    const el = this.container().nativeElement;
    if (!host) return;
    const w = Math.max(64, Math.floor(el.clientWidth));
    const h = Math.max(64, Math.floor(el.clientHeight));
    host.resize(w, h);
    host.canvas.style.width = `${w}px`;
    host.canvas.style.height = `${h}px`;
    host.renderer.frameCount = 0;
  }

  /** Serialises scene re-layouts (each parses a spec) so rapid slider input cannot interleave. */
  private queue(job: () => Promise<void>): Promise<void> {
    this.relayout = this.relayout.then(job).catch((err) => this.morphError.set(err instanceof Error ? err.message : String(err)));
    return this.relayout;
  }

  set<K extends keyof FormConfig>(key: K, value: FormConfig[K]): void {
    this.preset.set('');
    this.form.set({ ...this.form(), [key]: value });
  }

  setCount(value: number): void {
    if (!isNaN(value) && value > 0) this.set('count', Math.min(20000, Math.round(value)));
  }

  apply(id: string): void {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    this.preset.set(id);
    this.form.set({ ...this.form(), count: p.inputs.population, prior: p.inputs.prevalence, sensitivity: p.inputs.sensitivity, specificity: p.inputs.specificity });
  }

  onReset(): void { this.scene?.resetCamera(); }
  onPrev(): void { this.goTo((this.layoutIndex() + 3) % 4); }
  onNext(): void { this.goTo((this.layoutIndex() + 1) % 4); }

  goTo(index: number): void {
    if (index === this.layoutIndex() || !this.scene) { this.layoutIndex.set(index); return; }
    this.layoutIndex.set(index);
    this.transitioning.set(true);
    const scene = this.scene;
    void this.queue(() => scene.layout(index, this.data(), this.form(), true)).then(() => { if (!scene.isTransitioning) this.transitioning.set(false); });
  }
}
