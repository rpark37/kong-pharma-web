import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { MorphchartsSceneComponent } from '../../shared/morphcharts/morphcharts-scene.component';
import { MorphchartsCameraComponent } from '../../shared/morphcharts/morphcharts-camera.component';
import { CameraRig } from '../../shared/morphcharts/camera-rig';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { ThemeService } from '../../shared/theme/theme.service';
import { PLDDT_BANDS, confidentShare, proteinSpec } from './protein-spec';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { GENE_ORDER, STATIONS, STATION_LABEL, geneStory, type GeneStory, type Station } from './gene-stories';
import { associationSpec, geneDiseaseSpec, interactorSpec, literatureRaceSpec, plddtStripSpec } from './science-specs';
import { capturedOn, evidenceRows, isCancer, type DiseaseAssociation, type MachinerySnapshot, type Rac1Snapshot, type RasSnapshot, type StructureSnapshot } from './science.model';

/** What every story shows, whichever snapshot it came from. */
interface GeneData {
  name: string;
  captured: string;
  diseaseCount: number;
  diseases: DiseaseAssociation[];
  smallMolecule: string[];
  drugCount: number;
  drugs: { id: string; name: string; type: string; stage: string }[];
  /** Europe PMC papers naming the gene with macropinocytosis (machinery genes only). */
  papers?: number;
  papersTotal?: number;
  /** Twenty-year publication series (KRAS and RAC1 only). */
  literature?: { year: number; count: number }[];
  interactors?: { partner: string; score: number; experimental: number }[];
}

/**
 * One gene's story: what it is, its place on the route from RAS to lysosome, and what the public
 * evidence says about it. The prose is in gene-stories.ts; the numbers load from the snapshot the
 * story names. Same dark-first composition as the dossier, one column, threaded prev/next.
 */
@Component({
  selector: 'app-gene-page',
  imports: [DecimalPipe, RouterLink, VegaChartComponent, GlyphComponent, MorphchartsSceneComponent, MorphchartsCameraComponent],
  template: `
    @if (story(); as s) {
      <article class="story">
        <header class="head">
          <p class="eyebrow" data-reveal><app-glyph name="body" />Research · {{ index() + 1 }} of {{ order.length }} · {{ s.role }}</p>
          <h1 data-reveal>{{ s.symbol }}</h1>
          <p class="lead" data-reveal>{{ s.hook }}</p>
          @if (data(); as d) {
            <dl class="ledger" data-reveal>
              <div><dt>Name</dt><dd>{{ d.name }}</dd></div>
              <div><dt>Diseases</dt><dd>{{ d.diseaseCount | number }}<small>Open Targets</small></dd></div>
              @if (d.papers !== undefined) { <div><dt>With macropinocytosis</dt><dd>{{ d.papers | number }}<small>of {{ d.papersTotal | number }} papers</small></dd></div> }
              @if (d.literature) { <div><dt>Papers, {{ peakYear() }}</dt><dd>{{ peakPapers() | number }}<small>Europe PMC</small></dd></div> }
              <div><dt>Candidates</dt><dd>{{ d.drugCount | number }}<small>{{ approved() || (d.drugCount ? 'none approved' : 'none in the clinic') }}</small></dd></div>
              <div><dt>Small molecule</dt><dd>{{ d.smallMolecule.length }}<small>{{ d.smallMolecule.length ? 'tractability flags' : 'no tractability flag' }}</small></dd></div>
              <div><dt>Captured</dt><dd>{{ capturedOn(d.captured) }}</dd></div>
            </dl>
          }
        </header>

        <nav class="thread" aria-label="Genes" data-reveal>
          @if (prev(); as p) { <a [routerLink]="'/gene-' + p.toLowerCase()"><app-glyph name="prev" />{{ p }}</a> } @else { <span></span> }
          <a class="dossier" routerLink="/science" [fragment]="chapterFragment()">The dossier · {{ stationLabel() }}</a>
          @if (next(); as n) { <a class="next" [routerLink]="'/gene-' + n.toLowerCase()">{{ n }}<app-glyph name="next" /></a> } @else { <span></span> }
        </nav>

        <section class="part" data-reveal>
          <p class="kicker">What it is</p>
          @for (p of s.what; track $index) { <p class="prose">{{ p }}</p> }
        </section>

        @if (structure(); as st) {
          <section class="part structure" data-reveal>
            <p class="kicker">The protein</p>
            <dl class="ledger tight">
              <div><dt>Model</dt><dd>{{ st.model }}<small>AlphaFold DB v{{ st.version }}</small></dd></div>
              <div><dt>Residues</dt><dd>{{ st.length | number }}<small>Cα trace</small></dd></div>
              <div><dt>Mean pLDDT</dt><dd>{{ st.meanPlddt | number: '1.0-0' }}<small>{{ meanBand() }}</small></dd></div>
              <div><dt>Confident</dt><dd>{{ confident() | number: '1.0-0' }}%<small>residues at pLDDT ≥ 70</small></dd></div>
            </dl>
            <div class="scene-box">
              <app-morphcharts-scene [spec]="structureSpec()" [maxFrames]="300" [fallbackTitle]="s.symbol + ' in 3D needs WebGPU'" (hostReady)="onStructureHost($event)" (loaded)="rig()?.apply(); rig()?.applyRenderMode()">
                <p class="context-note">The confidence strip below carries the same model.</p>
              </app-morphcharts-scene>
            </div>
            <app-morphcharts-camera class="scene-camera" [rig]="rig()" layout="row" />
            <figcaption><b>Fig. 1</b> {{ s.symbol }} as beads on a string: every residue's alpha-carbon, coloured by how sure AlphaFold is of its position — <span class="band b0">very high</span>, <span class="band b1">confident</span>, <span class="band b2">low</span>, <span class="band b3">very low</span>. A loose thread of red is disorder, not error. AlphaFold DB, EMBL-EBI &amp; DeepMind, CC BY 4.0.</figcaption>
            <figure>
              <div class="chart strip-chart"><app-vega-chart [spec]="plddtStrip()" [fill]="true" /></div>
              <figcaption><b>Fig. 2</b> Confidence along the chain, one bar per residue. Long low stretches are the flexible regions a crystal never resolves.</figcaption>
            </figure>
          </section>
        }

        <figure class="pathway strip" data-reveal>
          <svg viewBox="0 0 960 150" role="img" [attr.aria-label]="'The route from RAS to the lysosome, with ' + s.symbol + ' at ' + stationLabel().toLowerCase()">
            <defs><marker id="gene-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l6 3-6 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></marker></defs>
            @for (st of stations; track st.id; let i = $index) {
              @if (i > 0) { <path class="edge" [attr.d]="'M' + (stationX(i - 1) + 60) + ' 80H' + (stationX(i) - 62)" /> }
              <g [class.on]="st.id === s.station" class="station">
                <rect class="node" [attr.x]="stationX(i) - 58" y="48" width="116" height="64" rx="8" />
                <text class="label" [attr.x]="stationX(i)" y="70">{{ st.label }}</text>
                <text class="label small" [attr.x]="stationX(i)" y="88">{{ st.genes.slice(0, 2).join(' · ') || 'digest' }}</text>
                @if (st.genes.length > 2) { <text class="label small" [attr.x]="stationX(i)" y="102">{{ st.genes.slice(2).join(' · ') }}</text> }
              </g>
            }
            <g class="station side" [class.on]="s.station === 'sensing'">
              <path class="edge direct" d="M846 32C830 44 812 56 800 66" />
              <rect class="node" x="846" y="12" width="104" height="40" rx="8" /><text class="label" x="898" y="30">HIF1A · MTOR</text><text class="label small" x="898" y="44">sensing</text>
            </g>
          </svg>
          <figcaption><b>Fig. 3</b> The route, with {{ s.symbol }}'s station lit. HIF1A turns the programme up under hypoxia; MTOR reads what the lysosome releases.</figcaption>
        </figure>

        <section class="part" data-reveal>
          <p class="kicker">Its part in the drinking</p>
          @for (p of s.route; track $index) { <p class="prose">{{ p }}</p> }
        </section>

        @if (data(); as d) {
          <section class="part" data-reveal>
            <p class="kicker">What the evidence says</p>
            <p class="prose">
              Open Targets ties {{ s.symbol }} to {{ d.diseaseCount | number }} diseases with some evidence. Of the top
              {{ d.diseases.length }}, {{ malignancies() }} {{ malignancies() === 1 ? 'is a malignancy' : 'are malignancies' }} by name;
              the strongest association is {{ d.diseases[0].name }} at {{ d.diseases[0].score | number: '1.2-2' }}.
              @if (d.papers !== undefined) { Europe PMC holds {{ d.papers | number }} papers that name the gene alongside macropinocytosis. }
              @if (d.literature) { Publications per year reached {{ peakPapers() | number }} in {{ peakYear() }}. }
            </p>
            <figure>
              <div class="chart tall"><app-vega-chart [spec]="associations()" [fill]="true" /></div>
              <figcaption><b>Fig. 4</b> Top {{ d.diseases.length }} associations, each score stacked by the evidence type behind it.</figcaption>
            </figure>
            @if (d.interactors) {
              <figure>
                <div class="chart"><app-vega-chart [spec]="interactors()" [fill]="true" /></div>
                <figcaption><b>Fig. 5</b> STRING interaction partners, combined score; the solid bar is experimental evidence alone. The exchange factors that carry the RAS signal stay bright.</figcaption>
              </figure>
            }
            @if (d.literature) {
              <figure>
                <div class="chart"><app-vega-chart [spec]="literature()" [fill]="true" /></div>
                <figcaption><b>Fig. {{ d.interactors ? 6 : 5 }}</b> Publications per year, Europe PMC; the last year is partial.</figcaption>
              </figure>
            }
            <div class="split">
              <div>
                <p class="kicker">In the clinic</p>
                @if (d.drugs.length) {
                  <table class="ledger-table">
                    <thead><tr><th>Candidate</th><th>Stage</th><th>Modality</th></tr></thead>
                    <tbody>
                      @for (r of d.drugs; track r.id) {
                        <tr><td><a [href]="'https://platform.opentargets.org/drug/' + r.id" target="_blank" rel="noopener">{{ r.name }}</a></td><td class="mono" [class.on]="r.stage === 'Approved'">{{ r.stage }}</td><td class="dim">{{ r.type }}</td></tr>
                      }
                    </tbody>
                  </table>
                  @if (d.drugCount > d.drugs.length) { <p class="context-note">{{ d.drugs.length }} of {{ d.drugCount }}, furthest stage first.</p> }
                } @else {
                  <p class="prose small">No clinical candidate lists this gene as its target in Open Targets.</p>
                }
              </div>
              <div>
                <p class="kicker">Tractability</p>
                @if (d.smallMolecule.length) {
                  <ul class="tags">@for (t of d.smallMolecule; track t) { <li><span class="mono">SM</span>{{ t }}</li> }</ul>
                } @else {
                  <p class="prose small">Open Targets carries no small-molecule tractability flag for it.</p>
                }
                <a class="source-link" [href]="'https://platform.opentargets.org/target/' + targetId()" target="_blank" rel="noopener">Open Targets entry<app-glyph name="external" /></a>
              </div>
            </div>
          </section>
        } @else if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @else { <p class="loading">Loading the snapshot…</p> }

        <section class="part kong" data-reveal>
          <p class="kicker">For Kong</p>
          <p class="prose">{{ s.kong }}</p>
        </section>

        <nav class="thread foot" aria-label="Genes">
          @if (prev(); as p) { <a [routerLink]="'/gene-' + p.toLowerCase()"><app-glyph name="prev" />{{ p }}</a> } @else { <span></span> }
          <a class="dossier" routerLink="/science" [fragment]="chapterFragment()">Back to the dossier</a>
          @if (next(); as n) { <a class="next" [routerLink]="'/gene-' + n.toLowerCase()">{{ n }}<app-glyph name="next" /></a> } @else { <span></span> }
        </nav>
      </article>
    } @else {
      <article class="story"><p class="error" role="alert">No story for that gene. <a routerLink="/science">Back to the dossier.</a></p></article>
    }
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 6rem; max-width: 1100px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 20px; }
    .eyebrow { display: inline-flex; align-items: center; margin: 0; app-glyph { margin-right: 8px; } }
    h1 { font-family: var(--font-mono); font-size: clamp(2.6rem, 7vw, 5rem); line-height: 0.95; margin: 10px 0 14px; letter-spacing: 0.02em; }
    .lead { font-size: clamp(1.05rem, 1.5vw, 1.25rem); line-height: 1.5; color: var(--on-ink-dim); max-width: 60ch; }
    .ledger { display: flex; flex-wrap: wrap; gap: 12px 32px; margin: 22px 0 0; padding: 14px 0; border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
    .ledger div { display: flex; flex-direction: column; gap: 4px; }
    .ledger dt, .kicker, th, .tags .mono, figcaption b { font: 500 9px/1.2 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }
    .ledger dd { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; line-height: 1; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .ledger dd small { display: block; margin-top: 4px; font: 400 11px/1.3 var(--font-mono); color: var(--on-ink-dim); max-width: 22ch; }
    .ledger div:first-child dd { font-family: var(--font-body); font-weight: 400; font-size: 13px; color: var(--on-ink-dim); max-width: 26ch; line-height: 1.3; }

    /* The thread: previous gene, the chapter this belongs to, next gene. */
    .thread { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin: 18px 0 8px; }
    .thread a { display: inline-flex; align-items: center; gap: 8px; font: 500 11px/1 var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--on-ink-dim); padding: 8px 0; }
    .thread a:hover { color: var(--teal); }
    .thread .next { justify-self: end; }
    .thread .dossier { color: var(--teal); padding: 8px 14px; border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent); border-radius: 6px; }
    .thread.foot { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--hairline); }

    .part { padding: 28px 0 8px; }
    .structure { padding-top: 24px; }
    .ledger.tight { margin: 0 0 16px; padding: 10px 0; border-top: 0; }
    .scene-box { height: clamp(320px, 52vh, 520px); }
    .scene-camera { margin-top: 12px; }
    .band { font-weight: 500; }
    .band.b0 { color: var(--teal); } .band.b1 { color: color-mix(in srgb, var(--teal) 70%, var(--on-ink)); } .band.b2 { color: var(--amber); } .band.b3 { color: var(--rose); }
    .chart.strip-chart { height: 170px; }
    .kicker { margin: 0 0 12px; color: var(--teal); }
    .prose { max-width: 66ch; font-size: 15px; line-height: 1.7; color: var(--on-ink); margin: 0 0 14px; }
    .prose.small { font-size: 13px; color: var(--on-ink-dim); }
    .kong { margin-top: 12px; padding: 24px 0 8px; border-top: 1px solid var(--hairline); }
    .kong .prose { font-size: 16px; }
    .loading, .context-note { color: var(--on-ink-faint); font: 400 11px/1.5 var(--font-mono); }
    .error { color: var(--rose); font-size: 13px; }

    figure { margin: 20px 0 8px; }
    figcaption { margin-top: 10px; font: 400 11px/1.55 var(--font-mono); color: var(--on-ink-faint); max-width: 76ch; b { color: var(--teal); margin-right: 8px; } }
    .chart { height: 300px; }
    .chart.tall { height: 360px; }
    .split { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px 40px; align-items: start; margin-top: 12px; }
    .tags { list-style: none; padding: 0; margin: 4px 0 14px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tags li { font-size: 12px; padding: 4px 10px; border: 1px solid var(--hairline); border-radius: 6px; color: var(--on-ink-dim); }
    .tags .mono { margin-right: 8px; color: var(--teal); letter-spacing: 0.08em; }
    .ledger-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 4px 0 8px; }
    .ledger-table th { text-align: left; padding: 6px 10px 8px 0; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
    .ledger-table td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--hairline); vertical-align: top; }
    .ledger-table td.dim { color: var(--on-ink-dim); }
    .ledger-table td.on { color: var(--teal); font-weight: 500; }
    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .source-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; app-glyph { width: 11px; height: 11px; } }
    a { color: var(--teal); }

    /* Fig. 1 in the glyph hand; the story's own station is the lit one. */
    .pathway svg { width: 100%; height: auto; display: block; color: var(--on-ink-faint); font-family: var(--font-mono); }
    .pathway .edge { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; marker-end: url(#gene-arrow); }
    .pathway .edge.direct { stroke-dasharray: 4 5; }
    .pathway .node { fill: var(--ink-2); stroke: currentColor; stroke-width: 1.2; }
    .pathway .label { fill: var(--on-ink-dim); font-size: 12px; font-weight: 500; text-anchor: middle; }
    .pathway .label.small { font-size: 9px; fill: var(--on-ink-faint); font-weight: 400; }
    .pathway .station.on .node { stroke: var(--teal); stroke-width: 2; fill: color-mix(in srgb, var(--teal) 14%, var(--ink-2)); }
    .pathway .station.on .label { fill: var(--on-ink); }
    .pathway .station.on .label.small { fill: var(--teal); }

    @media (max-width: 760px) {
      .split { grid-template-columns: 1fr; }
      .thread { grid-template-columns: 1fr; justify-items: start; }
      .thread .next { justify-self: start; }
      .chart.tall { height: 320px; }
    }
  `,
})
export class GenePageComponent {
  /** Bound from the route matcher: the symbol after `gene-`. */
  readonly symbol = input.required<string>();
  readonly order = GENE_ORDER;
  readonly stations = STATIONS;

  readonly story = computed<GeneStory | undefined>(() => geneStory(this.symbol()));
  readonly index = computed(() => GENE_ORDER.indexOf(this.story()?.symbol ?? ''));
  readonly prev = computed(() => (this.index() > 0 ? GENE_ORDER[this.index() - 1] : null));
  readonly next = computed(() => (this.index() >= 0 && this.index() < GENE_ORDER.length - 1 ? GENE_ORDER[this.index() + 1] : null));
  readonly data = signal<GeneData | null>(null);
  readonly structure = signal<StructureSnapshot | null>(null);
  readonly rig = signal<CameraRig | null>(null);
  readonly targetId = signal('');
  readonly error = signal('');
  readonly capturedOn = capturedOn;

  readonly stationLabel = computed(() => STATION_LABEL[this.story()?.station ?? 'ruffle']);
  /** Which dossier chapter the thread link returns to. */
  readonly chapterFragment = computed(() => {
    const st = this.story()?.station;
    return st === 'ras' ? 'ras' : st === 'rac1' ? 'rac1' : (this.story()?.symbol.toLowerCase() ?? 'machinery');
  });
  /** Rebuilt on theme change too: the beads' colours and the paper are baked into the spec. */
  readonly structureSpec = computed(() => { this.theme.theme(); const st = this.structure(); return st ? proteinSpec(st) : null; });
  readonly plddtStrip = computed(() => { const st = this.structure(); return st ? plddtStripSpec(st) : {}; });
  readonly confident = computed(() => { const st = this.structure(); return st ? confidentShare(st) * 100 : 0; });
  readonly meanBand = computed(() => { const m = this.structure()?.meanPlddt ?? 0; return (PLDDT_BANDS.find((b) => m >= b.min) ?? PLDDT_BANDS[3]).label.toLowerCase(); });
  onStructureHost(host: MorphChartsHost): void { this.rig.set(new CameraRig(host, { reducedMotion: () => this.gsap.reducedMotion })); }
  readonly malignancies = computed(() => (this.data()?.diseases ?? []).filter((d) => isCancer(d.name)).length);
  readonly approved = computed(() => (this.data()?.drugs ?? []).filter((d) => /approv/i.test(d.stage)).map((d) => d.name).slice(0, 2).join(', '));
  readonly peakYear = computed(() => this.data()?.literature?.at(-2)?.year ?? 0);
  readonly peakPapers = computed(() => this.data()?.literature?.at(-2)?.count ?? 0);
  readonly associations = computed(() => {
    const d = this.data()?.diseases ?? [];
    return d.length && d[0].evidence ? associationSpec(evidenceRows(d, (x) => x.name), d.map((x) => x.name), 'Association score') : geneDiseaseSpec({ diseases: d }, 8);
  });
  readonly interactors = computed(() => interactorSpec(this.data()?.interactors ?? [], ['TIAM1', 'PREX1', 'VAV1']));
  readonly literature = computed(() => literatureRaceSpec((this.data()?.literature ?? []).map((l) => ({ gene: this.story()?.symbol ?? '', ...l }))));

  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly title = inject(Title);
  private readonly theme = inject(ThemeService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => { this.reveal(); });
    // The symbol input changes in place when the thread links are followed: reload, retitle, re-reveal.
    effect(() => {
      const story = this.story();
      untracked(() => {
        this.title.setTitle(story ? `${story.symbol} · ${story.role}` : 'Research');
        this.data.set(null);
        this.structure.set(null);
        if (story) { void this.load(story).then(() => this.reveal()); void this.loadStructure(story.symbol); }
      });
    });
  }

  stationX(i: number): number { return 76 + i * 130; }

  private reveal(): void {
    const host = this.el.nativeElement;
    host.scrollIntoView({ block: 'start' });
    this.gsap.reveal(host.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.short, stagger: 0.05 });
    const svg = host.querySelector<SVGSVGElement>('.pathway svg');
    if (svg && !this.gsap.reducedMotion) {
      const edges = Array.from(svg.querySelectorAll<SVGPathElement>('.edge'));
      for (const p of edges) { const len = p.getTotalLength(); p.style.strokeDasharray = p.classList.contains('direct') ? '4 5' : `${len}`; p.style.strokeDashoffset = `${len}`; }
      this.gsap.tweenObject(edges as unknown as object, { strokeDashoffset: 0, duration: this.gsap.MOTION.duration.slow, stagger: 0.05, delay: 0.2 });
    }
  }

  private async loadStructure(symbol: string): Promise<void> {
    try {
      this.structure.set(await firstValueFrom(this.http.get<StructureSnapshot>(`data/science/structures/${symbol}.json`)));
    } catch {
      this.structure.set(null); // no model for this gene: the page simply has no structure section
    }
  }

  private async load(story: GeneStory): Promise<void> {
    this.error.set('');
    try {
      if (story.source === 'ras') {
        const snap = await firstValueFrom(this.http.get<RasSnapshot>('data/science/ras.json'));
        const g = snap.genes.find((x) => x.symbol === story.symbol)!;
        this.targetId.set(g.id);
        this.data.set({ name: g.name, captured: snap.captured, diseaseCount: g.diseaseCount, diseases: g.diseases, smallMolecule: g.smallMolecule, drugCount: g.drugCount, drugs: g.drugs, literature: story.symbol === 'KRAS' ? snap.literature : undefined });
      } else if (story.source === 'rac1') {
        const snap = await firstValueFrom(this.http.get<Rac1Snapshot>('data/science/rac1.json'));
        this.targetId.set(snap.target.id);
        this.data.set({ name: snap.target.name, captured: snap.captured, diseaseCount: snap.diseaseCount, diseases: snap.diseases, smallMolecule: snap.tractability.filter((t) => t.modality === 'SM').map((t) => t.label), drugCount: 0, drugs: [], literature: snap.literature, interactors: snap.interactors });
      } else {
        const snap = await firstValueFrom(this.http.get<MachinerySnapshot>('data/science/machinery.json'));
        const g = snap.genes.find((x) => x.symbol === story.symbol)!;
        this.targetId.set(g.id);
        this.data.set({ name: g.name, captured: snap.captured, diseaseCount: g.diseaseCount, diseases: g.diseases, smallMolecule: g.smallMolecule, drugCount: g.drugCount, drugs: g.drugs, papers: g.macropinocytosisPapers, papersTotal: snap.macropinocytosisPapers });
      }
    } catch (e) {
      this.error.set(`Could not load the ${story.source} snapshot: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
