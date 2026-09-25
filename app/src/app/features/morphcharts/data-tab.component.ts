import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import type { DatasetInfo } from '../../shared/morphcharts/morphcharts-host';

const TYPE_NAMES: Record<number, string> = { 0: '', 1: 'float', 2: 'integer', 4: 'string', 8: 'date' };
const PAGE_SIZE = 20;
const MAX_CELL = 50;

/**
 * The Data tab: upload CSV or image files that specs can reference by name, browse the datasets
 * of the parsed plot page by page, and export them as CSV or JSON.
 */
@Component({
  selector: 'app-data-tab',
  imports: [DecimalPipe],
  template: `
    <div class="col" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
      <label class="upload">
        <input class="sr-only" type="file" accept=".csv,.jpg,.jpeg,.png" (change)="onFile($event)">
        <span class="btn small">Add CSV or image…</span>
        <span class="hint">Reference uploads in a spec with <code>"file": "name.csv"</code></span>
      </label>
      @if (fileNames().length) {
        <div class="row">
          <label for="dt-files">Files</label>
          <select id="dt-files" [value]="selectedFile()" (change)="selectedFile.set($any($event.target).value)">
            @for (name of fileNames(); track name) { <option [value]="name">{{ name }}</option> }
          </select>
          <button type="button" class="btn small" (click)="deleteFile()">Delete</button>
        </div>
      }
      @if (datasets().length) {
        <div class="row">
          <label for="dt-datasets">Datasets</label>
          <select id="dt-datasets" [value]="selectedIndex()" (change)="selectDataset(+$any($event.target).value)">
            @for (d of datasets(); track d.name; let i = $index) { <option [value]="i">{{ d.name }}</option> }
          </select>
          <span class="hint">{{ rowCount() | number }} rows</span>
        </div>
        <div class="row">
          <label for="dt-page">Page</label>
          <input id="dt-page" type="number" inputmode="numeric" autocomplete="off" min="1" [max]="totalPages()" [value]="page() + 1" (change)="goTo(+$any($event.target).value)"> of {{ totalPages() }}
          <button type="button" class="btn small" [disabled]="page() === 0" (click)="page.set(page() - 1)">Prev</button>
          <button type="button" class="btn small" [disabled]="page() >= totalPages() - 1" (click)="page.set(page() + 1)">Next</button>
        </div>
        <div class="row">
          <button type="button" class="btn small" (click)="exportDataset()">Export</button>
          <label class="row"><input type="radio" name="export" value="json" [checked]="exportFormat() === 'json'" (change)="exportFormat.set('json')"> JSON</label>
          <label class="row"><input type="radio" name="export" value="csv" [checked]="exportFormat() === 'csv'" (change)="exportFormat.set('csv')"> CSV</label>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>@for (t of columnTypes(); track $index) { <th class="type">{{ t }}</th> }</tr>
              <tr>@for (h of headings(); track $index) { <th>{{ h }}</th> }</tr>
            </thead>
            <tbody>
              @for (row of pageRows(); track $index) {
                <tr>@for (cell of row; track $index) { <td>{{ cell }}</td> }</tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="hint">Datasets appear here after the spec is parsed (press Start).</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; padding: 8px 4px; font-size: 13px; }
    .col { display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    /* The file input stays in the tab order, just off-screen; the label's button shows its focus. */
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .upload { position: relative; display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .upload:focus-within .btn { outline: 2px solid var(--teal); outline-offset: 2px; }
    label { color: var(--on-ink-dim); }
    .hint { color: var(--on-ink-faint); font-size: 12px; }
    code { color: var(--teal); }
    select, input[type=number] { font: inherit; color: var(--on-ink); background: rgba(0,0,0,0.25); border: 1px solid var(--hairline); border-radius: 6px; padding: 4px 6px; }
    input[type=number] { width: 64px; }
    .table-wrap { overflow: auto; max-height: 50vh; border: 1px solid var(--hairline); border-radius: 6px; }
    table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
    th, td { border: 1px solid var(--hairline); padding: 4px 8px; text-align: left; }
    th { color: var(--on-ink-dim); font-weight: 500; position: sticky; background: var(--panel-solid); }
    th.type { color: var(--on-ink-faint); font-family: var(--font-mono); font-size: 10px; }
  `,
})
export class DataTabComponent {
  /** Uploaded CSV text keyed by filename, passed to Spec.Plot.fromJSONAsync. */
  readonly datasetsByFile: Record<string, string> = {};
  /** Uploaded images (data URLs) keyed by filename. */
  readonly imagesByFile: Record<string, string> = {};
  readonly fileNames = signal<string[]>([]);
  readonly selectedFile = signal('');
  readonly datasets = signal<DatasetInfo[]>([]);
  readonly selectedIndex = signal(0);
  readonly page = signal(0);
  readonly exportFormat = signal<'json' | 'csv'>('json');

  readonly current = computed(() => this.datasets()[this.selectedIndex()] ?? null);
  readonly rows = computed(() => this.current()?.dataset.rows ?? []);
  readonly rowCount = computed(() => this.rows().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rowCount() / PAGE_SIZE)));
  readonly headings = computed(() => {
    const d = this.current()?.dataset;
    if (!d) return [];
    return [...(d.datum?.headings ?? []), ...d.headings];
  });
  readonly columnTypes = computed(() => {
    const d = this.current()?.dataset;
    if (!d) return [];
    const types: string[] = [];
    if (d.datum) for (let i = 0; i < d.datum.headings.length; i++) types.push(TYPE_NAMES[d.datum.getColumnType(i)] ?? '');
    for (let i = 0; i < d.headings.length; i++) types.push(TYPE_NAMES[d.getColumnType(i)] ?? '');
    return types;
  });
  readonly pageRows = computed(() => {
    const d = this.current()?.dataset;
    if (!d) return [];
    const start = this.page() * PAGE_SIZE;
    const out: string[][] = [];
    for (let i = start; i < Math.min(d.rows.length, start + PAGE_SIZE); i++) {
      const cells = [...(d.datum ? d.datum.rows[i] : []), ...d.rows[i]].map((c) => (c.length > MAX_CELL ? c.substring(0, MAX_CELL) + '…' : c));
      out.push(cells);
    }
    return out;
  });

  update(datasets: DatasetInfo[]): void {
    this.datasets.set(datasets);
    this.selectedIndex.set(0);
    this.page.set(0);
  }

  selectDataset(i: number): void { this.selectedIndex.set(i); this.page.set(0); }
  goTo(p: number): void { if (!isNaN(p) && p >= 1 && p <= this.totalPages()) this.page.set(p - 1); }

  onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.addFile(file);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length === 1) this.addFile(files[0]);
  }

  addFile(file: File): void {
    const reader = new FileReader();
    const isImage = file.type === 'image/png' || file.type === 'image/jpeg';
    const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
    if (!isImage && !isCsv) return;
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (isImage) this.imagesByFile[file.name] = result; else this.datasetsByFile[file.name] = result;
      if (!this.fileNames().includes(file.name)) this.fileNames.set([...this.fileNames(), file.name]);
      this.selectedFile.set(file.name);
    };
    if (isImage) reader.readAsDataURL(file); else reader.readAsText(file);
  }

  deleteFile(): void {
    const name = this.selectedFile();
    delete this.datasetsByFile[name];
    delete this.imagesByFile[name];
    const names = this.fileNames().filter((n) => n !== name);
    this.fileNames.set(names);
    this.selectedFile.set(names[0] ?? '');
  }

  exportDataset(): void {
    const info = this.current();
    if (!info) return;
    const columns = info.dataset.headings.map((_, i) => i);
    const format = this.exportFormat();
    const text = format === 'csv' ? info.dataset.all.toCSV(columns) : info.dataset.all.toJSON(columns);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${info.name}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
