import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';
import type { View } from 'vega';
import { GsapService } from '../../shared/animation/gsap.service';
import { ApiService } from '../../shared/api/api.service';
import type * as M from '../../shared/api/models';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { REPORTS, REPORT_GROUPS, Report } from './ares-specs';

const fmtInt = format(',');
const fmtDate = timeFormat('%b %Y');

/**
 * OHDSI Ares-style data characterization. Ares itself renders its reports with Vega, Vega-Lite
 * and D3 in Vue; here the same report vocabulary is expressed as Vega-Lite specs in Angular,
 * with D3's format/time-format used for the summary strip.
 */
@Component({
  selector: 'app-ares-page',
  imports: [VegaChartComponent, KpiTileComponent],
  template: `
    <div class="layout">
      <aside class="menu glass" data-reveal>
        <p class="eyebrow">Reports</p>
        @for (group of groups; track group) {
          <h4>{{ group }}</h4>
          <ul>
            @for (r of reportsIn(group); track r.id) {
              <li><a href="#" [class.active]="active() === r.id" (click)="$event.preventDefault(); jump(r.id)">{{ r.title }}</a></li>
            }
          </ul>
        }
      </aside>
      <main class="content">
        <header class="head">
          <p class="eyebrow" data-reveal>Ares-style characterization · Vega + D3</p>
          <h1 data-reveal>Data source explorer</h1>
          <p class="lede" data-reveal>
            The report vocabulary of OHDSI Ares (person, observation period, data density, concepts, data quality)
            over a {{ summary()?.source ?? 'synthetic OMOP-like sample' }}, computed by DuckDB.
            @if (summary()) { <span class="mono dim">{{ periodLabel() }}</span> }
            @if (api.usingSnapshot()) { <span class="tag warn">API offline · showing snapshot</span> }
          </p>
        </header>
        <section class="kpis">
          <app-kpi-tile label="Persons" [value]="summary()?.persons ?? 0" [delay]="0" data-reveal />
          <app-kpi-tile label="Records" [value]="summary()?.records ?? 0" [delay]="0.08" data-reveal />
          <app-kpi-tile label="Quality checks" [value]="summary()?.checks ?? 0" [delay]="0.16" [hint]="failedLabel()" data-reveal />
          <app-kpi-tile label="Checks passing" [value]="summary()?.quality_pct ?? 0" suffix="%" [decimals]="1" [delay]="0.24" data-reveal />
        </section>
        <section class="grid">
          @for (r of reports; track r.id) {
            <article class="card glass" [class.wide]="r.wide" [id]="'report-' + r.id" data-reveal>
              <div class="card-head">
                <h3>{{ r.title }}</h3>
                <p>{{ r.description }}</p>
                @if (r.id === 'top-concepts') {
                  <div class="domain-picker">
                    @for (d of domains; track d) { <button type="button" class="btn small" [class.active]="domain() === d" (click)="setDomain(d)">{{ d }}</button> }
                  </div>
                }
                @if (r.id === 'prevalence' && selectedConcept()) { <p class="mono dim">{{ selectedConcept()?.concept_name }} · {{ fmtInt(selectedConcept()?.records ?? 0) }} records</p> }
              </div>
              <app-vega-chart [spec]="r.spec" [data]="dataFor(r)" [height]="r.height ?? 240" (viewReady)="r.id === 'top-concepts' ? bindPick($event) : null" />
            </article>
          }
        </section>
        @if (error()) { <p class="error">{{ error() }}</p> }
      </main>
    </div>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 20px; align-items: start; }
    .menu { position: sticky; top: calc(var(--nav-h) + 16px); padding: 16px; font-size: 13px; }
    .menu h4 { margin: 12px 0 4px; font-size: 12px; color: var(--on-ink-dim); font-weight: 500; }
    .menu ul { list-style: none; margin: 0; padding: 0; }
    .menu a { display: block; padding: 4px 8px; border-radius: 6px; color: var(--on-ink); }
    .menu a:hover { background: rgba(68,224,204,0.08); }
    .menu a.active { color: var(--teal); }
    h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: 6px 0 10px; }
    .lede { color: var(--on-ink-dim); max-width: 760px; margin-bottom: 18px; }
    .dim { color: var(--on-ink-faint); font-size: 12px; margin-left: 8px; }
    .tag { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-family: var(--font-mono); border: 1px solid var(--hairline); }
    .tag.warn { border-color: var(--amber); color: var(--amber); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { padding: 14px 16px; min-width: 0; scroll-margin-top: 80px; }
    .wide { grid-column: 1 / -1; }
    .card-head { margin-bottom: 8px; h3 { font-size: 17px; } p { color: var(--on-ink-dim); font-size: 13px; } }
    .domain-picker { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .error { color: var(--rose); margin-top: 12px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .menu { position: static; } .grid { grid-template-columns: 1fr; } }
  `,
})
export class AresPageComponent {
  readonly api = inject(ApiService);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly reports = REPORTS;
  readonly groups = REPORT_GROUPS;
  readonly domains = ['condition', 'drug', 'visit', 'measurement'];
  readonly fmtInt = fmtInt;

  readonly summary = signal<M.AresSummary | null>(null);
  readonly domain = signal('condition');
  readonly active = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly selectedConcept = signal<M.TopConceptRow | null>(null);
  readonly data = signal<Record<string, unknown[]>>({});

  readonly periodLabel = computed(() => {
    const s = this.summary();
    return s ? `${fmtDate(new Date(s.period_start))} – ${fmtDate(new Date(s.period_end))}` : '';
  });
  readonly failedLabel = computed(() => (this.summary() ? `${fmtInt(this.summary()!.checks_failed)} failed` : ''));

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.load();
    });
  }

  reportsIn(group: string): Report[] {
    return this.reports.filter((r) => r.group === group);
  }

  dataFor(r: Report): Record<string, unknown[]> {
    const rows = this.data()[r.dataset];
    return rows ? { [r.dataset]: rows } : {};
  }

  jump(id: string): void {
    this.active.set(id);
    document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: this.gsap.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  async setDomain(d: string): Promise<void> {
    this.domain.set(d);
    const top = await this.api.aresTopConcepts(d);
    this.merge({ topConcepts: top });
    if (top.length) await this.selectConcept(top[0]);
  }

  bindPick(view: View): void {
    view.addSignalListener('pick', (_name, value: { concept_id?: number[] } | null) => {
      const id = value?.concept_id?.[0];
      const row = (this.data()['topConcepts'] as M.TopConceptRow[] | undefined)?.find((r) => r.concept_id === id);
      if (row) void this.selectConcept(row);
    });
  }

  private async selectConcept(row: M.TopConceptRow): Promise<void> {
    this.selectedConcept.set(row);
    const prevalence = await this.api.aresPrevalence(this.domain(), row.concept_id).catch(() => []);
    this.merge({ prevalence });
  }

  private merge(part: Record<string, unknown[]>): void {
    this.data.set({ ...this.data(), ...part });
  }

  private async load(): Promise<void> {
    try {
      const [summary, recordsByDomain, ageAtFirstObservation, yearOfBirth, sex, race, observationLength, observationCumulative, ageBySex, recordsPerMonth, recordsPerPerson, conceptsPerPerson, quality, qualityFailures, topConcepts] = await Promise.all([
        this.api.aresSummary(), this.api.aresRecordsByDomain(), this.api.aresAgeAtFirstObservation(), this.api.aresYearOfBirth(), this.api.aresSex(), this.api.aresRace(),
        this.api.aresObservationLength(), this.api.aresObservationCumulative(), this.api.aresAgeBySex(), this.api.aresRecordsPerMonth(), this.api.aresRecordsPerPerson(),
        this.api.aresConceptsPerPerson(), this.api.aresQuality(), this.api.aresQualityFailures(), this.api.aresTopConcepts(this.domain()),
      ]);
      this.summary.set(summary);
      this.merge({ recordsByDomain, ageAtFirstObservation, yearOfBirth, sex, race, observationLength, observationCumulative, ageBySex, recordsPerMonth, recordsPerPerson, conceptsPerPerson, quality, qualityFailures, topConcepts });
      if (topConcepts.length) await this.selectConcept(topConcepts[0]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
