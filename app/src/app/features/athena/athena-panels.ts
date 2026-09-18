/**
 * Window content for the controls field.
 *
 * Every window shares one chrome — a header bar carrying title and unit code, an open-sided plot
 * well, numeric scales pinned outside — so a bank of them reads as one instrument set. Inside the
 * well, each window composes elements already used by the other two three.js pages: the readout's
 * hero numeral, status bar, slab plates, tick scales and ring gauges, and the site map's tab strip,
 * scan panel, channel checklists, polar plot and tracking callout.
 *
 * Nothing here draws from scratch — it is all `shared/fui/fui-panels.ts`, recomposed.
 */
import * as P from '../../shared/fui/fui-panels';

export interface PanelArt {
  canvas: HTMLCanvasElement;
  aspect: number;
}

export type PanelKind = 'trace' | 'scope' | 'contour' | 'profile' | 'axis' | 'primary' | 'strip' | 'column' | 'module';

const W = 900;
const H = 640;

function make(w: number, h: number, into?: HTMLCanvasElement): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = into ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  return { c, ctx };
}

function jitter(seed: number, t: number, spread: number): number {
  const n = Math.sin(seed * 12.9898 + Math.floor(t * 6) * 78.233) * 43758.5453;
  return Math.round((n - Math.floor(n)) * spread * 2 - spread);
}

interface Well { x: number; y: number; w: number; h: number }

/** Header bar, open-sided plot well, and the scales outside it — shared by every window. */
function chrome(ctx: CanvasRenderingContext2D, title: string, code: string, side?: string): Well {
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 24, W - 52, 56);
  P.corners(ctx, 14, 12, W - 28, 80, 18, P.PALETTE.teal);
  P.font(ctx, 22, 500, 0.12);
  P.text(ctx, title, 48, 62, P.PALETTE.text);
  ctx.textAlign = 'right';
  P.text(ctx, code, W - 48, 62, P.PALETTE.text);
  ctx.textAlign = 'left';

  const well: Well = { x: 112, y: 128, w: W - 170, h: H - 236 };
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.PALETTE.text;
  ctx.beginPath();
  ctx.moveTo(well.x, well.y); ctx.lineTo(well.x + well.w, well.y);
  ctx.moveTo(well.x, well.y + well.h); ctx.lineTo(well.x + well.w, well.y + well.h);
  ctx.moveTo(well.x, well.y); ctx.lineTo(well.x, well.y + well.h);
  ctx.moveTo(well.x + well.w, well.y); ctx.lineTo(well.x + well.w, well.y + well.h);
  ctx.stroke();

  P.font(ctx, 14, 400, 0.08);
  ctx.textAlign = 'right';
  ['100', '90', '25', '00', '-90', '-100'].forEach((l, i) => P.text(ctx, l, well.x - 14, well.y + 10 + (i / 5) * well.h, P.PALETTE.dim));
  ctx.textAlign = 'center';
  ['-100', '-50', '0', '50', '100'].forEach((l, i) => P.text(ctx, l, well.x + (i / 4) * well.w, H - 46, P.PALETTE.dim));
  ctx.textAlign = 'left';
  P.font(ctx, 13, 400, 0.1);
  P.text(ctx, 'TGS', 30, H - 46, P.PALETTE.dim);
  ctx.textAlign = 'right';
  P.text(ctx, 'ESM', W - 30, H - 46, P.PALETTE.dim);
  ctx.textAlign = 'left';

  if (side) {
    P.font(ctx, 15, 400, 0.3);
    ctx.textAlign = 'center';
    [...side].forEach((ch, i) => P.text(ctx, ch, 62, well.y + 56 + i * 26, P.PALETTE.dim));
    ctx.textAlign = 'left';
  }
  return well;
}

/** Waveform strip over the readout's instrument rail: ring gauges, bar pair, tick scale. */
function trace(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'CHROMATOGRAM', 'QC1', 'WNDW');
  for (let line = 0; line < 3; line++) {
    ctx.strokeStyle = line === 1 ? P.PALETTE.amber : P.PALETTE.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 110; i++) {
      const x = well.x + (i / 110) * well.w;
      const base = well.y + well.h * (0.16 + line * 0.09);
      const y = base + Math.sin(i * 0.33 + t * 1.2 + line * 2.1) * 12 + Math.sin(i * 0.08 + t) * 7;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  P.tickScale(ctx, well.x + 16, well.y + well.h * 0.46, 150, ['240', '180', '120', '060']);
  P.ringGauge(ctx, well.x + 250, well.y + well.h * 0.68, 46, jitter(1, t, 6), 0.55 + Math.sin(t * 0.5) * 0.2, 'PULSE/FREQUENCY:MPS');
  P.ringGauge(ctx, well.x + 400, well.y + well.h * 0.68, 46, jitter(2, t, 8), 0.3 + Math.cos(t * 0.4) * 0.2, 'ANGSTROM.WAVE');
  P.barMeter(ctx, well.x + 490, well.y + well.h * 0.5, 18, 96, 0.4 + Math.sin(t * 0.7) * 0.3);
  P.barMeter(ctx, well.x + 516, well.y + well.h * 0.5, 18, 96, 0.7 + Math.sin(t * 0.5) * 0.2);
  P.dataTable(ctx, well.x + 560, well.y + well.h * 0.55, [['PEAK', `${(96 + Math.sin(t) * 3).toFixed(1)}%`], ['RT', '13.57'], ['AREA', '6709']], 110);
  return { canvas: c, aspect: W / H };
}

/** The site map's polar plot and tracking callout, with coordinates. */
function scope(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'VIAL TRACKING', 'QC2', 'WNDW');
  P.polarPlot(ctx, well.x + 190, well.y + well.h * 0.5, 120, [
    [0.4, 0.55], [1.9, 0.8], [3.4, 0.35], [4.8, 0.62], [2.6, 0.9],
  ], (t * 0.9) % (Math.PI * 2));
  P.callout(ctx, well.x + 470, well.y + well.h * 0.44, 'LOT-04', [
    'CR067 · LYO CHAMBER 02',
    `42°30'17" N  71°11'44" W`,
    `UNITS ${String(128 + jitter(4, t, 4)).padStart(3, '0')} · 17 KM`,
  ], 1, 70);
  P.corners(ctx, well.x + 436, well.y + well.h * 0.44 - 34, 68, 68, 12, P.PALETTE.teal);
  P.font(ctx, 9, 400);
  P.text(ctx, '+3 IN CLUSTER', well.x + 480, well.y + well.h * 0.44 + 30, P.PALETTE.teal);
  P.dataTable(ctx, well.x + 430, well.y + well.h * 0.72, [['CODE', 'US-207'], ['STATUS', 'LOCKED']], 110);
  return { canvas: c, aspect: W / H };
}

/** Contour field under the readout's anchor bar. */
function contour(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'CHAMBER PRESSURE ::', '00A');
  const cx = well.x + well.w * 0.5;
  const cy = well.y + well.h * 0.42;
  ctx.setLineDash([3, 8]);
  for (let ring = 0; ring < 5; ring++) {
    ctx.strokeStyle = ring < 2 ? P.PALETTE.amber : P.PALETTE.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a <= 72; a++) {
      const th = (a / 72) * Math.PI * 2;
      const wob = 1 + Math.sin(th * 3 + ring + t * 0.6) * 0.16 + Math.sin(th * 5 - t * 0.4) * 0.08;
      const r = (20 + ring * 20) * wob;
      a === 0 ? ctx.moveTo(cx + Math.cos(th) * r * 1.5, cy + Math.sin(th) * r) : ctx.lineTo(cx + Math.cos(th) * r * 1.5, cy + Math.sin(th) * r);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  P.statusBar(ctx, well.x + 30, well.y + well.h - 92, well.w - 60, 'SYNTHESIS IN PROGRESS', 'B53.FS.21', Math.sin(t * 2) * 0.5 + 0.5);
  return { canvas: c, aspect: W / H };
}

/** The readout's hero numeral and transition block. */
function profile(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'STRUCTURAL PROGRESS', '00A');
  const pct = Math.floor((0.06 + ((t % 13) / 13) * 0.92) * 100);
  ctx.textAlign = 'center';
  P.font(ctx, 132, 400, -0.01);
  P.text(ctx, String(pct).padStart(2, '0'), well.x + well.w * 0.42, well.y + 168, P.PALETTE.text);
  P.font(ctx, 40, 400);
  P.text(ctx, '%', well.x + well.w * 0.42 + 152, well.y + 126, P.PALETTE.teal);
  ctx.textAlign = 'left';
  P.corners(ctx, well.x + 40, well.y + 30, well.w * 0.78, 180, 18, P.PALETTE.teal);
  P.font(ctx, 10, 400);
  P.text(ctx, 'Q-SWITCH · NEAR FIELD IMAGING - ON/6S', well.x + 40, well.y + 250, P.PALETTE.dim);
  P.font(ctx, 52, 400, 0.02);
  P.text(ctx, '312', well.x + 40, well.y + 312, P.PALETTE.text);
  P.font(ctx, 30, 400);
  P.text(ctx, '→', well.x + 190, well.y + 306, P.PALETTE.teal);
  P.font(ctx, 52, 400, 0.02);
  P.text(ctx, `${480 + jitter(5, t, 3)}`, well.x + 250, well.y + 312, P.PALETTE.text);
  P.slab(ctx, well.x + 40, well.y + 340, 420, 'RFN-637.A', 'POINT ORIG-', '[CR.R 10/9]');
  return { canvas: c, aspect: W / H };
}

/** The site map's tab strip, scan panel and redundant channel checklists. */
function axis(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'RELEASE CHANNELS', 'JPL');
  P.tabBar(ctx, well.x + 20, well.y + 24, well.w - 40, ['TRACKS', 'BATCH', 'ROUTES', 'METOC'], 1);
  P.scanPanel(ctx, well.x + 24, well.y + 76, 330, 'SCANNING', 'LOT NETWORK', [
    ['ROUTE A - COLD CHAIN RELAY', 'LAST VERIFIED 2026-09-11'],
    ['ROUTE B - ASSAY TRANSFER', 'LAST VERIFIED 2026-08-30'],
  ], Math.min(2, Math.floor((t % 6) / 2)));
  const fault = Math.floor(t * 0.4) % 4 === 2;
  const rows: Array<[string, boolean]> = [
    ['COLD CHAIN', true], ['CUSTODY LOG', true], ['ASSAY BUS', !fault], ['VIAL LINE', true],
  ];
  for (let i = 0; i < 2; i++) {
    P.channelPanel(ctx, well.x + 390 + i * 170, well.y + 90, 158, rows, `A0${i + 1}`);
    P.circuitTrace(ctx, [
      [well.x + 390 + i * 170 + 79, well.y + 178],
      [well.x + 390 + i * 170 + 79, well.y + 210],
      [well.x + 545, well.y + 210],
      [well.x + 545, well.y + 238],
    ]);
  }
  P.dotMatrix(ctx, well.x + 390, well.y + 252, 26, 3, Math.floor(t * 4));
  return { canvas: c, aspect: W / H };
}

const PAINTERS: Record<PanelKind, (t: number, into?: HTMLCanvasElement) => PanelArt> = { trace, scope, contour, profile, axis, primary, strip, column, module: module_ };

export function paintPanel(kind: PanelKind, t: number, into?: HTMLCanvasElement): PanelArt {
  return PAINTERS[kind](t, into);
}

/* ---------------------------------------------------------------------------------------------
 * Size classes. A wall of identically-proportioned panels reads as a grid; a console reads as one
 * dominant display surrounded by columns, strips and small modules. These four carry that variety.
 * ------------------------------------------------------------------------------------------- */

/** The dominant display: tolerance envelope over the anchor bar. */
function primary(t: number, into?: HTMLCanvasElement): PanelArt {
  const w = 1240;
  const h = 700;
  const { c, ctx } = make(w, h, into);
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 24, w - 52, 56);
  P.corners(ctx, 14, 12, w - 28, h - 24, 22, P.PALETTE.teal);
  P.font(ctx, 24, 500, 0.12);
  P.text(ctx, 'LOT RELEASE · PRIMARY', 48, 62, P.PALETTE.text);
  ctx.textAlign = 'right';
  P.text(ctx, 'KP/309 04627.21A', w - 48, 62, P.PALETTE.text);
  ctx.textAlign = 'left';

  const cx = w * 0.38;
  const cy = h * 0.46;
  ctx.strokeStyle = P.PALETTE.tealDim;
  ctx.lineWidth = 2;
  for (const f of [1, 0.66, 0.33]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 170 * f);
    ctx.lineTo(cx + 230 * f, cy);
    ctx.lineTo(cx, cy + 170 * f);
    ctx.lineTo(cx - 230 * f, cy);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = P.PALETTE.amber;
  const env = 0.55 + Math.sin(t * 0.8) * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 170 * env);
  ctx.lineTo(cx + 230 * env, cy);
  ctx.lineTo(cx, cy + 170 * env);
  ctx.lineTo(cx - 230 * env, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  P.tickScale(ctx, 700, 140, 300, ['240', '180', '120', '060', '000']);
  P.dataTable(ctx, 790, 170, [
    ['BATCH', 'CR067-L04'], ['STAGE', 'LYO 02'], ['MODE', 'AUTO'], ['FAULTS', '00'], ['OPERATOR', '—'],
  ], 220);
  P.ringGauge(ctx, 880, 400, 54, jitter(1, t, 6), 0.6 + Math.sin(t * 0.5) * 0.2, 'PULSE/FREQUENCY');
  P.ringGauge(ctx, 1050, 400, 54, jitter(2, t, 8), 0.4, 'ANGSTROM.WAVE');
  P.statusBar(ctx, 60, h - 130, w - 120, 'SYNTHESIS IN PROGRESS', 'B53.FS.21', Math.sin(t * 2) * 0.5 + 0.5);
  return { canvas: c, aspect: w / h };
}

/** Wide and short: the serial docket bar that rides above a cluster. */
function strip(t: number, into?: HTMLCanvasElement): PanelArt {
  const w = 940;
  const h = 200;
  const { c, ctx } = make(w, h, into);
  P.corners(ctx, 12, 10, w - 24, h - 20, 20, P.PALETTE.tealDim);
  ctx.strokeStyle = P.PALETTE.tealFaint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, h - 40);
  ctx.lineTo(w - 24, h - 40);
  ctx.stroke();
  P.font(ctx, 26, 500, 0.06);
  P.text(ctx, 'KP/309', 34, 78, P.PALETTE.dim);
  P.font(ctx, 38, 500, 0.02);
  P.text(ctx, `${(4627 + Math.floor(t * 2)) % 10000}`.padStart(5, '0'), 180, 78, P.PALETTE.text);
  P.font(ctx, 16, 400);
  P.text(ctx, '.21A', 348, 78, P.PALETTE.teal);
  P.font(ctx, 11, 400);
  P.text(ctx, 'RELEASE LOT DOCKET', 34, 110, P.PALETTE.faint);
  P.dotMatrix(ctx, 470, 48, 60, 5, Math.floor(t * 4));
  P.font(ctx, 12, 400, 0.12);
  P.text(ctx, 'DEPLOYED', w - 190, 110, P.PALETTE.teal);
  return { canvas: c, aspect: w / h };
}

/** Tall and narrow: a stack of segmented bars with a scale down the side. */
function column(t: number, into?: HTMLCanvasElement): PanelArt {
  const w = 360;
  const h = 820;
  const { c, ctx } = make(w, h, into);
  P.corners(ctx, 12, 10, w - 24, h - 20, 20, P.PALETTE.tealDim);
  P.font(ctx, 13, 500);
  P.text(ctx, 'LINE PRESSURE', 28, 44, P.PALETTE.text);
  P.dashedRule(ctx, 28, 58, w - 56);
  const labels = ['B2', 'B7', 'B9', 'C4'];
  for (let i = 0; i < 4; i++) {
    const x = 40 + i * 62;
    const fill = 0.25 + (Math.sin(t * 0.9 + i * 1.3) * 0.5 + 0.5) * 0.7;
    for (let sgm = 0; sgm < 20; sgm++) {
      const on = sgm / 20 < fill;
      ctx.fillStyle = on ? (sgm > 16 ? P.PALETTE.amber : P.PALETTE.teal) : P.PALETTE.micro;
      ctx.fillRect(x, 640 - sgm * 26, 36, 18);
    }
    P.font(ctx, 11, 500);
    ctx.textAlign = 'center';
    P.text(ctx, labels[i], x + 18, 686, P.PALETTE.dim);
    ctx.textAlign = 'left';
  }
  P.tickScale(ctx, 300, 140, 480, ['240', '180', '120', '060', '000']);
  P.font(ctx, 30, 500, 0.02);
  P.text(ctx, `${(142 + Math.sin(t) * 6).toFixed(0)}/L`, 28, 110, P.PALETTE.text);
  P.font(ctx, 11, 400, 0.1);
  P.text(ctx, `257.789.${(66 + Math.floor(t * 3)) % 100}`, 28, h - 40, P.PALETTE.teal);
  return { canvas: c, aspect: w / h };
}

/** Small module, meant to be repeated in a cluster. */
function module_(t: number, into?: HTMLCanvasElement): PanelArt {
  const w = 460;
  const h = 400;
  const { c, ctx } = make(w, h, into);
  P.corners(ctx, 12, 10, w - 24, h - 20, 18, P.PALETTE.tealDim);
  P.font(ctx, 13, 500);
  P.text(ctx, 'DRONE BANK', 28, 44, P.PALETTE.text);
  P.dashedRule(ctx, 28, 58, w - 56);
  const fault = Math.floor(t * 0.4) % 5 === 2;
  P.channelPanel(ctx, 28, 82, w - 56, [
    ['HYDRAULIC SYS', true], ['AUTO-PITCH', true], ['PRIMARY DC BUS', !fault], ['INERTIAL NAV', true],
  ], 'A01');
  P.font(ctx, 26, 500, 0.06);
  ctx.textAlign = 'center';
  P.text(ctx, `${(2.5 + Math.sin(t * 0.7) * 0.4).toFixed(1)}`, w / 2, h - 60, P.PALETTE.text);
  ctx.textAlign = 'left';
  P.font(ctx, 9, 400);
  P.text(ctx, 'ENERGY HIGH', 28, h - 26, P.PALETTE.faint);
  return { canvas: c, aspect: w / h };
}
