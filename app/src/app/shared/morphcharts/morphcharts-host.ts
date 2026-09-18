import { signal } from '@angular/core';
import * as Core from '@microsoft/morphcharts-core';
import * as Spec from '@microsoft/morphcharts-spec';
import * as WebGPURenderer from '@microsoft/morphcharts-webgpuraytrace';
import { ManipulationProcessor } from './input/manipulationprocessor';
import { Manipulator } from './input/manipulator';
import { MouseWheel } from './input/mousewheel';
import { Pointers } from './input/pointers';

export interface LoadSpecOptions {
  datasets?: Record<string, string>;
  images?: Record<string, string>;
  includeCamera?: boolean;
}

export interface SignalInfo { name: string; value: unknown; }
export interface DatasetInfo { name: string; dataset: Spec.Dataset; }

export interface SizePreset { width: number; height: number; }
export const SIZE_PRESETS: Record<string, SizePreset> = {
  hd: { width: 1280, height: 720 },
  fhd: { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
  '8k': { width: 7680, height: 4320 },
};

export const RENDER_MODES = ['raytrace', 'color', 'normal', 'edge', 'depth', 'segment'] as const;
export type RenderMode = (typeof RENDER_MODES)[number];

/** Camera and depth values mirrored for a debug overlay. */
export interface DebugSnapshot {
  frameCount: number;
  position: Core.Vector3;
  right: Core.Vector3;
  up: Core.Vector3;
  forward: Core.Vector3;
  origin: Core.Vector3;
  world: Core.Vector3;
  fov: number;
  aperture: number;
  focusDistance: number;
  depthMin: number;
  depthMax: number;
}

/**
 * One MorphCharts renderer bound to one canvas. This is the client page's `Main` class with the
 * DOM wiring removed: Angular components own the controls and call into this host, which owns the
 * renderer, the interactive camera, the pointer manipulation and the render loop.
 *
 * Analogy: the renderer is a film camera on a tripod. The host is the tripod head. Components are
 * the hands turning the knobs.
 */
export class MorphChartsHost {
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && (navigator as { gpu?: unknown }).gpu !== undefined;
  }

  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGPURenderer.Main;
  readonly camera: Core.Cameras.AltAzimuthPerspectiveCamera;
  plot: Spec.Plot | null = null;
  scene: Spec.IScene | null = null;

  // Reactive state for components
  readonly ready = signal(false);
  readonly running = signal(false);
  readonly frameCount = signal(0);
  readonly error = signal<string | null>(null);
  readonly fatal = signal(false);
  readonly hasMarks = signal(false);

  maxSamplesPerPixel: number = WebGPURenderer.Config.maxSamplesPerPixel;
  readonly defaultFocusDistance: number = Core.Config.cameraFocusDistance;
  tilesX = 1;
  tilesY = 1;
  tileOffsetX = 0;
  tileOffsetY = 0;
  autoTile = true;
  /** Called after each rendered frame with the elapsed milliseconds. */
  onFrame: ((elapsedMs: number) => void) | null = null;
  /** Called when rendering stops (max frames reached, error, or explicit stop). */
  onStop: (() => void) | null = null;
  /** Called when a capture is produced by the max-frames auto capture. */
  onCapture: ((blob: Blob, filename: string) => void) | null = null;

  private _initialized: Promise<void> | null = null;
  private _animationFrame = 0;
  private _previousTime = 0;
  private _frameCountTick = 0;
  private readonly _mouseWheel = new MouseWheel();
  private readonly _manipulators: Record<string, Manipulator> = {};
  private readonly _pointers = new Pointers(this._manipulators);
  private readonly _manipulationProcessor = new ManipulationProcessor({ dragToleranceSquared: 100, manipulatorMinRelativeDistanceSquared: 100 });
  private readonly _onBeforeUnload = () => this.renderer.dispose();
  private _disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this._mouseWheel.initialize(canvas);
    this._pointers.initialize(canvas);
    this.renderer = new WebGPURenderer.Main(canvas);
    this.renderer.deviceLostCallback = (reason: string, message: string) => {
      this.stop();
      this.fatal.set(true);
      this.error.set(`GPU device lost (${reason}). Please reload the page.${message ? ' ' + message : ''}`);
    };
    window.addEventListener('beforeunload', this._onBeforeUnload);
    this.camera = new Core.Cameras.AltAzimuthPerspectiveCamera({ width: this.renderer.width, height: this.renderer.height });
    this.renderer.depthAuto = Core.Config.depthAuto;
    this.renderer.depthMin = Core.Config.depthMin;
    this.renderer.depthMax = Core.Config.depthMax;
  }

  /** Initialises the GPU device and font atlas. Safe to call more than once. */
  init(): Promise<void> {
    if (!this._initialized) {
      this._initialized = this.renderer
        .initializeAsync({
          atlasOptions: { width: 4096, height: 4096, type: 'font' },
          glyphRasterizerOptions: { size: 192, border: 0x18, edgeValue: Core.Config.sdfBuffer, maxDistance: 0x40 },
        })
        .then(() => this.ready.set(true))
        .catch((err: unknown) => {
          this.fatal.set(true);
          this.error.set(err instanceof Error ? err.message : String(err));
          throw err;
        });
    }
    return this._initialized;
  }

  /** Null when the size is renderable, otherwise the reason it is not. */
  checkRenderSize(width: number, height: number): string | null {
    const maxPixels = this.renderer.maxPixels;
    const maxDim = this.renderer.maxRenderDim;
    const requested = (width + 1) * (height + 1);
    if (width > maxDim || height > maxDim) return `${width}x${height}px exceeds device per-dimension limit of ${maxDim}px`;
    if (requested > maxPixels) {
      return `${width}x${height}px (${requested.toLocaleString()} pixels) exceeds device max of ${Math.floor(maxPixels).toLocaleString()} pixels (~${Math.floor(Math.sqrt(maxPixels)).toLocaleString()}px square)`;
    }
    return null;
  }

  resize(width: number, height: number): void {
    this.renderer.width = width;
    this.renderer.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.width = width;
    this.camera.height = height;
  }

  /** Parses a spec, builds the scene and loads it into the renderer. */
  async loadSpec(json: unknown, options: LoadSpecOptions = {}): Promise<void> {
    await this.init();
    this.plot = await Spec.Plot.fromJSONAsync(json, { datasets: options.datasets ?? {}, images: options.images ?? {} });
    this.scene = await this.plot.createSceneAsync();
    this.renderer.loadScene(this.scene);
    if (options.includeCamera ?? true) this.resetCamera();
    this.hasMarks.set(this.renderer.bufferVisuals.length > 0 || this.renderer.labelSetVisuals.length > 0 || this.renderer.imageVisuals.length > 0);
    this.error.set(null);
  }

  resetCamera(): void {
    if (this.scene) this.camera.copyFrom(this.scene.camera);
  }

  start(): void {
    if (this.running() || this._disposed) return;
    this.error.set(null);
    this.renderer.tilesX = this.tilesX;
    this.renderer.tilesY = this.tilesY;
    this.renderer.tileOffsetX = this.tileOffsetX;
    this.renderer.tileOffsetY = this.tileOffsetY;
    this._mouseWheel.reset();
    if (this.renderer.frameCount >= this.maxSamplesPerPixel) this.renderer.frameCount = 0;
    this.running.set(true);
    this._previousTime = performance.now();
    this._animationFrame = requestAnimationFrame((t) => void this._tick(t));
  }

  stop(): void {
    const wasRunning = this.running();
    this.running.set(false);
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    this._animationFrame = 0;
    this.frameCount.set(this.renderer.frameCount);
    if (wasRunning) this.onStop?.();
  }

  /** Renders one frame if needed and returns the canvas as a PNG blob. */
  async capture(): Promise<{ blob: Blob; filename: string }> {
    await this.renderer.renderAsync(0);
    const filename = `${Core.Time.formatDate(new Date())}_${this.renderer.frameCount}spp`;
    const blob = await new Promise<Blob>((resolve, reject) => this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('capture failed'))), 'image/png'));
    return { blob, filename };
  }

  /** Renders a single frame without starting the loop (used after animating buffers). */
  async renderOnce(): Promise<void> {
    await this.init();
    this.camera.update(0);
    this.renderer.copyCamera(this.camera);
    await this.renderer.updateAsync(0);
    await this.renderer.renderAsync(0);
    this.frameCount.set(this.renderer.frameCount);
  }

  signals(): SignalInfo[] {
    const out: SignalInfo[] = [];
    if (this.plot) this._walkSignals(this.plot.root, out);
    return out;
  }

  datasets(): DatasetInfo[] {
    const out: DatasetInfo[] = [];
    if (this.plot) this._walkDatasets(this.plot.root, out);
    return out;
  }

  debugSnapshot(): DebugSnapshot {
    const world: Core.Vector3 = [0, 0, 0];
    if (this.plot) this.plot.cameraToWorldPosition(this.camera.position, world);
    return {
      frameCount: this.renderer.frameCount,
      position: this.camera.position,
      right: this.camera.right,
      up: this.camera.up,
      forward: this.camera.forward,
      origin: this.camera.manipulationOrigin,
      world,
      fov: this.camera.fov,
      aperture: this.camera.aperture,
      focusDistance: this.camera.focusDistance,
      depthMin: this.renderer.depthMin,
      depthMax: this.renderer.depthMax,
    };
  }

  /** Access to the pointer hover position (css px) for picking. */
  get hover(): { x: number | null; y: number | null } {
    return { x: this._pointers.hoverX, y: this._pointers.hoverY };
  }

  get isDragging(): boolean {
    return this._manipulationProcessor.isDragging;
  }

  dispose(): void {
    this._disposed = true;
    this.stop();
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    this._mouseWheel.dispose();
    this._pointers.dispose();
    this.renderer.dispose();
  }

  private async _tick(currentTime: number): Promise<void> {
    if (!this.running()) return;
    const elapsedTime = currentTime - this._previousTime;
    this._previousTime = currentTime;
    try {
      this._processManipulation(elapsedTime);
      this.camera.update(elapsedTime);
      this.renderer.copyCamera(this.camera);
      await this.renderer.updateAsync(elapsedTime);
      await this.renderer.renderAsync(elapsedTime);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.stop();
      return;
    }
    if (++this._frameCountTick % 5 === 0 || this.renderer.frameCount < 10) this.frameCount.set(this.renderer.frameCount);
    this.onFrame?.(elapsedTime);

    if (!this.running()) return;
    if (this.renderer.frameCount >= this.maxSamplesPerPixel) {
      const timestamp = Core.Time.formatDate(new Date());
      let filename = `${timestamp}_${this.renderer.frameCount}spp`;
      const totalTiles = this.tilesX * this.tilesY;
      if (totalTiles > 1) {
        filename = `${filename}_tile[${this.tileOffsetX},${this.tileOffsetY}]`;
        this.canvas.toBlob((blob) => blob && this.onCapture?.(blob, filename), 'image/png');
        if (!this.autoTile) { this.stop(); return; }
        let tileIndex = this.tileOffsetY * this.tilesX + this.tileOffsetX + 1;
        if (tileIndex < totalTiles) {
          tileIndex++;
          this.tileOffsetX++;
          if (this.tileOffsetX >= this.tilesX) { this.tileOffsetX = 0; this.tileOffsetY++; }
          this.renderer.tileOffsetX = this.tileOffsetX;
          this.renderer.tileOffsetY = this.tileOffsetY;
          this.renderer.frameCount = 0;
        } else { this.stop(); return; }
      } else {
        this.canvas.toBlob((blob) => blob && this.onCapture?.(blob, filename), 'image/png');
        this.stop();
        return;
      }
    }
    this._animationFrame = requestAnimationFrame((t) => void this._tick(t));
  }

  private _processManipulation(elapsedTime: number): void {
    this._mouseWheel.update();
    if (this._mouseWheel.delta !== 0) {
      this.camera.zoomWheel(this._mouseWheel.delta, this._pointers.hoverX ?? 0, this._pointers.hoverY ?? 0);
    }
    this._manipulationProcessor.update(elapsedTime, this._manipulators);
    const translationDelta = this._manipulationProcessor.translationDelta;
    if (this._manipulationProcessor.count === 1) {
      if (translationDelta[0] !== 0 || translationDelta[1] !== 0) {
        for (const key in this._manipulators) {
          const manipulator = this._manipulators[key];
          const rightButton = 2;
          if ((manipulator.type === 'mouse' && manipulator.button === rightButton) || manipulator.shiftKey || manipulator.ctrlKey) {
            this.camera.translate(translationDelta[0], translationDelta[1]);
          } else {
            this.camera.rotate(translationDelta[0], translationDelta[1]);
          }
          break;
        }
      }
    } else if (this._manipulationProcessor.scaleDelta !== 0) {
      this.camera.zoom(this._manipulationProcessor.scaleDelta, this._manipulationProcessor.centroid[0], this._manipulationProcessor.centroid[1]);
    }
  }

  private _walkSignals(group: Spec.Marks.Group, out: SignalInfo[]): void {
    const signals = (group as unknown as { signals?: Record<string, { value: unknown }> }).signals ?? {};
    for (const key in signals) out.push({ name: key, value: signals[key].value });
    const marks = (group as unknown as { marks?: unknown[] }).marks;
    if (marks) for (const child of marks) if (child instanceof Spec.Marks.Group) this._walkSignals(child, out);
  }

  private _walkDatasets(group: Spec.Marks.Group, out: DatasetInfo[]): void {
    const datasets = (group as unknown as { datasets?: Record<string, Spec.Dataset> }).datasets ?? {};
    for (const key in datasets) out.push({ name: key, dataset: datasets[key] });
    const marks = (group as unknown as { marks?: unknown[] }).marks;
    if (marks) for (const child of marks) if (child instanceof Spec.Marks.Group) this._walkDatasets(child, out);
  }
}

export { Core, Spec, WebGPURenderer };
