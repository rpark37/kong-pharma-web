import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import type { HudScene } from './hud-scene';

/**
 * A layered holographic readout in three.js, in the technical/aerospace FUI idiom: uppercase mono,
 * dot-path identifiers, ring gauges, corner brackets, and a steady status bar surrounded by
 * peripheral jitter. Original composition on the labs palette — see `hud-panels.ts` for the
 * drawing vocabulary and `hud-scene.ts` for the depth and motion rules.
 */
@Component({
  selector: 'app-hud-page',
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>three.js · canvas textures</p>
      <h1 data-reveal>Holographic readout</h1>
      <p class="lede" data-reveal>
        Three canvas-painted planes at different depths, raked away from the camera. The off-focus
        layers are blurred in 2D rather than through a bokeh pass — one extra draw instead of a
        postprocessing chain. Move the pointer over the panel to shift the parallax.
      </p>
    </section>

    <div class="card glass" data-reveal>
      <div class="card-head">
        <span class="eyebrow">CR-067 · lattice resolve</span>
        <h3>Synthesis monitor</h3>
      </div>
      <div class="stage" #stage (pointermove)="onMove($event)">
        <canvas #canvas role="img" aria-label="Decorative animation: a layered holographic instrument readout, with counters, a timecode and tracking brackets drifting across three depth planes."></canvas>
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
      <p class="note">
        Every peripheral value moves — counters jitter, the timecode runs, the scientific constant
        types itself out, tracking brackets acquire and drop. The status bar never moves, which is
        what makes it read as the one thing that matters.
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
export class HudPageComponent {
  readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: HudScene | null = null;
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

  /** three.js is ~600 kB; it loads only when this page does, like the atlas viewer. */
  private async boot(): Promise<void> {
    try {
      const { HudScene } = await import('./hud-scene');
      const scene = new HudScene(this.canvas().nativeElement, this.gsap.reducedMotion);
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
      this.error.set(`The readout could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
