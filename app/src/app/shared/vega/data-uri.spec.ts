import { VEGA_DATA_BASE, resolveDataUri } from './data-uri';

/**
 * These rewrites are the only reason 14 of the vendored gallery specs render at all, and every one
 * of them was found by a chart coming up empty rather than by anything failing loudly. Pinning them
 * here means a future edit has to be deliberate.
 */
describe('resolveDataUri', () => {
  it('sends the two vendored datasets at our own copy, whatever prefix the spec used', () => {
    // scatter3D asks one way, titanic the other; both files are absent from Vega's host.
    expect(resolveDataUri('../../sample-data/demovote.tsv')).toBe(new URL('data/demovote.tsv', document.baseURI).href);
    expect(resolveDataUri('assets/data/titanicmaster.tsv')).toBe(new URL('data/titanicmaster.tsv', document.baseURI).href);
  });

  it('strips the Vega Editor assets/ prefix so the path resolves against the data folder', () => {
    expect(resolveDataUri('assets/data/miserables.json')).toBe('data/miserables.json');
    expect(resolveDataUri('assets/data/penguins.json')).toBe('data/penguins.json');
  });

  it('leaves ordinary relative paths alone for the baseURL to resolve', () => {
    expect(resolveDataUri('data/cars.json')).toBe('data/cars.json');
    expect(resolveDataUri('data/stocks.csv')).toBe('data/stocks.csv');
  });

  it('pulls the platformer sprite sheet off its image host', () => {
    // The only asset in the gallery fetched from outside Vega's data folder, and the only one an
    // earlier sweep missed: it hangs off a mark's `url` encoding, not off a data definition.
    expect(resolveDataUri('https://i.ibb.co/ZBc5RZK/Screen-Shot-2020-12-13-at-3-36-09-PM.png'))
      .toBe(new URL('data/vega/data/platformer-sprites.png', document.baseURI).href);
  });

  it('does not touch an absolute URL we hold no copy of', () => {
    const url = 'https://example.com/data/thing.json';
    expect(resolveDataUri(url)).toBe(url);
  });

  it('matches vendored datasets on filename, not on the directory they came from', () => {
    // The rule is filename-based precisely because the two specs disagree about the prefix.
    expect(resolveDataUri('data/demovote.tsv')).toContain('data/demovote.tsv');
    expect(resolveDataUri('demovote.tsv')).toMatch(/^https?:/);
    // A different file in the same directory is not swept along with it.
    expect(resolveDataUri('data/cars.json')).toBe('data/cars.json');
  });

  it('points relative data at our own copy of Vega\'s data folder', () => {
    expect(VEGA_DATA_BASE).toBe(new URL('data/vega/', document.baseURI).href);
    expect(VEGA_DATA_BASE).not.toContain('vega.github.io');
  });
});
