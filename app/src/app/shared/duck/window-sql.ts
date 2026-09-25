export interface Sort { key: string; dir: 'asc' | 'desc' }
export interface Range { start: number; end: number }

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * The grid's window query. OFFSET, not keyset: a scrollbar needs random access, and DuckDB runs
 * ORDER BY … LIMIT … OFFSET as a top-N heap, low milliseconds even at 10M rows. The stable key
 * breaks ties so a page never shifts under the reader between two fetches.
 */
export function windowSql(table: string, columns: string[], predicate: string | null, sort: Sort | null, stableKey: string, range: Range): string {
  const select = columns.map(quoteIdent).join(', ');
  const where = predicate ? ` WHERE ${predicate}` : '';
  const order = sort
    ? `${quoteIdent(sort.key)} ${sort.dir.toUpperCase()}${sort.key === stableKey ? '' : `, ${quoteIdent(stableKey)}`}`
    : quoteIdent(stableKey);
  return `SELECT ${select} FROM ${table}${where} ORDER BY ${order} LIMIT ${range.end - range.start} OFFSET ${range.start}`;
}
