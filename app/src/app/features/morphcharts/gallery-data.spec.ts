import { resolveGalleryData } from './gallery-data';

/**
 * A wrong rewrite here shows up as an empty canvas, not as an error — the same failure mode that
 * hid four broken dataset paths in the Vega gallery until someone looked at every chart.
 */
describe('resolveGalleryData', () => {
  it('sends a gallery spec\'s relative data at the upstream host', () => {
    const spec = '{"url": "data/ustornados_1950-2024.csv"}';
    expect(resolveGalleryData('gallery/ustornados1.json', spec))
      .toBe('{"url": "https://microsoft.github.io/morphcharts/data/ustornados_1950-2024.csv"}');
  });

  it('leaves textures local — a remote one taints the canvas and blanks the whole scene', () => {
    // ustornados1 lays a Mercator tile under the hex bins, earthquakes1 a coastline mask.
    const jpg = '{"images": [{"name": "map", "url": "data/-129.375,21.943046 -61.875,52.48278 6.jpg"}]}';
    const png = '{"url": "data/ocean_mask_5400x2700.png"}';
    expect(resolveGalleryData('gallery/ustornados1.json', jpg)).toBe(jpg);
    expect(resolveGalleryData('gallery/earthquakes1.json', png)).toBe(png);
  });

  it('leaves the vendored samples pointing at our own data folder', () => {
    const spec = '{"url": "data/random_walk_count_100.csv"}';
    expect(resolveGalleryData('line1.json', spec)).toBe(spec);
  });

  it('does not touch the data key itself, only paths under it', () => {
    const spec = '{"data": [{"name": "table"}]}';
    expect(resolveGalleryData('gallery/lissajous1.json', spec)).toBe(spec);
  });

  it('leaves absolute urls alone — most gallery specs already fetch from their original host', () => {
    const spec = '{"url": "https://raw.githubusercontent.com/vega/vega-datasets/main/data/flare.json"}';
    expect(resolveGalleryData('gallery/flaretreemap1.json', spec)).toBe(spec);
  });
});
