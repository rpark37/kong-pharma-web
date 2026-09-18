import { PALETTE_LIGHT } from '../theme/palette';

/** Vega config for the labs app light theme. Colours come from shared/theme/palette.ts. */
export const VEGA_COLORS = {
  teal: PALETTE_LIGHT.teal,
  violet: '#5B4BC4',
  green: PALETTE_LIGHT.success,
  amber: PALETTE_LIGHT.warning,
  rose: PALETTE_LIGHT.error,
  sky: '#1F6FB2',
  sand: '#8A6A3D',
  onInk: PALETTE_LIGHT.ink,
  dim: PALETTE_LIGHT.inkDim,
  faint: PALETTE_LIGHT.inkMuted,
  grid: 'rgba(45, 45, 45, 0.10)',
};

/**
 * Re-derived for paper rather than darkened from the dark set. Two constraints fight here:
 * every hue must clear 3:1 on #F5F5F3 and stay distinguishable from its neighbours. Naive
 * darkening collapses the greens and blues toward each other, which is why these are picked
 * rather than computed.
 */
export const CATEGORY_RANGE = [
  VEGA_COLORS.teal,
  VEGA_COLORS.violet,
  VEGA_COLORS.green,
  VEGA_COLORS.amber,
  VEGA_COLORS.rose,
  VEGA_COLORS.sky,
  VEGA_COLORS.sand,
  '#4A5A5F',
];

export const VEGA_CONFIG: Record<string, unknown> = {
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
  range: { category: CATEGORY_RANGE, ordinal: { scheme: 'teals' }, ramp: { scheme: 'teals' } },
  mark: { color: VEGA_COLORS.teal },
  bar: { color: VEGA_COLORS.teal, cornerRadiusEnd: 2 },
  line: { color: VEGA_COLORS.teal, strokeWidth: 2 },
  area: { color: VEGA_COLORS.teal, opacity: 0.25 },
  point: { color: VEGA_COLORS.teal, filled: true },
  arc: { stroke: '#F5F5F3', strokeWidth: 1 },
  text: { color: VEGA_COLORS.onInk },
  rect: { color: VEGA_COLORS.teal },
};
