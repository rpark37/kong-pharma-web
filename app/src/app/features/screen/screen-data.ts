import type { ColumnDef } from '../../shared/duck/column-def';
import { GENE_ORDER } from '../science/gene-stories';

export type { ColumnDef } from '../../shared/duck/column-def';

export const SCREEN_TABLE = 'screen';
export const ROW_COUNTS = [1_000_000, 5_000_000, 10_000_000] as const;
export const DEFAULT_ROWS = 1_000_000;
export const SEED = 2026;

const LIBRARIES = ['LIB-A', 'LIB-B', 'LIB-C', 'LIB-D'];
const SITES = ['Boston', 'Basel', 'Shanghai', 'Seoul', 'Oxford'];
const CONCENTRATIONS = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];
/** Mean inhibition shift per target, in GENE_ORDER order: some targets are simply more druggable in this screen. */
const TARGET_SHIFT = [12, 4, 6, 18, 9, 3, 15, 2, 5, 7, 11, 8, 14, 6];
const SD = 12;

const list = (xs: readonly (string | number)[]) => `[${xs.map((x) => (typeof x === 'string' ? `'${x}'` : x)).join(', ')}]`;
/** A uniform in [0, 1) from the row index: hash is a stable 64-bit mix, so the table is identical for a seed. */
const uniform = (mult: number, seed: number) => `(hash(i * ${mult} + ${seed}) % 1000000)::DOUBLE / 1e6`;

/**
 * The whole dataset as one CREATE TABLE. Every random-looking column is a pure function of the
 * row index and the seed. `zscore` standardises against the generating distribution (mean per
 * target and concentration, sd 12), which is what a plate-level z-score estimates.
 */
export function screenGeneratorSql(rows: number, seed: number): string {
  if (!(ROW_COUNTS as readonly number[]).includes(rows)) throw new Error(`unsupported row count ${rows}`);
  return `
CREATE OR REPLACE TABLE ${SCREEN_TABLE} AS
WITH base AS (
  SELECT i,
    ${uniform(7919, seed)} AS u1,
    ${uniform(104729, seed)} AS u2,
    ${uniform(1299709, seed)} AS u3,
    ${uniform(15485863, seed)} AS u4,
    ${uniform(32452843, seed)} AS u5
  FROM range(${rows}) t(i)
), wells AS (
  SELECT i,
    1 + floor(u3 * ${GENE_ORDER.length})::INTEGER AS target_ix,
    list_extract(${list(CONCENTRATIONS)}, 1 + (i % 8)::INTEGER) AS conc_um,
    sqrt(-2 * ln(greatest(u1, 1e-9))) * cos(2 * pi() * u2) AS z,
    u4, u5
  FROM base
), shaped AS (
  SELECT i, target_ix, conc_um, z, u4, u5,
    8 + 10 * log10(conc_um * 100) + list_extract(${list(TARGET_SHIFT)}, target_ix) AS mean
  FROM wells
)
SELECT
  i AS well_id,
  (i // 384)::INTEGER AS plate,
  chr(65 + ((i % 384) // 24)::INTEGER) || lpad(((i % 384) % 24 + 1)::VARCHAR, 2, '0') AS well,
  list_extract(${list(GENE_ORDER)}, target_ix) AS target,
  list_extract(${list(LIBRARIES)}, 1 + floor(u4 * ${LIBRARIES.length})::INTEGER) AS library,
  list_extract(${list(SITES)}, 1 + floor(u5 * ${SITES.length})::INTEGER) AS site,
  conc_um::DOUBLE AS conc_um,
  greatest(-20, least(120, mean + ${SD} * z))::DOUBLE AS inhibition,
  ((greatest(-20, least(120, mean + ${SD} * z)) - mean) / ${SD})::DOUBLE AS zscore,
  (((greatest(-20, least(120, mean + ${SD} * z)) - mean) / ${SD}) > 3) AS hit,
  TIMESTAMP '2026-01-05 08:00:00' + to_seconds(i * 2) AS read_at
FROM shaped`;
}

/** `?rows=` from the URL: one of the offered counts, else the default. */
export function parseRows(raw: string | null): number {
  const n = Number(raw);
  return (ROW_COUNTS as readonly number[]).includes(n) ? n : DEFAULT_ROWS;
}

const int = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const asDate = (v: unknown) => (v instanceof Date ? v : new Date(Number(v)));

export const SCREEN_COLUMNS: ColumnDef[] = [
  { key: 'well_id', label: 'Well ID', width: 96, align: 'right', format: (v) => int.format(Number(v)), sortable: true },
  { key: 'plate', label: 'Plate', width: 72, align: 'right', format: (v) => int.format(Number(v)), sortable: true },
  { key: 'well', label: 'Well', width: 60, sortable: true },
  { key: 'target', label: 'Target', width: 84, sortable: true },
  { key: 'library', label: 'Library', width: 72, sortable: true },
  { key: 'site', label: 'Site', width: 92, sortable: true },
  { key: 'conc_um', label: 'µM', width: 64, align: 'right', format: (v) => two.format(Number(v)), sortable: true },
  { key: 'inhibition', label: 'Inhibition %', width: 104, align: 'right', format: (v) => one.format(Number(v)), sortable: true },
  { key: 'zscore', label: 'Z', width: 72, align: 'right', format: (v) => two.format(Number(v)), sortable: true },
  { key: 'hit', label: 'Hit', width: 52, format: (v) => (v ? 'HIT' : ''), sortable: true },
  { key: 'read_at', label: 'Read at', width: 150, format: (v) => when.format(asDate(v)), sortable: true },
];
