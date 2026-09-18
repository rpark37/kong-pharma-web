/**
 * The built-in Vega-Lite gallery, ported from the a21-ares `vega-charts` component.
 *
 * Each entry is self-contained: data is inlined as `data.values` rather than pushed as a named
 * dataset, because these are demonstrations of the grammar rather than views onto the API. Chart
 * styling (axes, legends, fonts, categorical colours) is deliberately omitted so VEGA_DARK_CONFIG
 * in shared/vega/theme.ts supplies it and the gallery matches the rest of the app.
 */
import { VEGA_COLORS } from '../../shared/vega/theme';

const VL = 'https://vega.github.io/schema/vega-lite/v6.json';

export interface GalleryChart {
  id: string;
  label: string;
  /** Which optgroup the entry sits under; 107 flat options is unusable. */
  group?: 'Built-in' | 'Specs' | 'Examples';
  /** Rebuilt on demand; the randomised sets differ per call, which is the point of "Shuffle". */
  spec?: () => Record<string, unknown>;
  /** Vendored specs load from here instead. Exactly one of `spec` / `url` is set. */
  url?: string;
}

/** A built-in always carries its builder — only vendored entries are url-backed. */
export type BuiltInChart = GalleryChart & { spec: () => Record<string, unknown> };

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (month: number, day: number) => new Date(2024, month, day).toISOString().split('T')[0];

export function barChart(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'A simple bar chart with embedded data.',
    width: 'container',
    height: 'container',
    data: {
      values: [
        { category: 'A', value: 28 },
        { category: 'B', value: 55 },
        { category: 'C', value: 43 },
        { category: 'D', value: 91 },
        { category: 'E', value: 81 },
        { category: 'F', value: 53 },
        { category: 'G', value: 19 },
        { category: 'H', value: 87 },
      ],
    },
    mark: { type: 'bar', cornerRadiusEnd: 4 },
    encoding: {
      x: { field: 'category', type: 'nominal', axis: { labelAngle: 0 } },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal', legend: null },
    },
  };
}

export function lineChart(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Stock price over time.',
    width: 'container',
    height: 'container',
    data: {
      values: Array.from({ length: 50 }, (_, i) => ({
        date: iso(0, i + 1),
        price: 100 + Math.sin(i / 5) * 30 + Math.random() * 10,
      })),
    },
    mark: { type: 'line', point: true },
    encoding: {
      x: { field: 'date', type: 'temporal', title: 'Date' },
      y: { field: 'price', type: 'quantitative', title: 'Price ($)' },
    },
  };
}

export function scatterPlot(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Scatter plot with tooltips.',
    width: 'container',
    height: 'container',
    data: {
      values: Array.from({ length: 100 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 50 + 10,
        category: ['Alpha', 'Beta', 'Gamma'][Math.floor(Math.random() * 3)],
      })),
    },
    mark: { type: 'circle', opacity: 0.8 },
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      size: { field: 'size', type: 'quantitative', legend: null },
      color: { field: 'category', type: 'nominal' },
      tooltip: [
        { field: 'x', type: 'quantitative', format: '.2f' },
        { field: 'y', type: 'quantitative', format: '.2f' },
        { field: 'category', type: 'nominal' },
      ],
    },
  };
}

export function areaChart(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Stacked area chart.',
    width: 'container',
    height: 'container',
    data: {
      values: ['Product A', 'Product B', 'Product C'].flatMap((product) =>
        Array.from({ length: 12 }, (_, i) => ({
          month: iso(i, 1),
          product,
          sales: Math.floor(Math.random() * 100) + 20,
        })),
      ),
    },
    mark: { type: 'area', opacity: 0.7 },
    encoding: {
      x: { field: 'month', type: 'temporal', title: 'Month' },
      y: { field: 'sales', type: 'quantitative', stack: 'zero', title: 'Sales' },
      color: { field: 'product', type: 'nominal', title: 'Product' },
    },
  };
}

export function heatmap(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Heatmap showing values across two dimensions.',
    width: 'container',
    height: 'container',
    data: {
      values: days.flatMap((day) =>
        Array.from({ length: 24 }, (_, hour) => ({ day, hour, value: Math.floor(Math.random() * 100) })),
      ),
    },
    mark: 'rect',
    encoding: {
      x: { field: 'hour', type: 'ordinal', title: 'Hour' },
      y: { field: 'day', type: 'ordinal', title: 'Day' },
      color: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
      tooltip: [
        { field: 'day', type: 'nominal' },
        { field: 'hour', type: 'ordinal' },
        { field: 'value', type: 'quantitative' },
      ],
    },
  };
}

export function donutChart(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'A donut chart.',
    width: 'container',
    height: 'container',
    data: {
      values: [
        { category: 'Desktop', value: 45 },
        { category: 'Mobile', value: 35 },
        { category: 'Tablet', value: 15 },
        { category: 'Other', value: 5 },
      ],
    },
    mark: { type: 'arc', innerRadius: 60 },
    encoding: {
      theta: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal', title: 'Device' },
      tooltip: [
        { field: 'category', type: 'nominal' },
        { field: 'value', type: 'quantitative', title: 'Percentage' },
      ],
    },
  };
}

export function boxplot(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Box plot showing distribution.',
    width: 'container',
    height: 'container',
    data: {
      values: ['Group A', 'Group B', 'Group C', 'Group D'].flatMap((group) =>
        Array.from({ length: 50 }, () => ({
          group,
          value: Math.random() * 100 + (group === 'Group B' ? 20 : 0),
        })),
      ),
    },
    mark: { type: 'boxplot', extent: 'min-max' },
    encoding: {
      x: { field: 'group', type: 'nominal', title: 'Group' },
      y: { field: 'value', type: 'quantitative', title: 'Value' },
      color: { field: 'group', type: 'nominal', legend: null },
    },
  };
}

export function histogram(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'A histogram of values.',
    width: 'container',
    height: 'container',
    data: {
      values: Array.from({ length: 200 }, () => ({ value: Math.random() * 100 + Math.random() * 50 })),
    },
    mark: { type: 'bar' },
    encoding: {
      x: { bin: { maxbins: 20 }, field: 'value', title: 'Value' },
      y: { aggregate: 'count', title: 'Frequency' },
    },
  };
}

export function groupedBar(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Grouped bar chart comparing categories.',
    width: 'container',
    height: 'container',
    data: {
      values: ['Q1', 'Q2', 'Q3', 'Q4'].flatMap((quarter) =>
        ['Product A', 'Product B', 'Product C'].map((product) => ({
          quarter,
          product,
          revenue: Math.floor(Math.random() * 100) + 50,
        })),
      ),
    },
    mark: { type: 'bar', cornerRadiusEnd: 2 },
    encoding: {
      x: { field: 'quarter', type: 'nominal', title: 'Quarter' },
      xOffset: { field: 'product' },
      y: { field: 'revenue', type: 'quantitative', title: 'Revenue ($K)' },
      color: { field: 'product', type: 'nominal', title: 'Product' },
    },
  };
}

export function multiLine(): Record<string, unknown> {
  const phase = (series: string) => (series === 'Series A' ? 0 : series === 'Series B' ? 2 : 4);
  return {
    $schema: VL,
    description: 'Multiple lines showing trends over time.',
    width: 'container',
    height: 'container',
    data: {
      values: ['Series A', 'Series B', 'Series C'].flatMap((series) =>
        Array.from({ length: 30 }, (_, i) => ({
          date: iso(0, i + 1),
          series,
          value: 50 + Math.sin(i / 5 + phase(series)) * 30 + Math.random() * 5,
        })),
      ),
    },
    mark: { type: 'line', point: true },
    encoding: {
      x: { field: 'date', type: 'temporal', title: 'Date' },
      y: { field: 'value', type: 'quantitative', title: 'Value' },
      color: { field: 'series', type: 'nominal', title: 'Series' },
      strokeDash: { field: 'series', type: 'nominal' },
    },
  };
}

export function bubbleChart(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Bubble chart with size encoding.',
    width: 'container',
    height: 'container',
    data: {
      values: Array.from({ length: 50 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1000 + 100,
        category: ['Tech', 'Finance', 'Health', 'Energy'][Math.floor(Math.random() * 4)],
        label: `Item ${i + 1}`,
      })),
    },
    mark: { type: 'circle', opacity: 0.7 },
    encoding: {
      x: { field: 'x', type: 'quantitative', title: 'X Axis' },
      y: { field: 'y', type: 'quantitative', title: 'Y Axis' },
      size: { field: 'size', type: 'quantitative', title: 'Size', scale: { range: [100, 1000] } },
      color: { field: 'category', type: 'nominal', title: 'Category' },
      tooltip: [
        { field: 'label', type: 'nominal', title: 'Item' },
        { field: 'category', type: 'nominal' },
        { field: 'size', type: 'quantitative', format: ',.0f' },
      ],
    },
  };
}

export function horizontalBar(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Horizontal bar chart sorted by value.',
    width: 'container',
    height: 'container',
    data: {
      values: [
        { country: 'United States', population: 331 },
        { country: 'Indonesia', population: 273 },
        { country: 'Pakistan', population: 220 },
        { country: 'Brazil', population: 212 },
        { country: 'Nigeria', population: 206 },
        { country: 'Bangladesh', population: 164 },
        { country: 'Russia', population: 144 },
        { country: 'Mexico', population: 128 },
      ],
    },
    mark: { type: 'bar', cornerRadiusEnd: 4 },
    encoding: {
      y: { field: 'country', type: 'nominal', sort: '-x', title: null },
      x: { field: 'population', type: 'quantitative', title: 'Population (millions)' },
      color: { field: 'population', type: 'quantitative', scale: { scheme: 'tealblues' }, legend: null },
    },
  };
}

export function streamgraph(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Streamgraph showing flow over time.',
    width: 'container',
    height: 'container',
    data: {
      values: ['Category A', 'Category B', 'Category C', 'Category D'].flatMap((category) =>
        Array.from({ length: 20 }, (_, i) => ({
          time: i,
          category,
          value: Math.abs(Math.sin(i / 3 + category.charCodeAt(9)) * 50 + Math.random() * 20),
        })),
      ),
    },
    mark: { type: 'area', interpolate: 'basis' },
    encoding: {
      x: { field: 'time', type: 'quantitative', title: 'Time', axis: { tickCount: 10 } },
      y: { field: 'value', type: 'quantitative', stack: 'center', title: null },
      color: { field: 'category', type: 'nominal', title: 'Category' },
    },
  };
}

export function lollipop(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Lollipop chart showing values.',
    width: 'container',
    height: 'container',
    data: {
      values: [
        { item: 'Alpha', value: 85 },
        { item: 'Beta', value: 72 },
        { item: 'Gamma', value: 63 },
        { item: 'Delta', value: 91 },
        { item: 'Epsilon', value: 45 },
        { item: 'Zeta', value: 78 },
      ],
    },
    encoding: {
      y: { field: 'item', type: 'nominal', sort: '-x', title: null },
      x: { field: 'value', type: 'quantitative', title: 'Score' },
    },
    layer: [
      { mark: { type: 'rule', color: VEGA_COLORS.teal, strokeWidth: 2 } },
      { mark: { type: 'circle', size: 200, color: VEGA_COLORS.teal } },
    ],
  };
}

export function radialBar(): Record<string, unknown> {
  return {
    $schema: VL,
    description: 'Radial/circular bar chart.',
    width: 'container',
    height: 'container',
    data: { values: days.map((category, i) => ({ category, value: [28, 55, 43, 91, 81, 53, 19][i] })) },
    mark: { type: 'arc', innerRadius: 30 },
    encoding: {
      theta: { field: 'value', type: 'quantitative', stack: true },
      radius: { field: 'value', type: 'quantitative', scale: { type: 'sqrt', zero: true, range: [30, 120] } },
      color: { field: 'category', type: 'nominal', title: 'Day' },
    },
  };
}

/** Gallery order matches the source component's built-in chart list. */
export const GALLERY: BuiltInChart[] = [
  { id: 'bar-chart', label: 'Simple bar', spec: barChart },
  { id: 'line-chart', label: 'Line with points', spec: lineChart },
  { id: 'scatter-plot', label: 'Scatter', spec: scatterPlot },
  { id: 'area-chart', label: 'Stacked area', spec: areaChart },
  { id: 'heatmap', label: 'Heatmap', spec: heatmap },
  { id: 'pie-chart', label: 'Donut', spec: donutChart },
  { id: 'boxplot', label: 'Box plot', spec: boxplot },
  { id: 'histogram', label: 'Histogram', spec: histogram },
  { id: 'grouped-bar', label: 'Grouped bar', spec: groupedBar },
  { id: 'multi-line', label: 'Multi-line', spec: multiLine },
  { id: 'bubble-chart', label: 'Bubble', spec: bubbleChart },
  { id: 'horizontal-bar', label: 'Horizontal bar', spec: horizontalBar },
  { id: 'streamgraph', label: 'Streamgraph', spec: streamgraph },
  { id: 'lollipop', label: 'Lollipop', spec: lollipop },
  { id: 'radial-bar', label: 'Radial bar', spec: radialBar },
];
