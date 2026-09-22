import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { type GalleryChart } from './vega-charts-specs';
import { VENDORED } from './vega-gallery-vendored';

const PANEL_MIN = 320;
/** Edits render this long after the last keystroke: under a frame's worth of thinking, well over a keystroke. */
const LIVE_DEBOUNCE_MS = 120;
/** How long play leaves each chart up. */
const DEMO_DWELL_MS = 4500;

/**
 * Vega-Lite gallery, ported from the a21-ares `vega-charts` component, laid out like the
 * MorphCharts client: chart on the left, draggable divider, spec panel on the right.
 *
 * The editor is live — a parseable edit renders LIVE_DEBOUNCE_MS after the last keystroke, and
 * an unparseable one keeps the last good chart and marks the line — and a transport walks the
 * gallery (⏮ ⏵ ⏭, ← →, space), so the 107 specifications double as a demo reel.
 */
@Component({
  selector: 'app-vega-charts-page',
  imports: [VegaChartComponent, SpecEditorComponent, GlyphComponent],
  host: { '(window:keydown)': 'onKey($event)' },
  template: `
    <div class="client chart-shell" [style.gridTemplateColumns]="'1fr 6px ' + panelWidth() + 'px'">
      <div class="chart-column">
        <div class="chart-toolbar">
          <div class="keyrail keys" role="group" aria-label="Gallery transport">
            <button type="button" class="key" (click)="step(-1)" aria-label="Previous chart" title="Previous chart (←)"><app-glyph name="prev" /></button>
            <button type="button" class="key play" (click)="togglePlay()" [attr.aria-pressed]="playing()" [attr.aria-label]="playing() ? 'Pause' : 'Play every chart'" [title]="playing() ? 'Pause (space)' : 'Play every chart (space)'"><app-glyph [name]="playing() ? 'pause' : 'play'" /></button>
            <button type="button" class="key" (click)="step(1)" aria-label="Next chart" title="Next chart (→)"><app-glyph name="next" /></button>
            <button type="button" class="key" (click)="shuffle()" aria-label="Random chart" title="Random chart"><app-glyph name="shuffle" /></button>
          </div>
          <output class="counter" [attr.aria-label]="'Chart ' + (index() + 1) + ' of ' + gallery.length">{{ index() + 1 }}<i>/</i>{{ gallery.length }}</output>
          <label class="field">
            <select [value]="selectedId()" (change)="select($any($event.target).value)" aria-label="Chart">
              @for (g of groups; track g.name) {
                <optgroup [label]="g.name">
                  @for (c of g.items; track c.id) { <option [value]="c.id">{{ c.label }}</option> }
                </optgroup>
              }
            </select>
          </label>
          <h1>Vega Charts</h1>
          <span class="spacer"></span>
          <span class="status" [class.err]="!!error()" role="status">{{ error() || status() }}</span>
        </div>
        <div class="chart-stage" #stage>
          @if (hasSpec()) { <app-vega-chart [spec]="spec()" [fill]="true" (viewReady)="onRendered()" /> }
        </div>
      </div>

      <div class="chart-divider" (pointerdown)="startDivider($event)" role="separator" aria-orientation="vertical"></div>

      <div class="chart-column" #right>
        <div class="chart-pane">
          <div class="chart-pane-head">
            <span class="eyebrow">Specification · {{ selected().label }}</span>
            <span class="actions">
              <span class="live" title="Edits render as you type">LIVE</span>
              <button type="button" class="btn small" (click)="reset()" title="Discard edits and reload the gallery spec">Reset</button>
            </span>
          </div>
          <app-spec-editor #editor [value]="json()" (changed)="onEdit($event)" />
        </div>
      </div>
    </div>
  `,
  styles: `
    /* Shell, stage, panes and divider come from styles.scss; only what is specific to this page
       lives here. */
    :host { display: block; height: calc(100vh - var(--nav-h)); display: flex; flex-direction: column; }
    .keys .key { width: 30px; height: 28px; }
    .key.play { background: var(--teal); color: var(--ink); }
    .counter { font: 500 10px/1 var(--font-mono); color: var(--on-ink-dim); font-variant-numeric: tabular-nums; i { margin: 0 3px; color: var(--hairline); } }
    .actions { display: inline-flex; align-items: center; gap: 8px; }
    .live { font: 500 9px/1 var(--font-mono); letter-spacing: 0.14em; color: var(--teal); }
    .live::before { content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--teal); vertical-align: 1px; animation: live 1.6s var(--ease-out) infinite; }
    @keyframes live { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { .live::before { animation: none; } }
    .status { font: 400 10px/1 var(--font-mono); color: var(--on-ink-faint); font-variant-numeric: tabular-nums; }
    .status.err { color: var(--rose); }
    app-spec-editor { flex: 1; min-height: 200px; }
    @media (max-width: 860px) {
      :host { height: auto; }
      .client { grid-template-columns: 1fr !important; }
      .chart-divider { display: none; }
      .chart-stage { min-height: 55vh; }
    }
  `,
})
export class VegaChartsPageComponent {
  readonly gallery: GalleryChart[] = VENDORED;
  readonly groups = [
    { name: 'Specs', items: VENDORED.filter((c) => c.group === 'Specs') },
    { name: 'Examples', items: VENDORED.filter((c) => c.group === 'Examples') },
  ];
  readonly selectedId = signal(VENDORED[0].id);
  readonly selected = computed(() => this.gallery.find((c) => c.id === this.selectedId()) ?? VENDORED[0]);
  readonly index = computed(() => Math.max(0, this.gallery.findIndex((c) => c.id === this.selectedId())));
  /** The spec currently rendered — replaced wholesale by select/shuffle, or by a parseable edit. */
  readonly spec = signal<Record<string, unknown>>({});
  /** Every entry is url-backed now, so the first spec arrives from a fetch rather than inline. */
  readonly hasSpec = computed(() => Object.keys(this.spec()).length > 0);
  readonly error = signal('');
  readonly status = signal('');
  readonly playing = signal(false);
  readonly json = computed(() => JSON.stringify(this.spec(), null, 2));
  readonly panelWidth = signal(480);

  private readonly editor = viewChild.required(SpecEditorComponent);
  private readonly right = viewChild.required<ElementRef<HTMLDivElement>>('right');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly gsap = inject(GsapService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  /** Guards against a slow fetch landing after the user has moved on. */
  private loadToken = 0;
  private editTimer: ReturnType<typeof setTimeout> | null = null;
  private playTimer: ReturnType<typeof setTimeout> | null = null;
  private renderStart = 0;

  constructor() {
    afterNextRender(() => {
      this.gsap.slideIn(this.right().nativeElement, 'right', this.gsap.MOTION.delay.medium);
      // Every entry is url-backed, so nothing is on screen until the first fetch lands.
      // Deferred to afterNextRender because load() writes into the spec editor view child.
      void this.load();
    });
    this.destroyRef.onDestroy(() => { this.stopPlay(); if (this.editTimer) clearTimeout(this.editTimer); });
  }

  select(id: string): void {
    this.selectedId.set(id);
    void this.load();
  }

  /** Neighbouring chart; a manual step pauses play. */
  step(delta: number): void {
    this.stopPlay();
    this.select(this.gallery[(this.index() + delta + this.gallery.length) % this.gallery.length].id);
  }

  /** Jumps to a random chart from the list, never landing on the one already shown. */
  shuffle(): void {
    if (this.gallery.length < 2) return;
    this.stopPlay();
    let id = this.selectedId();
    while (id === this.selectedId()) id = this.gallery[Math.floor(Math.random() * this.gallery.length)].id;
    this.select(id);
  }

  togglePlay(): void {
    if (this.playing()) { this.stopPlay(); return; }
    this.playing.set(true);
    this.scheduleNext();
  }

  /** ← → step the gallery, space plays, unless the keys are going into a field. */
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
    else if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
  }

  reset(): void {
    void this.load();
  }

  /** Live editing: parse after a short quiet period; a bad edit keeps the last good chart and marks its line. */
  onEdit(text: string): void {
    if (text === this.json()) return;
    if (this.editTimer) clearTimeout(this.editTimer);
    this.editTimer = setTimeout(() => { this.editTimer = null; this.apply(); }, LIVE_DEBOUNCE_MS);
  }

  /** The chart mounted: fade it in, report the time, and let play keep its cue. */
  onRendered(): void {
    // Only a load or an edit sets renderStart; a theme re-embed reports nothing.
    if (this.renderStart) { this.status.set(`rendered in ${Math.max(1, Math.round(performance.now() - this.renderStart))} ms`); this.renderStart = 0; }
    this.gsap.reveal(this.stage().nativeElement, { duration: this.gsap.MOTION.duration.base, delay: 0, distance: 10 });
  }

  private apply(): void {
    try {
      const parsed = this.editor().parseJSON();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error.set('A specification must be a JSON object.');
        return;
      }
      this.error.set('');
      this.renderStart = performance.now();
      this.spec.set(parsed as Record<string, unknown>);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private stopPlay(): void {
    this.playing.set(false);
    if (this.playTimer) { clearTimeout(this.playTimer); this.playTimer = null; }
  }

  private scheduleNext(): void {
    if (this.playTimer) clearTimeout(this.playTimer);
    this.playTimer = setTimeout(() => {
      this.playTimer = null;
      if (!this.playing()) return;
      this.select(this.gallery[(this.index() + 1) % this.gallery.length].id);
      this.scheduleNext();
    }, DEMO_DWELL_MS);
  }

  // Same drag as the MorphCharts client; ~6 lines, duplicated rather than abstracted for two callers.
  startDivider(e: PointerEvent): void {
    const startX = e.clientX;
    const startWidth = this.right().nativeElement.clientWidth;
    const move = (ev: PointerEvent) => this.panelWidth.set(Math.max(startWidth - (ev.clientX - startX), PANEL_MIN));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.error.set('');
    if (this.editTimer) { clearTimeout(this.editTimer); this.editTimer = null; }
    const entry = this.selected();
    this.renderStart = performance.now();
    if (entry.spec) {
      this.spec.set(entry.spec());
    } else if (entry.url) {
      try {
        const loaded = await firstValueFrom(this.http.get<Record<string, unknown>>(entry.url));
        if (token !== this.loadToken) return;
        this.spec.set(loaded);
      } catch (e) {
        if (token !== this.loadToken) return;
        this.error.set(`Could not load ${entry.url}: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    this.editor().setContent(this.json());
  }
}
