import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import type { AthenaScene } from './athena-scene';

/**
 * An input deck with instrument windows growing out of it on a branching tree. The structural idea
 * is causality: a branch reaches a place, and a window opens there — rather than windows appearing
 * on timers that merely look sequenced.
 */
@Component({
  selector: 'app-athena-page',
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>three.js · bokeh pass</p>
      <h1 data-reveal>Console and branch tree</h1>
      <p class="lede" data-reveal>
        An input deck with instrument windows growing out of it on a branching tree. Branches root
        at the keyboard and fork outward, and each window opens as its branch arrives rather than on
        a timer, so the build reads as causal. Depth of field is a real postprocessing pass, because
        the out-of-focus set changes as the camera pushes in.
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
        The build runs on a 13-second loop: the deck lights, the tree grows out from it fork by
        fork, and each instrument window opens as its branch lands.
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
