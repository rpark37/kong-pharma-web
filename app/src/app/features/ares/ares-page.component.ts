import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import type { View } from 'vega';
import { GsapService } from '../../shared/animation/gsap.service';
import { ApiService } from '../../shared/api/api.service';
import type * as M from '../../shared/api/models';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { readQuery, writeQuery } from '../../shared/url-state';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { REPORTS, REPORT_GROUPS, Report } from './ares-specs';

const fmtInt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const DOMAINS = ['condition', 'drug', 'visit', 'measurement'] as const;

/**
 * OHDSI Ares-style data characterization. Ares itself renders its reports with Vega, Vega-Lite
 * and D3 in Vue; here the same report vocabulary is expressed as Vega-Lite specs in Angular.
 */
@Component({
  selector: 'app-ares-page',
  imports: [VegaChartComponent, KpiTileComponent],
  template: `
    <div class="layout">
      <nav class="menu glass" data-reveal aria-label="Reports">
        <p class="eyebrow">Reports</p>
        @for (group of groups; track group) {
          <h2>{{ group }}</h2>
          <ul>
            @for (r of reportsIn(group); track r.id) {
              <li><a [attr.href]="href(r.id)" [class.active]="active() === r.id" [attr.aria-current]="active() === r.id ? 'location' : null" (click)="$event.preventDefault(); jump(r.id)">{{ r.title }}</a></li>
            }
          </ul>
        }
      </nav>
      <main class="content">
        <header class="head">
          <p class="eyebrow" data-reveal>Data characterization · Vega + D3</p>
          <h1 data-reveal>Data source explorer</h1>
          <p class="lede" data-reveal>
            The report vocabulary of OHDSI Ares (person, observation period, data density, concepts, data quality)
            over a {{ summary()?.source ?? 'synthetic OMOP-like sample' }}, computed by DuckDB.
            <span aria-live="polite">
              @if (summary()) { <span class="mono dim">{{ periodLabel() }}</span> }
              @if (api.usingSnapshot()) { <span class="tag warn">API offline · showing snapshot</span> }
            </span>
          </p>
        </header>
        <section class="kpis">
          <app-kpi-tile label="Persons" [value]="summary()?.persons ?? 0" />
          <app-kpi-tile label="Records" [value]="summary()?.records ?? 0" />
          <app-kpi-tile label="Quality checks" [value]="summary()?.checks ?? 0" [hint]="failedLabel()" />
          <app-kpi-tile label="Checks passing" [value]="(summary()?.quality_pct ?? 0) / 100" format="percent" [decimals]="1" />
        </section>
        <section class="grid">
          @for (r of reports; track r.id) {
            <article class="card glass" [class.wide]="r.wide" [id]="'report-' + r.id" data-reveal [attr.aria-busy]="busyFor(r.id) || null">
              <div class="card-head">
                <h2>{{ r.title }}</h2>
                <p>{{ r.description }}</p>
                @if (r.id === 'top-concepts') {
                  <div class="pickers">
                    <div class="domain-picker" role="group" aria-label="Domain">
                      @for (d of domains; track d) { <button type="button" class="btn small" [class.active]="domain() === d" [attr.aria-pressed]="domain() === d" [attr.aria-disabled]="busy() || null" (click)="setDomain(d)">{{ titleCase(d) }}</button> }
                    </div>
                    <!-- The keyboard route to what a click on a bar does. -->
                    <label class="concept-pick">Concept
                      <select name="concept" [value]="selectedConcept()?.concept_id ?? ''" [disabled]="!topConcepts().length" (change)="pickConcept(+$any($event.target).value)">
                        @for (c of topConcepts(); track c.concept_id) { <option [value]="c.concept_id">{{ c.concept_name }}</option> }
                      </select>
                    </label>
                  </div>
                }
                @if (r.id === 'prevalence') { <p class="mono dim" aria-live="polite">@if (selectedConcept(); as c) { {{ c.concept_name }} · {{ fmtInt.format(c.records) }} records }</p> }
              </div>
              @if (rowsFor(r).length) {
                <app-vega-chart [spec]="r.spec" [data]="dataFor(r)" [height]="r.height ?? 240" (viewReady)="r.id === 'top-concepts' ? bindPick($event) : null" />
              } @else {
                <p class="empty mono">{{ loaded() ? 'No data for this report.' : 'Loading…' }}</p>
              }
            </article>
          }
        </section>
        @if (error()) { <p class="error" role="alert">Could not load the reports ({{ error() }}). Start the API with <code>make serve</code> in <code>api/</code>, or reload to use the committed snapshot.</p> }
      </main>
    </div>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 20px; align-items: start; }
    .menu { position: sticky; top: calc(var(--nav-h) + 16px); padding: 16px; font-size: 13px; }
    .menu h2 { margin: 12px 0 4px; font-size: 12px; font-family: var(--font-body); letter-spacing: 0; color: var(--on-ink-dim); font-weight: 500; }
    .menu ul { list-style: none; margin: 0; padding: 0; }
    .menu a { display: block; padding: 4px 8px; border-radius: 6px; color: var(--on-ink); touch-action: manipulation; }
    .menu a:hover { background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .menu a.active { color: var(--teal); }
    .menu a:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: 6px 0 10px; text-wrap: balance; }
    .lede { color: var(--on-ink-dim); max-width: 760px; margin-bottom: 18px; }
    .dim { color: var(--on-ink-faint); font-size: 12px; margin-left: 8px; }
    .tag { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-family: var(--font-mono); border: 1px solid var(--hairline); }
    .tag.warn { border-color: var(--amber); color: var(--amber); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { padding: 14px 16px; min-width: 0; scroll-margin-top: 80px; }
    .wide { grid-column: 1 / -1; }
    .card-head { margin-bottom: 8px; h2 { font-size: 17px; } p { color: var(--on-ink-dim); font-size: 13px; } }
    .pickers { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 8px; }
    .domain-picker { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn[aria-disabled="true"] { opacity: 0.5; cursor: default; }
    .concept-pick { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--on-ink-dim); }
    .concept-pick select { max-width: 260px; font: inherit; color: var(--on-ink); background: var(--well); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; }
    .concept-pick select:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
    .empty { margin: 0; padding: 40px 0; text-align: center; font-size: 12px; color: var(--on-ink-faint); }
    .error { color: var(--rose); margin-top: 12px; code { font-size: 12px; } }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .menu { position: static; } .grid { grid-template-columns: 1fr; } }
  `,
})
export class AresPageComponent {
  readonly api = inject(ApiService);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly reports = REPORTS;
  readonly groups = REPORT_GROUPS;
  readonly domains = DOMAINS;
  readonly fmtInt = fmtInt;

  readonly summary = signal<M.AresSummary | null>(null);
  /** `?domain=` and `?concept=` come from the URL and go back to it; the concept id is applied once the list arrives. */
  readonly domain = signal<string>(domainFromUrl());
  private pendingConcept: number | null = Number(readQuery().get('concept')) || null;
  readonly active = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly loaded = signal(false);
  /** A domain or concept fetch in flight: the two concept cards are aria-busy and their controls wait. */
  readonly busy = signal(false);
  readonly selectedConcept = signal<M.TopConceptRow | null>(null);
  readonly data = signal<Record<string, unknown[]>>({});
  readonly topConcepts = computed(() => (this.data()['topConcepts'] as M.TopConceptRow[] | undefined) ?? []);

  readonly periodLabel = computed(() => {
    const s = this.summary();
    return s ? `${fmtMonth.format(new Date(s.period_start))} – ${fmtMonth.format(new Date(s.period_end))}` : '';
  });
  readonly failedLabel = computed(() => (this.summary() ? `${fmtInt.format(this.summary()!.checks_failed)} failed` : ''));
  private spy: IntersectionObserver | null = null;
  /** While a jump's smooth scroll is in flight the spy stays quiet, so the clicked link keeps its mark. */
  private spyMuteUntil = 0;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      this.watch();
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => this.spy?.disconnect());
  }

  reportsIn(group: string): Report[] {
    return this.reports.filter((r) => r.group === group);
  }

  rowsFor(r: Report): unknown[] { return this.data()[r.dataset] ?? []; }

  dataFor(r: Report): Record<string, unknown[]> {
    const rows = this.data()[r.dataset];
    return rows ? { [r.dataset]: rows } : {};
  }

  busyFor(id: string): boolean { return this.busy() && (id === 'top-concepts' || id === 'prevalence'); }

  titleCase(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** A real anchor: pathname-relative so it survives the `<base href="./">` and a middle-click copies a working link. */
  href(id: string): string { return `${location.pathname}${location.search}#report-${id}`; }

  jump(id: string): void {
    this.active.set(id);
    this.spyMuteUntil = Date.now() + 1000;
    history.replaceState(history.state, '', this.href(id));
    document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: this.gsap.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /** The sidebar follows the reader: the card crossing the upper third of the viewport is the active one. */
  private watch(): void {
    const cards = Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('.card[id]'));
    this.spy = new IntersectionObserver((entries) => {
      if (Date.now() < this.spyMuteUntil) return;
      // Cards sit two abreast: of the ones crossing the band, the top-left one is the reader's.
      const hits = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      if (hits.length) this.active.set(hits[0].target.id.replace(/^report-/, ''));
    }, { rootMargin: '-30% 0px -60% 0px' });
    cards.forEach((c) => this.spy!.observe(c));
  }

  async setDomain(d: string): Promise<void> {
    if (this.busy() || d === this.domain()) return;
    this.domain.set(d);
    this.busy.set(true);
    try {
      const top = await this.api.aresTopConcepts(d);
      this.merge({ topConcepts: top });
      if (top.length) await this.selectConcept(top[0]);
    } finally { this.busy.set(false); }
  }

  pickConcept(id: number): void {
    const row = this.topConcepts().find((r) => r.concept_id === id);
    if (row && !this.busy()) void this.selectConcept(row);
  }

  bindPick(view: View): void {
    view.addSignalListener('pick', (_name, value: { concept_id?: number[] } | null) => {
      const id = value?.concept_id?.[0];
      if (id !== undefined) this.pickConcept(id);
    });
  }

  private async selectConcept(row: M.TopConceptRow): Promise<void> {
    this.selectedConcept.set(row);
    writeQuery({ domain: this.domain() === DOMAINS[0] ? null : this.domain(), concept: row.concept_id });
    const prevalence = await this.api.aresPrevalence(this.domain(), row.concept_id).catch(() => []);
    // A newer pick may have landed while this one was in flight; only the current concept's rows are shown.
    if (this.selectedConcept()?.concept_id === row.concept_id) this.merge({ prevalence });
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
      const first = topConcepts.find((c) => c.concept_id === this.pendingConcept) ?? topConcepts[0];
      this.pendingConcept = null;
      if (first) await this.selectConcept(first);
      // The charts embed asynchronously and change the page height, so the hash jump waits for them.
      const hash = location.hash.replace(/^#report-/, '');
      if (hash && this.reports.some((r) => r.id === hash)) setTimeout(() => this.jump(hash), 600);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loaded.set(true);
    }
  }
}

function domainFromUrl(): string {
  const d = readQuery().get('domain');
  return d && (DOMAINS as readonly string[]).includes(d) ? d : DOMAINS[0];
}
