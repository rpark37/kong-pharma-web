import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { PRESETS, TestInputs, bayes, predictiveCurve } from './bayes';
import { curveSpec, iconArraySpec, outcomeSpec } from './bayes-specs';

@Component({
  selector: 'app-bayes-page',
  imports: [DecimalPipe, PercentPipe, KpiTileComponent, VegaChartComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>Therapeutic tests · Bayes' theorem</p>
      <h1 data-reveal>What should a test result make you believe?</h1>
      <p class="lede" data-reveal>
        A test never answers "does this patient have it?" directly. It updates the odds you started with.
        Set the prevalence (how common the condition is where you are testing), the test's sensitivity and
        specificity, and watch the positive and negative predictive values move.
      </p>
    </section>

    <section class="layout">
      <form class="controls glass" data-reveal (submit)="$event.preventDefault()">
        <div class="presets">
          @for (p of presets; track p.id) { <button type="button" class="btn small" [class.active]="preset() === p.id" (click)="apply(p.id)" [title]="p.note">{{ p.name }}</button> }
        </div>
        <label>
          <span>Prevalence <output>{{ inputs().prevalence | percent: '1.1-2' }}</output></span>
          <input type="range" min="0" max="1" step="0.001" [value]="inputs().prevalence" (input)="set('prevalence', +$any($event.target).value)">
          <small>Pre-test probability: 1 in {{ 1 / (inputs().prevalence || 0.0001) | number: '1.0-0' }}</small>
        </label>
        <label>
          <span>Sensitivity <output>{{ inputs().sensitivity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="inputs().sensitivity" (input)="set('sensitivity', +$any($event.target).value)">
          <small>Of people with the condition, the share the test catches</small>
        </label>
        <label>
          <span>Specificity <output>{{ inputs().specificity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="inputs().specificity" (input)="set('specificity', +$any($event.target).value)">
          <small>Of people without it, the share the test clears</small>
        </label>
        <label>
          <span>Population <output>{{ inputs().population | number }}</output></span>
          <input type="range" min="100" max="100000" step="100" [value]="inputs().population" (input)="set('population', +$any($event.target).value)">
        </label>
        <p class="formula mono">PPV = Se·P / (Se·P + (1−Sp)·(1−P))</p>
        <p class="formula mono">post-test odds = pre-test odds × LR</p>
      </form>

      <div class="results">
        <div class="kpis">
          <app-kpi-tile label="Positive predictive value" [value]="out().ppv * 100" suffix="%" [decimals]="1" [delay]="0" hint="P(disease | positive)" data-reveal />
          <app-kpi-tile label="Negative predictive value" [value]="out().npv * 100" suffix="%" [decimals]="1" [delay]="0.08" hint="P(no disease | negative)" data-reveal />
          <app-kpi-tile label="LR+" [value]="lrPlus()" [decimals]="1" [delay]="0.16" hint="sensitivity / (1 − specificity)" data-reveal />
          <app-kpi-tile label="LR−" [value]="out().lrNegative" [decimals]="2" [delay]="0.24" hint="(1 − sensitivity) / specificity" data-reveal />
        </div>

        <div class="tree glass" data-reveal>
          <p class="eyebrow">Natural frequencies · {{ inputs().population | number }} people</p>
          <div class="tree-grid">
            <div class="node root"><strong>{{ inputs().population | number }}</strong><span>people tested</span></div>
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
    <p class="note" data-reveal>Presets are rounded illustrative figures for learning, not clinical guidance. Share the original therapeutic-tests project files and this page will take its content and examples.</p>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: 6px 0 10px; max-width: 800px; }
    .lede { color: var(--on-ink-dim); max-width: 760px; margin-bottom: 20px; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px; align-items: start; }
    .controls { position: sticky; top: calc(var(--nav-h) + 16px); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    label span { display: flex; justify-content: space-between; color: var(--on-ink); }
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
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .controls { position: static; } .results { grid-template-columns: 1fr; } }
  `,
})
export class BayesPageComponent {
  readonly presets = PRESETS;
  readonly preset = signal<string>('mammography');
  readonly inputs = signal<TestInputs>({ ...PRESETS[0].inputs });
  readonly out = computed(() => bayes(this.inputs()));
  readonly lrPlus = computed(() => Math.min(999, this.out().lrPositive));
  readonly curve = computed(() => predictiveCurve(this.inputs().sensitivity, this.inputs().specificity));
  readonly marker = computed(() => [{ prevalence: this.inputs().prevalence, ppv: this.out().ppv }]);
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
    for (const [outcome, n] of counts) {
      for (let i = 0; i < Math.round(n) && k < 100; i++, k++) cells.push({ col: k % 20, row: Math.floor(k / 20), outcome });
    }
    while (k < 100) { cells.push({ col: k % 20, row: Math.floor(k / 20), outcome: 'True negative' }); k++; }
    return cells;
  });
  readonly specs = { outcome: outcomeSpec(), curve: curveSpec(), icons: iconArraySpec() };
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium }));
  }

  set<K extends keyof TestInputs>(key: K, value: TestInputs[K]): void {
    this.preset.set('');
    this.inputs.set({ ...this.inputs(), [key]: value });
  }

  apply(id: string): void {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    this.preset.set(id);
    this.inputs.set({ ...p.inputs });
  }
}
