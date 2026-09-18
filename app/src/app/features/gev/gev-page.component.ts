import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { type SensorMode, SENSORS, lutTable } from './tracks';
import type { GevScene } from './gev-scene';

/**
 * A spatial-intelligence console in the style of Bilawal Sidhu's God's Eye View — a vector globe
 * behind a circular aperture, framed by monospace classification chrome, with air, orbital and
 * seismic contacts labelled by leader lines.
 *
 * Nothing here is live: the tracks are a committed snapshot replayed forward locally, so the page
 * works with the network off. See `scripts/capture-gev-snapshot.mjs` for how it was captured and
 * `tracks.ts` for the propagation.
 *
 * The sensor modes are an SVG filter rather than a WebGL post pass. One `filter` declaration on
 * the stage grades the three.js globe and the canvas chrome together, with no render target, and
 * `feComponentTransfer` carries an arbitrary lookup table — so the real multi-hue ironbow ramp
 * survives, which a chain of `hue-rotate()` could not express. The tables come from `gradeLut`,
 * which is unit-tested, so the ramps are written down exactly once.
 */
@Component({
  selector: 'app-gev-page',
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>three.js · vector globe · snapshot replay</p>
      <h1 data-reveal>God's eye view</h1>
      <p class="lede" data-reveal>
        A spy-satellite console built on the FUI vocabulary the other three.js pages share. The
        globe is drawn from the TopoJSON world file already vendored for the Vega gallery — arcs as
        line segments, so coastlines and borders cost one draw call and no decoder. Aircraft are
        dead-reckoned from a captured frame, satellites propagated from their orbital elements.
        Drag to spin it; switch sensors below.
      </p>
    </section>

    <div class="card glass" data-reveal>
      <div class="card-head">
        <span class="eyebrow">KH11-4894 · OPS-4120</span>
        <h3>Spatial intelligence console</h3>
      </div>

      <div
        class="stage"
        #stage
        [style.filter]="stageFilter()"
        (pointermove)="onMove($event)"
        (pointerdown)="onDown($event)"
        (pointerup)="onUp()"
        (pointerleave)="onUp()"
      >
        <canvas #canvas></canvas>
        @if (mode() === 'crt') { <div class="scanlines"></div> }
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>

      <div class="tray" role="group" aria-label="Sensor mode">
        @for (s of sensors; track s.id) {
          <button type="button" class="preset" [class.on]="mode() === s.id" [attr.aria-pressed]="mode() === s.id" (click)="mode.set(s.id)">
            {{ s.label }}
          </button>
        }
      </div>

      <p class="note">
        After <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noopener">God's Eye View</a>
        by Bilawal Sidhu (MIT). This is an independent reimplementation of the look on this app's
        three.js stack — no upstream code and no CesiumJS. Contact data captured from adsb.lol,
        orbital elements from Celestrak, seismic events from USGS; each remains the property of its
        source.
      </p>
    </div>

    <!-- Sensor ramps as component-transfer tables. Generated from gradeLut so the ramp is not
         written down a second time in CSS. -->
    <svg class="defs" aria-hidden="true" focusable="false">
      <defs>
        @for (f of filters; track f.id) {
          <filter [attr.id]="'gev-' + f.id" color-interpolation-filters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" [attr.tableValues]="f.r" />
              <feFuncG type="table" [attr.tableValues]="f.g" />
              <feFuncB type="table" [attr.tableValues]="f.b" />
            </feComponentTransfer>
          </filter>
        }
      </defs>
    </svg>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.5rem, 3.2vw, 2.3rem); margin: 6px 0 10px; max-width: 900px; }
    .lede { color: var(--on-ink-dim); max-width: 860px; margin-bottom: 20px; }
    .card { padding: 14px 16px; }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-head h3 { font-size: 18px; }
    .stage { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--hairline); background: #05090c; touch-action: none; cursor: grab; }
    .stage:active { cursor: grabbing; }
    canvas { display: block; width: 100%; height: 100%; }
    .scanlines { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: multiply; background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.96) 0 2px, rgba(120,120,120,0.72) 2px 4px); }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }
    .tray { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
    .preset { font: 500 10px/1 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.14em; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--hairline); background: transparent; color: var(--on-ink-dim); cursor: pointer; transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
    .preset:hover { color: var(--on-ink); border-color: var(--teal); }
    .preset.on { color: var(--teal); border-color: var(--teal); }
    .note { margin-top: 12px; font-size: 12px; color: var(--on-ink-faint); max-width: 820px; }
    .note a { color: var(--teal); }
    .defs { position: absolute; width: 0; height: 0; }
  `,
})
export class GevPageComponent {
  readonly error = signal<string | null>(null);
  readonly mode = signal<SensorMode>('normal');
  readonly sensors = SENSORS;

  /** Only the recolouring modes need a filter element; the others are plain CSS or nothing. */
  readonly filters = SENSORS.filter((s) => s.lut > 0).map((s) => {
    const [r, g, b] = lutTable(s.id);
    return { id: s.id, r, g, b };
  });

  readonly stageFilter = computed(() => {
    const m = this.mode();
    if (m === 'crt') return 'saturate(1.3) contrast(1.12) brightness(1.04)';
    return SENSORS.find((s) => s.id === m)!.lut > 0 ? `url(#gev-${m})` : 'none';
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: GevScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => {
      this.scene?.dispose();
      this.resize?.disconnect();
    });
  }

  onMove(e: PointerEvent): void {
    const r = this.stage().nativeElement.getBoundingClientRect();
    this.scene?.track(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  }

  onDown(e: PointerEvent): void {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.scene?.setDragging(true);
  }

  onUp(): void {
    this.scene?.setDragging(false);
  }

  /** three.js is ~600 kB; it loads only when this page does, like the atlas viewer. */
  private async boot(): Promise<void> {
    try {
      const { GevScene } = await import('./gev-scene');
      const scene = new GevScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.stage().nativeElement;
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.stage().nativeElement);
      await scene.load();
      scene.start();
    } catch (err) {
      this.error.set(`The console could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
