import { PALETTE_DARK, PALETTE_LIGHT, type Theme } from '../theme/palette';

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

/** The same six slots lifted for the dark panel: every hue 6.7–9.6:1 on #171C1A, worst ΔE76 29. */
export const CATEGORY_RANGE_DARK = ['#3FC2A5', '#A99BF5', '#F5924A', '#F27BA8', '#6CB4F5', '#8ED27A'];

interface VegaInk { onInk: string; dim: string; faint: string; grid: string; teal: string; surface: string; range: string[]; }

function buildConfig(ink: VegaInk): Record<string, unknown> {
  return {
    background: 'transparent',
    padding: 8,
    font: 'IBM Plex Sans, system-ui, sans-serif',
    axis: {
      domainColor: ink.faint,
      gridColor: ink.grid,
      tickColor: ink.faint,
      labelColor: ink.dim,
      titleColor: ink.dim,
      labelFontSize: 11,
      titleFontSize: 11,
      titleFontWeight: 'normal',
      titlePadding: 8,
    },
    legend: { labelColor: ink.dim, titleColor: ink.dim, labelFontSize: 11, titleFontSize: 11, symbolSize: 80 },
    header: { labelColor: ink.onInk, titleColor: ink.dim, labelFontSize: 12 },
    title: { color: ink.onInk, fontSize: 13, fontWeight: 600, anchor: 'start', font: 'Rajdhani, IBM Plex Sans, sans-serif' },
    view: { stroke: null },
    range: { category: ink.range, ordinal: { scheme: 'teals' }, ramp: { scheme: 'teals' } },
    mark: { color: ink.teal },
    bar: { color: ink.teal, cornerRadiusEnd: 2 },
    line: { color: ink.teal, strokeWidth: 2 },
    area: { color: ink.teal, opacity: 0.25 },
    point: { color: ink.teal, filled: true },
    arc: { stroke: ink.surface, strokeWidth: 1 },
    text: { color: ink.onInk },
    rect: { color: ink.teal },
  };
}

export const VEGA_CONFIG: Record<string, unknown> = buildConfig({
  onInk: VEGA_COLORS.onInk, dim: VEGA_COLORS.dim, faint: VEGA_COLORS.faint, grid: VEGA_COLORS.grid, teal: VEGA_COLORS.teal, surface: PALETTE_LIGHT.panel, range: CATEGORY_RANGE,
});

export const VEGA_CONFIG_DARK: Record<string, unknown> = buildConfig({
  onInk: PALETTE_DARK.ink, dim: PALETTE_DARK.inkDim, faint: PALETTE_DARK.inkMuted, grid: 'rgba(231, 229, 224, 0.12)', teal: CATEGORY_RANGE_DARK[0], surface: PALETTE_DARK.panel, range: CATEGORY_RANGE_DARK,
});

export function vegaConfig(theme: Theme): Record<string, unknown> {
  return theme === 'dark' ? VEGA_CONFIG_DARK : VEGA_CONFIG;
}
