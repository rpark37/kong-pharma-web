import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import type { HudScene } from './hud-scene';

/**
 * A layered holographic readout in three.js, in the technical/aerospace FUI idiom: uppercase mono,
 * dot-path identifiers, ring gauges, corner brackets, and a steady status bar surrounded by
 * peripheral jitter. Original composition on the labs palette — see `hud-panels.ts` for the
 * drawing vocabulary and `hud-scene.ts` for the depth and motion rules.
 */
@Component({
  imports: [ConsoleStageComponent],
  selector: 'app-hud-page',
  template: `
    <app-console-stage background="#0b1318" label="Holographic readout" (track)="scene?.track($event.nx, $event.ny)">
      <canvas #canvas role="img" aria-label="Decorative animation: a layered holographic instrument readout, with counters, a timecode and tracking brackets drifting across three depth planes."></canvas>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div console-info>
        <p class="eyebrow">three.js · canvas textures · CR-067 lattice resolve</p>
        <p class="lede">
          Three canvas-painted planes at different depths, raked away from the camera. The off-focus
          layers are blurred in 2D rather than through a bokeh pass — one extra draw instead of a
          postprocessing chain. Move the pointer over the panel to shift the parallax.
        </p>
        <p class="note">
          Every peripheral value moves — counters jitter, the timecode runs, the scientific constant
          types itself out, tracking brackets acquire and drop. The status bar never moves, which is
          what makes it read as the one thing that matters.
        </p>
      </div>
    </app-console-stage>
  `,
  styles: `
    :host { display: block; }
    canvas { display: block; width: 100%; height: 100%; }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }
  `,
})
export class HudPageComponent {
  readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: HudScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => { this.scene?.dispose(); this.resize?.disconnect(); });
  }

  /** three.js is ~600 kB; it loads only when this page does, like the atlas viewer. */
  private async boot(): Promise<void> {
    try {
      const { HudScene } = await import('./hud-scene');
      const scene = new HudScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.console().stageElement();
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.console().stageElement());
      scene.start();
    } catch (err) {
      this.error.set(`The readout could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
