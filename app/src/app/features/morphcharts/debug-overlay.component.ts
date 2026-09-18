import { Component, input } from '@angular/core';
import type { DebugSnapshot } from '../../shared/morphcharts/morphcharts-host';

const DEG = 180 / Math.PI;

/** The client's monospace debug readout of camera and depth state. */
@Component({
  selector: 'app-debug-overlay',
  template: `
    @if (snapshot(); as s) {
      <pre class="mono">FRM TOT {{ pad(s.frameCount, 5) }}
CAM POS {{ v(s.position) }}
CAM RHT {{ v(s.right) }}
CAM UP  {{ v(s.up) }}
CAM FWD {{ v(s.forward) }}
CAM ORI {{ v(s.origin) }}
WLD POS {{ v(s.world) }}
CAM DST {{ dist(s) }}
CAM FOV {{ (s.fov * deg).toFixed(1).padStart(7, ' ') }}°
CAM DOF {{ (s.aperture * 1000).toFixed(1).padStart(7, ' ') }}mm
CAM FOC {{ s.focusDistance.toFixed(3).padStart(9, ' ') }}
DEP MIN {{ s.depthMin.toFixed(2).padStart(8, ' ') }}
DEP MAX {{ s.depthMax.toFixed(2).padStart(8, ' ') }}</pre>
    }
  `,
  styles: `
    :host { position: absolute; left: 8px; top: 8px; pointer-events: none; }
    pre { margin: 0; font-size: 11px; line-height: 1.35; color: var(--teal); background: rgba(6,12,16,0.55); padding: 6px 8px; border-radius: 6px; }
  `,
})
export class DebugOverlayComponent {
  readonly snapshot = input<DebugSnapshot | null>(null);
  readonly deg = DEG;
  pad(n: number, w: number): string { return n.toString().padStart(w, ' '); }
  v(a: ArrayLike<number>): string { return `${a[0].toFixed(4).padStart(10, ' ')} ${a[1].toFixed(4).padStart(10, ' ')} ${a[2].toFixed(4).padStart(10, ' ')}`; }
  dist(s: DebugSnapshot): string {
    const d = Math.hypot(s.position[0] - s.origin[0], s.position[1] - s.origin[1], s.position[2] - s.origin[2]);
    return d.toFixed(3).padStart(9, ' ');
  }
}
