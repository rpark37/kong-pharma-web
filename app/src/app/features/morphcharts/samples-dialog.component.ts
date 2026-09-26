import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';

export interface SamplePlot { plot: string; title: string; description: string; thumbnail: string; image: string; notes?: string; }
export interface SampleCategory { title: string; description: string; plots: SamplePlot[]; }

export const SAMPLE_SPEC_FOLDER = 'samples/specs';
export const SAMPLE_IMAGE_FOLDER = 'samples/images';
export const UPSTREAM_IMAGE_BASE = 'https://raw.githubusercontent.com/microsoft/morphcharts/508deab66bb7e2dffe7f7cfc45ee6a06c4b6d8e9/client/wwwroot/public/samples/images';

/** The "Show Examples" grid from the MorphCharts client, scale-tweened in with GSAP. */
@Component({
  selector: 'app-samples-dialog',
  template: `
    <div class="backdrop" (click)="close.emit()" (keydown.escape)="close.emit()" (keydown.tab)="trapTab($event)">
      <div class="dialog glass" #dialog tabindex="-1" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="samples-title">
        <div class="head">
          <h2 id="samples-title">Examples</h2>
          <button type="button" class="btn small" (click)="close.emit()">Close</button>
        </div>
        <div class="body">
          @for (category of categories(); track category.title) {
            <h3>{{ category.title }}</h3>
            <p class="desc">{{ category.description }}</p>
            <div class="grid">
              @for (plot of category.plots; track plot.plot) {
                <button type="button" class="sample" (click)="pick.emit(plot)" [title]="plot.description">
                  <img [src]="imageFolder + '/' + plot.thumbnail" [alt]="plot.title" loading="lazy">
                  <span>{{ plot.title }}</span>
                </button>
              }
            </div>
          }
          @if (!categories().length) { <p class="desc">Loading examples…</p> }
        </div>
      </div>
    </div>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 30; background: rgba(6, 12, 16, 0.7); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .dialog { width: min(1100px, 100%); max-height: 100%; display: flex; flex-direction: column; overflow: hidden; outline: none; }
    .head h2 { font-size: 18px; }
    .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--hairline); }
    .body { overflow: auto; overscroll-behavior: contain; padding: 8px 18px 18px; }
    h3 { margin-top: 14px; font-size: 16px; }
    .desc { color: var(--on-ink-dim); font-size: 13px; margin: 2px 0 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
    .sample { display: flex; flex-direction: column; gap: 6px; padding: 0; border: 0; background: none; font: inherit; text-align: left; color: var(--on-ink); font-size: 13px; cursor: pointer; border-radius: var(--radius-sm); touch-action: manipulation; }
    .sample img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--hairline); transition: border-color var(--dur-fast) var(--ease-out); }
    .sample:hover img { border-color: var(--teal); }
    .sample:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
  `,
})
export class SamplesDialogComponent {
  readonly pick = output<SamplePlot>();
  readonly close = output<void>();
  readonly categories = signal<SampleCategory[]>([]);
  readonly imageFolder = SAMPLE_IMAGE_FOLDER;
  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  /** Tab cycles inside the dialog; the page behind it is not reachable until it closes. */
  trapTab(e: Event): void {
    const ev = e as KeyboardEvent;
    const focusable = [...this.dialog().nativeElement.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (ev.shiftKey && (document.activeElement === first || document.activeElement === this.dialog().nativeElement)) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  constructor() {
    this.http.get<SampleCategory[]>(`${SAMPLE_SPEC_FOLDER}/index.json`).subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([]),
    });
    afterNextRender(() => {
      const dialog = this.el.nativeElement.querySelector('.dialog');
      if (dialog) {
        this.gsap.kill(dialog);
        // Focus lands on the dialog itself once it is visible; the opener gets focus back on close.
        void this.gsap.reveal(dialog, { distance: 24, duration: this.gsap.MOTION.duration.base, delay: 0 }).then(() => (dialog as HTMLElement).focus());
      }
    });
  }
}
