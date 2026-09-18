/**
 * Window content for the controls field: framed instrument displays.
 *
 * Every window shares one chrome — a header bar carrying title and unit code, an open-sided plot
 * well, and numeric scales pinned outside it — so a bank of them reads as one instrument set rather
 * than as unrelated widgets. Built on the shared primitives in `shared/fui/fui-panels.ts`.
 *
 * Content is the QC side of a compound release: chromatography, vial inspection, chamber pressure.
 */
import * as P from '../../shared/fui/fui-panels';

export interface PanelArt {
  canvas: HTMLCanvasElement;
  aspect: number;
}

export type PanelKind = 'trace' | 'scope' | 'contour' | 'profile' | 'axis';

const W = 900;
const H = 640;

function make(w: number, h: number, into?: HTMLCanvasElement): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  // Repaints reuse the window's existing canvas: reallocating these several times a second is pure
  // GC churn for no visual difference.
  const c = into ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  return { c, ctx };
}

interface Well { x: number; y: number; w: number; h: number }

/** Header bar, open-sided plot well, and the scales outside it — shared by every window. */
function chrome(ctx: CanvasRenderingContext2D, title: string, code: string, side?: string): Well {
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 24, W - 52, 56);
  // Bracket ticks riding the header's corners.
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

  // Vertical side legend, one letter per line.
  if (side) {
    P.font(ctx, 15, 400, 0.3);
    ctx.textAlign = 'center';
    [...side].forEach((ch, i) => P.text(ctx, ch, 62, well.y + 56 + i * 26, P.PALETTE.dim));
    ctx.textAlign = 'left';
  }
  return well;
}

/** Stacked waveform traces — the strip-chart member of the set. */
function trace(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'CHROMATOGRAM', 'QC1', 'WNDW');
  for (let line = 0; line < 4; line++) {
    ctx.strokeStyle = line === 1 ? P.PALETTE.amber : P.PALETTE.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 110; i++) {
      const x = well.x + (i / 110) * well.w;
      const base = well.y + well.h * (0.16 + line * 0.1);
      const y = base + Math.sin(i * 0.33 + t * 1.2 + line * 2.1) * 13 + Math.sin(i * 0.08 + t) * 8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  P.dataTable(ctx, well.x + 24, well.y + well.h * 0.62, [
    ['A-A', '108° /'], ['PEAK', `${(96 + Math.sin(t) * 3).toFixed(1)}%`], ['RT', '13.57 MIN'], ['AREA', '6709.27'],
  ], 150);
  P.dataTable(ctx, well.x + 300, well.y + well.h * 0.62, [
    ['A-S', '093° /'], ['SPD', '0'], ['ETE', '1357:24'], ['TOT', '-'],
  ], 150);
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.lineWidth = 2;
  ctx.strokeRect(well.x + 180, well.y + well.h - 44, 92, 26);
  P.font(ctx, 13, 400, 0.1);
  P.text(ctx, 'LASER', well.x + 196, well.y + well.h - 25, P.PALETTE.text);
  return { canvas: c, aspect: W / H };
}

/** Concentric rings with a boxed reticle — the acquisition member of the set. */
function scope(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'VIAL INSPECT', 'QC2', 'WNDW');
  const cx = well.x + well.w / 2;
  const cy = well.y + well.h / 2;
  for (const r of [118, 76]) {
    ctx.strokeStyle = P.PALETTE.text;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(68, 224, 204, 0.3)';
  ctx.fillRect(cx - 32, cy - 28, 64, 56);
  ctx.strokeStyle = P.PALETTE.text;
  ctx.lineWidth = 2;
  const drift = Math.sin(t * 1.3) * 9;
  ctx.strokeRect(cx - 16 + drift, cy - 14, 32, 28);
  ctx.beginPath();
  ctx.moveTo(well.x + 30, cy); ctx.lineTo(cx - 140, cy);
  ctx.moveTo(cx + 140, cy); ctx.lineTo(well.x + well.w - 30, cy);
  ctx.stroke();
  ctx.textAlign = 'center';
  P.font(ctx, 14, 400, 0.14);
  P.text(ctx, 'MASK', cx, cy - 130, P.PALETTE.text);
  ctx.textAlign = 'left';
  P.dataTable(ctx, well.x + 20, well.y + 34, [['HDG', '223°'], ['FILL', '100° /'], ['VC', '496']], 90);
  P.dataTable(ctx, well.x + well.w - 190, well.y + 34, [['CAP', '093°'], ['HDG', '000°'], ['SPD', '0']], 90);
  P.dataTable(ctx, well.x + 20, well.y + well.h - 78, [['SEAL', '100° /'], ['ETE', '5599:33']], 90);
  return { canvas: c, aspect: W / H };
}

/** Dotted contour rings — the field-map member of the set. */
function contour(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'CHAMBER PRESSURE ::', '00A');
  const cx = well.x + well.w * 0.55;
  const cy = well.y + well.h * 0.5;
  ctx.setLineDash([3, 8]);
  for (let ring = 0; ring < 6; ring++) {
    ctx.strokeStyle = ring < 2 ? P.PALETTE.amber : P.PALETTE.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a <= 72; a++) {
      const th = (a / 72) * Math.PI * 2;
      const wob = 1 + Math.sin(th * 3 + ring + t * 0.6) * 0.16 + Math.sin(th * 5 - t * 0.4) * 0.08;
      const r = (22 + ring * 22) * wob;
      const x = cx + Math.cos(th) * r * 1.4;
      const y = cy + Math.sin(th) * r;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = P.PALETTE.text;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([12, 9]);
  ctx.strokeStyle = P.PALETTE.dim;
  ctx.beginPath();
  ctx.moveTo(well.x + 8, cy); ctx.lineTo(well.x + well.w - 8, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  P.font(ctx, 14, 400);
  ['-16', '-12', '-8', '-2', '-6', '-10', '-18'].forEach((v, i) => {
    P.text(ctx, v, cx + Math.cos(i * 0.9) * 190, cy + Math.sin(i * 0.9) * 120, P.PALETTE.dim);
  });
  ctx.strokeStyle = P.PALETTE.text;
  ctx.lineWidth = 2;
  ctx.strokeRect(well.x + 14, well.y + well.h - 40, well.w - 28, 30);
  P.font(ctx, 15, 500, 0.08);
  P.text(ctx, 'ISENTROPIC LAYER STABILITY: MODERATE', well.x + 26, well.y + well.h - 18, P.PALETTE.text);
  return { canvas: c, aspect: W / H };
}

/** Crosshair axes over an empty field — the sparse member, for contrast against the dense ones. */
function profile(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'ELECTRO OPTICAL ASSAY', '00A');
  const cy = well.y + well.h * 0.5;
  const vx = well.x + well.w * 0.28;
  ctx.strokeStyle = P.PALETTE.text;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(vx, well.y + 10); ctx.lineTo(vx, well.y + well.h - 10);
  ctx.stroke();
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(well.x + 10, cy); ctx.lineTo(well.x + well.w - 10, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = P.PALETTE.teal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(well.x + well.w * 0.55, cy - 10, 74 + Math.sin(t * 0.7) * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(well.x + 70, well.y + well.h - 70, 28, 0, Math.PI * 2);
  ctx.stroke();
  P.font(ctx, 14, 400);
  P.text(ctx, '-14', well.x + 44, well.y + well.h - 44, P.PALETTE.dim);
  P.text(ctx, '(A)', well.x + well.w - 60, well.y + 34, P.PALETTE.dim);
  P.font(ctx, 15, 500, 0.08);
  P.text(ctx, 'ISENTROPIC LAYER STABILITY: MODERATE', well.x + 200, well.y + well.h - 16, P.PALETTE.text);
  return { canvas: c, aspect: W / H };
}

/** Boxed marker on crossed axes — the tracking member of the set. */
function axis(t: number, into?: HTMLCanvasElement): PanelArt {
  const { c, ctx } = make(W, H, into);
  const well = chrome(ctx, 'TGS', 'JPL', 'WNDW');
  const cy = well.y + well.h * 0.5;
  const cx = well.x + well.w * 0.52 + Math.sin(t * 0.6) * 20;
  ctx.setLineDash([12, 9]);
  ctx.strokeStyle = P.PALETTE.amber;
  ctx.lineWidth = 2;
  for (const y of [well.y + 60, well.y + well.h - 66]) {
    ctx.beginPath();
    ctx.moveTo(well.x + 10, y); ctx.lineTo(well.x + well.w - 10, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = P.PALETTE.text;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(well.x + 20, cy); ctx.lineTo(cx - 34, cy);
  ctx.moveTo(cx + 34, cy); ctx.lineTo(well.x + well.w - 20, cy);
  ctx.moveTo(cx, well.y + 16); ctx.lineTo(cx, cy - 34);
  ctx.moveTo(cx, cy + 34); ctx.lineTo(cx, well.y + well.h - 16);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 30, cy - 28, 60, 56);
  ctx.textAlign = 'center';
  P.font(ctx, 24, 500, 0.1);
  P.text(ctx, 'AFT', cx, cy + 92, P.PALETTE.text);
  ctx.textAlign = 'left';
  P.dataTable(ctx, well.x + 20, well.y + 34, [['HDG', '100°'], ['VC', '496']], 80);
  P.dataTable(ctx, well.x + 20, well.y + well.h - 70, [['HDG', '045°'], ['VC', '400']], 80);
  return { canvas: c, aspect: W / H };
}

const PAINTERS: Record<PanelKind, (t: number, into?: HTMLCanvasElement) => PanelArt> = { trace, scope, contour, profile, axis };

export function paintPanel(kind: PanelKind, t: number, into?: HTMLCanvasElement): PanelArt {
  return PAINTERS[kind](t, into);
}
