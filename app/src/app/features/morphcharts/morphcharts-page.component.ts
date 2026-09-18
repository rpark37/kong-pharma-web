import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GsapService } from '../../shared/animation/gsap.service';
import type { DebugSnapshot, MorphChartsHost, SignalInfo } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DataTabComponent } from './data-tab.component';
import { DebugOverlayComponent } from './debug-overlay.component';
import { RenderTabComponent, ResizeRequest } from './render-tab.component';
import { SAMPLE_SPEC_FOLDER, SamplePlot, SamplesDialogComponent } from './samples-dialog.component';
import { SignalsTabComponent } from './signals-tab.component';
import { SpecEditorComponent } from '../../shared/ui/spec-editor.component';
import { TileSettings, TilesTabComponent } from './tiles-tab.component';

const PANEL_MIN = 320;
const DEFAULT_SAMPLE = 'line4'; // "Multi Series Line Chart" — generated in-spec, so it needs no data file

/**
 * Recreation of https://microsoft.github.io/morphcharts/client.html: a path-traced canvas on the
 * left, a draggable divider, and a tabbed control panel on the right.
 */
@Component({
  selector: 'app-morphcharts-page',
  imports: [MorphchartsCanvasComponent, WebGpuFallbackComponent, DataTabComponent, DebugOverlayComponent, RenderTabComponent, SamplesDialogComponent, SignalsTabComponent, SpecEditorComponent, TilesTabComponent],
  template: `
    <section class="head">
      <p class="eyebrow">morphcharts · webgpu path tracer</p>
    </section>

    <div class="client chart-shell" [style.gridTemplateColumns]="'1fr 6px ' + panelWidth() + 'px'">
      <div class="chart-column">
        <div class="chart-toolbar">
          <button type="button" class="btn small" [class.active]="running()" [disabled]="startDisabled()" (click)="toggleRun()">{{ running() ? 'Stop' : 'Start' }}</button>
          <button type="button" class="btn small" [disabled]="!running()" (click)="resetCamera()" title="Reset camera position">Reset</button>
          <button type="button" class="btn small" [disabled]="!host() || !hasScene()" (click)="capture()" title="Capture current frame">Capture</button>
          <h1>MorphCharts</h1>
          <span class="spacer"></span>
          <a href="#" (click)="$event.preventDefault(); showSamples.set(true)">Show examples</a>
        </div>
        <div class="chart-stage" #left>
          <app-morphcharts-canvas (hostReady)="onHostReady($event)" (failed)="onFailed($event)" />
          @if (debug() && debugSnapshot()) { <app-debug-overlay [snapshot]="debugSnapshot()" /> }
          @if (fallback()) {
            <div class="fallback-wrap">
              <app-webgpu-fallback title="MorphCharts needs WebGPU" image="samples/images/bar2_raytrace_640x360.jpg">
                <p class="small">{{ fallback() }}</p>
              </app-webgpu-fallback>
            </div>
          }
          @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        </div>
      </div>

      <div class="chart-divider" (pointerdown)="startDivider($event)" role="separator" aria-orientation="vertical"></div>

      <div class="chart-column" #right>
        <!-- The five panels have always existed behind activeTab; until now nothing switched it. -->
        <div class="tabs" role="tablist" aria-label="Control panels">
          @for (t of tabs; track t) {
            <button type="button" class="btn small" role="tab" [class.active]="activeTab() === t"
                    [attr.aria-selected]="activeTab() === t" (click)="activeTab.set(t)">{{ t }}</button>
          }
        </div>
        <div class="tab-body" #tabBody>
          <div [hidden]="activeTab() !== 'Plot'" class="plot-tab">
            <div class="chart-pane-head">
              <span class="eyebrow">Specification</span>
              <span class="row">
                <label class="row"><input type="checkbox" [checked]="includeCamera()" (change)="includeCamera.set($any($event.target).checked)"> Set camera from specification</label>
                <button type="button" class="btn small" [disabled]="startDisabled()" (click)="applySpec()">Apply this spec</button>
              </span>
            </div>
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
    /* Shell, stage, panes, toolbar and divider come from styles.scss. */
    :host { display: block; height: calc(100vh - var(--nav-h)); display: flex; flex-direction: column; }
    .head { padding: clamp(0.75rem, 2vh, 1.1rem) var(--pad-x) 0; }
    app-morphcharts-canvas { position: absolute; inset: 0; }
    .fallback-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
    .small { font-size: 12px; color: var(--on-ink-faint); }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .tab-body { flex: 1; overflow: auto; min-height: 0; }
    .plot-tab { display: flex; flex-direction: column; gap: 8px; height: 100%; }
    /* display:flex on .plot-tab outranks the hidden attribute's own display:none, so the panel
       stayed laid out behind whichever tab was chosen. Latent until the switcher existed: Plot
       was always the active tab. */
    .tab-body > [hidden] { display: none !important; }
    .row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--on-ink-dim); }
    app-spec-editor { flex: 1; min-height: 240px; }
    .error { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(179,38,30,0.12); border: 1px solid rgba(179,38,30,0.45); color: var(--on-ink); font-size: 13px; }
    @media (max-width: 860px) {
      :host { height: auto; }
      .client { grid-template-columns: 1fr !important; }
      .chart-divider { display: none; }
      .chart-stage { min-height: 55vh; }
    }
  `,
})
export class MorphchartsPageComponent {
  readonly tabs = ['Plot', 'Render', 'Data', 'Signals', 'Tiles'] as const;
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
  private sizeType: ResizeRequest['type'] = 'fit';
  private pendingSample: string | null = null;
  private autoStart = true;
  private specReady = false;
  private pickToken = 0;

  constructor() {
    this.pendingSample = this.route.snapshot.queryParamMap.get('plot') ?? this.route.snapshot.queryParamMap.get('spec') ?? DEFAULT_SAMPLE;
    afterNextRender(() => {
      this.gsap.slideIn(this.right().nativeElement, 'right', this.gsap.MOTION.delay.medium);
      void this.loadSampleFile(this.pendingSample!).then((ok) => { if (ok) { this.specReady = true; this.maybeAutoStart(); } });
    });
    // 'fit' sizes the renderer to the pane, so it has to follow the window too — the divider's
    // pointerup only covers the panel being dragged. Debounced because resizing a path-traced
    // canvas restarts its convergence.
    let refit: ReturnType<typeof setTimeout> | null = null;
    const onWindowResize = () => {
      if (this.sizeType !== 'fit') return;
      if (refit) clearTimeout(refit);
      refit = setTimeout(() => this.applySize('fit'), 150);
    };
    window.addEventListener('resize', onWindowResize);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', onWindowResize);
      if (refit) clearTimeout(refit);
      this.host()?.dispose();
    });
  }

  onHostReady(host: MorphChartsHost): void {
    host.onFrame = () => { if (this.debug()) this.debugSnapshot.set(host.debugSnapshot()); };
    host.onCapture = (blob, filename) => this.download(blob, filename);
    this.host.set(host);
    this.applySize('fit');
    this.renderTab().syncFromHost();
    this.maybeAutoStart();
  }

  /** Renders the sample we loaded on arrival, once both it and the WebGPU host are ready (either can win the race). */
  private maybeAutoStart(): void {
    if (!this.autoStart || !this.specReady || !this.host()) return;
    this.autoStart = false;
    void this.run();
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
    await this.run();
  }

  /** Compiles the current spec if it changed, then starts the render loop. */
  private async run(): Promise<void> {
    const host = this.host();
    if (!host) return;
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
      }
    } catch (err) {
      host.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Recompiles whatever is in the editor and renders it, the same way picking an example does.
   * Without this, an edit only took effect on the next Stop/Start: the running loop holds the
   * scene built from the previous spec, and `run()` skips recompilation while it is running.
   */
  async applySpec(): Promise<void> {
    this.host()?.stop();
    this.hasSpecChanged = true;
    await this.run();
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
    void this.pickSample(plot.plot);
  }

  /**
   * Picking an example always leaves it running. The previous scene's loop is stopped first,
   * and `loadSpec()` resets the camera on our behalf when "Set camera from specification" is on.
   * `pickToken` drops a load whose example was superseded mid-flight, so the newest pick wins.
   */
  private async pickSample(name: string): Promise<void> {
    const token = ++this.pickToken;
    this.host()?.stop();
    const ok = await this.loadSampleFile(name);
    if (!ok || token !== this.pickToken) return;
    await this.run();
  }

  startDivider(e: PointerEvent): void {
    const startX = e.clientX;
    const startWidth = this.right().nativeElement.clientWidth;
    const move = (ev: PointerEvent) => this.panelWidth.set(Math.max(startWidth - (ev.clientX - startX), PANEL_MIN));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); if (this.sizeType === 'fit') this.applySize('fit'); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  /** Returns false if the fetch failed, so callers do not start the spec still in the editor. */
  private async loadSampleFile(name: string): Promise<boolean> {
    const file = name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
    try {
      const text = await new Promise<string>((resolve, reject) => this.http.get(`${SAMPLE_SPEC_FOLDER}/${file}`, { responseType: 'text' }).subscribe({ next: resolve, error: reject }));
      this.editor().setContent(text);
      this.hasSpecChanged = true;
      return true;
    } catch {
      this.host()?.error.set(`could not load sample ${file}`);
      return false;
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
