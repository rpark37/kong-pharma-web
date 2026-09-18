import { Component, input, output, signal } from '@angular/core';

export interface TileSettings { tilesX: number; tilesY: number; tileOffsetX: number; tileOffsetY: number; autoTile: boolean; }

/** Tiled rendering controls for images larger than the device can render in one pass. */
@Component({
  selector: 'app-tiles-tab',
  template: `
    <div class="col">
      <div class="row">
        <label>X tiles</label><input type="number" min="1" [value]="tilesX()" (change)="tilesX.set(num($event, 1))">
        <label>offset</label><input type="number" min="0" [value]="tileOffsetX()" (change)="tileOffsetX.set(num($event, 0))">
      </div>
      <div class="row">
        <label>Y tiles</label><input type="number" min="1" [value]="tilesY()" (change)="tilesY.set(num($event, 1))">
        <label>offset</label><input type="number" min="0" [value]="tileOffsetY()" (change)="tileOffsetY.set(num($event, 0))">
      </div>
      <label class="row"><input type="checkbox" [checked]="autoTile()" (change)="autoTile.set($any($event.target).checked)"> Auto — render all remaining tiles</label>
      <div class="row">
        <button type="button" class="btn small" (click)="apply()" title="Update tile settings (applied on start)">Update</button>
        <button type="button" class="btn small" (click)="reset()" title="Reset tiling to none">Reset</button>
      </div>
      <p class="hint">Current: {{ current().tilesX }}×{{ current().tilesY }}, offset [{{ current().tileOffsetX }}, {{ current().tileOffsetY }}]</p>
    </div>
  `,
  styles: `
    :host { display: block; padding: 8px 4px; }
    .col { display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    label { color: var(--on-ink-dim); }
    input[type=number] { width: 64px; font: inherit; color: var(--on-ink); background: rgba(0,0,0,0.25); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; }
    .hint { font-size: 12px; color: var(--on-ink-faint); }
  `,
})
export class TilesTabComponent {
  readonly current = input<TileSettings>({ tilesX: 1, tilesY: 1, tileOffsetX: 0, tileOffsetY: 0, autoTile: true });
  readonly changed = output<TileSettings>();
  readonly tilesX = signal(1);
  readonly tilesY = signal(1);
  readonly tileOffsetX = signal(0);
  readonly tileOffsetY = signal(0);
  readonly autoTile = signal(true);

  num(e: Event, min: number): number {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    return isNaN(v) ? min : Math.max(min, v);
  }
  apply(): void {
    this.changed.emit({ tilesX: this.tilesX(), tilesY: this.tilesY(), tileOffsetX: this.tileOffsetX(), tileOffsetY: this.tileOffsetY(), autoTile: this.autoTile() });
  }
  reset(): void {
    this.tilesX.set(1); this.tilesY.set(1); this.tileOffsetX.set(0); this.tileOffsetY.set(0);
    this.apply();
  }
}
