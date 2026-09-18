/**
 * The 2D vocabulary the HUD is built from: every panel is painted to a canvas and mapped onto a
 * plane in `hud-scene.ts`. Canvas text beats any 3D text approach here — JetBrains Mono is already
 * loaded for the app, glyphs stay crisp at any plane scale, and there is no font-loader dependency.
 *
 * Conventions borrowed from technical/aerospace readout design rather than any one source: uppercase
 * mono throughout, tracking inverse to size, dot-path identifiers, key:value pairs, ratio values,
 * and empty slots rendered as dashes so absent data still occupies its cell.
 */

export const PALETTE = {
  ink: '#121c24',
  ink2: '#192630',
  ink3: '#24343f',
  teal: '#44e0cc',
  tealDim: 'rgba(68, 224, 204, 0.45)',
  tealFaint: 'rgba(68, 224, 204, 0.16)',
  tealDeep: '#063a34',
  text: '#e6f6f3',
  dim: 'rgba(230, 246, 243, 0.62)',
  faint: 'rgba(230, 246, 243, 0.30)',
  micro: 'rgba(230, 246, 243, 0.16)',
  amber: '#f2c14e',
  rose: '#ef7a8a',
} as const;

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Tracking runs inverse to size: wide on small labels, tight on large numerals. */
export function font(ctx: CanvasRenderingContext2D, size: number, weight = 400, tracking = size < 14 ? 0.18 : 0.02): void {
  ctx.font = `${weight} ${size}px ${MONO}`;
  ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`;
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** L-shaped ticks, never a closed rectangle — corners imply the frame without drawing it. */
export function corners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len = 14, color: string = PALETTE.tealDim, which = 'all'): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const c: Array<[number, number, number, number]> = [];
  if (which === 'all' || which.includes('tl')) c.push([x, y + len, x, y], [x, y, x + len, y]);
  if (which === 'all' || which.includes('tr')) c.push([x + w - len, y, x + w, y], [x + w, y, x + w, y + len]);
  if (which === 'all' || which.includes('bl')) c.push([x, y + h - len, x, y + h], [x, y + h, x + len, y + h]);
  if (which === 'all' || which.includes('br')) c.push([x + w - len, y + h, x + w, y + h], [x + w, y + h, x + w, y + h - len]);
  ctx.beginPath();
  for (let i = 0; i < c.length; i += 2) { ctx.moveTo(c[i][0], c[i][1]); ctx.lineTo(c[i][2], c[i][3]); ctx.lineTo(c[i + 1][2], c[i + 1][3]); }
  ctx.stroke();
}

/** Reference code in a lighter weight, then the label, on a skewed slab with a tapering underline. */
export function slab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ref: string, label: string, accent?: string): void {
  const h = 34;
  ctx.save();
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.fillStyle = 'rgba(68, 224, 204, 0.07)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  font(ctx, 9, 400);
  text(ctx, ref, x + 10, y + 22, PALETTE.faint);
  font(ctx, 17, 500, 0.06);
  const labelX = x + 12 + ctx.measureText(ref).width + 14;
  text(ctx, label, labelX, y + 24, PALETTE.text);
  if (accent) text(ctx, accent, labelX + ctx.measureText(label).width + 8, y + 24, PALETTE.teal);

  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h + 5);
  ctx.lineTo(x + w - 18, y + h + 5);
  ctx.lineTo(x + w - 30, y + h + 13);
  ctx.stroke();
}

/**
 * The anchor. Everything else on screen jitters; this holds still, which is what makes it read as
 * the one thing that matters. Chevron terminators point in the direction of flow.
 */
export function statusBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, code: string, pulse: number): void {
  const h = 62;
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, 'rgba(68, 224, 204, 0.06)');
  grad.addColorStop(0.5, `rgba(68, 224, 204, ${0.22 + pulse * 0.06})`);
  grad.addColorStop(1, 'rgba(68, 224, 204, 0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Bright core line: the single hottest element in the frame.
  ctx.fillStyle = PALETTE.teal;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = PALETTE.teal;
  ctx.lineWidth = 2;
  for (const [cx, dir] of [[x + 26, 1], [x + w - 26, -1]] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.moveTo(cx + 10 * dir, y + 16);
    ctx.lineTo(cx - 6 * dir, y + h / 2);
    ctx.lineTo(cx + 10 * dir, y + h - 16);
    ctx.stroke();
  }

  font(ctx, 10, 400);
  ctx.textAlign = 'center';
  text(ctx, code, x + w / 2, y + 16, PALETTE.tealDim);
  font(ctx, 26, 500, 0.22);
  text(ctx, label, x + w / 2, y + h / 2 + 9, PALETTE.text);
  ctx.textAlign = 'left';
}

export function ringGauge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, value: number, fill: number, caption: string): void {
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
    const on = i / 40 < fill;
    ctx.strokeStyle = on ? PALETTE.teal : PALETTE.micro;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    ctx.lineTo(cx + Math.cos(a) * (r + (on ? 12 : 8)), cy + Math.sin(a) * (r + (on ? 12 : 8)));
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  font(ctx, 20, 500, 0.02);
  text(ctx, (value > 0 ? '+' : '') + value, cx, cy + 7, PALETTE.text);
  font(ctx, 8, 400);
  text(ctx, caption, cx, cy + r + 26, PALETTE.faint);
  ctx.textAlign = 'left';
}

export function barMeter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number): void {
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = PALETTE.tealDim;
  ctx.fillRect(x + 2, y + h - 2 - (h - 4) * fill, w - 4, (h - 4) * fill);
}

/** Pure activity texture — reads as a live system without carrying information. */
export function dotMatrix(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, seed: number): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = ((c * 7 + r * 13 + seed) % 11) < 4;
      ctx.fillStyle = on ? PALETTE.tealDim : PALETTE.micro;
      ctx.fillRect(x + c * 6, y + r * 6, 4, 4);
    }
  }
}

/** Key/value stack. Missing values render as dashes so the cell still occupies its place. */
export function dataTable(ctx: CanvasRenderingContext2D, x: number, y: number, rows: Array<[string, string]>, valueX = 150): void {
  font(ctx, 10, 400);
  rows.forEach(([k, v], i) => {
    const ly = y + i * 17;
    text(ctx, k, x, ly, PALETTE.dim);
    text(ctx, v, x + valueX, ly, v === '-' || v === '--' ? PALETTE.micro : PALETTE.text);
  });
}

export function tickScale(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, labels: string[]): void {
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  font(ctx, 8, 400);
  labels.forEach((l, i) => {
    const ly = y + (i / (labels.length - 1)) * h;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + (i % 2 ? 5 : 10), ly);
    ctx.stroke();
    text(ctx, l, x + 15, ly + 3, PALETTE.faint);
  });
}

export function gridPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 18): void {
  ctx.strokeStyle = 'rgba(68, 224, 204, 0.055)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += step) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
  for (let gy = y; gy <= y + h; gy += step) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
  ctx.stroke();
}

/** Micro type: deliberately below the reading threshold, present as texture. */
export function microRail(ctx: CanvasRenderingContext2D, x: number, y: number, lines: string[]): void {
  font(ctx, 7, 400, 0.3);
  lines.forEach((l, i) => text(ctx, l, x, y + i * 11, PALETTE.micro));
}

export function dashedRule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Tab strip with a routed underline — the active tab owns the rule beneath it. */
export function tabBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, tabs: string[], active: number): void {
  const step = w / tabs.length;
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.lineTo(x + w, y + 14);
  ctx.stroke();
  ctx.textAlign = 'center';
  tabs.forEach((t, i) => {
    const cx = x + step * i + step / 2;
    font(ctx, 10, 500);
    text(ctx, t, cx, y, i === active ? PALETTE.teal : PALETTE.faint);
    if (i === active) {
      ctx.strokeStyle = PALETTE.teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 34, y + 14);
      ctx.lineTo(cx + 34, y + 14);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';
}

/**
 * One redundant channel: a checklist where every row carries a trailing state mark. Drawn three
 * times side by side, identical panels read as parallel units rather than three different things.
 */
export function channelPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: Array<[string, boolean]>, id: string): void {
  const h = rows.length * 18 + 16;
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  font(ctx, 8, 400);
  rows.forEach(([label, ok], i) => {
    const ly = y + 18 + i * 18;
    text(ctx, label, x + 8, ly, ok ? PALETTE.dim : PALETTE.amber);
    ctx.fillStyle = ok ? PALETTE.teal : PALETTE.amber;
    ctx.fillRect(x + w - 14, ly - 6, 6, 6);
  });
  font(ctx, 8, 400);
  ctx.textAlign = 'right';
  text(ctx, id, x + w, y + h + 12, PALETTE.faint);
  ctx.textAlign = 'left';
}

/** Right-angle trace with a junction dot at each corner — modules wired together, not floating. */
export function circuitTrace(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.strokeStyle = PALETTE.tealDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
  ctx.stroke();
  ctx.fillStyle = PALETTE.teal;
  for (const [px, py] of pts.slice(1, -1)) ctx.fillRect(px - 2, py - 2, 4, 4);
}

/** Polar plot: concentric rings, cross axes, and blips at bearing/range. */
export function polarPlot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, blips: Array<[number, number]>, sweep: number): void {
  ctx.strokeStyle = PALETTE.tealFaint;
  ctx.lineWidth = 1;
  for (const f of [0.35, 0.7, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();

  const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
  grad.addColorStop(0, 'rgba(68, 224, 204, 0.5)');
  grad.addColorStop(1, 'rgba(68, 224, 204, 0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
  ctx.stroke();

  for (const [bearing, range] of blips) {
    const bx = cx + Math.cos(bearing) * r * range;
    const by = cy + Math.sin(bearing) * r * range;
    // Fades with how long ago the sweep passed: a blip is a memory of the last pass.
    const age = ((sweep - bearing + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2);
    ctx.fillStyle = `rgba(68, 224, 204, ${Math.max(0.12, 1 - age)})`;
    ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
  }
}

/**
 * A tracking callout: marker bracket, elbow leader line, then the label block. `side` flips the
 * elbow so a callout never runs off its own edge of the frame.
 */
export function callout(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, lines: string[], side: 1 | -1, lead = 70): void {
  ctx.strokeStyle = PALETTE.teal;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 9, y - 9, 18, 18);

  const ex = x + lead * side;
  const ey = y - 44;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 11 * side, y - 4);
  ctx.lineTo(ex - 14 * side, ey + 12);
  ctx.lineTo(ex + 6 * side, ey + 12);
  ctx.stroke();

  ctx.textAlign = side === 1 ? 'left' : 'right';
  const tx = ex + 10 * side;
  font(ctx, 19, 500, 0.12);
  text(ctx, name, tx, ey + 4, PALETTE.text);
  font(ctx, 8, 400);
  lines.forEach((l, i) => text(ctx, l, tx, ey + 18 + i * 11, PALETTE.dim));
  ctx.textAlign = 'left';
}

/** Search state: verb on top, subject below it, then the result rows as they resolve. */
export function scanPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, verb: string, subject: string, rows: Array<[string, string]>, revealed: number): void {
  font(ctx, 9, 400);
  text(ctx, verb, x + 8, y, PALETTE.dim);

  ctx.fillStyle = 'rgba(68, 224, 204, 0.14)';
  ctx.fillRect(x, y + 8, w, 40);
  font(ctx, 26, 500, 0.06);
  text(ctx, subject, x + 10, y + 38, PALETTE.text);

  rows.forEach(([head, detail], i) => {
    if (i >= revealed) return;
    const ry = y + 76 + i * 30;
    font(ctx, 10, 500);
    text(ctx, head, x + 8, ry, PALETTE.teal);
    font(ctx, 9, 400);
    text(ctx, detail, x + 8, ry + 13, PALETTE.dim);
  });
}
