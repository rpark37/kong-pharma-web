import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { MosaicClient, clauseInterval, clausePoints, type Coordinator, type Selection } from '@uwdata/mosaic-core';
import type { FilterExpr, Query } from '@uwdata/mosaic-sql';
import type { Table } from '@uwdata/flechette';
import type { View } from 'vega';
import { VegaChartComponent, type VegaSpecInput } from '../vega/vega-chart.component';
import { DuckDbService } from './duckdb.service';
import type { Bench } from './bench';

export type BrushKind = 'interval' | 'point';

/** A Mosaic client that hands its aggregate to a callback and reports settle time to the bench. */
class ChartClient extends MosaicClient {
  constructor(brush: Selection, private readonly build: (filter: FilterExpr) => Query, private readonly onData: (rows: Record<string, unknown>[]) => void, private readonly onError: (m: string) => void) { super(brush); }
  override query(filter: FilterExpr | null = null) { return this.build(filter ?? []); }
  override queryResult(data: unknown) { this.onData((data as Table).toArray() as Record<string, unknown>[]); return this; }
  override queryError(err: { message?: string }) { this.onError(err.message ?? String(err)); return this; }
}

/**
 * A Vega-Lite chart that is also a Mosaic client. Its aggregate query runs under the brush, so
 * every other chart's selection filters it; its own `brush` param becomes a Mosaic clause, so it
 * filters everything else. The clause carries the x scale, which lets Mosaic pre-aggregate the
 * query at pixel resolution and answer drags from a materialised view.
 */
@Component({
  selector: 'app-linked-chart',
  imports: [VegaChartComponent],
  template: `
    <app-vega-chart [spec]="spec()" [data]="data()" [height]="height()" (viewReady)="onView($event)" />
    @if (error(); as e) { <p class="err" role="alert">{{ e }}</p> }
  `,
  styles: `:host { display: block; } .err { margin: 2px 0 0; font-size: 11px; color: var(--rose); }`,
})
export class LinkedChartComponent {
  readonly spec = input.required<VegaSpecInput>();
  readonly query = input.required<(filter: FilterExpr) => Query>();
  readonly brush = input.required<Selection>();
  readonly field = input.required<string>();
  readonly kind = input<BrushKind>('interval');
  readonly dataset = input('rows');
  readonly height = input(180);
  readonly bench = input<Bench | null>(null);
  readonly error = signal<string | null>(null);

  protected readonly data = signal<Record<string, unknown[]> | null>(null);
  private readonly duck = inject(DuckDbService);
  private client: ChartClient | null = null;
  private coordinator: Coordinator | null = null;
  private view: View | null = null;
  private readonly onSignal = (_: string, value: unknown) => this.onBrush(value);

  constructor() {
    effect(() => { this.brush(); this.query(); untracked(() => void this.connect()); });
    inject(DestroyRef).onDestroy(() => { this.disconnect(); this.view?.removeSignalListener('brush', this.onSignal); });
  }

  private async connect(): Promise<void> {
    this.disconnect();
    this.coordinator = await this.duck.ready();
    this.client = new ChartClient(this.brush(), this.query(), (rows) => { this.data.set({ [this.dataset()]: rows }); this.bench()?.settled(); }, (m) => this.error.set(m));
    this.coordinator.connect(this.client);
  }

  private disconnect(): void {
    if (this.client && this.coordinator) this.coordinator.disconnect(this.client);
    this.client = null;
  }

  onView(view: View): void {
    this.view?.removeSignalListener('brush', this.onSignal);
    this.view = view;
    view.addSignalListener('brush', this.onSignal);
  }

  /** Empty this chart's Vega selection and drop its clause. The page calls it from Reset. */
  async clearBrush(): Promise<void> {
    if (this.view) {
      // An interval's store is derived from its pixel-extent signal, so that is what has to go; a
      // point selection's store is the source of truth itself.
      if (this.kind() === 'interval') this.view.signal('brush_x', [0, 0]); else this.view.data('brush_store', []);
      await this.view.runAsync();
    }
    if (this.client) this.brush().update(this.kind() === 'interval' ? clauseInterval(this.field(), null, { source: this.client }) : clausePoints([this.field()], null, { source: this.client }));
  }

  private onBrush(value: unknown): void {
    if (!this.client || !this.view) return;
    const v = (value ?? {}) as Record<string, unknown>;
    this.bench()?.brushed();
    if (this.kind() === 'point') {
      const picked = Object.values(v)[0] as unknown[] | undefined;
      this.brush().update(clausePoints([this.field()], picked?.length ? picked.map((p) => [p]) : null, { source: this.client }));
      return;
    }
    const range = Object.values(v)[0] as [number, number] | [Date, Date] | undefined;
    const x = this.view.scale('x') as unknown as { domain(): unknown[]; range(): number[] } | undefined;
    const isTime = range?.[0] instanceof Date;
    const scale = x ? { type: isTime ? 'utc' : 'linear', domain: x.domain() as [number, number], range: x.range() as [number, number] } : undefined;
    this.brush().update(clauseInterval(this.field(), range && range.length === 2 ? range : null, { source: this.client, scale, pixelSize: 1 }));
  }
}
