/**
 * Vega-Lite specs for the three /science pages.
 *
 * Styling is deliberately omitted — VEGA_CONFIG in shared/vega/theme.ts supplies fonts, axes,
 * legends and the categorical range, so these match the rest of the app. Data is inlined as
 * `data.values` because every page has already loaded its snapshot by the time it builds a spec.
 */
import { VEGA_COLORS } from '../../shared/vega/theme';

const VL = 'https://vega.github.io/schema/vega-lite/v6.json';

const base = (description: string) => ({
  $schema: VL,
  description,
  width: 'container',
  height: 'container',
});

// ── trials ───────────────────────────────────────────────────────────────────────────────────

/**
 * Phase mix per indication, as each indication's own share.
 *
 * Raw counts do not work here: solid tumour runs to 7,006 Phase 1 studies against bladder's 469,
 * so on a linear axis the smaller two fields flatten to nothing and the shape — the thing actually
 * being compared — becomes unreadable. The `joinaggregate` totals each indication so the bars show
 * distribution; the tooltip still carries the real count.
 */
export function phaseSpec(rows: { indication: string; phase: string; count: number }[]): Record<string, unknown> {
  return {
    ...base('Phase distribution within each indication'),
    data: { values: rows },
    transform: [
      { joinaggregate: [{ op: 'sum', field: 'count', as: 'tagged' }], groupby: ['indication'] },
      { calculate: 'datum.count / datum.tagged', as: 'share' },
    ],
    mark: { type: 'bar', cornerRadiusEnd: 2 },
    encoding: {
      x: { field: 'phase', type: 'nominal', title: null, sort: null },
      y: { field: 'share', type: 'quantitative', title: 'Share of phase-tagged studies', axis: { format: '.0%' } },
      xOffset: { field: 'indication', type: 'nominal' },
      color: { field: 'indication', type: 'nominal', title: null },
      tooltip: [
        { field: 'indication' },
        { field: 'phase' },
        { field: 'count', title: 'Studies' },
        { field: 'share', title: 'Share', format: '.1%' },
      ],
    },
  };
}

/** Status as a share of each indication, so a 739-trial field compares with a 9,804-trial one. */
export function statusSpec(rows: { indication: string; status: string; count: number }[]): Record<string, unknown> {
  return {
    ...base('Study status as a share of each indication'),
    data: { values: rows },
    mark: { type: 'bar' },
    encoding: {
      y: { field: 'indication', type: 'nominal', title: null },
      x: { field: 'count', type: 'quantitative', title: 'Share of studies', stack: 'normalize', axis: { format: '.0%' } },
      color: { field: 'status', type: 'nominal', title: null },
      tooltip: [{ field: 'indication' }, { field: 'status' }, { field: 'count', title: 'Studies' }],
    },
  };
}

// ── RAC1 ─────────────────────────────────────────────────────────────────────────────────────

/** Association score per disease, stacked by the evidence type contributing it. */
export function associationSpec(
  rows: { name: string; type: string; score: number }[],
  order: string[],
  axisTitle: string,
): Record<string, unknown> {
  return {
    ...base('Association score by evidence type'),
    data: { values: rows },
    mark: { type: 'bar' },
    encoding: {
      y: { field: 'name', type: 'nominal', title: null, sort: order, axis: { labelLimit: 220 } },
      x: { field: 'score', type: 'quantitative', title: axisTitle },
      color: { field: 'type', type: 'nominal', title: null },
      tooltip: [{ field: 'name', title: 'Target' }, { field: 'type' }, { field: 'score', format: '.3f' }],
    },
  };
}

/** Publications per year. An area reads as a trend; the point layer keeps single years readable. */
export function literatureSpec(rows: { year: number; count: number }[]): Record<string, unknown> {
  return {
    ...base('RAC1 publications per year, Europe PMC'),
    data: { values: rows },
    layer: [
      { mark: { type: 'area', opacity: 0.25, line: { strokeWidth: 2 } } },
      { mark: { type: 'point', filled: true, size: 45 } },
    ],
    encoding: {
      x: { field: 'year', type: 'ordinal', title: null, axis: { labelAngle: -45 } },
      y: { field: 'count', type: 'quantitative', title: 'Publications' },
      tooltip: [{ field: 'year' }, { field: 'count', title: 'Publications' }],
    },
  };
}

/** STRING partners: total confidence as the bar, experimental evidence overlaid as the darker rule. */
export function interactorSpec(
  rows: { partner: string; score: number; experimental: number }[],
): Record<string, unknown> {
  return {
    ...base('STRING interaction partners of RAC1'),
    data: { values: rows },
    encoding: {
      y: { field: 'partner', type: 'nominal', title: null, sort: '-x' },
      tooltip: [
        { field: 'partner' },
        { field: 'score', title: 'Combined', format: '.3f' },
        { field: 'experimental', title: 'Experimental', format: '.3f' },
      ],
    },
    layer: [
      {
        mark: { type: 'bar', cornerRadiusEnd: 2, opacity: 0.35, color: VEGA_COLORS.teal },
        encoding: { x: { field: 'score', type: 'quantitative', title: 'Confidence' } },
      },
      {
        mark: { type: 'bar', cornerRadiusEnd: 2, color: VEGA_COLORS.teal },
        encoding: { x: { field: 'experimental', type: 'quantitative' } },
      },
    ],
  };
}

// ── bladder ──────────────────────────────────────────────────────────────────────────────────

/** Clinical candidates by furthest stage reached. */
export function stageSpec(rows: { stage: string; count: number }[], order: string[]): Record<string, unknown> {
  return {
    ...base('Clinical candidates by furthest stage'),
    data: { values: rows },
    mark: { type: 'bar', cornerRadiusEnd: 2, color: VEGA_COLORS.teal },
    encoding: {
      x: { field: 'stage', type: 'nominal', title: null, sort: order },
      y: { field: 'count', type: 'quantitative', title: 'Drugs' },
      tooltip: [{ field: 'stage' }, { field: 'count', title: 'Drugs' }],
    },
  };
}
