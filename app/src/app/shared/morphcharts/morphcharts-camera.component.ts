import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { GlyphComponent } from '../ui/glyph.component';
import type { CameraRig } from './camera-rig';
import type { RenderMode } from './morphcharts-host';

/**
 * The camera controls every path-traced view shares: view presets, a dolly, a slow orbit and the
 * render mode, driving a `CameraRig`. Segmented rails in the same instrument vocabulary as the
 * Bayes panel; `layout="row"` lays the rails out in one line for a toolbar or a card foot.
 */
@Component({
  selector: 'app-morphcharts-camera',
  imports: [DecimalPipe, GlyphComponent],
  host: { '[class.row]': 'layout() === "row"' },
  template: `
    @if (rig(); as r) {
      <p class="label" title="Controls set the camera from its reset pose; drag the view to fine-tune"><app-glyph name="camera" />Camera</p>
      <small class="sr-only" id="cam-help">Controls set the camera from its reset pose; drag the view to fine-tune.</small>
      <small class="sr-only" id="cam-zoom-help">Dolly the camera in or out.</small>
      <div class="keyrail" role="group" aria-label="View" aria-describedby="cam-help">
        @for (v of r.views; track v.id) {
          <button type="button" class="key" [class.on]="r.view() === v.id" [attr.aria-pressed]="r.view() === v.id" [title]="v.name" (click)="r.setView(v.id)">{{ v.code }}</button>
        }
      </div>
      <label class="field">
        <span title="Dolly the camera in or out"><i><app-glyph name="zoom" />Zoom</i> <output>{{ r.zoom() | number: '1.2-2' }}×</output></span>
        <input type="range" min="0.6" max="1.6" step="0.02" [value]="r.zoom()" (input)="r.setZoom(+$any($event.target).value)" aria-label="Zoom" [attr.aria-valuetext]="(r.zoom() | number: '1.2-2') + '×'" aria-describedby="cam-zoom-help">
      </label>
      <div class="rowline">
        <button type="button" class="key lone" [class.on]="r.orbiting()" [attr.aria-pressed]="r.orbiting()" (click)="r.setOrbit(!r.orbiting())" aria-label="Orbit slowly" title="Orbit slowly"><app-glyph name="orbit" /></button>
        @if (showRender()) {
          <div class="keyrail" role="group" aria-label="Render mode">
            @for (m of renderModes; track m.id) {
              <button type="button" class="key" [class.on]="r.renderMode() === m.id" [attr.aria-pressed]="r.renderMode() === m.id" [title]="m.name" (click)="r.setRenderMode(m.id)">{{ m.code }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; font-family: var(--font-body); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    :host(.row) { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
    :host(.row) .field { min-width: 150px; }
    :host(.row) .keyrail { min-width: 190px; }
    .label { display: inline-flex; align-items: center; gap: 6px; margin: 0; font: 500 9px/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }
    .field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
    .field > span { display: flex; justify-content: space-between; gap: 6px; color: var(--on-ink); cursor: help; }
    .field i { display: inline-flex; align-items: center; gap: 6px; font-style: normal; }
    .field i app-glyph { color: var(--on-ink-faint); }
    output { font-family: var(--font-mono); color: var(--teal); }
    input[type=range] { width: 100%; margin: 0; }
    .rowline { display: grid; grid-template-columns: 26px 1fr; gap: 6px; align-items: center; }
    :host(.row) .rowline { grid-template-columns: 26px auto; }
    .key.lone { width: 26px; }
  `,
})
export class MorphchartsCameraComponent {
  readonly rig = input<CameraRig | null>(null);
  readonly layout = input<'column' | 'row'>('column');
  /** Off where a page has its own render-mode controls (the MorphCharts client's Render tab). */
  readonly showRender = input(true);

  /** Depth and segment are omitted: nothing to read on a still chart. */
  readonly renderModes: { id: RenderMode; code: string; name: string }[] = [
    { id: 'raytrace', code: 'RAY', name: 'Path traced' },
    { id: 'color', code: 'FLAT', name: 'Flat colour' },
    { id: 'normal', code: 'NORM', name: 'Surface normals' },
    { id: 'edge', code: 'EDGE', name: 'Edges' },
  ];
}
