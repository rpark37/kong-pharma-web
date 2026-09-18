import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { GALLERY } from './vega-charts-specs';

/**
 * Vega-Lite gallery, ported from the a21-ares `vega-charts` component. Pick a chart, read its
 * specification, edit the JSON and re-render it.
 *
 * The port drops the original's Angular Material shell, its own vega.View embedding and its
 * light/dark toggle: rendering goes through the shared <app-vega-chart> (vega-embed + resize
 * observer) and the app is dark-only, so VEGA_DARK_CONFIG styles every chart.
 */
@Component({
  selector: 'app-vega-charts-page',
  imports: [VegaChartComponent, SpecEditorComponent],
  template: `
    <section class="head" data-reveal>
      <p class="eyebrow">Vega-Lite · grammar gallery</p>
      <h1>Chart gallery</h1>
      <p class="lede">
        Fifteen Vega-Lite specifications with their data inlined, so each one is a complete,
        readable example of the grammar. Pick a chart to load its spec into the editor, change
        anything, and apply it to re-render. Charts inherit the app's Vega theme rather than
        carrying their own styling.
      </p>
    </section>

    <section class="pick glass" data-reveal>
      @for (c of gallery; track c.id) {
        <button type="button" class="btn small" [class.active]="c.id === selectedId()" (click)="select(c.id)">
          {{ c.label }}
        </button>
      }
    </section>

    <section class="work" data-reveal>
      <div class="card glass">
        <div class="card-head">
          <h2>{{ selected().label }}</h2>
          <button type="button" class="btn small" (click)="shuffle()" title="Rebuild this chart's randomised sample">
            Shuffle data
          </button>
        </div>
        <app-vega-chart [spec]="spec()" [height]="selected().height ?? 330" />
      </div>

      <div class="card glass editor-card">
        <div class="card-head">
          <h2>Specification</h2>
          <div class="button-group">
            <button type="button" class="btn small" (click)="reset()">Reset</button>
            <button type="button" class="btn" (click)="apply()">Apply</button>
          </div>
        </div>
        <app-spec-editor #editor [value]="json()" />
        @if (error()) { <p class="err">{{ error() }}</p> }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1500px; margin: 0 auto; width: 100%; }
    .head { margin-bottom: 20px; }
    h1 { font-family: var(--font-display); font-size: clamp(1.9rem, 4vw, 2.9rem); margin: 6px 0 10px; }
    .lede { color: var(--on-ink-dim); max-width: 70ch; margin: 0; }
    .pick { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 14px; margin-bottom: 16px; }
    .work { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px; align-items: start; }
    .card { padding: 14px 16px; min-width: 0; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .card-head h2 { font-family: var(--font-display); font-size: 15px; margin: 0; }
    .button-group { display: flex; gap: 6px; }
    .editor-card { display: flex; flex-direction: column; }
    .err { color: var(--rose); font-size: 12px; font-family: var(--font-mono); margin: 8px 0 0; }
    @media (max-width: 1000px) { .work { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class VegaChartsPageComponent {
  readonly gallery = GALLERY;
  readonly selectedId = signal(GALLERY[0].id);
  readonly selected = computed(() => GALLERY.find((c) => c.id === this.selectedId()) ?? GALLERY[0]);
  /** The spec currently rendered — replaced wholesale by select/shuffle/apply. */
  readonly spec = signal<Record<string, unknown>>(GALLERY[0].spec());
  readonly error = signal('');
  readonly json = computed(() => JSON.stringify(this.spec(), null, 2));

  private readonly editor = viewChild.required(SpecEditorComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
    });
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.load();
  }

  /** Rebuilds the chart, which redraws the randomised sample sets. */
  shuffle(): void {
    this.load();
  }

  reset(): void {
    this.load();
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

  private load(): void {
    this.error.set('');
    this.spec.set(this.selected().spec());
    this.editor().setContent(this.json());
  }
}
