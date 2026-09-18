import { VEGA_DATA_BASE, resolveDataUri } from './data-uri';

/**
 * These rewrites are the only reason 14 of the vendored gallery specs render at all, and every one
 * of them was found by a chart coming up empty rather than by anything failing loudly. Pinning them
 * here means a future edit has to be deliberate.
 */
describe('resolveDataUri', () => {
  it('sends the two SandDance datasets to SandDance, whatever prefix the spec used', () => {
    // scatter3D asks one way, titanic the other; both files are absent from Vega's host.
    expect(resolveDataUri('../../sample-data/demovote.tsv'))
      .toBe('https://microsoft.github.io/SandDance/sample-data/demovote.tsv');
    expect(resolveDataUri('assets/data/titanicmaster.tsv'))
      .toBe('https://microsoft.github.io/SandDance/sample-data/titanicmaster.tsv');
  });

  it('strips the Vega Editor assets/ prefix so the path resolves on vega.github.io', () => {
    expect(resolveDataUri('assets/data/miserables.json')).toBe('data/miserables.json');
    expect(resolveDataUri('assets/data/penguins.json')).toBe('data/penguins.json');
  });

  it('leaves ordinary relative paths alone for the baseURL to resolve', () => {
    expect(resolveDataUri('data/cars.json')).toBe('data/cars.json');
    expect(resolveDataUri('data/stocks.csv')).toBe('data/stocks.csv');
  });

  it('does not touch absolute URLs', () => {
    const url = 'https://example.com/data/thing.json';
    expect(resolveDataUri(url)).toBe(url);
  });

  it('matches SandDance datasets on filename, not on the directory they came from', () => {
    // The rule is filename-based precisely because the two specs disagree about the prefix.
    expect(resolveDataUri('data/demovote.tsv')).toContain('SandDance');
    expect(resolveDataUri('demovote.tsv')).toContain('SandDance');
    // A different file in the same directory is not swept along with it.
    expect(resolveDataUri('data/cars.json')).not.toContain('SandDance');
  });

  it('points relative data at Vega rather than at this app', () => {
    expect(VEGA_DATA_BASE).toBe('https://vega.github.io/vega/');
  });
});
