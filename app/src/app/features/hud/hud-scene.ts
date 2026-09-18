/**
 * A layered holographic readout: three canvas-painted planes at different depths, raked away from
 * the camera, with the off-focus layers pre-blurred in 2D rather than run through a bokeh pass.
 * Baking the blur into the texture costs one extra canvas draw instead of a postprocessing chain,
 * and the planes never come into focus, so nothing is lost.
 *
 * Motion rule: the periphery never stops moving (counters, timecode, matrices, bracket re-acquire)
 * while the status bar holds perfectly still. The contrast is what makes the anchor read as
 * important — take the jitter away and the composition goes flat.
 */
import * as T from 'three';
import * as P from './hud-panels';

const W = 1600;
const H = 900;

export interface HudState {
  progress: number;
  frame: number;
  reduced: boolean;
}

/** Deterministic per-frame jitter: same frame index always yields the same value. */
function jitter(seed: number, frame: number, spread: number): number {
  const n = Math.sin(seed * 12.9898 + Math.floor(frame) * 78.233) * 43758.5453;
  return Math.round((n - Math.floor(n)) * spread * 2 - spread);
}

function timecode(frames: number): string {
  const f = Math.floor(frames) % 24;
  const s = Math.floor(frames / 24) % 60;
  const m = Math.floor(frames / 1440) % 60;
  return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}:00-`;
}

/** Progressive reveal, character by character — a line that is still being written. */
function typed(full: string, t: number): string {
  const n = Math.min(full.length, Math.max(0, Math.floor(t * 18)));
  return full.slice(0, n);
}

function paintBack(ctx: CanvasRenderingContext2D, s: HudState): void {
  ctx.clearRect(0, 0, W, H);
  P.gridPanel(ctx, 0, 0, W, H, 42);
  P.microRail(ctx, 60, 90, [
    'OPTICAL RESONATOR:R:0.5/857942', 'DIL.SUB.CHN.12A', 'REF 06/--/05',
    'CAL-860 QL3', 'UV-A (315-400 NM)', 'LEV.4A 0/02',
  ]);
  P.microRail(ctx, W - 300, 140, ['N0.156574LD', 'E1.20652245', 'SVR.654', 'A127 LDS']);
  for (let i = 0; i < 5; i++) P.dashedRule(ctx, 80, 220 + i * 130, W - 160);
  P.dotMatrix(ctx, 120, H - 160, 24, 6, s.frame * 0.25);
  P.dotMatrix(ctx, W - 260, 260, 18, 5, s.frame * 0.4);
}

function paintMid(ctx: CanvasRenderingContext2D, s: HudState): void {
  ctx.clearRect(0, 0, W, H);
  const f = s.frame;

  // Top rail — dense, small, namespaced.
  P.font(ctx, 11, 500);
  P.text(ctx, 'CR067.LOT-04:-/ASSAY', 56, 46, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, 'QUANTUM YIELD: 21.00X 13.06', 56, 66, P.PALETTE.tealDim);
  P.dashedRule(ctx, 56, 80, 420);

  P.font(ctx, 10, 400);
  P.text(ctx, 'XTL.GRID-02.INTERFACE', W - 320, 46, P.PALETTE.dim);
  P.font(ctx, 13, 500, 0.04);
  P.text(ctx, `STABILITY:0${3640 + jitter(3, f, 4)}`, W - 320, 72, P.PALETTE.text);

  P.dataTable(ctx, 470, 52, [['LEN:', '00.1'], ['OPN:', '01.3'], ['AV', '-']], 62);
  P.dataTable(ctx, 640, 52, [['RND. MODE', ''], ['COORDINATES', '08.23'], ['N:', `0.${3 + (f % 3)}`]], 108);

  // Left column — identifiers, then an evaluation table with vacancies left visible.
  P.slab(ctx, 60, 300, 330, 'RFN-637.A', 'POINT ORIG-', `[CR.R 10/9]`);
  P.slab(ctx, 60, 372, 330, 'RFN-637.A', 'POINT RG-', `[K119 07/10-]`);
  P.font(ctx, 10, 400);
  P.text(ctx, 'TRANSFER EVALUATION', 62, 452, P.PALETTE.dim);
  P.dataTable(ctx, 62, 478, [
    ['REQ TRANSFER:VARIABLE', '038'],
    [`HPR-01 - 00:${String(40 + (f % 9)).padStart(2, '0')} - 00:26`, '038'],
    ['3:1', '038'],
    ['4:1', '-'],
    ['5:1', '--'],
  ], 210);

  P.font(ctx, 15, 500, 0.05);
  P.text(ctx, typed('QTIC.</[1.38 X 10-23 J/', (f % 160) / 22), 60, H - 120, P.PALETTE.teal);
  P.font(ctx, 8, 400);
  P.text(ctx, '303 MAGNIFY RD78', 60, H - 100, P.PALETTE.faint);

  // Centre — the hero readout. Large numeral, unit as superscript, then the steady anchor bar.
  const pct = Math.floor(s.progress * 100);
  ctx.textAlign = 'center';
  P.font(ctx, 108, 400, -0.01);
  P.text(ctx, String(pct).padStart(2, '0'), W / 2 - 24, 372, P.PALETTE.text);
  P.font(ctx, 30, 400);
  P.text(ctx, '%', W / 2 + 76, 340, P.PALETTE.teal);
  P.font(ctx, 9, 400);
  P.text(ctx, 'STRUCTURAL PROGRESS', W / 2, 262, P.PALETTE.tealDim);
  ctx.textAlign = 'left';
  P.corners(ctx, W / 2 - 230, 230, 460, 190, 16);

  P.statusBar(ctx, W / 2 - 330, 452, 660, 'SYNTHESIS IN PROGRESS', 'B53.FS.21', Math.sin(f * 0.08) * 0.5 + 0.5);

  P.font(ctx, 9, 400);
  ctx.textAlign = 'center';
  P.text(ctx, 'COMPOUND CR-067 · LATTICE RESOLVE', W / 2, 556, P.PALETTE.faint);
  ctx.textAlign = 'left';

  P.tickScale(ctx, W / 2 - 300, 236, 190, ['18:00', '17:00', '16:00', '15:00']);

  // Right column — sparse and large, the counterweight to the dense left.
  P.font(ctx, 9, 400);
  P.text(ctx, 'Q-SWITCH:', W - 330, 300, P.PALETTE.dim);
  P.text(ctx, 'NEAR FIELD IMAGING - ON/6S', W - 330, 318, P.PALETTE.dim);
  P.font(ctx, 44, 400, 0.02);
  P.text(ctx, '312', W - 330, 384, P.PALETTE.text);
  P.font(ctx, 24, 400);
  P.text(ctx, '→', W - 242, 380, P.PALETTE.teal);
  P.font(ctx, 44, 400, 0.02);
  P.text(ctx, '480', W - 206, 384, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, 'SELECTION AR', W - 330, 440, P.PALETTE.dim);
  P.text(ctx, 'UNIFORM ENERGY DISTRIBUTION', W - 330, 458, P.PALETTE.faint);
  P.text(ctx, 'LEV.4A', W - 330, 486, P.PALETTE.faint);
  P.text(ctx, `0/${String(2 + (f % 2)).padStart(2, '0')}`, W - 258, 486, P.PALETTE.teal);

  // Bottom instrument rail.
  P.dashedRule(ctx, 56, H - 210, W - 112);
  P.ringGauge(ctx, 390, H - 120, 34, jitter(1, f * 0.3, 6), 0.55 + Math.sin(f * 0.05) * 0.2, 'PULSE/FREQUENCY:MPS');
  P.ringGauge(ctx, 550, H - 120, 34, jitter(2, f * 0.3, 8), 0.3 + Math.cos(f * 0.04) * 0.2, 'ANGSTROM.WAVE');
  P.barMeter(ctx, 648, H - 160, 14, 80, 0.4 + Math.sin(f * 0.07) * 0.3);
  P.barMeter(ctx, 670, H - 160, 14, 80, 0.7 + Math.sin(f * 0.05) * 0.2);
  P.dataTable(ctx, 730, H - 150, [['RND. MODE', ''], ['COORDINATES', '08.23'], ['UV-A', '(315-400 NM)']], 130);
  P.ringGauge(ctx, 1040, H - 120, 30, jitter(4, f * 0.3, 9), 0.6, 'DETECTION TEMPER');
  P.font(ctx, 17, 500, 0.05);
  P.text(ctx, 'DETECTION TEMPER: 1.00X', W - 440, H - 130, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, '303 MAGNIFY RD78', W - 440, H - 108, P.PALETTE.faint);

  ctx.textAlign = 'center';
  P.font(ctx, 13, 400, 0.12);
  P.text(ctx, timecode(f), W / 2, H - 196, P.PALETTE.dim);
  ctx.textAlign = 'left';
}

function paintFront(ctx: CanvasRenderingContext2D, s: HudState): void {
  ctx.clearRect(0, 0, W, H);
  // Tracking brackets that acquire, hold, drop and re-acquire.
  const phase = (s.frame % 96) / 96;
  if (phase > 0.12) P.corners(ctx, 210, 250, 200, 150, 18, P.PALETTE.teal, 'tl,br');
  if (phase > 0.4 && phase < 0.9) P.corners(ctx, W - 430, 560, 240, 130, 18, P.PALETTE.teal, 'tr,bl');
  P.corners(ctx, 40, 30, W - 80, H - 60, 26, P.PALETTE.tealFaint);
  P.dotMatrix(ctx, W - 180, H - 90, 12, 4, s.frame * 0.6);
}

export class HudScene {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  private readonly layers: Array<{ ctx: CanvasRenderingContext2D; tex: T.CanvasTexture; paint: (c: CanvasRenderingContext2D, s: HudState) => void; blur: number; every: number; mesh: T.Mesh }> = [];
  private readonly group = new T.Group();
  private raf = 0;
  private frame = 0;
  private disposed = false;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera.position.set(0, 0, 3.9);
    this.scene.add(this.group);

    // Back and front planes are never in focus, so their blur is baked in 2D.
    const defs: Array<[(c: CanvasRenderingContext2D, s: HudState) => void, number, number, number, number]> = [
      [paintBack, 5, 12, -1.5, 1.22],
      [paintMid, 0, 2, 0, 1],
      [paintFront, 7, 6, 1.1, 0.86],
    ];
    for (const [paint, blur, every, z, scale] of defs) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const mesh = new T.Mesh(new T.PlaneGeometry(3.55 * scale, 2 * scale), mat);
      mesh.position.z = z;
      this.group.add(mesh);
      this.layers.push({ ctx, tex, paint, blur, every, mesh });
    }
    this.repaint(true);
  }

  /** Slight rake plus pointer parallax — the plane is a surface in the room, not a flat overlay. */
  track(nx: number, ny: number): void {
    this.target.x = nx;
    this.target.y = ny;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private repaint(force = false): void {
    const state: HudState = { progress: this.progress(), frame: this.frame, reduced: this.reduced };
    for (const layer of this.layers) {
      if (!force && this.frame % layer.every !== 0) continue;
      layer.ctx.filter = layer.blur ? `blur(${layer.blur}px)` : 'none';
      layer.ctx.save();
      layer.paint(layer.ctx, state);
      layer.ctx.restore();
      layer.ctx.filter = 'none';
      layer.tex.needsUpdate = true;
    }
  }

  private progress(): number {
    if (this.reduced) return 0.43;
    const cycle = (this.frame % 560) / 560;
    return 0.06 + cycle * 0.92;
  }

  start(): void {
    if (this.reduced) { this.render(); return; }
    const tick = () => {
      if (this.disposed) return;
      this.frame += 1;
      this.repaint();
      this.pointer.x += (this.target.x - this.pointer.x) * 0.05;
      this.pointer.y += (this.target.y - this.pointer.y) * 0.05;
      this.group.rotation.y = -0.16 + this.pointer.x * 0.1;
      this.group.rotation.x = 0.04 + this.pointer.y * 0.06;
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private render(): void {
    this.group.rotation.y = this.reduced ? -0.16 : this.group.rotation.y;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const l of this.layers) {
      l.tex.dispose();
      (l.mesh.material as T.Material).dispose();
      l.mesh.geometry.dispose();
    }
    this.renderer.dispose();
  }
}
