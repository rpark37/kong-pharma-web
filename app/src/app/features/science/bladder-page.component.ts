import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { associationSpec, stageSpec } from './science-specs';
import { capturedOn, evidenceRows, type BladderSnapshot } from './science.model';

/** Stages in the order a programme passes through them, so the bars read left to right. */
const STAGES = ['Preclinical', 'Phase 1', 'Phase 1 2', 'Phase 2', 'Phase 2 3', 'Phase 3', 'Phase 4', 'Approved'];

/**
 * The druggable-target landscape for urinary bladder carcinoma, K-119's indication.
 *
 * Open Targets ranks targets by aggregated evidence and lists the drugs already in the clinic for
 * this disease. Pulled by `app/scripts/fetch-science.py`; a snapshot, not a live query.
 */
@Component({
  selector: 'app-bladder-page',
  imports: [DecimalPipe, KpiTileComponent, VegaChartComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>K-119 · indication landscape · Open Targets</p>
      <h1 data-reveal>Bladder carcinoma targets</h1>
      @if (snap(); as s) {
        <p class="sub" data-reveal>{{ s.disease.name }} · {{ s.disease.id }} · captured {{ capturedOn(s.captured) }}</p>
      }
    </section>

    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (snap(); as s) {
      <section class="kpis" data-reveal>
        <app-kpi-tile label="Associated targets" [value]="s.targetCount" hint="any evidence type" />
        <app-kpi-tile label="Top target" [value]="s.targets[0].score" [decimals]="3" [hint]="s.targets[0].symbol" />
        <app-kpi-tile label="Clinical candidates" [value]="s.drugCount" hint="drugs reaching the clinic" />
        <app-kpi-tile label="Small-molecule tractable" [value]="tractableCount()" [hint]="'of the top ' + s.targets.length" />
      </section>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">Top {{ s.targets.length }} of {{ s.targetCount | number }}</span>
          <h3>Ranked by aggregated evidence</h3>
        </div>
        <div class="chart tall"><app-vega-chart [spec]="associations()" [fill]="true" /></div>
        <p class="note">
          Each bar stacks the evidence types behind that target's score. Somatic mutation dominating a
          target means the case rests on tumour sequencing; genetic association means inherited data.
        </p>
      </div>

      <div class="pair">
        <div class="card glass" data-reveal>
          <div class="card-head">
            <span class="eyebrow">{{ s.drugCount }} candidates</span>
            <h3>How far drugs have got</h3>
          </div>
          <div class="chart"><app-vega-chart [spec]="stages()" [fill]="true" /></div>
          <p class="note">Furthest stage reached for this indication, not current status.</p>
        </div>

        <div class="card glass" data-reveal>
          <div class="card-head">
            <span class="eyebrow">Small-molecule tractability</span>
            <h3>What an oral programme could reach</h3>
          </div>
          <div class="scroll short">
            <table>
              <thead><tr><th>Target</th><th class="num">Score</th><th>Buckets</th></tr></thead>
              <tbody>
                @for (t of tractable(); track t.id) {
                  <tr>
                    <td><a [href]="'https://platform.opentargets.org/target/' + t.id" target="_blank" rel="noopener">{{ t.symbol }}</a></td>
                    <td class="num mono">{{ t.score.toFixed(3) }}</td>
                    <td class="dim">{{ t.smallMolecule.join(' · ') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="note">Only targets Open Targets flags as having small-molecule tractability evidence.</p>
        </div>
      </div>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">Open Targets · furthest stage first</span>
          <h3>Drugs already in the clinic</h3>
        </div>
        <div class="scroll">
          <table>
            <thead><tr><th>Drug</th><th>Modality</th><th>Stage</th></tr></thead>
            <tbody>
              @for (d of s.drugs.slice(0, 24); track d.id) {
                <tr>
                  <td><a [href]="'https://platform.opentargets.org/drug/' + d.id" target="_blank" rel="noopener">{{ d.name }}</a></td>
                  <td class="dim">{{ d.type }}</td>
                  <td class="mono">{{ d.stage }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="note">Showing 24 of {{ s.drugCount }}. Mostly antibodies and checkpoint inhibitors — the gap an oral small molecule would fill.</p>
      </div>
    } @else if (!error()) {
      <p class="loading">Loading target landscape…</p>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.5rem, 3.2vw, 2.3rem); margin: 6px 0 6px; }
    .sub { color: var(--on-ink-dim); font-size: 13px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card { padding: 14px 16px; margin-bottom: 16px; }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-head h3 { font-size: 18px; }
    .chart { height: 300px; }
    .chart.tall { height: 620px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .note { margin-top: 10px; font-size: 12px; color: var(--on-ink-faint); max-width: 76ch; }
    .scroll { overflow-x: auto; }
    .scroll.short { max-height: 300px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--on-ink-faint); padding: 6px 10px; border-bottom: 1px solid var(--hairline); position: sticky; top: 0; background: var(--panel); }
    td { padding: 7px 10px; border-bottom: 1px solid var(--hairline); }
    td.dim { color: var(--on-ink-dim); }
    td.num, th.num { text-align: right; }
    tbody tr:hover { background: var(--ink-3); }
    a { color: var(--teal); }
    .loading { color: var(--on-ink-faint); font-size: 13px; }
    .error { color: var(--rose); font-size: 13px; }
    @media (max-width: 960px) { .pair { grid-template-columns: 1fr; } .chart.tall { height: 460px; } }
  `,
})
export class BladderPageComponent {
  readonly snap = signal<BladderSnapshot | null>(null);
  readonly error = signal('');
  readonly capturedOn = capturedOn;

  readonly tractable = computed(() => (this.snap()?.targets ?? []).filter((t) => t.smallMolecule.length > 0));
  readonly tractableCount = computed(() => this.tractable().length);

  readonly associations = computed(() => {
    const t = this.snap()?.targets ?? [];
    return associationSpec(evidenceRows(t, (x) => x.symbol), t.map((x) => x.symbol), 'Association score');
  });

  readonly stages = computed(() => {
    const counts = new Map<string, number>();
    for (const d of this.snap()?.drugs ?? []) counts.set(d.stage, (counts.get(d.stage) ?? 0) + 1);
    const rows = [...counts].map(([stage, count]) => ({ stage, count }));
    return stageSpec(rows, STAGES);
  });

  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      void this.load().then(() =>
        this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.short }));
    });
  }

  private async load(): Promise<void> {
    try {
      this.snap.set(await firstValueFrom(this.http.get<BladderSnapshot>('data/science/bladder.json')));
    } catch (e) {
      this.error.set(`Could not load the bladder snapshot: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
