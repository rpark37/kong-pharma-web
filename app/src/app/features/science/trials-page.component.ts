import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { phaseSpec, statusSpec } from './science-specs';
import { capturedOn, type TrialsSnapshot } from './science.model';

/**
 * The registered-study landscape around each Kong programme's indication, from ClinicalTrials.gov.
 *
 * Counts come from count-only queries — `pageSize=1` with `countTotal`, one per phase and status —
 * so the snapshot is exact totals rather than a sample, without downloading twelve thousand studies.
 * Written by `app/scripts/fetch-science.py`.
 */
@Component({
  selector: 'app-trials-page',
  imports: [DecimalPipe, KpiTileComponent, VegaChartComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>Competitive landscape · ClinicalTrials.gov</p>
      <h1 data-reveal>Who else is in our indications</h1>
      @if (snap(); as s) { <p class="sub" data-reveal>Registered studies, captured {{ capturedOn(s.captured) }}</p> }
    </section>

    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (snap(); as s) {
      <section class="kpis" data-reveal>
        @for (c of s.conditions; track c.key) {
          <app-kpi-tile [label]="c.label" [value]="c.total" [hint]="c.programme + ' · all studies'" />
        }
        <app-kpi-tile label="Recruiting now" [value]="recruiting()" hint="across all three" />
      </section>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">By phase</span>
          <h3>How far along the field is</h3>
        </div>
        <div class="chart"><app-vega-chart [spec]="phases()" [fill]="true" /></div>
        <p class="note">
          Each indication as its own share, because 7,006 Phase 1 solid-tumour studies against
          bladder's 469 flattens the smaller fields to nothing on a shared count axis — hover for the
          real numbers. The denominator is phase-tagged studies, which is neither the total above nor
          a clean partition of it: observational studies carry no phase, and a Phase 1/Phase 2 study
          counts under both.
        </p>
      </div>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">By status · share of indication</span>
          <h3>Active versus finished</h3>
        </div>
        <div class="chart short"><app-vega-chart [spec]="statuses()" [fill]="true" /></div>
        <p class="note">Normalised, because a 739-study field and a 9,804-study one do not compare on raw counts.</p>
      </div>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">Recruiting · newest first</span>
          <h3>Nearest competitors</h3>
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Indication</th><th>Trial</th><th>Phase</th><th class="num">Enrol.</th><th>Sponsor</th><th>Start</th></tr>
            </thead>
            <tbody>
              @for (t of s.recent; track t.nctId) {
                <tr>
                  <td class="dim">{{ t.condition }}</td>
                  <td><a [href]="'https://clinicaltrials.gov/study/' + t.nctId" target="_blank" rel="noopener">{{ t.title }}</a></td>
                  <td class="mono">{{ t.phase }}</td>
                  <td class="num mono">{{ t.enrollment ? (t.enrollment | number) : '—' }}</td>
                  <td class="dim">{{ t.sponsor }}</td>
                  <td class="mono dim">{{ t.start ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else if (!error()) {
      <p class="loading">Loading trial landscape…</p>
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
    .chart { height: 340px; }
    .chart.short { height: 200px; }
    .note { margin-top: 10px; font-size: 12px; color: var(--on-ink-faint); max-width: 76ch; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--on-ink-faint); padding: 6px 10px; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--hairline); vertical-align: top; }
    td.dim { color: var(--on-ink-dim); white-space: nowrap; }
    td.num, th.num { text-align: right; }
    tbody tr:hover { background: var(--ink-3); }
    a { color: var(--teal); }
    .loading { color: var(--on-ink-faint); font-size: 13px; }
    .error { color: var(--rose); font-size: 13px; }
  `,
})
export class TrialsPageComponent {
  readonly snap = signal<TrialsSnapshot | null>(null);
  readonly error = signal('');
  readonly capturedOn = capturedOn;

  readonly recruiting = computed(() =>
    (this.snap()?.conditions ?? []).reduce(
      (sum, c) => sum + (c.statuses.find((s) => s.status === 'Recruiting')?.count ?? 0), 0));

  readonly phases = computed(() => phaseSpec(
    (this.snap()?.conditions ?? []).flatMap((c) =>
      c.phases.map((p) => ({ indication: c.label, phase: p.phase, count: p.count })))));

  readonly statuses = computed(() => statusSpec(
    (this.snap()?.conditions ?? []).flatMap((c) =>
      c.statuses.filter((s) => s.count > 0).map((s) => ({ indication: c.label, status: s.status, count: s.count })))));

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
      this.snap.set(await firstValueFrom(this.http.get<TrialsSnapshot>('data/science/trials.json')));
    } catch (e) {
      this.error.set(`Could not load the trials snapshot: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
