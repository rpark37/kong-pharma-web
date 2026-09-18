/**
 * The operator's input deck: a holographic keyboard drawn to canvas and mapped onto a raked plane.
 *
 * Painted rather than built from ~70 key meshes. At this viewing angle the keys read as glowing
 * cells regardless, and one canvas beats 70 draw calls plus 70 label textures. Lit keys live on a
 * second additive layer so the typing animation repaints only that, leaving the base untouched.
 */
import * as P from '../../shared/fui/fui-panels';

export const KB_W = 1680;
export const KB_H = 640;

interface Key {
  label: string;
  x: number;
  y: number;
  w: number;
  sub?: string;
}

const U = 96; // one key unit
const GAP = 8;
const X0 = 150;
const Y0 = 120;

/** Standard QWERTY stagger — the layout is functional, the treatment is what makes it ours. */
function layout(): Key[] {
  const rows: Array<Array<[string, number] | string>> = [
    ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', ['BCK', 1.6]],
    [['TAB', 1.4], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.2]],
    [['CTL', 1.7], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['ENTER', 1.9]],
    [['SHF', 2.1], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['SHF', 2.3]],
    [['CTL', 1.4], ['ALT', 1.3], ['', 6.4], ['ALT', 1.3], ['FN', 1.3], ['CTL', 1.4]],
  ];
  const keys: Key[] = [];
  rows.forEach((row, r) => {
    let x = X0 + [0, 0, 0, 0, 0][r];
    const y = Y0 + r * (U + GAP);
    for (const cell of row) {
      const [label, units] = Array.isArray(cell) ? cell : [cell, 1];
      const w = (units as number) * U + ((units as number) - 1) * GAP;
      keys.push({ label: label as string, x, y, w });
      x += w + GAP;
    }
  });
  return keys;
}

export const KEYS = layout();

function keyPath(ctx: CanvasRenderingContext2D, k: Key): void {
  // Clipped corners rather than rounded: the rest of this system is drawn with cut corners.
  const c = 10;
  ctx.beginPath();
  ctx.moveTo(k.x + c, k.y);
  ctx.lineTo(k.x + k.w - c, k.y);
  ctx.lineTo(k.x + k.w, k.y + c);
  ctx.lineTo(k.x + k.w, k.y + U - c);
  ctx.lineTo(k.x + k.w - c, k.y + U);
  ctx.lineTo(k.x + c, k.y + U);
  ctx.lineTo(k.x, k.y + U - c);
  ctx.lineTo(k.x, k.y + c);
  ctx.closePath();
}

/** The static deck: every key outline, its label, and the surrounding frame. */
export function paintKeyboardBase(into?: HTMLCanvasElement): HTMLCanvasElement {
  const c = into ?? document.createElement('canvas');
  c.width = KB_W;
  c.height = KB_H;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, KB_W, KB_H);

  for (const k of KEYS) {
    keyPath(ctx, k);
    ctx.fillStyle = 'rgba(68, 224, 204, 0.045)';
    ctx.fill();
    ctx.strokeStyle = P.PALETTE.tealFaint;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!k.label) continue;
    P.font(ctx, k.label.length > 1 ? 18 : 26, 400, 0.06);
    ctx.textAlign = 'center';
    P.text(ctx, k.label, k.x + k.w / 2, k.y + U / 2 + 9, P.PALETTE.dim);
    ctx.textAlign = 'left';
  }

  // Frame rails with section tabs, top and bottom, mirroring the panel system.
  for (const y of [70, KB_H - 54]) {
    ctx.strokeStyle = P.PALETTE.tealDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(KB_W - 60, y);
    ctx.stroke();
    P.font(ctx, 13, 400, 0.24);
    const tabs = ['OVERLAYS', 'TRACKS', 'BATCH', 'METOC'];
    tabs.forEach((t, i) => P.text(ctx, t, 230 + i * 330, y - 12, P.PALETTE.faint));
  }
  P.corners(ctx, 46, 46, KB_W - 92, KB_H - 92, 30, P.PALETTE.tealDim);

  // Side stubs, the little connector marks the deck hangs off.
  ctx.strokeStyle = P.PALETTE.tealFaint;
  for (const sx of [24, KB_W - 24]) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(sx, 150 + i * 80);
      ctx.lineTo(sx + (sx < 100 ? 20 : -20), 150 + i * 80);
      ctx.stroke();
    }
  }
  return c;
}

/** Only the lit keys — repainted each beat so the base canvas is never touched. */
export function paintKeyboardLit(lit: Set<number>, into?: HTMLCanvasElement): HTMLCanvasElement {
  const c = into ?? document.createElement('canvas');
  c.width = KB_W;
  c.height = KB_H;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, KB_W, KB_H);
  for (const i of lit) {
    const k = KEYS[i];
    if (!k) continue;
    keyPath(ctx, k);
    ctx.fillStyle = 'rgba(68, 224, 204, 0.38)';
    ctx.fill();
    ctx.strokeStyle = P.PALETTE.teal;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!k.label) continue;
    P.font(ctx, k.label.length > 1 ? 18 : 26, 500, 0.06);
    ctx.textAlign = 'center';
    P.text(ctx, k.label, k.x + k.w / 2, k.y + U / 2 + 9, P.PALETTE.text);
    ctx.textAlign = 'left';
  }
  return c;
}

/** A plausible typing rhythm: a burst of keys, a modifier held, then a pause. */
export function litKeysAt(t: number): Set<number> {
  const out = new Set<number>();
  const beat = Math.floor(t * 6);
  const n = KEYS.length;
  out.add((beat * 7 + 13) % n);
  if (beat % 3 === 0) out.add((beat * 11 + 29) % n);
  if (beat % 5 === 0) out.add((beat * 17 + 3) % n);
  if (beat % 4 < 2) out.add(29); // a modifier held across several beats
  return out;
}
