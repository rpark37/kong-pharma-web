import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { associationSpec, interactorSpec, literatureSpec } from './science-specs';
import { capturedOn, evidenceRows, type Rac1Snapshot } from './science.model';

/**
 * Target dossier for RAC1, the pathway XTL-152 addresses.
 *
 * Everything here is public evidence pulled by `app/scripts/fetch-science.py`: Open Targets for
 * the disease associations, UniProt for function, STRING for interaction partners, Europe PMC for
 * the publication trend. A snapshot, not a live query — see the capture date in the header.
 */
@Component({
  selector: 'app-rac1-page',
  imports: [DecimalPipe, KpiTileComponent, VegaChartComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>XTL-152 · target evidence · Open Targets, UniProt, STRING, Europe PMC</p>
      <h1 data-reveal>RAC1</h1>
      @if (snap(); as s) {
        <p class="sub" data-reveal>{{ s.target.name }} · {{ s.target.length }} aa · {{ s.target.uniprot }} · captured {{ capturedOn(s.captured) }}</p>
      }
    </section>

    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (snap(); as s) {
      <section class="kpis" data-reveal>
        <app-kpi-tile label="Associated diseases" [value]="s.diseaseCount" hint="Open Targets, any evidence" />
        <app-kpi-tile label="Top association" [value]="s.diseases[0].score" [decimals]="3" [hint]="s.diseases[0].name" />
        <app-kpi-tile label="Interaction partners" [value]="s.interactors.length" hint="STRING, highest confidence" />
        <app-kpi-tile label="Publications, {{ latestYear() }}" [value]="latestPubs()" hint="Europe PMC" />
      </section>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">Open Targets · top {{ s.diseases.length }} of {{ s.diseaseCount | number }}</span>
          <h3>What RAC1 is associated with</h3>
        </div>
        <div class="chart tall"><app-vega-chart [spec]="associations()" [fill]="true" /></div>
        <p class="note">
          Bars stack each disease's overall score by the evidence type behind it, so a score built from
          genetics reads differently from one built from literature alone.
        </p>
      </div>

      <div class="pair">
        <div class="card glass" data-reveal>
          <div class="card-head">
            <span class="eyebrow">STRING · combined score</span>
            <h3>Interaction partners</h3>
          </div>
          <div class="chart"><app-vega-chart [spec]="interactors()" [fill]="true" /></div>
          <p class="note">The solid bar is experimental evidence alone; the pale remainder is everything else STRING counts.</p>
        </div>

        <div class="card glass" data-reveal>
          <div class="card-head">
            <span class="eyebrow">Europe PMC · 20 years</span>
            <h3>Publications per year</h3>
          </div>
          <div class="chart"><app-vega-chart [spec]="literature()" [fill]="true" /></div>
          <p class="note">The current year is partial — it counts only what is indexed so far.</p>
        </div>
      </div>

      <div class="card glass" data-reveal>
        <div class="card-head">
          <span class="eyebrow">UniProt {{ s.target.uniprot }}</span>
          <h3>Function</h3>
        </div>
        <p class="prose">{{ s.target.uniprotFunction }}</p>
        @if (s.target.subunit) { <p class="prose dim">{{ s.target.subunit }}</p> }
        @if (s.tractability.length) {
          <p class="eyebrow tract-head">Tractability</p>
          <ul class="tract">
            @for (t of s.tractability; track t.label + t.modality) { <li><span class="mono">{{ t.modality }}</span> {{ t.label }}</li> }
          </ul>
        }
      </div>
    } @else if (!error()) {
      <p class="loading">Loading target dossier…</p>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); margin: 6px 0 6px; font-family: var(--font-mono); letter-spacing: 0.02em; }
    .sub { color: var(--on-ink-dim); font-size: 13px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card { padding: 14px 16px; margin-bottom: 16px; }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-head h3 { font-size: 18px; }
    .chart { height: 300px; }
    .chart.tall { height: 560px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .pair .card { margin-bottom: 16px; }
    .note { margin-top: 10px; font-size: 12px; color: var(--on-ink-faint); max-width: 70ch; }
    .prose { color: var(--on-ink-dim); max-width: 80ch; font-size: 14px; line-height: 1.6; }
    .prose.dim { color: var(--on-ink-faint); margin-top: 8px; }
    .tract-head { margin-top: 14px; }
    .tract { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .tract li { font-size: 12px; padding: 4px 10px; border: 1px solid var(--hairline); border-radius: 999px; color: var(--on-ink-dim); }
    .tract .mono { color: var(--teal); margin-right: 6px; }
    .loading { color: var(--on-ink-faint); font-size: 13px; }
    .error { color: var(--rose); font-size: 13px; }
    @media (max-width: 960px) { .pair { grid-template-columns: 1fr; } .chart.tall { height: 420px; } }
  `,
})
export class Rac1PageComponent {
  readonly snap = signal<Rac1Snapshot | null>(null);
  readonly error = signal('');
  readonly capturedOn = capturedOn;

  readonly latestYear = computed(() => this.snap()?.literature.at(-1)?.year ?? 0);
  readonly latestPubs = computed(() => this.snap()?.literature.at(-1)?.count ?? 0);

  readonly associations = computed(() => {
    const d = this.snap()?.diseases ?? [];
    return associationSpec(evidenceRows(d, (x) => x.name), d.map((x) => x.name), 'Association score');
  });
  readonly interactors = computed(() => interactorSpec(this.snap()?.interactors ?? []));
  readonly literature = computed(() => literatureSpec(this.snap()?.literature ?? []));

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
      this.snap.set(await firstValueFrom(this.http.get<Rac1Snapshot>('data/science/rac1.json')));
    } catch (e) {
      this.error.set(`Could not load the RAC1 snapshot: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
