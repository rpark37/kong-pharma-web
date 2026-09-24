import { GALLERY, barChart, heatmap, lollipop } from './vega-charts-specs';

describe('vega-charts gallery', () => {
  it('builds every gallery entry as a Vega-Lite spec with inline data', () => {
    expect(GALLERY.length).toBe(15);
    for (const chart of GALLERY) {
      const spec = chart.spec() as { $schema: string; data: { values?: unknown[] }; encoding?: unknown; layer?: unknown };
      expect(spec.$schema, chart.id).toContain('vega-lite');
      // These are self-contained demos, so the rows travel with the spec rather than
      // arriving through the component's named-dataset input.
      expect(Array.isArray(spec.data.values), chart.id).toBe(true);
      expect((spec.data.values as unknown[]).length, chart.id).toBeGreaterThan(0);
      expect(spec.encoding ?? spec.layer, chart.id).toBeDefined();
    }
  });

  it('sizes every spec to its container so the plot fills the pane', () => {
    // Paired with <app-vega-chart fill>, which gives the container a definite height.
    for (const chart of GALLERY) {
      const spec = chart.spec() as { width: unknown; height: unknown };
      expect(spec.width, chart.id).toBe('container');
      expect(spec.height, chart.id).toBe('container');
    }
  });

  it('gives every entry a unique id', () => {
    expect(new Set(GALLERY.map((c) => c.id)).size).toBe(GALLERY.length);
  });

  it('survives the JSON round-trip the editor performs', () => {
    for (const chart of GALLERY) {
      const spec = chart.spec();
      expect(() => JSON.parse(JSON.stringify(spec)), chart.id).not.toThrow();
      expect(JSON.parse(JSON.stringify(spec)), chart.id).toEqual(spec);
    }
  });

  it('rebuilds randomised sets on each call but keeps fixed ones stable', () => {
    const a = heatmap() as { data: { values: { value: number }[] } };
    const b = heatmap() as { data: { values: { value: number }[] } };
    expect(a.data.values.length).toBe(b.data.values.length);
    expect(a.data.values.map((v) => v.value)).not.toEqual(b.data.values.map((v) => v.value));
    expect(barChart()).toEqual(barChart());
  });

  it('uses theme colours rather than the source component light-mode hexes', () => {
    const spec = lollipop() as { layer: { mark: { color: string } }[] };
    for (const layer of spec.layer) expect(layer.mark.color).not.toBe('#4c78a8');
  });
});
