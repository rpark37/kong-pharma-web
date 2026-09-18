/** The CSV name the spec asks for; the page supplies its text through the scene's `datasets` input. */
export const PURCHASES_FILE = 'google_purchases.csv';

/**
 * MorphCharts unit chart: every purchase is one block, stacked within its day × category bin.
 * The a21-ares original built this imperatively with `Layouts.StackTreeMap`; the vendored core
 * here has no such layout, so the same shape comes from the `unitstack` transform (see
 * `public/samples/specs/bar10.json` for the pattern).
 */
export function salesSpec(): Record<string, unknown> {
  return {
    title: 'Google Merchandise Sales',
    width: 900,
    height: 180,
    depth: 420,
    background: '#F5F5F3',
    camera: { position: [0.05, 0.6, 0.95], target: [0, -0.04, 0] },
    lights: [
      { type: 'rect', position: [-0.6, 1.4, 0.9], brightness: 6 },
      { type: 'sphere', position: [0.9, 1, -0.7], brightness: 2, color: '#44e0cc' },
    ],
    data: [
      {
        name: 'purchases',
        file: PURCHASES_FILE,
        // `date` stays a string so the day key below is a plain substring; `price` drives colour.
        format: { type: 'csv', parse: { price: 'number', date: 'string' } },
        transform: [
          { type: 'formula', as: 'day', expr: 'substring(datum.date, 0, 10)' },
          { type: 'unitstack', groupby: ['day', 'category'] },
          { type: 'extent', field: 'y1', signal: 'stacky' },
        ],
      },
    ],
    scales: [
      { name: 'xscale', type: 'band', domain: { data: 'purchases', field: 'day' }, range: 'width', padding: 0.2 },
      { name: 'yscale', type: 'linear', domain: [0, { signal: 'stacky[1]' }], range: 'height' },
      { name: 'zscale', type: 'band', domain: { data: 'purchases', field: 'category' }, range: 'depth', padding: 0.3 },
      { name: 'fillscale', type: 'linear', domain: { data: 'purchases', field: 'price' }, range: { scheme: 'viridis' } },
    ],
    axes: [
      {
        orient: 'bottom',
        orientZ: 'front',
        scale: 'xscale',
        labelBaseline: 'top',
        labelOffsetY: 0.1,
        labelAngleX: 90,
        labelAngle: -90,
        labelFontSize: 9,
        labelColor: '#2D2D2D',
        title: 'Purchase date',
        titleColor: '#2D2D2D',
        titleOffsetZ: 70,
        titleOffsetY: 0.1,
        titleAngleX: 90,
        domain: false,
      },
      {
        orient: 'left',
        orientZ: 'bottom',
        scale: 'zscale',
        labelAlign: 'right',
        labelOffsetX: -4,
        labelOffsetY: 0.1,
        labelAngleX: 90,
        labelFontSize: 8,
        labelColor: '#2D2D2D',
        title: 'Category',
        titleColor: '#2D2D2D',
        titleOffsetX: -120,
        titleOffsetY: 0.1,
        titleAngleX: 90,
        titleAngleZ: 90,
        grid: true,
        gridWidth: 0.3,
        gridColor: '#D4D4D2',
        domain: false,
      },
      {
        orient: 'right',
        orientZ: 'back',
        scale: 'yscale',
        labelAlign: 'left',
        labelOffsetX: 2,
        labelColor: '#2D2D2D',
        tickCount: 4,
        title: 'Purchases',
        titleColor: '#2D2D2D',
        titleOffsetX: 30,
        grid: true,
        gridWidth: 0.3,
        gridColor: '#D4D4D2',
      },
    ],
    marks: [
      {
        type: 'rect',
        geometry: 'xzrect',
        material: 'glossy',
        encode: {
          enter: {
            xc: { signal: 'width/2' },
            zc: { signal: 'depth/2' },
            width: { signal: 'width*1.25' },
            depth: { signal: 'depth*1.6' },
            fuzz: { value: 0.15 },
            fill: { value: '#E8E8E6' },
          },
        },
      },
      {
        from: { data: 'purchases' },
        type: 'rect',
        geometry: 'box',
        material: 'glossy',
        encode: {
          enter: {
            x: { scale: 'xscale', field: 'day' },
            width: { scale: 'xscale', band: 1 },
            y: { scale: 'yscale', field: 'y0' },
            y2: { scale: 'yscale', field: 'y1' },
            z: { scale: 'zscale', field: 'category' },
            depth: { scale: 'zscale', band: 1 },
            fill: { scale: 'fillscale', field: 'price' },
          },
        },
      },
    ],
  };
}
