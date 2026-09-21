import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import type { AthenaScene } from './athena-scene';

/**
 * The site map and the holographic readout merged into one instrument: the map's raked plane,
 * beams and projected tracking underneath, the readout's unit vocabulary laid over it.
 */
@Component({
  imports: [ConsoleStageComponent],
  selector: 'app-athena-page',
  template: `
    <!-- The painted tab strip owns the top-right band on this console, so the buttons go left. -->
    <app-console-stage background="#0b1318" label="Network console" actions="left" (track)="scene?.track($event.nx, $event.ny)">
      <canvas #canvas role="img" aria-label="Decorative animation: a network console, with perimeter gauges, channel panels and site readouts for the trial site network."></canvas>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div console-info>
        <p class="eyebrow">three.js · two render passes · ATLAS.NET-02 · grid zone 48T</p>
        <p class="lede">
          The site map and the readout combined. Underneath: a raked plane, a beam at each trial site,
          route arcs from Lowell and a scan ring that locks sites as it passes. Over it: the readout's
          units — hero numeral, the steady anchor bar, slab plates, instrument rail and running
          timecode. Callouts are projected from the beam heads each frame, so they track their markers
          through the parallax.
        </p>
        <p class="note">
          Everything peripheral jitters — counters, timecode, the typing constant, brackets acquiring
          and dropping — while the status bar holds perfectly still. That contrast is what makes the
          anchor read as the one thing that matters.
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
export class AthenaPageComponent {
  readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: AthenaScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => { this.scene?.dispose(); this.resize?.disconnect(); });
  }

  private async boot(): Promise<void> {
    try {
      const { AthenaScene } = await import('./athena-scene');
      const scene = new AthenaScene(this.canvas().nativeElement, this.gsap.reducedMotion);
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
      this.error.set(`The console could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
