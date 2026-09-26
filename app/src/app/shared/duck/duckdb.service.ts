import { Injectable, signal } from '@angular/core';
import type { Coordinator } from '@uwdata/mosaic-core';
import type { Table } from '@uwdata/flechette';

export type DuckStatus = 'idle' | 'booting' | 'ready' | 'failed';

/**
 * One DuckDB in a worker, one Mosaic coordinator over it. Nothing loads until a page calls
 * `ready()`; the wasm is ~36 MB, so only the routes that need it pay for it.
 *
 * Every query goes through the coordinator: one Arrow decoder (flechette), one result cache,
 * and the pre-aggregation optimizer sees every client. Nothing here calls the raw connection.
 */
@Injectable({ providedIn: 'root' })
export class DuckDbService {
  readonly status = signal<DuckStatus>('idle');
  readonly error = signal<string | null>(null);
  /** Wall time of the first boot, for the bench strip. */
  readonly bootMs = signal<number | null>(null);
  private booting: Promise<Coordinator> | null = null;

  ready(): Promise<Coordinator> {
    if (!this.booting) this.booting = this.boot().catch((err) => { this.booting = null; throw err; });
    return this.booting;
  }

  async query(sql: string, opts: { cache?: boolean } = {}): Promise<Table> {
    const c = await this.ready();
    return c.query(sql, { type: 'arrow', cache: opts.cache ?? true }) as Promise<Table>;
  }

  async exec(sql: string): Promise<void> {
    const c = await this.ready();
    await c.exec(sql);
  }

  private async boot(): Promise<Coordinator> {
    const t0 = performance.now();
    this.status.set('booting');
    this.error.set(null);
    try {
      const [duckdb, mosaic] = await Promise.all([import('@duckdb/duckdb-wasm'), import('@uwdata/mosaic-core')]);
      // Local assets (angular.json copies them to duckdb/); resolved against the base href so
      // both the dev server and the Pages deploy under /app/ find them.
      const wasm = new URL('duckdb/duckdb-eh.wasm', document.baseURI).href;
      const workerUrl = new URL('duckdb/duckdb-browser-eh.worker.js', document.baseURI).href;
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(wasm);
      const connection = await db.connect();
      const coordinator = new mosaic.Coordinator();
      coordinator.databaseConnector(mosaic.wasmConnector({ duckdb: db, connection }));
      this.bootMs.set(Math.round(performance.now() - t0));
      this.status.set('ready');
      return coordinator;
    } catch (err) {
      this.status.set('failed');
      this.error.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
