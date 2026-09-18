import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { GALLERY, type GalleryChart } from './vega-charts-specs';
import { VENDORED } from './vega-gallery-vendored';

const PANEL_MIN = 320;

/**
 * Vega-Lite gallery, ported from the a21-ares `vega-charts` component, laid out like the
 * MorphCharts client: chart on the left, draggable divider, spec panel on the right.
 *
 * The port drops the original's Angular Material shell, its own vega.View embedding and its
 * light/dark toggle: rendering goes through the shared <app-vega-chart> (vega-embed + resize
 * observer) and the app is dark-only, so VEGA_DARK_CONFIG styles every chart.
 */
@Component({
  selector: 'app-vega-charts-page',
  imports: [VegaChartComponent, SpecEditorComponent],
  template: `
    <div class="client">
      <div class="left">
        <app-vega-chart [spec]="spec()" [fill]="true" />
      </div>
      <div class="divider" (pointerdown)="startDivider($event)" role="separator" aria-orientation="vertical"></div>
      <div class="right" #right [style.width.px]="panelWidth()">
        <div class="panel-body">
          <label class="field">
            <span>Chart</span>
            <select [value]="selectedId()" (change)="select($any($event.target).value)">
              @for (g of groups; track g.name) {
                <optgroup [label]="g.name">
                  @for (c of g.items; track c.id) { <option [value]="c.id">{{ c.label }}</option> }
                </optgroup>
              }
            </select>
          </label>
          <div class="toolbar">
            <span class="spacer"></span>
            <button type="button" class="btn small" [disabled]="!selected().spec" (click)="shuffle()" title="Rebuild this chart's randomised sample">Shuffle</button>
            <button type="button" class="btn small" (click)="reset()">Reset</button>
            <button type="button" class="btn small" (click)="apply()">Apply</button>
          </div>
          <app-spec-editor #editor [value]="json()" />
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: calc(100vh - var(--nav-h)); }
    .client { display: flex; height: 100%; overflow: hidden; }
    .left { position: relative; flex: 1; min-width: 0; overflow: hidden; padding: 16px; }
    .divider { width: 6px; cursor: col-resize; background: var(--ink-3); border-left: 1px solid var(--hairline); }
    .divider:hover { background: var(--teal-deep); }
    .right { display: flex; flex-direction: column; min-width: ${PANEL_MIN}px; max-width: 70vw; background: var(--ink-2); border-left: 1px solid var(--hairline); }
    .panel-body { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 10px 12px; min-height: 0; }
    .toolbar { display: flex; align-items: center; gap: 6px; }
    .spacer { flex: 1; }
    app-spec-editor { flex: 1; min-height: 200px; }
    .err { color: var(--rose); font-size: 12px; font-family: var(--font-mono); margin: 0; }
    @media (max-width: 860px) {
      .client { flex-direction: column; }
      .divider { display: none; }
      .right { width: 100% !important; max-width: none; min-width: 0; height: 50%; }
    }
  `,
})
export class VegaChartsPageComponent {
  readonly gallery: GalleryChart[] = [...GALLERY, ...VENDORED];
  readonly groups = [
    { name: 'Built-in', items: GALLERY },
    { name: 'Specs', items: VENDORED.filter((c) => c.group === 'Specs') },
    { name: 'Examples', items: VENDORED.filter((c) => c.group === 'Examples') },
  ];
  readonly selectedId = signal(GALLERY[0].id);
  readonly selected = computed(() => this.gallery.find((c) => c.id === this.selectedId()) ?? GALLERY[0]);
  /** The spec currently rendered — replaced wholesale by select/shuffle/apply. */
  readonly spec = signal<Record<string, unknown>>(GALLERY[0].spec());
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
    });
  }

  select(id: string): void {
    this.selectedId.set(id);
    void this.load();
  }

  /** Rebuilds the chart, which redraws the randomised sample sets. */
  shuffle(): void {
    void this.load();
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
