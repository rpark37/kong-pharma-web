import { PALETTE_LIGHT } from '../theme/palette';

/** Vega config for the labs app light theme. Colours come from shared/theme/palette.ts. */
export const VEGA_COLORS = {
  /** Series hues. Independent of the UI accent and of the status colours below — see CATEGORY_RANGE. */
  teal: '#01806A',
  violet: '#5B4BC4',
  ember: '#C2570A',
  magenta: '#A8235C',
  sky: '#1F6FB2',
  green: '#2F7D2F',

  /**
   * Status. Reserved: a reader must never have to wonder whether red means "series 5" or "failed".
   * Legitimate use is an explicit two- or three-value scale, as the data-quality chart does for
   * passed/failed, and it always ships with a label rather than relying on colour alone.
   */
  good: PALETTE_LIGHT.success,
  warn: PALETTE_LIGHT.warning,
  bad: PALETTE_LIGHT.error,

  onInk: PALETTE_LIGHT.ink,
  dim: PALETTE_LIGHT.inkDim,
  faint: PALETTE_LIGHT.inkMuted,
  grid: 'rgba(45, 45, 45, 0.10)',
};

/**
 * Six slots, computed rather than picked. The previous eight were chosen by eye and failed three
 * of the six standard checks: rose/amber sat at deltaE 4.6 for deuteranopia (adjacent slots, so
 * series 4 and 5 of any chart were the same colour to a red-green colourblind reader), slate/sand
 * at 12.9 for *normal* vision, and three hues fell under the chroma floor and read grey on paper.
 *
 * This set passes all six against #F5F5F3, and clears the assertions in palette.spec.ts with room:
 * every hue 4.13-6.29:1 (floor 3), worst all-pairs Lab deltaE76 31.7 (floor 15).
 *
 * Six is enough, measured rather than assumed: the widest categorical field in the data is
 * `domain` at 5 distinct values, then `category` at 3. A seventh series never gets a generated
 * hue — fold it into "Other", facet it, or encode it twice.
 *
 * Order is fixed. Colour follows the entity, not its rank, so filtering a series out must not
 * repaint the survivors.
 */
export const CATEGORY_RANGE = [
  VEGA_COLORS.teal,
  VEGA_COLORS.violet,
  VEGA_COLORS.ember,
  VEGA_COLORS.magenta,
  VEGA_COLORS.sky,
  VEGA_COLORS.green,
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
