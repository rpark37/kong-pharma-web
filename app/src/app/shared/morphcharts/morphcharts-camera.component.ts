import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { type CameraRig, type CameraView } from './camera-rig';
import type { RenderMode } from './morphcharts-host';

/**
 * The camera controls every path-traced view shares: view presets, a dolly, a slow orbit and the
 * render mode, driving a `CameraRig`. Segmented rails in the same instrument vocabulary as the
 * Bayes panel; `layout="row"` lays the rails out in one line for a toolbar or a card foot.
 */
@Component({
  selector: 'app-morphcharts-camera',
  imports: [DecimalPipe],
  host: { '[class.row]': 'layout() === "row"' },
  template: `
    @if (rig(); as r) {
      <p class="label" title="Controls set the camera from its reset pose; drag the view to fine-tune">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.5a1.5 1.5 0 0 1 1.5-1.5H5l1-1.5h4l1 1.5h1.5A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5zM8 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5" /></svg>Camera
      </p>
      <div class="rail" role="group" aria-label="View">
        @for (v of views; track v.id) {
          <button type="button" class="key code" [class.on]="r.view() === v.id" [attr.aria-pressed]="r.view() === v.id" [title]="v.name" (click)="r.setView(v.id)">{{ v.code }}</button>
        }
      </div>
      <label class="field">
        <span title="Dolly the camera in or out"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM10.3 10.3 14 14M5 7h4M7 5v4" /></svg>Zoom</i> <output>{{ r.zoom() | number: '1.2-2' }}×</output></span>
        <input type="range" min="0.6" max="1.6" step="0.02" [value]="r.zoom()" (input)="r.setZoom(+$any($event.target).value)" aria-label="Zoom">
      </label>
      <div class="rowline">
        <button type="button" class="key orbit" [class.on]="r.orbiting()" [attr.aria-pressed]="r.orbiting()" (click)="r.setOrbit(!r.orbiting())" aria-label="Orbit slowly" title="Orbit slowly">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM1.5 9.5c2.5-1 10.5-1 13 0" /></svg>
        </button>
        @if (showRender()) {
          <div class="rail" role="group" aria-label="Render mode">
            @for (m of renderModes; track m.id) {
              <button type="button" class="key code" [class.on]="r.renderMode() === m.id" [attr.aria-pressed]="r.renderMode() === m.id" [title]="m.name" (click)="r.setRenderMode(m.id)">{{ m.code }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; font-family: var(--font-body); }
    :host(.row) { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
    :host(.row) .label { margin: 0; }
    :host(.row) .field { min-width: 150px; }
    .label { display: inline-flex; align-items: center; gap: 6px; margin: 0; font: 500 9px/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }
    .label svg, .field i svg { width: 12px; height: 12px; flex: none; }
    .rail { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--hairline); border-radius: 6px; overflow: hidden; background: rgba(0, 0, 0, 0.04); }
    :host(.row) .rail { min-width: 190px; }
    .key { display: flex; align-items: center; justify-content: center; height: 26px; padding: 0 2px; border: 0; background: none; color: var(--on-ink-dim); cursor: pointer; font: 500 9px/1 var(--font-mono); letter-spacing: 0.02em; transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
    .key + .key { border-left: 1px solid var(--hairline); }
    .key:hover { background: rgba(0, 112, 93, 0.08); color: var(--on-ink); }
    .key:active { background: rgba(0, 112, 93, 0.16); }
    .key:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    .key.on { background: var(--teal); color: var(--ink); }
    .key.on:hover { background: rgba(0, 112, 93, 0.9); color: var(--ink); }
    .key.orbit { width: 26px; border: 1px solid var(--hairline); border-radius: 6px; background: rgba(0, 0, 0, 0.04); }
    .key.orbit.on { background: var(--teal); }
    svg { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .key svg { width: 16px; height: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
    .field > span { display: flex; justify-content: space-between; gap: 6px; color: var(--on-ink); cursor: help; }
    .field i { display: inline-flex; align-items: center; gap: 6px; font-style: normal; }
    .field i svg { color: var(--on-ink-faint); }
    output { font-family: var(--font-mono); color: var(--teal); }
    input[type=range] { width: 100%; margin: 0; }
    .rowline { display: grid; grid-template-columns: 26px 1fr; gap: 6px; align-items: center; }
    :host(.row) .rowline { grid-template-columns: 26px auto; }
  `,
})
export class MorphchartsCameraComponent {
  readonly rig = input<CameraRig | null>(null);
  readonly layout = input<'column' | 'row'>('column');
  /** Off where a page has its own render-mode controls (the MorphCharts client's Render tab). */
  readonly showRender = input(true);

  readonly views: { id: CameraView; code: string; name: string }[] = [
    { id: 'front', code: 'FRONT', name: 'Front' },
    { id: 'quarter', code: '¾', name: 'Three-quarter' },
    { id: 'top', code: 'TOP', name: 'Top-down' },
    { id: 'low', code: 'LOW', name: 'Low angle' },
  ];
  /** Depth and segment are omitted: nothing to read on a still chart. */
  readonly renderModes: { id: RenderMode; code: string; name: string }[] = [
    { id: 'raytrace', code: 'RAY', name: 'Path traced' },
    { id: 'color', code: 'FLAT', name: 'Flat colour' },
    { id: 'normal', code: 'NORM', name: 'Surface normals' },
    { id: 'edge', code: 'EDGE', name: 'Edges' },
  ];
}
