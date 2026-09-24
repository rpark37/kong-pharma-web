import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import { ORIGIN, SITES } from './sites';
import type { MapScene } from './map-scene';

/**
 * The trial-site network as a tactical map: a raked plane, beams at each site, route arcs from
 * Lowell, and tracking callouts that follow their markers through the parallax. Shares its drawing
 * vocabulary with the holographic readout via `shared/fui/fui-panels.ts`.
 */
@Component({
  imports: [ConsoleStageComponent],
  selector: 'app-map-page',
  template: `
    <app-console-stage background="#0b1318" label="Site network map" (track)="scene?.track($event.nx, $event.ny)">
      <canvas #canvas role="img" aria-label="Decorative animation: a stylised world map on a raked plane, with the ten trial sites marked by beams and labelled callouts."></canvas>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div console-info>
        <p class="eyebrow">three.js · projected overlay · ATLAS.NET-02 · grid zone 48T</p>
        <p class="lede">
          {{ count }} nodes on a raked plane, with route arcs from Lowell. Each beam head is projected
          through the camera every frame, so the callouts track their markers rather than being painted
          into the map texture. The scan ring expands from the origin and locks sites as it passes.
        </p>
        <p class="note">
          Coordinates are the same trial-site network the marketing globe plots. Two render passes:
          perspective for the world, then an orthographic quad for the overlay.
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
export class MapPageComponent {
  readonly count = SITES.length + 1;
  readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: MapScene | null = null;
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
      const { MapScene } = await import('./map-scene');
      const scene = new MapScene(this.canvas().nativeElement, this.gsap.reducedMotion);
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
      this.error.set(`The map could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
