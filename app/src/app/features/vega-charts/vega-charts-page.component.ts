import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { type GalleryChart } from './vega-charts-specs';
import { VENDORED } from './vega-gallery-vendored';

const PANEL_MIN = 320;

/**
 * Vega-Lite gallery, ported from the a21-ares `vega-charts` component, laid out like the
 * MorphCharts client: chart on the left, draggable divider, spec panel on the right.
 *
 * The port drops the original's Angular Material shell, its own vega.View embedding and its
 * light/dark toggle: rendering goes through the shared <app-vega-chart> (vega-embed + resize
 * observer) and the app is single-theme, so VEGA_CONFIG styles every chart.
 */
@Component({
  selector: 'app-vega-charts-page',
  imports: [VegaChartComponent, SpecEditorComponent],
  template: `
    <section class="head">
      <p class="eyebrow">vega · vega-lite · {{ gallery.length }} specifications</p>
    </section>

    <div class="client chart-shell" [style.gridTemplateColumns]="'1fr 6px ' + panelWidth() + 'px'">
      <div class="chart-column">
        <div class="chart-toolbar">
          <label class="field">
            <select [value]="selectedId()" (change)="select($any($event.target).value)">
              @for (g of groups; track g.name) {
                <optgroup [label]="g.name">
                  @for (c of g.items; track c.id) { <option [value]="c.id">{{ c.label }}</option> }
                </optgroup>
              }
            </select>
          </label>
          <h1>Vega Charts</h1>
          <span class="spacer"></span>
          @if (error()) { <span class="status err">{{ error() }}</span> }
        </div>
        <div class="chart-stage">
          @if (hasSpec()) { <app-vega-chart [spec]="spec()" [fill]="true" /> }
        </div>
      </div>

      <div class="chart-divider" (pointerdown)="startDivider($event)" role="separator" aria-orientation="vertical"></div>

      <div class="chart-column" #right>
        <div class="chart-pane">
          <div class="chart-pane-head">
            <span class="eyebrow">Specification · {{ selected().label }}</span>
            <span class="actions">
              <button type="button" class="btn small" (click)="shuffle()" title="Jump to a random chart from the list">Shuffle</button>
              <button type="button" class="btn small" (click)="reset()">Reset</button>
              <button type="button" class="btn small" (click)="apply()">Apply</button>
            </span>
          </div>
          <app-spec-editor #editor [value]="json()" />
        </div>
      </div>
    </div>
  `,
  styles: `
    /* Shell, stage, panes and divider come from styles.scss; only what is specific to this page
       lives here. */
    :host { display: block; height: calc(100vh - var(--nav-h)); display: flex; flex-direction: column; }
    .head { padding: clamp(0.75rem, 2vh, 1.1rem) var(--pad-x) 0; }
    .actions { display: inline-flex; gap: 6px; }
    .status.err { font-size: 12px; color: var(--rose); font-family: var(--font-mono); }
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
  /** The spec currently rendered — replaced wholesale by select/shuffle/apply. */
  readonly spec = signal<Record<string, unknown>>({});
  /** Every entry is url-backed now, so the first spec arrives from a fetch rather than inline. */
  readonly hasSpec = computed(() => Object.keys(this.spec()).length > 0);
  readonly error = signal('');
  readonly json = computed(() => JSON.stringify(this.spec(), null, 2));
  readonly panelWidth = signal(480);

  private readonly editor = viewChild.required(SpecEditorComponent);
  private readonly right = viewChild.required<ElementRef<HTMLDivElement>>('right');
  private readonly gsap = inject(GsapService);
  private readonly http = inject(HttpClient);
  /** Guards against a slow fetch landing after the user has moved on. */
  private loadToken = 0;

  constructor() {
    afterNextRender(() => {
      this.gsap.slideIn(this.right().nativeElement, 'right', this.gsap.MOTION.delay.medium);
      // Every entry is url-backed, so nothing is on screen until the first fetch lands.
      // Deferred to afterNextRender because load() writes into the spec editor view child.
      void this.load();
    });
  }

  select(id: string): void {
    this.selectedId.set(id);
    void this.load();
  }

  /** Jumps to a random chart from the list, never landing on the one already shown. */
  shuffle(): void {
    if (this.gallery.length < 2) return;
    let id = this.selectedId();
    while (id === this.selectedId()) id = this.gallery[Math.floor(Math.random() * this.gallery.length)].id;
    this.select(id);
  }

  reset(): void {
    void this.load();
  }

  /** Parses the editor content and renders it; SpecEditor highlights the offending line on failure. */
  apply(): void {
    try {
      const parsed = this.editor().parseJSON();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error.set('A specification must be a JSON object.');
        return;
      }
      this.error.set('');
      this.spec.set(parsed as Record<string, unknown>);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
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
    const entry = this.selected();
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
