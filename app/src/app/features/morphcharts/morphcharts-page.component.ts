import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GsapService } from '../../shared/animation/gsap.service';
import type { DebugSnapshot, MorphChartsHost, SignalInfo } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DataTabComponent } from './data-tab.component';
import { DebugOverlayComponent } from './debug-overlay.component';
import { RenderTabComponent, ResizeRequest } from './render-tab.component';
import { SAMPLE_SPEC_FOLDER, SamplePlot, SamplesDialogComponent } from './samples-dialog.component';
import { SignalsTabComponent } from './signals-tab.component';
import { SpecEditorComponent } from './spec-editor.component';
import { TileSettings, TilesTabComponent } from './tiles-tab.component';

const TABS = ['Plot', 'Render', 'Data', 'Signals', 'Tiles'] as const;
const LOADING_SHOW_DELAY = 200;
const LOADING_MIN_DISPLAY = 500;
const PANEL_MIN = 320;

/**
 * Recreation of https://microsoft.github.io/morphcharts/client.html: a path-traced canvas on the
 * left, a draggable divider, and a tabbed control panel on the right.
 */
@Component({
  selector: 'app-morphcharts-page',
  imports: [MorphchartsCanvasComponent, TabsComponent, WebGpuFallbackComponent, DataTabComponent, DebugOverlayComponent, RenderTabComponent, SamplesDialogComponent, SignalsTabComponent, SpecEditorComponent, TilesTabComponent],
  template: `
    <div class="client">
      <div class="left" #left>
        <app-morphcharts-canvas (hostReady)="onHostReady($event)" (failed)="onFailed($event)" />
        @if (debug() && debugSnapshot()) { <app-debug-overlay [snapshot]="debugSnapshot()" /> }
        @if (fallback()) {
          <div class="fallback-wrap">
            <app-webgpu-fallback title="MorphCharts needs WebGPU" image="samples/images/bar2_raytrace_640x360.jpg">
              <p class="small">{{ fallback() }}</p>
            </app-webgpu-fallback>
          </div>
        }
        <div class="loading glass" [class.show]="loadingVisible()" role="status">Rendering…</div>
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      </div>
      <div class="divider" (pointerdown)="startDivider($event)" role="separator" aria-orientation="vertical"></div>
      <div class="right" #right [style.width.px]="panelWidth()">
        <app-tabs [tabs]="tabs" [(active)]="activeTab" />
        <div class="tab-body" #tabBody>
          <div [hidden]="activeTab() !== 'Plot'" class="plot-tab">
            <div class="toolbar">
              <button type="button" class="btn small" [class.active]="running()" [disabled]="startDisabled()" (click)="toggleRun()">{{ running() ? 'Stop' : 'Start' }}</button>
              <button type="button" class="btn small" [disabled]="!running()" (click)="resetCamera()" title="Reset camera position">Reset</button>
              <button type="button" class="btn small" [disabled]="!host() || !hasScene()" (click)="capture()" title="Capture current frame">Capture</button>
              <span class="spacer"></span>
              <a href="#" (click)="$event.preventDefault(); showSamples.set(true)">Show examples</a>
            </div>
            <label class="row"><input type="checkbox" [checked]="includeCamera()" (change)="includeCamera.set($any($event.target).checked)"> Set camera from specification</label>
            <app-spec-editor #editor [(value)]="specText" (changed)="onSpecChanged()" />
          </div>
          <div [hidden]="activeTab() !== 'Render'">
            <app-render-tab #renderTab [host]="host()" [frameCount]="frameCount()" [debug]="debug()" (debugChange)="debug.set($event)" (resizeRequest)="onResize($event)" />
          </div>
          <div [hidden]="activeTab() !== 'Data'">
            <app-data-tab #dataTab />
          </div>
          <div [hidden]="activeTab() !== 'Signals'">
            <app-signals-tab [signals]="signals()" />
          </div>
          <div [hidden]="activeTab() !== 'Tiles'">
            <app-tiles-tab [current]="tiles()" (changed)="onTiles($event)" />
          </div>
        </div>
      </div>
    </div>
    @if (showSamples()) {
      <app-samples-dialog (pick)="loadSample($event)" (close)="showSamples.set(false)" />
    }
  `,
  styles: `
    :host { display: block; height: calc(100vh - var(--nav-h)); }
    .client { display: flex; height: 100%; overflow: hidden; }
    .left { position: relative; flex: 1; min-width: 0; overflow: hidden; }
    .fallback-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .divider { width: 6px; cursor: col-resize; background: var(--ink-3); border-left: 1px solid var(--hairline); }
    .divider:hover { background: var(--teal-deep); }
    .right { display: flex; flex-direction: column; min-width: ${PANEL_MIN}px; max-width: 70vw; background: var(--ink-2); border-left: 1px solid var(--hairline); }
    .tab-body { flex: 1; overflow: auto; padding: 10px 12px; }
    .plot-tab { display: flex; flex-direction: column; gap: 10px; height: 100%; }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .spacer { flex: 1; }
    .row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--on-ink-dim); }
    app-spec-editor { flex: 1; min-height: 300px; }
    .loading { position: absolute; left: 50%; bottom: 16px; transform: translate(-50%, 12px); padding: 6px 14px; font-size: 13px; opacity: 0; pointer-events: none; transition: opacity 0.2s var(--ease-out) ${LOADING_SHOW_DELAY}ms, transform 0.2s var(--ease-out) ${LOADING_SHOW_DELAY}ms; }
    .loading.show { opacity: 1; transform: translate(-50%, 0); }
    .error { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(239,122,138,0.16); border: 1px solid rgba(239,122,138,0.5); color: var(--on-ink); font-size: 13px; }
    @media (max-width: 860px) {
      .client { flex-direction: column; }
      .divider { display: none; }
      .right { width: 100% !important; max-width: none; min-width: 0; height: 50%; }
    }
  `,
})
export class MorphchartsPageComponent {
  readonly tabs = TABS;
  readonly activeTab = signal<string>('Plot');
  readonly host = signal<MorphChartsHost | null>(null);
  readonly fallback = signal<string | null>(null);
  readonly specText = signal('{}');
  readonly includeCamera = signal(true);
  readonly showSamples = signal(false);
  readonly debug = signal(false);
  readonly debugSnapshot = signal<DebugSnapshot | null>(null);
  readonly signals = signal<SignalInfo[]>([]);
  readonly panelWidth = signal(480);
  readonly tiles = signal<TileSettings>({ tilesX: 1, tilesY: 1, tileOffsetX: 0, tileOffsetY: 0, autoTile: true });
  readonly loadingVisible = signal(false);
  readonly hasScene = signal(false);

  readonly running = computed(() => this.host()?.running() ?? false);
  readonly frameCount = computed(() => this.host()?.frameCount() ?? 0);
  readonly error = computed(() => this.host()?.error() ?? null);
  readonly startDisabled = computed(() => !this.host() || (this.host()?.fatal() ?? false) || (!this.running() && this.specText().trim().length === 0));

  private readonly editor = viewChild.required(SpecEditorComponent);
  private readonly renderTab = viewChild.required(RenderTabComponent);
  private readonly dataTab = viewChild.required(DataTabComponent);
  private readonly left = viewChild.required<ElementRef<HTMLDivElement>>('left');
  private readonly right = viewChild.required<ElementRef<HTMLDivElement>>('right');
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly gsap = inject(GsapService);
  private readonly destroyRef = inject(DestroyRef);
  private hasSpecChanged = true;
  private loadingShownAt = 0;
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;
  private sizeType: ResizeRequest['type'] = 'hd';
  private pendingSample: string | null = null;

  constructor() {
    const sample = this.route.snapshot.queryParamMap.get('plot') ?? this.route.snapshot.queryParamMap.get('spec');
    if (sample) this.pendingSample = sample;
    afterNextRender(() => {
      this.gsap.slideIn(this.right().nativeElement, 'right', this.gsap.MOTION.delay.medium);
      if (this.pendingSample) void this.loadSampleFile(this.pendingSample);
    });
    this.destroyRef.onDestroy(() => this.host()?.dispose());
  }

  onHostReady(host: MorphChartsHost): void {
    host.onFrame = () => { if (this.debug()) this.debugSnapshot.set(host.debugSnapshot()); };
    host.onStop = () => this.hideLoading();
    host.onCapture = (blob, filename) => this.download(blob, filename);
    this.host.set(host);
    this.applySize('hd');
    this.renderTab().syncFromHost();
  }

  onFailed(message: string): void {
    this.fallback.set(message);
  }

  onSpecChanged(): void {
    this.hasSpecChanged = true;
  }

  async toggleRun(): Promise<void> {
    const host = this.host();
    if (!host) return;
    if (host.running()) { host.stop(); return; }
    this.showLoading();
    await new Promise((r) => setTimeout(r, 0));
    try {
      if (this.hasSpecChanged) {
        const json = this.editor().parseJSON();
        const data = this.dataTab();
        await host.loadSpec(json, { datasets: data.datasetsByFile, images: data.imagesByFile, includeCamera: this.includeCamera() });
        data.update(host.datasets());
        this.signals.set(host.signals());
        this.renderTab().syncFromHost();
        this.hasScene.set(true);
        this.hasSpecChanged = false;
      }
      if (host.hasMarks()) {
        host.start();
      } else {
        host.error.set('no marks to render');
        this.hideLoading();
      }
    } catch (err) {
      host.error.set(err instanceof Error ? err.message : String(err));
      this.hideLoading();
    }
  }

  resetCamera(): void {
    this.host()?.resetCamera();
    this.renderTab().syncFromHost();
  }

  async capture(): Promise<void> {
    const host = this.host();
    if (!host) return;
    const { blob, filename } = await host.capture();
    this.download(blob, filename);
  }

  onResize(req: ResizeRequest): void {
    this.sizeType = req.type;
    this.applySize(req.type, req.width, req.height);
  }

  onTiles(t: TileSettings): void {
    this.tiles.set(t);
    const host = this.host();
    if (host) { host.tilesX = t.tilesX; host.tilesY = t.tilesY; host.tileOffsetX = t.tileOffsetX; host.tileOffsetY = t.tileOffsetY; host.autoTile = t.autoTile; }
  }

  loadSample(plot: SamplePlot): void {
    this.showSamples.set(false);
    void this.loadSampleFile(plot.plot);
  }

  startDivider(e: PointerEvent): void {
    const startX = e.clientX;
    const startWidth = this.right().nativeElement.clientWidth;
    const move = (ev: PointerEvent) => this.panelWidth.set(Math.max(startWidth - (ev.clientX - startX), PANEL_MIN));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); if (this.sizeType === 'fit') this.applySize('fit'); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private async loadSampleFile(name: string): Promise<void> {
    const file = name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
    try {
      const text = await new Promise<string>((resolve, reject) => this.http.get(`${SAMPLE_SPEC_FOLDER}/${file}`, { responseType: 'text' }).subscribe({ next: resolve, error: reject }));
      this.editor().setContent(text);
      this.hasSpecChanged = true;
    } catch {
      this.host()?.error.set(`could not load sample ${file}`);
    }
  }

  private applySize(type: ResizeRequest['type'], width = 0, height = 0): void {
    const host = this.host();
    if (!host) return;
    if (type === 'fit') {
      const el = this.left().nativeElement;
      width = Math.max(64, el.clientWidth - 1);
      height = Math.max(64, el.clientHeight - 1);
    } else if (type !== 'custom') {
      const preset = { hd: [1280, 720], fhd: [1920, 1080], '4k': [3840, 2160], '8k': [7680, 4320] }[type];
      if (preset) [width, height] = preset;
    }
    if (width > 0 && height > 0) host.resize(width, height);
  }

  private showLoading(): void {
    this.loadingShownAt = performance.now();
    this.loadingVisible.set(true);
  }

  private hideLoading(): void {
    if (this.loadingTimeout) { clearTimeout(this.loadingTimeout); this.loadingTimeout = null; }
    if (!this.loadingVisible()) return;
    const elapsed = performance.now() - this.loadingShownAt;
    if (elapsed < LOADING_SHOW_DELAY) { this.loadingVisible.set(false); return; }
    const remaining = LOADING_MIN_DISPLAY - (elapsed - LOADING_SHOW_DELAY);
    if (remaining > 0) this.loadingTimeout = setTimeout(() => this.loadingVisible.set(false), remaining);
    else this.loadingVisible.set(false);
  }

  private download(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
}
