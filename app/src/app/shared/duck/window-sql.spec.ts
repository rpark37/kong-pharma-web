import { quoteIdent, windowSql } from './window-sql';

describe('windowSql', () => {
  const cols = ['well_id', 'target', 'inhibition'];

  it('selects quoted columns for the window and orders by the stable key', () => {
    const sql = windowSql('screen', cols, null, null, 'well_id', { start: 0, end: 60 });
    expect(sql).toBe('SELECT "well_id", "target", "inhibition" FROM screen ORDER BY "well_id" LIMIT 60 OFFSET 0');
  });

  it('applies the predicate, the sort, then the stable key as a tiebreak', () => {
    const sql = windowSql('screen', cols, '("inhibition" BETWEEN 10 AND 50)', { key: 'zscore', dir: 'desc' }, 'well_id', { start: 1200, end: 1260 });
    expect(sql).toBe('SELECT "well_id", "target", "inhibition" FROM screen WHERE ("inhibition" BETWEEN 10 AND 50) ORDER BY "zscore" DESC, "well_id" LIMIT 60 OFFSET 1200');
  });

  it('does not repeat the stable key when it is the sort key', () => {
    const sql = windowSql('screen', cols, null, { key: 'well_id', dir: 'asc' }, 'well_id', { start: 0, end: 10 });
    expect(sql).toContain('ORDER BY "well_id" ASC LIMIT 10');
  });

  it('quotes identifiers and escapes embedded quotes', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});
