import { VEGA_COLORS } from '../../shared/vega/theme';

const VL = 'https://vega.github.io/schema/vega-lite/v6.json';

/** Natural-frequency breakdown of the population as a stacked bar per test result. */
export function outcomeSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    width: 'container',
    height: 160,
    data: { name: 'outcomes' },
    mark: { type: 'bar', cornerRadiusEnd: 3 },
    encoding: {
      y: { field: 'result', type: 'nominal', title: null, sort: ['Test positive', 'Test negative'] },
      x: { field: 'people', type: 'quantitative', title: 'People', stack: 'zero' },
      color: { field: 'truth', type: 'nominal', title: null, scale: { domain: ['Diseased', 'Healthy'], range: [VEGA_COLORS.bad, VEGA_COLORS.teal] } },
      order: { field: 'order' },
      tooltip: [{ field: 'result' }, { field: 'truth' }, { field: 'people', format: ',.0f' }, { field: 'label' }],
    },
  };
}

/** PPV and NPV against prevalence, with a rule at the current prevalence. */
export function curveSpec(): Record<string, unknown> {
  return {
    $schema: VL,
    width: 'container',
    height: 240,
    layer: [
      {
        data: { name: 'curve' },
        transform: [{ fold: ['ppv', 'npv'], as: ['measure', 'value'] }],
        mark: { type: 'line', strokeWidth: 2 },
        encoding: {
          x: { field: 'prevalence', type: 'quantitative', title: 'Prevalence (pre-test probability)', axis: { format: '.0%' } },
          y: { field: 'value', type: 'quantitative', title: 'Probability', axis: { format: '.0%' } },
          color: { field: 'measure', type: 'nominal', title: null, scale: { domain: ['ppv', 'npv'], range: [VEGA_COLORS.magenta, VEGA_COLORS.teal] } },
        },
      },
      { data: { name: 'marker' }, mark: { type: 'rule', color: VEGA_COLORS.warn, strokeDash: [4, 4] }, encoding: { x: { field: 'prevalence', type: 'quantitative' } } },
      { data: { name: 'marker' }, mark: { type: 'point', filled: true, size: 90, color: VEGA_COLORS.warn }, encoding: { x: { field: 'prevalence', type: 'quantitative' }, y: { field: 'ppv', type: 'quantitative' }, tooltip: [{ field: 'ppv', format: '.1%' }] } },
      { data: { name: 'marker' }, transform: [{ calculate: "format(datum.prevalence, '.1%') + ' → PPV ' + format(datum.ppv, '.1%')", as: 'label' }], mark: { type: 'text', align: 'left', dx: 10, dy: -8, fontSize: 11, font: 'IBM Plex Mono, monospace', color: VEGA_COLORS.onInk }, encoding: { x: { field: 'prevalence', type: 'quantitative' }, y: { field: 'ppv', type: 'quantitative' }, text: { field: 'label' } } },
    ],
  };
}

/** Icon array: 1 icon per bucket of people, coloured by outcome. */
export function iconArraySpec(): Record<string, unknown> {
  return {
    $schema: VL,
    width: 'container',
    height: 200,
    data: { name: 'icons' },
    mark: { type: 'circle', size: 140 },
    encoding: {
      x: { field: 'col', type: 'ordinal', axis: null },
      y: { field: 'row', type: 'ordinal', axis: null },
      color: { field: 'outcome', type: 'nominal', legend: null, scale: { domain: ['True positive', 'False negative', 'False positive', 'True negative'], range: [VEGA_COLORS.bad, '#b85f6b', VEGA_COLORS.warn, VEGA_COLORS.teal] } },
      tooltip: [{ field: 'outcome' }],
    },
  };
}
