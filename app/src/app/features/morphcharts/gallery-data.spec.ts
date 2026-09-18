import { useVendoredData } from './gallery-data';

/**
 * A wrong rewrite here shows up as an empty canvas, not as an error — the same failure mode that
 * hid four broken dataset paths in the Vega gallery until someone looked at every chart.
 */
describe('useVendoredData', () => {
  it('points a vendored dataset at our own data folder whatever host it came from', () => {
    const spec = '{"url": "https://raw.githubusercontent.com/vega/vega-datasets/refs/heads/main/data/flare.json"}';
    expect(useVendoredData(spec)).toBe('{"url": "data/flare.json"}');
  });

  it('covers all five remote datasets the gallery reaches for', () => {
    for (const f of ['flare.json', 'miserables.json', 'population.json', 'demovote.tsv', 'polio_incidence_rates_us.csv']) {
      expect(useVendoredData(`{"url": "https://example.com/some/path/${f}"}`)).toBe(`{"url": "data/${f}"}`);
    }
  });

  it('leaves a remote file we do not hold alone, so the spec still works over the network', () => {
    const spec = '{"url": "https://example.com/data/not-vendored.csv"}';
    expect(useVendoredData(spec)).toBe(spec);
  });

  it('leaves relative paths alone — those already resolve against our own base', () => {
    const spec = '{"url": "data/ustornados_1950-2024.csv"}';
    expect(useVendoredData(spec)).toBe(spec);
  });

  it('does not rewrite a spec\'s own schema url', () => {
    const spec = '{"$schema": "https://vega.github.io/schema/vega/v5.json"}';
    expect(useVendoredData(spec)).toBe(spec);
  });
});
