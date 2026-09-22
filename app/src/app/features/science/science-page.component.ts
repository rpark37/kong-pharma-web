import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { gsap } from 'gsap';
import { GsapService } from '../../shared/animation/gsap.service';
import { EASE, MOTION } from '../../shared/animation/motion';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { associationSpec, interactorSpec, literatureRaceSpec, phaseSpec, rasDiseaseSpec, stageSpec, statusSpec } from './science-specs';
import { capturedOn, evidenceRows, type BladderSnapshot, type Rac1Snapshot, type RasSnapshot, type TrialsSnapshot } from './science.model';

/** Stages in the order a programme passes through them, so the bars read left to right. */
const STAGES = ['Preclinical', 'Phase 1', 'Phase 1 2', 'Phase 2', 'Phase 2 3', 'Phase 3', 'Phase 4', 'Approved'];

/**
 * RAC1's guanine-nucleotide exchange factors among its STRING partners: the proteins that load
 * it with GTP, which is how a RAS signal reaches it. TIAM1 binds RAS directly; PREX1 and VAV1
 * answer PI3K, a RAS effector. Named in the pathway figure and held bright in FIG. 5.
 */
const RAS_GEFS = ['TIAM1', 'PREX1', 'VAV1'];

interface Chapter { id: string; numeral: string; title: string; }

/**
 * The science dossier: one story in five chapters, from the RAS oncogene to the trial field
 * around Kong's programmes. Every figure is a committed snapshot of a public database
 * (`app/scripts/fetch-science.py`); the prose quotes the numbers rather than restating them.
 *
 * Composed for the dark surface: no cards, hairline rules, Rajdhani numerals, figures set
 * directly on the page with mono captions. It reads on paper too.
 */
@Component({
  selector: 'app-science-page',
  imports: [DecimalPipe, TitleCasePipe, VegaChartComponent, GlyphComponent],
  template: `
    <article class="dossier">
      <header class="prologue">
        <p class="eyebrow" data-reveal><app-glyph name="body" />Science · a dossier in five chapters</p>
        <h1 data-reveal>Starving a RAS tumour</h1>
        <p class="lead" data-reveal>
          Three genes jam a growth switch on; the cells they drive get hungry and drink their surroundings;
          the drinking runs through a second switch, RAC1, that a small molecule can reach. This is the
          public evidence behind that argument, read in order.
        </p>
        <dl class="ledger" data-reveal>
          <div><dt>Sources</dt><dd>Open Targets · UniProt · STRING · Europe PMC · ClinicalTrials.gov</dd></div>
          @if (ras(); as r) { <div><dt>RAS captured</dt><dd>{{ capturedOn(r.captured) }}</dd></div> }
          @if (rac1(); as r) { <div><dt>Rest captured</dt><dd>{{ capturedOn(r.captured) }}</dd></div> }
          <div><dt>Refresh</dt><dd><code>fetch-science.py</code></dd></div>
        </dl>
      </header>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      <nav class="rail" aria-label="Chapters">
        @for (c of chapters; track c.id) {
          <a [href]="'#' + c.id" [class.active]="active() === c.id" [attr.aria-current]="active() === c.id ? 'true' : null" (click)="jump($event, c.id)">
            <span class="num">{{ c.numeral }}</span><span class="name">{{ c.title }}</span>
          </a>
        }
      </nav>

      <div class="chapters">
        <!-- I · The oncogene -->
        <section class="chapter" id="ras">
          <header class="chapter-head" data-reveal>
            <span class="numeral" aria-hidden="true">I</span>
            <div><p class="kicker">The oncogene</p><h2>Three genes, one switch</h2></div>
          </header>
          @if (ras(); as r) {
            <p class="prose" data-reveal>
              RAS is a family of three small GTPases — <b>KRAS</b>, <b>HRAS</b> and <b>NRAS</b> — anchored to the inside of
              the cell membrane. Bound to GTP the switch is on and growth signalling flows; hydrolyse it and the
              switch is off. A single amino-acid substitution can jam it on, and the cell never hears "stop".
            </p>
            <dl class="readout" data-reveal>
              @for (g of r.genes; track g.id) {
                <div><dt>{{ g.symbol }}</dt><dd>{{ g.diseaseCount | number }}<small>diseases</small></dd></div>
              }
              <div><dt>Approved</dt><dd>{{ approvedRas().length }}<small>small molecules</small></dd></div>
            </dl>
            <p class="prose" data-reveal>
              Open Targets ties the three genes to {{ totalRasDiseases() | number }} disease associations between them. The top of
              each list splits in two: the malignancies, where the switch is jammed by a somatic mutation, and the
              RASopathies — Noonan, Costello, the naevus syndromes — where an inherited variant shapes development
              instead. HRAS's list already names the indication this dossier ends on.
            </p>
            <figure data-reveal>
              <div class="chart facets"><app-vega-chart [spec]="rasDiseases()" /></div>
              <figcaption><b>Fig. 1</b> Top eight associations per gene, Open Targets overall score. Teal marks a malignancy by name; the rest are developmental or other.</figcaption>
            </figure>
            <div class="split" data-reveal>
              <div>
                <p class="prose">
                  For four decades the family was called undruggable: no pocket to speak of, and a grip on its
                  nucleotide measured in picomolar. In this snapshot KRAS carries {{ krasDrugs().length }} clinical
                  candidates, {{ approvedRas().length }} of them at approval
                  @if (approvedRas().length) { — {{ approvedNames() }} — }
                  while HRAS and NRAS share one, at Phase 2. The switch can be reached; it has just been reached late,
                  and for one mutation at a time.
                </p>
              </div>
              <table class="ledger-table">
                <thead><tr><th>Gene</th><th>Candidate</th><th>Stage</th><th>Modality</th></tr></thead>
                <tbody>
                  @for (row of rasDrugRows(); track row.gene + row.name) {
                    <tr><td class="mono">{{ row.gene }}</td><td>{{ row.name }}</td><td class="mono" [class.on]="row.stage === 'Approval' || row.stage === 'Approved'">{{ row.stage }}</td><td class="dim">{{ row.type }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <figure data-reveal>
              <div class="chart"><app-vega-chart [spec]="literatureRace()" [fill]="true" /></div>
              <figcaption><b>Fig. 2</b> Publications per year, Europe PMC. KRAS went from {{ krasFirst() | number }} in {{ firstYear() }} to {{ krasPeak() | number }} in {{ peakYear() }}; RAC1, the switch downstream, from {{ rac1First() | number }} to {{ rac1Peak() | number }}. {{ lastYear() }} is partial.</figcaption>
            </figure>
          } @else if (!error()) { <p class="loading">Loading the RAS snapshot…</p> }
        </section>

        <!-- II · The hungry cell -->
        <section class="chapter" id="hungry">
          <header class="chapter-head" data-reveal>
            <span class="numeral" aria-hidden="true">II</span>
            <div><p class="kicker">The hungry cell</p><h2>What a jammed switch does with its appetite</h2></div>
          </header>
          <p class="prose" data-reveal>
            A RAS-driven cell is hungry. It throws out membrane ruffles that fold into cups and pinch off as large
            vesicles — macropinosomes — full of extracellular fluid, protein, amino acids and lipids. This bulk
            drinking, macropinocytosis, is how the tumour feeds when the blood supply cannot keep up, and it is the
            route Kong's small molecules aim to shut.
          </p>
          <p class="prose" data-reveal>
            The route has a second switch. RAS signals through PI3K to the exchange factors that load RAC1 with GTP,
            and active RAC1 builds the actin ruffle. Cut the signal at RAC1 and the ruffle never forms; the cell
            keeps its mutation and loses its meal.
          </p>
          <figure class="pathway" data-reveal>
            <svg viewBox="0 0 960 250" role="img" aria-label="RAS signals through PI3K to the exchange factors TIAM1, PREX1 and VAV1, which activate RAC1; RAC1 drives a membrane ruffle that closes into a macropinosome." #pathway>
              <defs><marker id="sci-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l6 3-6 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></marker></defs>
              <!-- edges -->
              <path class="edge" d="M112 125H214" />
              <path class="edge" d="M304 125H384" />
              <path class="edge" d="M304 125C340 125 350 185 384 185" />
              <path class="edge direct" d="M92 92C140 30 330 30 384 65" />
              <path class="edge" d="M506 65C550 65 560 125 594 125" />
              <path class="edge" d="M506 125H594" />
              <path class="edge" d="M506 185C550 185 560 125 594 125" />
              <path class="edge" d="M676 125H718" />
              <path class="edge ruffle" d="M722 150c8-30 14-46 22-46s8 46 18 46 10-52 20-52 10 52 20 52 10-40 18-40" />
              <path class="edge" d="M826 125H852" />
              <!-- nodes -->
              <circle class="node ras" cx="70" cy="125" r="42" />
              <text class="label big" x="70" y="121">RAS</text><text class="label small" x="70" y="140">GTP · on</text>
              <rect class="node" x="214" y="101" width="90" height="48" rx="8" />
              <text class="label" x="259" y="130">PI3K</text>
              <rect class="node gef" x="384" y="41" width="122" height="48" rx="8" /><text class="label" x="445" y="61">TIAM1</text><text class="label small" x="445" y="79">{{ gefScore('TIAM1') }}</text>
              <rect class="node gef" x="384" y="101" width="122" height="48" rx="8" /><text class="label" x="445" y="121">PREX1</text><text class="label small" x="445" y="139">{{ gefScore('PREX1') }}</text>
              <rect class="node gef" x="384" y="161" width="122" height="48" rx="8" /><text class="label" x="445" y="181">VAV1</text><text class="label small" x="445" y="199">{{ gefScore('VAV1') }}</text>
              <text class="label tiny" x="445" y="228">GEFs · STRING combined score</text>
              <circle class="node rac1" cx="635" cy="125" r="42" />
              <text class="label big" x="635" y="121">RAC1</text><text class="label small" x="635" y="140">XTL-152</text>
              <text class="label tiny" x="770" y="180">membrane ruffle</text>
              <circle class="node vesicle" cx="892" cy="125" r="36" /><circle class="node vesicle inner" cx="892" cy="125" r="20" />
              <text class="label tiny" x="892" y="184">macropinosome</text>
              <text class="label tiny" x="238" y="24">direct</text>
            </svg>
            <figcaption><b>Fig. 3</b> RAS to RAC1. The middle column is RAC1's own STRING partners, scored; TIAM1 binds RAS directly, PREX1 and VAV1 answer PI3K. Drawn, not measured — the scores are the data.</figcaption>
          </figure>
        </section>

        <!-- III · The switch -->
        <section class="chapter" id="rac1">
          <header class="chapter-head" data-reveal>
            <span class="numeral" aria-hidden="true">III</span>
            <div><p class="kicker">The switch</p><h2>RAC1, the target</h2></div>
          </header>
          @if (rac1(); as r) {
            <dl class="readout" data-reveal>
              <div><dt>UniProt</dt><dd>{{ r.target.uniprot }}<small>{{ r.target.length }} aa</small></dd></div>
              <div><dt>Diseases</dt><dd>{{ r.diseaseCount | number }}<small>Open Targets</small></dd></div>
              <div><dt>Partners</dt><dd>{{ r.interactors.length }}<small>STRING, highest confidence</small></dd></div>
              <div><dt>Top association</dt><dd>{{ r.diseases[0].score | number: '1.2-2' }}<small>{{ r.diseases[0].name }}</small></dd></div>
            </dl>
            <p class="prose" data-reveal>{{ r.target.uniprotFunction }}</p>
            <figure data-reveal>
              <div class="chart tall"><app-vega-chart [spec]="rac1Associations()" [fill]="true" /></div>
              <figcaption><b>Fig. 4</b> What RAC1 is associated with, top {{ r.diseases.length }} of {{ r.diseaseCount | number }}, each score stacked by the evidence behind it. A score built from genetics reads differently from one built from literature alone. Melanoma and head-and-neck carcinoma are the malignancies; the intellectual-disability entries are the germline story again.</figcaption>
            </figure>
            <div class="split" data-reveal>
              <figure>
                <div class="chart"><app-vega-chart [spec]="rac1Interactors()" [fill]="true" /></div>
                <figcaption><b>Fig. 5</b> Interaction partners, STRING combined score; the solid bar is experimental evidence alone. The exchange factors from Fig. 3 stay bright — they are how the RAS signal arrives.</figcaption>
              </figure>
              <div>
                <p class="kicker">Tractability</p>
                <ul class="tags">
                  @for (t of r.tractability; track t.label + t.modality) { <li><span class="mono">{{ t.modality }}</span>{{ t.label }}</li> }
                </ul>
                <p class="prose small">
                  Open Targets flags a ligand-bound structure and a high-quality pocket for small molecules — the two
                  things RAS lacked for forty years. {{ r.target.subunit }}
                </p>
              </div>
            </div>
          } @else if (!error()) { <p class="loading">Loading the RAC1 dossier…</p> }
        </section>

        <!-- IV · The indication -->
        <section class="chapter" id="bladder">
          <header class="chapter-head" data-reveal>
            <span class="numeral" aria-hidden="true">IV</span>
            <div><p class="kicker">The indication</p><h2>Where RAS meets the clinic</h2></div>
          </header>
          @if (bladder(); as b) {
            <p class="prose" data-reveal>
              {{ b.disease.name | titlecase }} is K-119's indication. In Open Targets' ranking of {{ b.targetCount | number }} targets for it,
              <b>HRAS</b> sits at #{{ rank('HRAS') }} and <b>KRAS</b> at #{{ rank('KRAS') }}; FGFR3 leads, and the two lineages
              are famously exclusive — a tumour tends to carry one driver or the other. Either way the cell arrives at
              the same hungry state.
            </p>
            <dl class="readout" data-reveal>
              <div><dt>Targets</dt><dd>{{ b.targetCount | number }}<small>any evidence</small></dd></div>
              <div><dt>HRAS</dt><dd>#{{ rank('HRAS') }}<small>{{ score('HRAS') }}</small></dd></div>
              <div><dt>KRAS</dt><dd>#{{ rank('KRAS') }}<small>{{ score('KRAS') }}</small></dd></div>
              <div><dt>In the clinic</dt><dd>{{ b.drugCount | number }}<small>candidates</small></dd></div>
              <div><dt>Small-molecule tractable</dt><dd>{{ tractable().length }}<small>of the top {{ b.targets.length }}</small></dd></div>
            </dl>
            <figure data-reveal>
              <div class="chart tall"><app-vega-chart [spec]="bladderAssociations()" [fill]="true" /></div>
              <figcaption><b>Fig. 6</b> Top {{ b.targets.length }} targets by aggregated evidence, the RAS genes and FGFR3 held bright. Somatic mutation dominating a bar means the case rests on tumour sequencing; genetic association means inherited data.</figcaption>
            </figure>
            <div class="split" data-reveal>
              <figure>
                <div class="chart short"><app-vega-chart [spec]="stages()" [fill]="true" /></div>
                <figcaption><b>Fig. 7</b> The {{ b.drugCount }} clinical candidates by the furthest stage each reached, not its current status.</figcaption>
              </figure>
              <div>
                <p class="kicker">What an oral programme could reach</p>
                <table class="ledger-table">
                  <thead><tr><th>Target</th><th class="num">Score</th><th>Small-molecule buckets</th></tr></thead>
                  <tbody>
                    @for (t of tractable().slice(0, 10); track t.id) {
                      <tr [class.on]="t.symbol === 'HRAS' || t.symbol === 'KRAS'">
                        <td><a [href]="'https://platform.opentargets.org/target/' + t.id" target="_blank" rel="noopener">{{ t.symbol }}</a></td>
                        <td class="num mono">{{ t.score | number: '1.3-3' }}</td>
                        <td class="dim">{{ t.smallMolecule.join(' · ') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <p class="kicker" data-reveal>Already in the clinic · furthest stage first</p>
            <table class="ledger-table wide" data-reveal>
              <thead><tr><th>Drug</th><th>Modality</th><th>Stage</th></tr></thead>
              <tbody>
                @for (d of b.drugs.slice(0, 18); track d.id) {
                  <tr>
                    <td><a [href]="'https://platform.opentargets.org/drug/' + d.id" target="_blank" rel="noopener">{{ d.name }}</a></td>
                    <td class="dim">{{ d.type }}</td>
                    <td class="mono">{{ d.stage }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="prose small" data-reveal>Eighteen of {{ b.drugCount }}. Antibodies and checkpoint inhibitors, mostly — the gap an oral small molecule against the hungry state would fill.</p>
          } @else if (!error()) { <p class="loading">Loading the indication landscape…</p> }
        </section>

        <!-- V · The field -->
        <section class="chapter" id="trials">
          <header class="chapter-head" data-reveal>
            <span class="numeral" aria-hidden="true">V</span>
            <div><p class="kicker">The field</p><h2>Who else is in these indications</h2></div>
          </header>
          @if (trials(); as t) {
            <dl class="readout" data-reveal>
              @for (c of t.conditions; track c.key) {
                <div><dt>{{ c.label }}</dt><dd>{{ c.total | number }}<small>{{ c.programme }} · registered studies</small></dd></div>
              }
              <div><dt>Recruiting now</dt><dd>{{ recruiting() | number }}<small>across all three</small></dd></div>
            </dl>
            <p class="prose" data-reveal>
              ClinicalTrials.gov, counted rather than sampled: one count query per phase and status. Solid tumour is
              the field XTL-152 enters — {{ solidPhase1() | number }} Phase 1 studies alone — which is why the phase chart
              shows each indication as its own share rather than a count.
            </p>
            <figure data-reveal>
              <div class="chart"><app-vega-chart [spec]="phases()" [fill]="true" /></div>
              <figcaption><b>Fig. 8</b> Phase as a share of each indication's phase-tagged studies. The denominator is neither the total above nor a clean partition of it: observational studies carry no phase, and a Phase 1/2 study counts under both.</figcaption>
            </figure>
            <figure data-reveal>
              <div class="chart short"><app-vega-chart [spec]="statuses()" [fill]="true" /></div>
              <figcaption><b>Fig. 9</b> Status as a share of each indication, because a 739-study field and a 9,804-study one do not compare on raw counts.</figcaption>
            </figure>
            <p class="kicker" data-reveal>Recruiting · newest first</p>
            <table class="ledger-table wide" data-reveal>
              <thead><tr><th>Indication</th><th>Trial</th><th>Phase</th><th class="num">Enrol.</th><th>Sponsor</th><th>Start</th></tr></thead>
              <tbody>
                @for (r of t.recent; track r.nctId) {
                  <tr>
                    <td class="dim nowrap">{{ r.condition }}</td>
                    <td><a [href]="'https://clinicaltrials.gov/study/' + r.nctId" target="_blank" rel="noopener">{{ r.title }}</a></td>
                    <td class="mono nowrap">{{ r.phase }}</td>
                    <td class="num mono">{{ r.enrollment ? (r.enrollment | number) : '—' }}</td>
                    <td class="dim">{{ r.sponsor }}</td>
                    <td class="mono dim nowrap">{{ r.start ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else if (!error()) { <p class="loading">Loading the trial landscape…</p> }
        </section>

        <footer class="colophon">
          <p>Every number on this page is a committed snapshot of a public database, refreshed by <code>app/scripts/fetch-science.py</code> and shown with its capture date. Open Targets Platform, UniProt, STRING and Europe PMC for the biology; ClinicalTrials.gov for the field. The pathway in Fig. 3 is drawn from the literature; its scores are STRING's.</p>
        </footer>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 6rem; max-width: 1360px; margin: 0 auto; width: 100%; }
    .dossier { display: grid; grid-template-columns: 180px minmax(0, 1fr); column-gap: clamp(24px, 4vw, 64px); }
    .prologue { grid-column: 1 / -1; max-width: 72ch; margin-bottom: clamp(32px, 6vh, 64px); }
    .eyebrow { display: inline-flex; align-items: center; margin: 0; app-glyph { margin-right: 8px; } }
    h1 { font-size: clamp(2.4rem, 6vw, 4.4rem); line-height: 0.95; margin: 10px 0 18px; letter-spacing: -0.02em; }
    .lead { font-size: clamp(1rem, 1.4vw, 1.15rem); line-height: 1.55; color: var(--on-ink-dim); max-width: 62ch; }
    .ledger { display: flex; flex-wrap: wrap; gap: 10px 32px; margin: 22px 0 0; padding-top: 14px; border-top: 1px solid var(--hairline); }
    .ledger div { display: flex; flex-direction: column; gap: 3px; }
    .ledger dt, .kicker, th, .tags .mono, figcaption b { font: 500 9px/1.2 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }
    .ledger dd { margin: 0; font-size: 12px; color: var(--on-ink-dim); code { font-size: 11px; color: var(--teal); } }

    /* Chapter rail: sticky on wide screens, a scrolling strip on narrow ones. */
    .rail { position: sticky; top: calc(var(--nav-h) + 24px); align-self: start; display: flex; flex-direction: column; gap: 2px; }
    .rail a { display: grid; grid-template-columns: 28px 1fr; align-items: baseline; gap: 8px; padding: 8px 10px; border-radius: 6px; color: var(--on-ink-faint); font-size: 12px; transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
    .rail .num { font-family: var(--font-display); font-weight: 600; font-size: 14px; letter-spacing: 0.04em; }
    .rail a:hover { color: var(--on-ink); background: var(--well); }
    .rail a.active { color: var(--teal); background: color-mix(in srgb, var(--teal) 10%, transparent); }
    .rail a:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }

    .chapters { min-width: 0; }
    .chapter { padding: clamp(40px, 7vh, 88px) 0; border-top: 1px solid var(--hairline); scroll-margin-top: calc(var(--nav-h) + 16px); }
    .chapter:first-child { border-top: 0; padding-top: 0; }
    .chapter-head { display: grid; grid-template-columns: auto 1fr; align-items: end; gap: 20px; margin-bottom: 26px; }
    .numeral { font-family: var(--font-display); font-weight: 600; font-size: clamp(3.4rem, 7vw, 5.6rem); line-height: 0.8; letter-spacing: -0.02em; color: color-mix(in srgb, var(--teal) 62%, transparent); }
    .kicker { margin: 0 0 6px; }
    h2 { font-size: clamp(1.5rem, 2.8vw, 2.1rem); line-height: 1.05; }
    .prose { max-width: 66ch; font-size: 15px; line-height: 1.65; color: var(--on-ink); margin: 0 0 16px; b { font-weight: 600; } }
    .prose.small { font-size: 13px; color: var(--on-ink-dim); }
    .loading { color: var(--on-ink-faint); font-size: 13px; }
    .error { grid-column: 1 / -1; color: var(--rose); font-size: 13px; margin-bottom: 16px; }

    /* Readouts: a ledger row, Rajdhani figures, mono captions. */
    .readout { display: flex; flex-wrap: wrap; gap: 14px 36px; margin: 8px 0 24px; padding: 14px 0; border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
    .readout div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .readout dt { font: 500 9px/1.2 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }
    .readout dd { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 26px; line-height: 1; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .readout small { display: block; margin-top: 4px; font: 400 11px/1.3 var(--font-mono); color: var(--on-ink-dim); max-width: 22ch; }

    figure { margin: 24px 0 8px; }
    figcaption { margin-top: 10px; font: 400 11px/1.55 var(--font-mono); color: var(--on-ink-faint); max-width: 76ch; b { color: var(--teal); margin-right: 8px; } }
    .chart { height: 320px; }
    .chart.short { height: 220px; }
    .chart.tall { height: 560px; }
    /* Sized by the spec (a height per facet), not the box: fill mode would feed the box height back in. */
    .chart.facets { height: auto; }
    .split { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px 40px; align-items: start; margin: 8px 0 16px; }
    .split figure { margin-top: 0; }
    .split .kicker { margin-top: 8px; }
    .tags { list-style: none; padding: 0; margin: 8px 0 14px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tags li { font-size: 12px; padding: 4px 10px; border: 1px solid var(--hairline); border-radius: 6px; color: var(--on-ink-dim); }
    .tags .mono { margin-right: 8px; color: var(--teal); letter-spacing: 0.08em; }

    .ledger-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
    .ledger-table th { text-align: left; padding: 6px 10px 8px 0; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
    .ledger-table td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--hairline); vertical-align: top; }
    .ledger-table td.dim { color: var(--on-ink-dim); }
    .ledger-table .num { text-align: right; }
    .ledger-table .nowrap { white-space: nowrap; }
    .ledger-table td.on, .ledger-table tr.on td:first-child a { color: var(--teal); font-weight: 500; }
    .ledger-table.wide { display: block; overflow-x: auto; }
    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    a { color: var(--teal); }

    /* Fig. 3, in the glyph hand: 1.5 px strokes, currentColor, the two switches as rings. */
    .pathway svg { width: 100%; height: auto; display: block; color: var(--on-ink-dim); font-family: var(--font-mono); }
    .pathway .edge { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; marker-end: url(#sci-arrow); }
    .pathway .edge.direct { stroke-dasharray: 4 5; marker-end: url(#sci-arrow); }
    .pathway .edge.ruffle { marker-end: none; stroke: var(--teal); }
    .pathway .node { fill: var(--ink-2); stroke: currentColor; stroke-width: 1.5; }
    .pathway .node.ras { stroke: var(--rose); stroke-width: 2; }
    .pathway .node.rac1 { stroke: var(--teal); stroke-width: 2; fill: color-mix(in srgb, var(--teal) 12%, var(--ink-2)); }
    .pathway .node.gef { stroke-width: 1.2; }
    .pathway .node.vesicle { stroke: var(--teal); }
    .pathway .node.vesicle.inner { fill: color-mix(in srgb, var(--teal) 25%, transparent); stroke: none; }
    .pathway .label { fill: var(--on-ink); font-size: 13px; font-weight: 500; text-anchor: middle; }
    .pathway .label.big { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
    .pathway .label.small { font-size: 10px; fill: var(--on-ink-dim); font-weight: 400; }
    .pathway .label.tiny { font-size: 9px; fill: var(--on-ink-faint); letter-spacing: 0.12em; text-transform: uppercase; }

    .colophon { padding-top: 40px; border-top: 1px solid var(--hairline); max-width: 76ch; p { font: 400 12px/1.6 var(--font-mono); color: var(--on-ink-faint); } code { color: var(--teal); } }

    @media (max-width: 900px) {
      .dossier { grid-template-columns: 1fr; }
      .rail { position: sticky; top: var(--nav-h); z-index: 2; flex-direction: row; overflow-x: auto; gap: 4px; margin: 0 calc(-1 * var(--pad-x)); padding: 8px var(--pad-x); background: var(--nav-bg); backdrop-filter: blur(14px); border-bottom: 1px solid var(--hairline); }
      .rail a { grid-template-columns: auto; white-space: nowrap; }
      .rail .name { display: none; }
      .split { grid-template-columns: 1fr; }
      .chart.tall { height: 460px; }
    }
  `,
})
export class SciencePageComponent {
  readonly chapters: Chapter[] = [
    { id: 'ras', numeral: 'I', title: 'The oncogene' },
    { id: 'hungry', numeral: 'II', title: 'The hungry cell' },
    { id: 'rac1', numeral: 'III', title: 'The switch' },
    { id: 'bladder', numeral: 'IV', title: 'The indication' },
    { id: 'trials', numeral: 'V', title: 'The field' },
  ];
  readonly active = signal('ras');
  readonly ras = signal<RasSnapshot | null>(null);
  readonly rac1 = signal<Rac1Snapshot | null>(null);
  readonly bladder = signal<BladderSnapshot | null>(null);
  readonly trials = signal<TrialsSnapshot | null>(null);
  readonly error = signal('');
  readonly capturedOn = capturedOn;

  // ── I ──
  readonly totalRasDiseases = computed(() => (this.ras()?.genes ?? []).reduce((n, g) => n + g.diseaseCount, 0));
  readonly krasDrugs = computed(() => this.ras()?.genes.find((g) => g.symbol === 'KRAS')?.drugs ?? []);
  readonly approvedRas = computed(() => this.krasDrugs().filter((d) => /approv/i.test(d.stage)));
  readonly approvedNames = computed(() => this.approvedRas().map((d) => d.name).join(' and '));
  readonly rasDrugRows = computed(() => (this.ras()?.genes ?? []).flatMap((g) => g.drugs.map((d) => ({ gene: g.symbol, ...d }))));
  readonly rasDiseases = computed(() => rasDiseaseSpec(this.ras()?.genes ?? []));
  readonly literatureRace = computed(() => literatureRaceSpec([
    ...(this.ras()?.literature ?? []).map((l) => ({ gene: 'KRAS', ...l })),
    ...(this.rac1()?.literature ?? []).map((l) => ({ gene: 'RAC1', ...l })),
  ]));
  readonly firstYear = computed(() => this.ras()?.literature[0]?.year ?? 0);
  readonly lastYear = computed(() => this.ras()?.literature.at(-1)?.year ?? 0);
  readonly peakYear = computed(() => this.ras()?.literature.at(-2)?.year ?? 0);
  readonly krasFirst = computed(() => this.ras()?.literature[0]?.count ?? 0);
  readonly krasPeak = computed(() => this.ras()?.literature.at(-2)?.count ?? 0);
  readonly rac1First = computed(() => this.rac1()?.literature[0]?.count ?? 0);
  readonly rac1Peak = computed(() => this.rac1()?.literature.at(-2)?.count ?? 0);

  // ── III ──
  readonly rac1Associations = computed(() => {
    const d = this.rac1()?.diseases ?? [];
    return associationSpec(evidenceRows(d, (x) => x.name), d.map((x) => x.name), 'Association score');
  });
  readonly rac1Interactors = computed(() => interactorSpec(this.rac1()?.interactors ?? [], RAS_GEFS));
  gefScore(name: string): string {
    const s = this.rac1()?.interactors.find((i) => i.partner === name)?.score;
    return s === undefined ? '—' : s.toFixed(3);
  }

  // ── IV ──
  readonly tractable = computed(() => (this.bladder()?.targets ?? []).filter((t) => t.smallMolecule.length > 0));
  readonly bladderAssociations = computed(() => {
    const t = this.bladder()?.targets ?? [];
    return associationSpec(evidenceRows(t, (x) => x.symbol), t.map((x) => x.symbol), 'Association score', ['HRAS', 'KRAS', 'FGFR3']);
  });
  readonly stages = computed(() => {
    const counts = new Map<string, number>();
    for (const d of this.bladder()?.drugs ?? []) counts.set(d.stage, (counts.get(d.stage) ?? 0) + 1);
    return stageSpec([...counts].map(([stage, count]) => ({ stage, count })), STAGES);
  });
  rank(symbol: string): number { return (this.bladder()?.targets.findIndex((t) => t.symbol === symbol) ?? -1) + 1; }
  score(symbol: string): string { const s = this.bladder()?.targets.find((t) => t.symbol === symbol)?.score; return s === undefined ? '—' : s.toFixed(3); }

  // ── V ──
  readonly recruiting = computed(() => (this.trials()?.conditions ?? []).reduce((sum, c) => sum + (c.statuses.find((s) => s.status === 'Recruiting')?.count ?? 0), 0));
  readonly solidPhase1 = computed(() => this.trials()?.conditions.find((c) => c.key === 'solid')?.phases.find((p) => p.phase === 'Phase 1')?.count ?? 0);
  readonly phases = computed(() => phaseSpec((this.trials()?.conditions ?? []).flatMap((c) => c.phases.map((p) => ({ indication: c.label, phase: p.phase, count: p.count })))));
  readonly statuses = computed(() => statusSpec((this.trials()?.conditions ?? []).flatMap((c) => c.statuses.filter((s) => s.count > 0).map((s) => ({ indication: c.label, status: s.status, count: s.count })))));

  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private spy: IntersectionObserver | null = null;
  private revealer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      this.gsap.reveal(host.querySelectorAll('.prologue [data-reveal]'), { delay: this.gsap.MOTION.delay.short });
      void this.load().then(() => {
        this.watch();
        const fragment = this.route.snapshot.fragment;
        // Twice: once now, once after the charts above have taken their height and moved the target.
        if (fragment) { requestAnimationFrame(() => this.scrollTo(fragment, false)); setTimeout(() => this.scrollTo(fragment, false), 900); }
      });
      const sub = this.route.fragment.subscribe((f) => { if (f && this.rac1()) this.scrollTo(f, true); });
      this.destroyRef.onDestroy(() => { sub.unsubscribe(); this.spy?.disconnect(); this.revealer?.disconnect(); });
    });
  }

  jump(e: Event, id: string): void {
    e.preventDefault();
    this.scrollTo(id, true);
    history.replaceState(null, '', `#${id}`);
  }

  private scrollTo(id: string, smooth: boolean): void {
    const target = this.el.nativeElement.querySelector<HTMLElement>(`#${id}`);
    target?.scrollIntoView({ behavior: smooth && !this.gsap.reducedMotion ? 'smooth' : 'auto', block: 'start' });
  }

  /** Scroll-spy for the rail, and per-chapter reveals so a long page does not stagger for seconds. */
  private watch(): void {
    const host = this.el.nativeElement;
    const sections = Array.from(host.querySelectorAll<HTMLElement>('.chapter'));
    this.spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) this.active.set(e.target.id);
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach((s) => this.spy!.observe(s));

    const seen = new WeakSet<Element>();
    this.revealer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || seen.has(e.target)) continue;
        seen.add(e.target);
        this.gsap.reveal(e.target.querySelectorAll('[data-reveal]'), { delay: 0, stagger: MOTION.stagger / 2 });
        const svg = e.target.querySelector<SVGSVGElement>('.pathway svg');
        if (svg) this.draw(svg);
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    sections.forEach((s) => this.revealer!.observe(s));
  }

  /** The pathway draws itself edge by edge, left to right, then the nodes fade up. */
  private draw(svg: SVGSVGElement): void {
    if (this.gsap.reducedMotion) return;
    const edges = Array.from(svg.querySelectorAll<SVGPathElement>('.edge'));
    for (const p of edges) { const len = p.getTotalLength(); p.style.strokeDasharray = p.classList.contains('direct') ? '4 5' : `${len}`; p.style.strokeDashoffset = `${len}`; }
    gsap.to(edges, { strokeDashoffset: 0, duration: MOTION.duration.slow, ease: EASE.inOut, stagger: 0.06, delay: 0.15, overwrite: 'auto' });
    gsap.from(svg.querySelectorAll('.node, .label'), { opacity: 0, duration: MOTION.duration.base, ease: EASE.out, stagger: 0.02, overwrite: 'auto' });
  }

  private async load(): Promise<void> {
    const get = <T,>(file: string) => firstValueFrom(this.http.get<T>(`data/science/${file}.json`));
    const results = await Promise.allSettled([get<RasSnapshot>('ras'), get<Rac1Snapshot>('rac1'), get<BladderSnapshot>('bladder'), get<TrialsSnapshot>('trials')]);
    const [ras, rac1, bladder, trials] = results;
    if (ras.status === 'fulfilled') this.ras.set(ras.value);
    if (rac1.status === 'fulfilled') this.rac1.set(rac1.value);
    if (bladder.status === 'fulfilled') this.bladder.set(bladder.value);
    if (trials.status === 'fulfilled') this.trials.set(trials.value);
    const failed = results.map((r, i) => (r.status === 'rejected' ? ['ras', 'rac1', 'bladder', 'trials'][i] : null)).filter(Boolean);
    if (failed.length) this.error.set(`Could not load the ${failed.join(', ')} snapshot${failed.length > 1 ? 's' : ''}.`);
  }
}
