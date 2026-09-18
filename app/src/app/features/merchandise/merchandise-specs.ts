/**
 * Vega-Lite (2D) and MorphCharts (3D) specification builders for the Google Merchandise page.
 * Data is injected as named datasets so a date-range change only pushes new rows.
 */
import type * as M from '../../shared/api/models';
import { VEGA_COLORS } from '../../shared/vega/theme';

const VL = 'https://vega.github.io/schema/vega-lite/v6.json';

export function dailySpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Sessions and revenue by day',
    width: 'container',
    height: 240,
    data: { name: 'daily' },
    encoding: { x: { field: 'day', type: 'temporal', title: null, axis: { format: '%b %d', grid: false } } },
    layer: [
      { mark: { type: 'bar', color: VEGA_COLORS.violet, opacity: 0.55 }, encoding: { y: { field: 'sessions', type: 'quantitative', title: 'Sessions', axis: { titleColor: VEGA_COLORS.violet } }, tooltip: [{ field: 'day', type: 'temporal', format: '%Y-%m-%d' }, { field: 'sessions', type: 'quantitative' }, { field: 'revenue', type: 'quantitative', format: '$,.0f' }] } },
      { mark: { type: 'line', color: VEGA_COLORS.teal, strokeWidth: 2, point: { size: 20 } }, encoding: { y: { field: 'revenue', type: 'quantitative', title: 'Revenue (USD)', axis: { titleColor: VEGA_COLORS.teal, format: '$,.0f' } } } },
    ],
    resolve: { scale: { y: 'independent' } },
  };
}

export function funnelSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Session funnel',
    width: 'container',
    height: 200,
    data: { name: 'funnel' },
    transform: [{ calculate: "format(datum.pct_of_first, '.1%') + ' of sessions'", as: 'label' }],
    encoding: { y: { field: 'step', type: 'nominal', sort: { field: 'order' }, title: null, axis: { labelFontSize: 12 } } },
    layer: [
      { mark: { type: 'bar', cornerRadiusEnd: 3 }, encoding: { x: { field: 'sessions', type: 'quantitative', title: 'Sessions' }, color: { field: 'pct_of_first', type: 'quantitative', scale: { range: [VEGA_COLORS.violet, VEGA_COLORS.teal] }, legend: null }, tooltip: [{ field: 'step' }, { field: 'sessions' }, { field: 'pct_of_previous', format: '.1%', title: 'of previous step' }] } },
      { mark: { type: 'text', align: 'left', dx: 6, color: VEGA_COLORS.onInk, fontSize: 11 }, encoding: { x: { field: 'sessions', type: 'quantitative' }, text: { field: 'label' } } },
    ],
  };
}

export function countrySpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Sessions by country',
    width: 'container',
    height: 300,
    data: { name: 'countries' },
    mark: { type: 'bar', cornerRadiusEnd: 3 },
    encoding: {
      y: { field: 'country', type: 'nominal', sort: '-x', title: null },
      x: { field: 'sessions', type: 'quantitative', title: 'Sessions' },
      color: { field: 'revenue', type: 'quantitative', title: 'Revenue', scale: { scheme: 'tealblues' } },
      tooltip: [{ field: 'country' }, { field: 'sessions' }, { field: 'purchases' }, { field: 'revenue', format: '$,.0f' }],
    },
  };
}

export function deviceSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Sessions by device',
    width: 'container',
    height: 220,
    data: { name: 'devices' },
    mark: { type: 'arc', innerRadius: 55, padAngle: 0.02 },
    encoding: {
      theta: { field: 'sessions', type: 'quantitative' },
      color: { field: 'device', type: 'nominal', title: null },
      tooltip: [{ field: 'device' }, { field: 'sessions' }, { field: 'purchases' }],
    },
  };
}

export function sourceSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Traffic sources',
    width: 'container',
    height: 240,
    data: { name: 'sources' },
    transform: [{ fold: ['sessions', 'purchases'], as: ['metric', 'value'] }],
    mark: { type: 'bar', cornerRadiusEnd: 3 },
    encoding: {
      y: { field: 'source', type: 'nominal', sort: '-x', title: null },
      x: { field: 'value', type: 'quantitative', title: null, scale: { type: 'sqrt' } },
      color: { field: 'metric', type: 'nominal', title: null },
      yOffset: { field: 'metric' },
      tooltip: [{ field: 'source' }, { field: 'metric' }, { field: 'value' }],
    },
  };
}

export function itemsSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    title: 'Top products by revenue',
    width: 'container',
    height: 300,
    data: { name: 'items' },
    mark: { type: 'bar', cornerRadiusEnd: 3 },
    encoding: {
      y: { field: 'item', type: 'nominal', sort: '-x', title: null, axis: { labelLimit: 220 } },
      x: { field: 'revenue', type: 'quantitative', title: 'Revenue (USD)', axis: { format: '$,.0f' } },
      color: { field: 'category', type: 'nominal', title: null },
      tooltip: [{ field: 'item' }, { field: 'category' }, { field: 'quantity' }, { field: 'orders' }, { field: 'revenue', format: '$,.2f' }],
    },
  };
}

/** MorphCharts matrix bar chart: revenue by country (x) and month (z), path-traced. */
export function revenueCubeSpec(rows: M.RevenueCubeRow[]): Record<string, unknown> {
  const values = rows.map((r) => ({ country: r.country, month: r.month, revenue: Math.round(r.revenue) }));
  return {
    title: 'Revenue by country and month',
    width: 640,
    height: 220,
    depth: 200,
    background: '#121c24',
    camera: { position: [0.15, 0.55, 1.25], target: [0, -0.05, 0] },
    lights: [{ type: 'rect', position: [-0.6, 1.2, 0.8], brightness: 6 }, { type: 'sphere', position: [0.8, 0.9, -0.6], brightness: 2, color: '#44e0cc' }],
    config: { range: { category: { scheme: 'set2' } } },
    data: [{ name: 'table', values }],
    scales: [
      { name: 'xscale', type: 'band', domain: { data: 'table', field: 'country', sort: { field: 'revenue', op: 'sum', order: 'descending' } }, range: 'width', padding: 0.3 },
      { name: 'yscale', type: 'linear', domain: { data: 'table', field: 'revenue' }, nice: true, range: 'height' },
      { name: 'zscale', type: 'band', domain: { data: 'table', field: 'month' }, range: 'depth', reverse: true, padding: 0.3 },
      { name: 'color', type: 'ordinal', range: 'category', domain: { data: 'table', field: 'month' } },
    ],
    axes: [
      { orient: 'bottom', orientZ: 'front', scale: 'xscale', labelBaseline: 'top', labelOffsetY: 0.1, labelAngleX: 90, labelFontSize: 9, labelColor: '#e6f6f3', title: 'Country', titleColor: '#e6f6f3', titleOffsetZ: 28, titleOffsetY: 0.1, titleAngleX: 90, gridZ: true, gridWidth: 0.4, gridColor: '#24343f', domain: false },
      { orient: 'left', orientZ: 'bottom', scale: 'zscale', labelAlign: 'right', labelOffsetY: 0.1, labelAngleX: 90, labelColor: '#e6f6f3', title: 'Month', titleColor: '#e6f6f3', titleOffsetX: -40, titleOffsetY: 0.1, titleAngleX: 90, titleAngleZ: 90, grid: true, gridWidth: 0.4, gridColor: '#24343f', domain: false },
      { orient: 'right', orientZ: 'back', scale: 'yscale', labelAlign: 'left', labelOffsetX: 2, labelColor: '#e6f6f3', tickCount: 4, title: 'Revenue', titleColor: '#e6f6f3', titleOffsetX: 32, grid: true, gridWidth: 0.3, gridColor: '#24343f' },
    ],
    marks: [
      { type: 'rect', geometry: 'xzrect', material: 'glossy', encode: { enter: { xc: { signal: 'width/2' }, zc: { signal: 'depth/2' }, width: { signal: 'width*2' }, depth: { signal: 'width*2' }, fuzz: { value: 0.15 }, fill: { value: '#192630' } } } },
      { from: { data: 'table' }, type: 'rect', geometry: 'cuboid', material: 'glossy', encode: { enter: { x: { scale: 'xscale', field: 'country' }, width: { scale: 'xscale', band: 1 }, y: { scale: 'yscale', value: 0 }, y2: { scale: 'yscale', field: 'revenue' }, z: { scale: 'zscale', field: 'month' }, depth: { scale: 'zscale', band: 1 }, rounding: { scale: 'xscale', band: 0.08 }, fill: { scale: 'color', field: 'month' } } } },
      { from: { data: 'table' }, type: 'text', encode: { enter: { x: { scale: 'xscale', field: 'country', band: 0.5 }, y: { scale: 'yscale', field: 'revenue', offset: 0.1 }, z: { scale: 'zscale', field: 'month', band: 0.5 }, align: { value: 'center' }, baseline: { value: 'center' }, angleX: { value: 90 }, fontSize: { value: 9 }, fill: { value: '#e6f6f3' }, text: { field: 'revenue' } } } },
    ],
  };
}
