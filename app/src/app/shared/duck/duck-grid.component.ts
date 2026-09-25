import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { MosaicClient, type Coordinator, type Selection } from '@uwdata/mosaic-core';
import { Query, and, count, type FilterExpr } from '@uwdata/mosaic-sql';
import type { Table } from '@uwdata/flechette';
import type { ColumnDef } from './column-def';
import { DuckDbService } from './duckdb.service';
import { RowWindow, scrollToStart, spacerHeight, startToScroll, windowRange } from './row-window';
import { windowSql, type Range, type Sort } from './window-sql';

const DEBOUNCE_MS = 30;

/** Mosaic client whose only job is the row count under the current brush. */
class CountClient extends MosaicClient {
  constructor(brush: Selection, private readonly table: string, private readonly onCount: (n: number) => void, private readonly onError: (m: string) => void) { super(brush); }
  override query(filter: FilterExpr | null = null) { return Query.from(this.table).select({ n: count() }).where(filter ?? []); }
  override queryResult(data: unknown) { this.onCount(Number((data as Table).getChild('n')?.at(0) ?? 0)); return this; }
  override queryError(err: { message?: string }) { this.onError(err.message ?? String(err)); return this; }
}

/**
 * A windowed grid over a DuckDB table. The scroller owns a row index, not a pixel offset: the
 * spacer is capped (see row-window.ts) and scroll position maps proportionally to a row, while
 * the wheel and the keyboard move the row index directly. Only the rows on screen, plus one
 * screen of overscan each side, are ever fetched, and only those become strings.
 */
@Component({
  selector: 'app-duck-grid',
  imports: [DecimalPipe],
  template: `
    <div class="grid" role="grid" [attr.aria-rowcount]="total()" [attr.aria-colcount]="columns().length" [style.--row-h.px]="rowHeight">
      <div class="header" role="row" [style.gridTemplateColumns]="template()">
        @for (c of columns(); track c.key) {
          <button type="button" role="columnheader" class="th" [class.right]="c.align === 'right'" [attr.aria-sort]="ariaSort(c.key)" [disabled]="c.sortable === false" (click)="cycleSort(c.key)">
            <span>{{ c.label }}</span>@if (sort()?.key === c.key) { <i aria-hidden="true">{{ sort()?.dir === 'asc' ? '▲' : '▼' }}</i> }
          </button>
        }
      </div>
      <div class="scroller" #scroller tabindex="0" aria-label="Rows; arrow keys and Page Up/Down move, Home and End jump" (scroll)="onScroll()" (wheel)="onWheel($event)" (keydown)="onKey($event)">
        <div class="window">
          @for (row of windowRows(); track $index) {
            <div class="tr" role="row" [attr.aria-rowindex]="start() + $index + 1" [style.gridTemplateColumns]="template()">
              @for (c of columns(); track c.key; let ci = $index) {
                <span class="td" role="gridcell" [class.right]="c.align === 'right'">{{ row ? cell(c, row[ci]) : '—' }}</span>
              }
            </div>
          }
        </div>
        <div class="spacer" [style.height.px]="spacer()"></div>
      </div>
      <div class="foot mono">
        <span>{{ total() | number }} rows</span>
        <span>{{ start() + 1 | number }}–{{ (start() + windowRows().length) | number }}</span>
        @if (error()) { <span class="err" role="alert">{{ error() }}</span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    .grid { display: flex; flex-direction: column; height: 100%; min-height: 0; border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--panel); overflow: hidden; font-size: 12px; }
    .header, .tr { display: grid; column-gap: 0; min-width: max-content; }
    .header { border-bottom: 1px solid var(--hairline); background: var(--well); }
    .th { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 0; border-right: 1px solid var(--hairline); background: none; color: var(--on-ink-dim); font: 500 10px/1 var(--font-mono); letter-spacing: 0.12em; text-align: left; cursor: pointer; touch-action: manipulation; }
    .th:hover { color: var(--on-ink); background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .th:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    .th:disabled { cursor: default; color: var(--on-ink-faint); }
    .th.right { justify-content: flex-end; }
    .th i { color: var(--teal); font-style: normal; }
    .scroller { position: relative; flex: 1; min-height: 0; overflow: auto; outline: none; }
    .scroller:focus-visible { box-shadow: inset 0 0 0 2px var(--teal); }
    .window { position: sticky; top: 0; z-index: 1; min-width: max-content; }
    .spacer { width: 1px; }
    .tr { height: var(--row-h); border-bottom: 1px solid color-mix(in srgb, var(--hairline) 60%, transparent); }
    .tr:hover { background: color-mix(in srgb, var(--teal) 6%, transparent); }
    .td { display: flex; align-items: center; padding: 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .td.right { justify-content: flex-end; font-family: var(--font-mono); }
    .foot { display: flex; gap: 16px; padding: 6px 10px; border-top: 1px solid var(--hairline); font-size: 10px; letter-spacing: 0.08em; color: var(--on-ink-dim); }
    .err { color: var(--rose); letter-spacing: 0; }
  `,
})
export class DuckGridComponent {
  readonly table = input.required<string>();
  readonly columns = input.required<ColumnDef[]>();
  readonly brush = input.required<Selection>();
  readonly stableKey = input('well_id');
  readonly rowHeight = 28;

  readonly total = signal(0);
  readonly sort = signal<Sort | null>(null);
  readonly start = signal(0);
  readonly error = signal<string | null>(null);
  /** performance.now() when the first window painted; the bench reads it. Reset on regenerate via reset(). */
  readonly firstRowAt = signal<number | null>(null);
  readonly scrolling = signal(false);

  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly duck = inject(DuckDbService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cache = new RowWindow();
  private readonly version = signal(0);
  private readonly viewportHeight = signal(560);
  private client: CountClient | null = null;
  private coordinator: Coordinator | null = null;
  private fetchTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private expectedScrollTop = 0;
  private resize: ResizeObserver | null = null;

  readonly visible = computed(() => Math.max(1, Math.ceil(this.viewportHeight() / this.rowHeight)));
  readonly spacer = computed(() => spacerHeight(this.total(), this.rowHeight));
  readonly template = computed(() => this.columns().map((c) => `${c.width}px`).join(' '));
  readonly windowRows = computed(() => {
    this.version();
    const n = Math.min(this.visible(), Math.max(0, this.total() - this.start()));
    return Array.from({ length: n }, (_, i) => this.cache.get(this.start() + i));
  });

  constructor() {
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      this.viewportHeight.set(el.clientHeight || 560);
      this.resize = new ResizeObserver(() => { this.viewportHeight.set(el.clientHeight || 560); this.scheduleFetch(); });
      this.resize.observe(el);
      void this.connect();
    });
    // A new brush object (regenerate) reconnects the count client.
    effect(() => { this.brush(); untracked(() => { if (this.coordinator) void this.connect(); }); });
    this.destroyRef.onDestroy(() => { this.disconnect(); this.resize?.disconnect(); if (this.fetchTimer) clearTimeout(this.fetchTimer); });
  }

  private async connect(): Promise<void> {
    this.disconnect();
    this.coordinator = await this.duck.ready();
    this.client = new CountClient(this.brush(), this.table(), (n) => this.onCount(n), (m) => this.error.set(m));
    this.coordinator.connect(this.client);
  }

  private disconnect(): void {
    if (this.client && this.coordinator) this.coordinator.disconnect(this.client);
    this.client = null;
  }

  /** Forget everything and start from the top; the page calls this after regenerating the table. */
  reset(): void {
    this.cache.clear();
    this.firstRowAt.set(null);
    this.moveTo(0);
    this.version.update((v) => v + 1);
  }

  private onCount(n: number): void {
    this.error.set(null);
    this.total.set(n);
    this.cache.clear();
    this.moveTo(Math.min(this.start(), Math.max(0, n - this.visible())));
    this.version.update((v) => v + 1);
    this.scheduleFetch();
  }

  cell(c: ColumnDef, v: unknown): string {
    if (v === null || v === undefined) return '';
    return c.format ? c.format(v) : String(v);
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  cycleSort(key: string): void {
    const s = this.sort();
    this.setSort(s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null);
  }

  setSort(sort: Sort | null): void {
    this.sort.set(sort);
    this.cache.clear();
    this.version.update((v) => v + 1);
    this.scheduleFetch();
  }

  /** Set the first visible row and write the matching scroll position, remembering it so onScroll ignores the echo. */
  private moveTo(start: number): void {
    const s = Math.max(0, Math.min(start, Math.max(0, this.total() - this.visible())));
    this.start.set(s);
    const el = this.scroller().nativeElement;
    this.expectedScrollTop = startToScroll(s, this.total(), this.visible(), this.rowHeight, this.viewportHeight());
    if (Math.abs(el.scrollTop - this.expectedScrollTop) >= 1) el.scrollTop = this.expectedScrollTop;
    this.markScrolling();
    this.scheduleFetch();
  }

  onScroll(): void {
    const el = this.scroller().nativeElement;
    if (Math.abs(el.scrollTop - this.expectedScrollTop) < 1) return; // our own write
    this.expectedScrollTop = el.scrollTop;
    this.start.set(scrollToStart(el.scrollTop, this.total(), this.visible(), this.rowHeight, this.viewportHeight()));
    this.markScrolling();
    this.scheduleFetch();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rows = Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / this.rowHeight));
    this.moveTo(this.start() + rows);
  }

  onKey(e: KeyboardEvent): void {
    const page = this.visible() - 1;
    const next = e.key === 'ArrowDown' ? this.start() + 1 : e.key === 'ArrowUp' ? this.start() - 1
      : e.key === 'PageDown' ? this.start() + page : e.key === 'PageUp' ? this.start() - page
      : e.key === 'Home' ? 0 : e.key === 'End' ? this.total() : null;
    if (next === null) return;
    e.preventDefault();
    this.moveTo(next);
  }

  private markScrolling(): void {
    this.scrolling.set(true);
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => this.scrolling.set(false), 300);
  }

  private scheduleFetch(): void {
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = setTimeout(() => void this.fetch(), DEBOUNCE_MS);
  }

  private async fetch(): Promise<void> {
    const total = this.total();
    if (!this.coordinator || !this.client || total === 0) return;
    const range: Range = windowRange(this.start(), this.visible(), total, this.visible());
    // Skip when every row in range is cached already.
    let missing = false;
    for (let i = range.start; i < range.end && !missing; i++) if (!this.cache.get(i)) missing = true;
    if (!missing) return;
    // predicate() hands back one node or a list of them (one per clause); the list is an AND.
    const p = this.brush().predicate(this.client);
    const node = Array.isArray(p) ? (p.length ? and(p) : null) : p;
    const sql = windowSql(this.table(), this.columns().map((c) => c.key), node ? String(node) : null, this.sort(), this.stableKey(), range);
    const token = this.cache.begin();
    try {
      const t = (await this.coordinator.query(sql, { type: 'arrow', cache: false })) as Table;
      const cols = t.toColumns() as Record<string, ArrayLike<unknown>>;
      const keys = this.columns().map((c) => c.key);
      const rows: unknown[][] = Array.from({ length: t.numRows }, (_, i) => keys.map((k) => cols[k][i]));
      if (!this.cache.accept(token, range, rows)) return;
      this.error.set(null);
      this.version.update((v) => v + 1);
      if (this.firstRowAt() === null) requestAnimationFrame(() => this.firstRowAt.set(performance.now()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
