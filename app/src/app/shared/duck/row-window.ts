import type { Range } from './window-sql';

/** Chrome stops laying out elements past ~33.5M px; keep well under it. */
export const MAX_SCROLL_PX = 15_000_000;

export function spacerHeight(total: number, rowHeight: number): number {
  return Math.min(total * rowHeight, MAX_SCROLL_PX);
}

function maxStart(total: number, visible: number): number { return Math.max(0, total - visible); }
function maxScrollTop(total: number, rowHeight: number, viewportHeight: number): number { return Math.max(0, spacerHeight(total, rowHeight) - viewportHeight); }

/** The scroll position that shows row `start` at the top. Linear under the cap, proportional above it. */
export function startToScroll(start: number, total: number, visible: number, rowHeight: number, viewportHeight: number): number {
  const ms = maxStart(total, visible), mt = maxScrollTop(total, rowHeight, viewportHeight);
  if (ms === 0 || mt === 0) return 0;
  return Math.round((Math.min(ms, Math.max(0, start)) / ms) * mt);
}

/** The first visible row for a scroll position. Inverse of startToScroll, clamped to the table. */
export function scrollToStart(scrollTop: number, total: number, visible: number, rowHeight: number, viewportHeight: number): number {
  const ms = maxStart(total, visible), mt = maxScrollTop(total, rowHeight, viewportHeight);
  if (ms === 0 || mt === 0) return 0;
  const t = Math.min(mt, Math.max(0, scrollTop));
  return Math.round((t / mt) * ms);
}

/** The rows to fetch for a first visible row: the screen plus `overscan` rows either side. */
export function windowRange(start: number, visible: number, total: number, overscan: number): Range {
  return { start: Math.max(0, start - overscan), end: Math.min(total, start + visible + overscan) };
}

/**
 * Fetched rows by absolute index, with a token per fetch so a slow response for an old window or
 * an old predicate is dropped rather than painted. Bounded: once past `cap` rows the whole cache
 * is evicted, which is cheaper and simpler than LRU for a viewport that only ever needs one screen.
 */
export class RowWindow {
  private rows = new Map<number, unknown[]>();
  private token = 0;
  private valid = 0;
  constructor(private readonly cap = 4000) {}

  get size(): number { return this.rows.size; }

  /** Start a fetch; the returned token must be presented with the result. Invalidates earlier tokens. */
  begin(): number { this.valid = ++this.token; return this.token; }

  accept(token: number, range: Range, rows: unknown[][]): boolean {
    if (token !== this.valid) return false;
    if (this.rows.size > this.cap) this.rows.clear();
    rows.forEach((r, i) => this.rows.set(range.start + i, r));
    return true;
  }

  get(index: number): unknown[] | undefined { return this.rows.get(index); }

  clear(): void { this.rows.clear(); this.valid = ++this.token; }
}
