import { Component, ElementRef, OnDestroy, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type { MorphChartsHost, RenderMode } from './morphcharts-host';
import { MorphchartsCanvasComponent } from './morphcharts-canvas.component';
import { WebGpuFallbackComponent } from '../webgpu/webgpu-fallback.component';

/**
 * A self-running MorphCharts scene for a spec object: sizes the canvas to its container, loads
 * the spec, starts the render loop and stops after `maxFrames`. Pages that only need "show this
 * spec" use this instead of the full client page.
 */
@Component({
  selector: 'app-morphcharts-scene',
  imports: [MorphchartsCanvasComponent, WebGpuFallbackComponent],
  template: `
    <div class="scene" #wrap>
      @if (!failed()) {
        <app-morphcharts-canvas [label]="label()" (hostReady)="onHost($event)" (failed)="failed.set($event)" />
        @if (status()) { <span class="status mono" aria-hidden="true">{{ status() }}</span> }
        <div class="hint" aria-hidden="true">{{ hint() }}</div>
      } @else {
        <app-webgpu-fallback [title]="fallbackTitle()" [image]="fallbackImage()"><ng-content /></app-webgpu-fallback>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; }
    .scene { position: relative; width: 100%; height: 100%; min-height: 320px; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--hairline); background: var(--ink-2); }
    app-morphcharts-canvas { position: absolute; inset: 0; }
    .status { position: absolute; top: 10px; right: 12px; font-size: 11px; color: var(--on-ink-faint); }
    .hint { position: absolute; bottom: 8px; left: 12px; font-size: 11px; color: var(--on-ink-faint); pointer-events: none; }
  `,
})
export class MorphchartsSceneComponent implements OnDestroy {
  readonly spec = input<Record<string, unknown> | null>(null);
  readonly datasets = input<Record<string, string>>({});
  readonly renderMode = input<RenderMode>('raytrace');
  readonly maxFrames = input(400);
  /** Accessible name for the canvas. Empty means the page names it some other way. */
  readonly label = input('');
  /** Pointer hint shown in the corner; pages with a camera panel say so, since that is the keyboard route. */
  readonly hint = input('Drag to orbit · right-drag to pan · wheel to zoom');
  readonly fallbackTitle = input('This scene needs WebGPU');
  readonly fallbackImage = input<string | null>(null);
  readonly hostReady = output<MorphChartsHost>();
  readonly loaded = output<MorphChartsHost>();
  readonly failed = signal<string | null>(null);
  readonly status = signal('');
  private readonly wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');
  private readonly canvasCmp = viewChild(MorphchartsCanvasComponent);
  private host: MorphChartsHost | null = null;
  private resize: ResizeObserver | null = null;
  private readonly el = inject(ElementRef);

  constructor() {
    effect(() => {
      const spec = this.spec();
      const datasets = this.datasets();
      untracked(() => void this.load(spec, datasets));
    });
  }

  onHost(host: MorphChartsHost): void {
    this.host = host;
    host.renderer.renderMode = this.renderMode();
    host.maxSamplesPerPixel = this.maxFrames();
    host.onFrame = () => this.status.set(`${host.renderer.frameCount} spp`);
    host.onStop = () => this.status.set(`${host.renderer.frameCount} spp · paused`);
    this.fit();
    this.resize = new ResizeObserver(() => { this.fit(); if (this.host?.plot && !this.host.running()) this.host.start(); });
    this.resize.observe(this.wrap().nativeElement);
    this.hostReady.emit(host);
    void this.load(this.spec(), this.datasets());
  }

  private fit(): void {
    const host = this.host;
    if (!host) return;
    const el = this.wrap().nativeElement;
    const w = Math.max(64, Math.floor(el.clientWidth));
    const h = Math.max(64, Math.floor(el.clientHeight));
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const rw = Math.floor(w * dpr);
    const rh = Math.floor(h * dpr);
    if (host.checkRenderSize(rw, rh)) host.resize(w, h); else host.resize(rw, rh);
    host.canvas.style.width = `${w}px`;
    host.canvas.style.height = `${h}px`;
  }

  private async load(spec: Record<string, unknown> | null, datasets: Record<string, string>): Promise<void> {
    const host = this.host;
    if (!host || !spec) return;
    try {
      host.stop();
      await host.loadSpec(spec, { datasets, includeCamera: true });
      host.renderer.renderMode = this.renderMode();
      host.renderer.frameCount = 0;
      this.loaded.emit(host);
      if (host.hasMarks()) host.start();
    } catch (err) {
      this.failed.set(err instanceof Error ? err.message : String(err));
    }
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }
}
