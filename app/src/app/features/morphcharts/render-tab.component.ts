import { Component, input, output, signal } from '@angular/core';
import type { MorphChartsHost, RenderMode } from '../../shared/morphcharts/morphcharts-host';
import { RENDER_MODES, SIZE_PRESETS } from '../../shared/morphcharts/morphcharts-host';

export type SizeType = 'fit' | 'hd' | 'fhd' | '4k' | '8k' | 'custom';
export interface ResizeRequest { type: SizeType; width: number; height: number; }

const RADIANS_PER_DEGREE = Math.PI / 180;
const DEGREES_PER_RADIAN = 180 / Math.PI;

/** The Render tab: size, render mode, camera/ray-tracing options. Mirrors the client's controls. */
@Component({
  selector: 'app-render-tab',
  template: `
    <div class="col">
      <label class="row"><input type="checkbox" [checked]="debug()" (change)="debugChange.emit($any($event.target).checked)"> Debug overlay</label>

      <div class="group">
        <span class="heading">Size</span>
        <div class="row wrap">
          @for (size of sizes; track size.value) {
            <label class="row" [class.dim]="size.disabled()">
              <input type="radio" name="size" [value]="size.value" [checked]="sizeType() === size.value" [disabled]="size.disabled()" (change)="sizeType.set(size.value)"> {{ size.label }}
            </label>
          }
          <input type="number" [disabled]="sizeType() !== 'custom'" [value]="customWidth()" (change)="customWidth.set(+$any($event.target).value)" aria-label="Width"> ×
          <input type="number" [disabled]="sizeType() !== 'custom'" [value]="customHeight()" (change)="customHeight.set(+$any($event.target).value)" aria-label="Height"> px
          <button type="button" class="btn small" (click)="requestResize()">Resize</button>
        </div>
        @if (sizeError()) { <p class="err">{{ sizeError() }}</p> }
      </div>

      <div class="group">
        <span class="heading">Mode</span>
        <div class="row wrap">
          @for (mode of modes; track mode) {
            <label class="row"><input type="radio" name="mode" [value]="mode" [checked]="renderMode() === mode" (change)="setRenderMode(mode)"> {{ modeLabel[mode] }}</label>
          }
        </div>
      </div>

      <div class="group">
        <div class="row"><label class="w">Max frames</label><input type="number" min="1" [value]="maxFrames()" (change)="setMaxFrames(+$any($event.target).value)"> <span class="val mono">{{ frameCount() }}</span></div>
        <div class="row"><label class="w">Field of view</label><input type="range" min="0" max="100" step="0.1" [value]="fov()" (input)="setFov(+$any($event.target).value)"><span class="val mono">{{ fov().toFixed(1) }}°</span></div>
        @if (renderMode() === 'raytrace' || renderMode() === 'color') {
          <div class="row"><label class="w">Aperture</label><input type="range" min="0" max="100" step="0.1" [value]="aperture()" (input)="setAperture(+$any($event.target).value)"><span class="val mono">{{ aperture().toFixed(1) }}mm</span></div>
          <div class="row"><label class="w">Focus distance</label><input type="range" min="0" max="4" step="0.01" [value]="focus()" (input)="setFocus(+$any($event.target).value)"><span class="val mono">{{ focus().toFixed(3) }}</span><button type="button" class="btn small" (click)="resetFocus()">Reset</button></div>
          <div class="row"><label class="w">Max bounces</label><input type="range" min="1" max="64" step="1" [value]="maxBounces()" (input)="setMaxBounces(+$any($event.target).value)"><span class="val mono">{{ maxBounces() }}</span></div>
        }
        @if (renderMode() === 'edge') {
          <div class="row"><label class="w">Thickness</label><input type="range" min="1" max="8" step="1" [value]="edgeThickness()" (input)="setEdgeThickness(+$any($event.target).value)"><span class="val mono">{{ edgeThickness() }}</span></div>
          <div class="row"><label class="w">Foreground</label><input type="color" [value]="edgeFg()" (input)="setEdgeColor('fg', $any($event.target).value)"></div>
          <div class="row"><label class="w">Background</label><input type="color" [value]="edgeBg()" (input)="setEdgeColor('bg', $any($event.target).value)"></div>
        }
        @if (renderMode() === 'depth') {
          <label class="row"><span class="w">Auto depth</span><input type="checkbox" [checked]="depthAuto()" (change)="setDepthAuto($any($event.target).checked)"></label>
          <div class="row"><label class="w">Min depth</label><input type="range" min="0" max="25" step="0.01" [disabled]="depthAuto()" [value]="depthMin()" (input)="setDepth('min', +$any($event.target).value)"><span class="val mono">{{ depthMin().toFixed(2) }}</span></div>
          <div class="row"><label class="w">Max depth</label><input type="range" min="0" max="25" step="0.01" [disabled]="depthAuto()" [value]="depthMax()" (input)="setDepth('max', +$any($event.target).value)"><span class="val mono">{{ depthMax().toFixed(2) }}</span></div>
        }
        @if (renderMode() === 'segment') {
          <div class="row"><label class="w">ID source</label>
            <label class="row"><input type="radio" name="idsource" value="segment" [checked]="idSource() === 'segment'" (change)="setIdSource('segment')"> Segment</label>
            <label class="row"><input type="radio" name="idsource" value="pick" [checked]="idSource() === 'pick'" (change)="setIdSource('pick')"> Pick</label>
          </div>
        }
      </div>

      <div class="group">
        <span class="heading">Camera</span>
        <div class="row wrap">
          <label class="row"><input type="radio" name="cam" value="perspective" [checked]="cameraMode() === 'perspective'" (change)="setCameraMode('perspective')"> Perspective</label>
          <label class="row"><input type="radio" name="cam" value="cylindrical" [checked]="cameraMode() === 'cylindrical'" (change)="setCameraMode('cylindrical')"> Cylindrical</label>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; padding: 8px 4px; font-size: 13px; }
    .col { display: flex; flex-direction: column; gap: 14px; }
    .group { display: flex; flex-direction: column; gap: 6px; }
    .heading { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--on-ink-dim); }
    .row { display: flex; align-items: center; gap: 8px; }
    .wrap { flex-wrap: wrap; }
    .w { width: 104px; color: var(--on-ink-dim); }
    .val { width: 56px; text-align: right; }
    .dim { opacity: 0.4; }
    .err { color: var(--rose); font-size: 12px; }
    input[type=number] { width: 72px; font: inherit; color: var(--on-ink); background: rgba(0,0,0,0.25); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; }
    input[type=range] { flex: 1; min-width: 80px; }
  `,
})
export class RenderTabComponent {
  readonly host = input<MorphChartsHost | null>(null);
  readonly frameCount = input(0);
  readonly debug = input(false);
  readonly debugChange = output<boolean>();
  readonly resizeRequest = output<ResizeRequest>();

  readonly modes = RENDER_MODES;
  readonly modeLabel: Record<RenderMode, string> = { raytrace: 'Ray', color: 'Color', normal: 'Normal', edge: 'Edge', depth: 'Depth', segment: 'Segment' };
  readonly sizeType = signal<SizeType>('hd');
  readonly customWidth = signal(1280);
  readonly customHeight = signal(720);
  readonly sizeError = signal<string | null>(null);
  readonly sizes: Array<{ value: SizeType; label: string; disabled: () => boolean }> = [
    { value: 'fit', label: 'Fit', disabled: () => false },
    { value: 'hd', label: 'HD', disabled: () => this.presetDisabled('hd') },
    { value: 'fhd', label: 'Full HD', disabled: () => this.presetDisabled('fhd') },
    { value: '4k', label: '4K', disabled: () => this.presetDisabled('4k') },
    { value: '8k', label: '8K', disabled: () => this.presetDisabled('8k') },
    { value: 'custom', label: 'Custom', disabled: () => false },
  ];

  readonly renderMode = signal<RenderMode>('raytrace');
  readonly maxFrames = signal(10000);
  readonly fov = signal(45);
  readonly aperture = signal(0);
  readonly focus = signal(1);
  readonly maxBounces = signal(8);
  readonly edgeThickness = signal(1);
  readonly edgeFg = signal('#000000');
  readonly edgeBg = signal('#ffffff');
  readonly depthAuto = signal(true);
  readonly depthMin = signal(0);
  readonly depthMax = signal(1);
  readonly idSource = signal<'segment' | 'pick'>('segment');
  readonly cameraMode = signal<'perspective' | 'cylindrical'>('perspective');

  /** Pull current values from the host (after init and after each spec load). */
  syncFromHost(): void {
    const h = this.host();
    if (!h) return;
    this.renderMode.set((h.renderer.renderMode as RenderMode) ?? 'raytrace');
    this.maxFrames.set(h.maxSamplesPerPixel);
    this.fov.set(h.camera.fov * DEGREES_PER_RADIAN);
    this.aperture.set(h.camera.aperture * 1000);
    this.focus.set(h.camera.focusDistance);
    this.maxBounces.set(h.renderer.maxBounceDepth);
    this.edgeThickness.set(h.renderer.edgeThickness);
    this.depthAuto.set(h.renderer.depthAuto);
    this.depthMin.set(h.renderer.depthMin);
    this.depthMax.set(h.renderer.depthMax);
    this.idSource.set((h.renderer.idSource as 'segment' | 'pick') ?? 'segment');
    this.cameraMode.set((h.renderer.cameraMode as 'perspective' | 'cylindrical') ?? 'perspective');
  }

  presetDisabled(key: string): boolean {
    const h = this.host();
    const preset = SIZE_PRESETS[key];
    if (!h || !preset) return false;
    return h.checkRenderSize(preset.width, preset.height) !== null;
  }

  requestResize(): void {
    const type = this.sizeType();
    this.sizeError.set(null);
    if (type === 'fit') { this.resizeRequest.emit({ type, width: 0, height: 0 }); return; }
    const size = type === 'custom' ? { width: this.customWidth(), height: this.customHeight() } : SIZE_PRESETS[type];
    if (!size || isNaN(size.width) || isNaN(size.height)) { this.sizeError.set('invalid size'); return; }
    const err = this.host()?.checkRenderSize(size.width, size.height) ?? null;
    if (err) { this.sizeError.set(err); return; }
    this.resizeRequest.emit({ type, ...size });
  }

  setRenderMode(mode: RenderMode): void { this.renderMode.set(mode); const h = this.host(); if (h) h.renderer.renderMode = mode; }
  setMaxFrames(v: number): void { if (!isNaN(v) && v > 0) { this.maxFrames.set(v); const h = this.host(); if (h) h.maxSamplesPerPixel = v; } }
  setFov(v: number): void { this.fov.set(v); const h = this.host(); if (h) h.camera.fov = v * RADIANS_PER_DEGREE; }
  setAperture(v: number): void { this.aperture.set(v); const h = this.host(); if (h) h.camera.aperture = v / 1000; }
  setFocus(v: number): void { this.focus.set(v); const h = this.host(); if (h) h.camera.focusDistance = v; }
  resetFocus(): void { const h = this.host(); if (h) { h.camera.focusDistance = h.defaultFocusDistance; this.focus.set(h.camera.focusDistance); } }
  setMaxBounces(v: number): void { this.maxBounces.set(v); const h = this.host(); if (h) h.renderer.maxBounceDepth = v; }
  setEdgeThickness(v: number): void { this.edgeThickness.set(v); const h = this.host(); if (h) h.renderer.edgeThickness = v; }
  setEdgeColor(which: 'fg' | 'bg', hex: string): void {
    const rgb = hexToRgb(hex);
    const h = this.host();
    if (which === 'fg') { this.edgeFg.set(hex); if (h) h.renderer.edgeForeground = [rgb[0], rgb[1], rgb[2], 1]; }
    else { this.edgeBg.set(hex); if (h) h.renderer.edgeBackground = [rgb[0], rgb[1], rgb[2], 1]; }
  }
  setDepthAuto(v: boolean): void { this.depthAuto.set(v); const h = this.host(); if (h) h.renderer.depthAuto = v; }
  setDepth(which: 'min' | 'max', v: number): void {
    const h = this.host();
    if (which === 'min') { this.depthMin.set(v); if (h) h.renderer.depthMin = v; } else { this.depthMax.set(v); if (h) h.renderer.depthMax = v; }
  }
  setIdSource(v: 'segment' | 'pick'): void { this.idSource.set(v); const h = this.host(); if (h) h.renderer.idSource = v; }
  setCameraMode(v: 'perspective' | 'cylindrical'): void { this.cameraMode.set(v); const h = this.host(); if (h) h.renderer.cameraMode = v; }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
