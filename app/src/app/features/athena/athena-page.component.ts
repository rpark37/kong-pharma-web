import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import type { AthenaScene } from './athena-scene';

/**
 * Control panels distributed through a volume with the camera travelling past them. The structural
 * difference from the other two three.js pages here: those compose on parallel planes, this one
 * mixes orientations so panels swing from edge-on to face-on as the camera moves.
 */
@Component({
  selector: 'app-athena-page',
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>three.js · bokeh pass</p>
      <h1 data-reveal>Volumetric control field</h1>
      <p class="lede" data-reveal>
        Twelve panels distributed through a volume on three orientation families, wired to spine
        rails by routed traces, with the camera flying a spline through the middle of it. Depth of
        field is a real postprocessing pass rather than baked blur, because the out-of-focus set has
        to change as the camera moves.
      </p>
    </section>

    <div class="card glass" data-reveal>
      <div class="card-head">
        <span class="eyebrow">CR-067 · lot release</span>
        <h3>Controls</h3>
      </div>
      <div class="stage" #stage (pointermove)="onMove($event)">
        <canvas #canvas></canvas>
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
      <p class="note">
        The build runs on a 13-second loop: rails draw on, panels arrive near to far, traces route
        between them, then the field settles and the counters go live.
      </p>
    </div>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.5rem, 3.2vw, 2.3rem); margin: 6px 0 10px; max-width: 900px; }
    .lede { color: var(--on-ink-dim); max-width: 860px; margin-bottom: 20px; }
    .card { padding: 14px 16px; }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-head h3 { font-size: 18px; }
    .stage { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--hairline); background: #0b1318; }
    canvas { display: block; width: 100%; height: 100%; }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }
    .note { margin-top: 12px; font-size: 12px; color: var(--on-ink-faint); max-width: 820px; }
  `,
})
export class AthenaPageComponent {
  readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: AthenaScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => { this.scene?.dispose(); this.resize?.disconnect(); });
  }

  onMove(e: PointerEvent): void {
    const r = this.stage().nativeElement.getBoundingClientRect();
    this.scene?.track(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  }

  private async boot(): Promise<void> {
    try {
      const { AthenaScene } = await import('./athena-scene');
      const scene = new AthenaScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.stage().nativeElement;
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.stage().nativeElement);
      scene.start();
    } catch (err) {
      this.error.set(`The control field could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
