import { DEFAULT_ROWS, ROW_COUNTS, SCREEN_COLUMNS, SCREEN_TABLE, parseRows, screenGeneratorSql } from './screen-data';

describe('screenGeneratorSql', () => {
  it('creates the screen table from a range of the requested size', () => {
    const sql = screenGeneratorSql(1_000_000, 7);
    expect(sql).toContain(`CREATE OR REPLACE TABLE ${SCREEN_TABLE}`);
    expect(sql).toContain('range(1000000)');
  });

  it('is deterministic for a seed and differs across seeds', () => {
    expect(screenGeneratorSql(1_000_000, 7)).toBe(screenGeneratorSql(1_000_000, 7));
    expect(screenGeneratorSql(1_000_000, 7)).not.toBe(screenGeneratorSql(1_000_000, 8));
  });

  it('selects every grid column by name', () => {
    const sql = screenGeneratorSql(5_000_000, 1);
    for (const c of SCREEN_COLUMNS) expect(sql).toContain(`AS ${c.key}`);
  });

  it('rejects unsupported row counts', () => {
    expect(() => screenGeneratorSql(123, 1)).toThrow(/row count/);
  });
});

describe('parseRows', () => {
  it('accepts the offered counts and falls back to the default otherwise', () => {
    expect(parseRows('5000000')).toBe(5_000_000);
    expect(parseRows('10000000')).toBe(10_000_000);
    expect(parseRows('999')).toBe(DEFAULT_ROWS);
    expect(parseRows('abc')).toBe(DEFAULT_ROWS);
    expect(parseRows(null)).toBe(DEFAULT_ROWS);
    expect(ROW_COUNTS).toContain(DEFAULT_ROWS);
  });
});

describe('SCREEN_COLUMNS', () => {
  it('formats a timestamp cell from epoch milliseconds or a Date', () => {
    const readAt = SCREEN_COLUMNS.find((c) => c.key === 'read_at')!;
    const ms = Date.UTC(2026, 0, 5, 8, 0, 0);
    expect(readAt.format!(ms)).toBe(readAt.format!(new Date(ms)));
    expect(readAt.format!(ms)).toMatch(/2026/);
  });

  it('formats inhibition to one decimal and hits as a mark', () => {
    expect(SCREEN_COLUMNS.find((c) => c.key === 'inhibition')!.format!(12.345)).toBe('12.3');
    expect(SCREEN_COLUMNS.find((c) => c.key === 'hit')!.format!(true)).toBe('HIT');
    expect(SCREEN_COLUMNS.find((c) => c.key === 'hit')!.format!(false)).toBe('');
  });
});
