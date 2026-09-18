

/** Dark Vega config that reads like the rest of the labs app. Colors mirror _tokens.scss. */
export const VEGA_COLORS = {
  teal: '#44e0cc',
  violet: '#8b7cff',
  green: '#7ac585',
  amber: '#f2c14e',
  rose: '#ef7a8a',
  sky: '#6fb6ff',
  sand: '#d9b48a',
  onInk: '#e6f6f3',
  dim: 'rgba(230, 246, 243, 0.62)',
  faint: 'rgba(230, 246, 243, 0.3)',
  grid: 'rgba(230, 246, 243, 0.08)',
};

export const CATEGORY_RANGE = [VEGA_COLORS.teal, VEGA_COLORS.violet, VEGA_COLORS.green, VEGA_COLORS.amber, VEGA_COLORS.rose, VEGA_COLORS.sky, VEGA_COLORS.sand, '#b0c8ce'];

export const VEGA_DARK_CONFIG: Record<string, unknown> = {
  background: 'transparent',
  padding: 8,
  font: 'IBM Plex Sans, system-ui, sans-serif',
  axis: {
    domainColor: VEGA_COLORS.faint,
    gridColor: VEGA_COLORS.grid,
    tickColor: VEGA_COLORS.faint,
    labelColor: VEGA_COLORS.dim,
    titleColor: VEGA_COLORS.dim,
    labelFontSize: 11,
    titleFontSize: 11,
    titleFontWeight: 'normal',
    titlePadding: 8,
  },
  legend: { labelColor: VEGA_COLORS.dim, titleColor: VEGA_COLORS.dim, labelFontSize: 11, titleFontSize: 11, symbolSize: 80 },
  title: { color: VEGA_COLORS.onInk, fontSize: 13, fontWeight: 600, anchor: 'start', font: 'Rajdhani, IBM Plex Sans, sans-serif' },
  view: { stroke: null },
  range: { category: CATEGORY_RANGE, ordinal: { scheme: 'tealblues' }, ramp: { scheme: 'tealblues' } },
  mark: { color: VEGA_COLORS.teal },
  bar: { color: VEGA_COLORS.teal, cornerRadiusEnd: 2 },
  line: { color: VEGA_COLORS.teal, strokeWidth: 2 },
  area: { color: VEGA_COLORS.teal, opacity: 0.25 },
  point: { color: VEGA_COLORS.teal, filled: true },
  arc: { stroke: '#121c24', strokeWidth: 1 },
  text: { color: VEGA_COLORS.onInk },
  rect: { color: VEGA_COLORS.teal },
};
