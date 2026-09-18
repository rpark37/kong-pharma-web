/**
 * Panel content for the volumetric control field. Each painter returns a canvas plus the aspect the
 * scene should give its plane, so a panel's proportions come from its content rather than from an
 * arbitrary quad size.
 *
 * Content is the manufacturing/QC side of a compound release: line channels, cold chain, assay bus.
 * Built from the shared primitives in `shared/fui/fui-panels.ts`.
 */
import * as P from '../../shared/fui/fui-panels';

export interface PanelArt {
  canvas: HTMLCanvasElement;
  aspect: number;
}

export type PanelKind = 'gauges' | 'channels' | 'viewport' | 'timer' | 'plot' | 'serial' | 'stack';

function make(w: number, h: number, into?: HTMLCanvasElement): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  // Repaints reuse the panel's existing canvas: allocating twelve of these several times a second
  // is pure GC churn for no visual difference.
  const c = into ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  return { c, ctx };
}

/** Frame every panel the same way: corner ticks and a hairline, so the set reads as one system. */
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, serial: string): void {
  ctx.strokeStyle = P.PALETTE.tealFaint;
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  P.corners(ctx, 6, 6, w - 12, h - 12, 22, P.PALETTE.tealDim);
  P.font(ctx, 13, 500);
  P.text(ctx, title, 20, 34, P.PALETTE.text);
  P.font(ctx, 10, 400);
  ctx.textAlign = 'right';
  P.text(ctx, serial, w - 20, 34, P.PALETTE.faint);
  ctx.textAlign = 'left';
  P.dashedRule(ctx, 20, 46, w - 40);
}

/** Tall column of segmented bars with a numbered scale down the side. */
function gauges(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(420, 760, into);
  frame(ctx, 420, 760, 'LINE PRESSURE', 'KP/309 04627.21A');
  const labels = ['B2', 'B7', 'B9', 'C2', 'C4', 'C6'];
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 60;
    const fill = 0.25 + (Math.sin(t * 0.9 + i * 1.3) * 0.5 + 0.5) * 0.7;
    for (let s = 0; s < 22; s++) {
      const on = s / 22 < fill;
      ctx.fillStyle = on ? (s > 18 ? P.PALETTE.amber : P.PALETTE.teal) : P.PALETTE.micro;
      ctx.fillRect(x, 640 - s * 24, 34, 16);
    }
    P.font(ctx, 10, 500);
    ctx.textAlign = 'center';
    P.text(ctx, labels[i], x + 17, 690, P.PALETTE.dim);
    ctx.textAlign = 'left';
  }
  P.tickScale(ctx, 396, 120, 520, ['240', '180', '120', '060', '000']);
  P.font(ctx, 34, 500, 0.02);
  P.text(ctx, `${(142 + Math.sin(t) * 6).toFixed(0)}/L`, 34, 110, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, 'VARIABLE CHARGE · 2330.18', 34, 128, P.PALETTE.faint);
  P.font(ctx, 11, 400, 0.1);
  P.text(ctx, `257.789.${(66 + Math.floor(t * 3)) % 100}`, 34, 728, P.PALETTE.teal);
  return { canvas: c, aspect: 420 / 760 };
}

/** Three redundant line channels under a tab strip — identical panels read as parallel units. */
function channels(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(880, 520, into);
  frame(ctx, 880, 520, 'RELEASE CHANNELS', 'KP/309 55523.21A');
  P.tabBar(ctx, 40, 78, 800, ['LINE', 'BATCH', 'ASSAY', 'METOC'], 1);
  const fault = Math.floor(t * 0.4) % 4 === 2;
  const rows: Array<[string, boolean]> = [
    ['COLD CHAIN', true],
    ['CUSTODY LOG', true],
    ['ASSAY BUS', !fault],
    ['LYOPHILIZER', true],
    ['VIAL LINE', true],
  ];
  for (let i = 0; i < 3; i++) {
    P.channelPanel(ctx, 44 + i * 276, 150, 250, rows, `A0${i + 1}`);
    P.circuitTrace(ctx, [[44 + i * 276 + 125, 150 + 106], [44 + i * 276 + 125, 330], [440, 330], [440, 362]]);
  }
  P.font(ctx, 9, 400);
  P.text(ctx, 'UNIFORM ENERGY DISTRIBUTION', 44, 400, P.PALETTE.faint);
  P.dataTable(ctx, 44, 424, [['MODE', 'AUTO'], ['SET', '08.23'], ['FAULTS', fault ? '01' : '00']], 150);
  return { canvas: c, aspect: 880 / 520 };
}

/** Wireframe viewport: a schematic outline with a crosshair and corner data blocks. */
function viewport(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(820, 520, into);
  frame(ctx, 820, 520, 'CHAMBER VIEW', 'KP/309 46702.21A');
  ctx.strokeStyle = P.PALETTE.tealDim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(150, 120, 520, 300);
  P.corners(ctx, 130, 100, 560, 340, 26, P.PALETTE.teal);
  const cx = 410;
  const cy = 270;
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 34, cy);
  ctx.moveTo(cx, cy - 34); ctx.lineTo(cx, cy - 10);
  ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 34);
  ctx.stroke();
  ctx.strokeStyle = P.PALETTE.tealFaint;
  ctx.strokeRect(cx - 60 + Math.sin(t) * 18, cy - 44, 120, 88);
  P.microRail(ctx, 24, 140, ['CAL REV13 SEA CAL INTEG 1.1', 'ACTIVE 3.20 244V', 'PSI 0.4 SETP', '-06:05:28', '-06:05:41']);
  P.microRail(ctx, 700, 140, ['SUPPLY MODE', 'SET.TIN 244V', 'FIL 22 ARR12', '1.20 L ARR03']);
  P.font(ctx, 10, 400);
  P.text(ctx, `TEMP ${(4.2 + Math.sin(t * 1.4) * 0.3).toFixed(1)}°C`, 150, 462, P.PALETTE.dim);
  P.text(ctx, 'DWELL 00:41', 340, 462, P.PALETTE.dim);
  P.text(ctx, 'SEAL OK', 520, 462, P.PALETTE.teal);
  return { canvas: c, aspect: 820 / 520 };
}

/** Countdown, mode icons, and the run state — the block the eye goes to. */
function timer(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(520, 420, into);
  frame(ctx, 520, 420, 'RUN STATE', 'KP/309 11884.21A');
  const total = 24 * 3600 + 32 * 60;
  const left = total - Math.floor(t * 7);
  const hh = String(Math.floor(left / 3600) % 100).padStart(2, '0');
  const mm = String(Math.floor(left / 60) % 60).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  P.font(ctx, 44, 500, 0.04);
  P.text(ctx, `${hh}:${mm}:${ss}`, 34, 120, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, 'TIME TO RELEASE', 34, 142, P.PALETTE.tealDim);

  for (let i = 0; i < 3; i++) {
    const cx = 70 + i * 74;
    ctx.strokeStyle = i === 1 ? P.PALETTE.amber : P.PALETTE.tealDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, 220, 22, 0, Math.PI * 2);
    ctx.stroke();
    if (i === 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 14, 234); ctx.lineTo(cx + 14, 206);
      ctx.stroke();
    }
  }
  P.font(ctx, 20, 500, 0.02);
  P.text(ctx, `${(255 + Math.floor(Math.sin(t) * 4))}/R`, 300, 226, P.PALETTE.text);
  P.font(ctx, 9, 400);
  P.text(ctx, 'DEPLOYED', 300, 246, P.PALETTE.teal);
  P.dataTable(ctx, 34, 300, [['BATCH', 'CR067-L04'], ['STAGE', 'LYO 02'], ['OPERATOR', '—']], 190);
  return { canvas: c, aspect: 520 / 420 };
}

/** Rhombus plot over a perspective tick array. */
function plot(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(640, 560, into);
  frame(ctx, 640, 560, 'TOLERANCE ENVELOPE', 'KP/309 07714.21A');
  const cx = 320;
  const cy = 250;
  ctx.strokeStyle = P.PALETTE.tealDim;
  ctx.lineWidth = 1.5;
  for (const s of [1, 0.66, 0.33]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 150 * s);
    ctx.lineTo(cx + 190 * s, cy);
    ctx.lineTo(cx, cy + 150 * s);
    ctx.lineTo(cx - 190 * s, cy);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = P.PALETTE.amber;
  const w = 0.55 + Math.sin(t * 0.8) * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 150 * w);
  ctx.lineTo(cx + 190 * w, cy);
  ctx.lineTo(cx, cy + 150 * w);
  ctx.lineTo(cx - 190 * w, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // Perspective tick array beneath, rows converging toward the top.
  for (let r = 0; r < 7; r++) {
    const y = 440 + r * 14;
    const spread = 40 + r * 26;
    ctx.fillStyle = P.PALETTE.micro;
    for (let i = 0; i < 14; i++) ctx.fillRect(cx - spread + (i * spread * 2) / 13, y, 5, 3);
  }
  P.font(ctx, 9, 400);
  P.text(ctx, 'F1.0', 40, 250, P.PALETTE.faint);
  P.text(ctx, 'F1.8 3/1', 40, 200, P.PALETTE.faint);
  P.text(ctx, 'F1.8 3/1', 540, 200, P.PALETTE.faint);
  return { canvas: c, aspect: 640 / 560 };
}

/** A serial header bar — the long thin element that sits on a rail. */
function serial(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(760, 130, into);
  ctx.strokeStyle = P.PALETTE.tealFaint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 100);
  ctx.lineTo(750, 100);
  ctx.stroke();
  P.font(ctx, 22, 500, 0.06);
  P.text(ctx, 'KP/309', 16, 62, P.PALETTE.dim);
  P.font(ctx, 30, 500, 0.02);
  P.text(ctx, `${(4627 + Math.floor(t * 2)) % 10000}`.padStart(5, '0'), 130, 62, P.PALETTE.text);
  P.font(ctx, 13, 400);
  P.text(ctx, '.21A', 260, 62, P.PALETTE.teal);
  P.font(ctx, 9, 400);
  P.text(ctx, 'RELEASE LOT DOCKET', 16, 86, P.PALETTE.faint);
  P.dotMatrix(ctx, 420, 40, 40, 4, Math.floor(t * 4));
  return { canvas: c, aspect: 760 / 130 };
}

/** Dense stack of small readouts — texture more than content, for the far field. */
function stack(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(420, 620, into);
  frame(ctx, 420, 620, 'BUS TRACE', 'KP/309 92210.21A');
  for (let i = 0; i < 10; i++) {
    const y = 80 + i * 52;
    ctx.strokeStyle = P.PALETTE.tealFaint;
    ctx.strokeRect(24, y, 372, 40);
    P.font(ctx, 9, 400);
    P.text(ctx, `CH ${String(i + 1).padStart(2, '0')}`, 36, y + 25, P.PALETTE.dim);
    P.barMeter(ctx, 110, y + 8, 200, 24, 0.2 + (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * 0.75);
    P.font(ctx, 9, 400);
    P.text(ctx, `${(38 + i * 3)}`, 330, y + 25, P.PALETTE.faint);
  }
  return { canvas: c, aspect: 420 / 620 };
}

const PAINTERS: Record<PanelKind, (t: number, into?: HTMLCanvasElement) => PanelArt> = { gauges, channels, viewport, timer, plot, serial, stack };

export function paintPanel(kind: PanelKind, t: number, into?: HTMLCanvasElement): PanelArt {
  return PAINTERS[kind](t, into);
}
