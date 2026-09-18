import { Component, ElementRef, OnDestroy, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import type { MorphChartsHost } from './morphcharts-host';
import { isWebGpuAvailable } from '../webgpu/webgpu-support';

/**
 * Hosts a MorphCharts canvas. The renderer module (~700 kB) is imported lazily on first render
 * so pages without 3D scenes never pay for it. Emits the host once it is ready to accept specs.
 */
@Component({
  selector: 'app-morphcharts-canvas',
  template: `
    <div #container class="container" tabindex="0">
      <canvas #canvas [class.hidden]="!supported()"></canvas>
    </div>
  `,
  styles: `
    :host { display: block; position: relative; width: 100%; height: 100%; min-height: 240px; }
    .container { width: 100%; height: 100%; overflow: auto; outline: none; background: #0d151b; }
    canvas { display: block; touch-action: none; }
    canvas.hidden { display: none; }
  `,
})
export class MorphchartsCanvasComponent implements OnDestroy {
  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');
  readonly hostReady = output<MorphChartsHost>();
  readonly failed = output<string>();
  readonly supported = signal(isWebGpuAvailable());
  private host: MorphChartsHost | null = null;
  private readonly elementRef = inject(ElementRef);

  constructor() {
    afterNextRender(() => void this.create());
  }

  get container(): HTMLDivElement {
    return this.containerRef().nativeElement;
  }

  private async create(): Promise<void> {
    if (!this.supported()) {
      this.failed.emit('WebGPU is not available in this browser.');
      return;
    }
    try {
      const { MorphChartsHost } = await import('./morphcharts-host');
      this.host = new MorphChartsHost(this.canvasRef().nativeElement);
      await this.host.init();
      this.hostReady.emit(this.host);
    } catch (err) {
      this.failed.emit(err instanceof Error ? err.message : String(err));
    }
  }

  ngOnDestroy(): void {
    this.host?.dispose();
    this.host = null;
  }
}
