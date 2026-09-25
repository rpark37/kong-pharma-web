import { Query, cast, column, count, div, floor, literal, mul, sql, sum, type FilterExpr } from '@uwdata/mosaic-sql';
import type { VegaSpecInput } from '../../shared/vega/vega-chart.component';
import { VEGA_COLORS } from '../../shared/vega/theme';
import type { BrushKind } from '../../shared/duck/linked-chart.component';
import { SCREEN_TABLE } from './screen-data';

export interface ChartDef {
  id: string;
  title: string;
  field: string;
  kind: BrushKind;
  height: number;
  spec: VegaSpecInput;
  query: (filter: FilterExpr) => Query;
}

const T = SCREEN_TABLE;
const brushParam = (kind: BrushKind, field: string) => (kind === 'interval'
  ? [{ name: 'brush', select: { type: 'interval', encodings: ['x'] } }]
  : [{ name: 'brush', select: { type: 'point', fields: [field], toggle: 'event.shiftKey' } }]);

/** Pre-binned histogram: the query groups by floor(x/step)*step, Vega draws a rect from x0 to x1. Vega-Lite's `bar` treats a ranged x as horizontal, so this is a `rect` with an explicit y2. */
function histogram(field: string, step: number, title: string, color: string): ChartDef {
  return {
    id: field, title, field, kind: 'interval', height: 150,
    query: (filter) => Query.from(T).select({ x0: mul(literal(step), floor(div(column(field), literal(step)))), n: count() }).where(filter).groupby('x0'),
    spec: {
      width: 'container', height: 110, padding: 4,
      data: { name: 'rows' },
      params: brushParam('interval', field),
      transform: [{ calculate: `datum.x0 + ${step}`, as: 'x1' }],
      mark: { type: 'rect', color, opacity: 0.9 },
      encoding: {
        x: { field: 'x0', type: 'quantitative', title: null },
        x2: { field: 'x1' },
        y: { field: 'n', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        y2: { datum: 0 },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
      },
    },
  };
}

export const SCREEN_CHARTS: ChartDef[] = [
  histogram('inhibition', 5, 'Inhibition %', VEGA_COLORS.teal),
  histogram('zscore', 0.5, 'Z-score', VEGA_COLORS.violet),
  {
    id: 'target', title: 'Hits by target', field: 'target', kind: 'point', height: 190,
    query: (filter) => Query.from(T).select({ target: 'target', hits: sum(cast(column('hit'), 'INTEGER')), n: count() }).where(filter).groupby('target'),
    spec: {
      width: 'container', height: 150, padding: 4,
      data: { name: 'rows' },
      params: brushParam('point', 'target'),
      mark: { type: 'bar', color: VEGA_COLORS.ember },
      encoding: {
        x: { field: 'target', type: 'nominal', sort: '-y', title: null, axis: { labelAngle: 0, labelFontSize: 9 } },
        y: { field: 'hits', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
        tooltip: [{ field: 'target' }, { field: 'hits', format: ',' }, { field: 'n', title: 'wells', format: ',' }],
      },
    },
  },
  {
    id: 'read_at', title: 'Hits per week', field: 'read_at', kind: 'interval', height: 150,
    query: (filter) => Query.from(T).select({ week: sql`date_trunc('week', "read_at")`, hits: sum(cast(column('hit'), 'INTEGER')) }).where(filter).groupby('week'),
    spec: {
      width: 'container', height: 110, padding: 4,
      data: { name: 'rows' },
      params: brushParam('interval', 'read_at'),
      transform: [{ calculate: 'time(datum.week) + 7 * 86400000', as: 'week_end' }],
      mark: { type: 'rect', color: VEGA_COLORS.sky },
      encoding: {
        x: { field: 'week', type: 'temporal', title: null, axis: { format: '%b %d', labelFontSize: 9 } },
        x2: { field: 'week_end' },
        y: { field: 'hits', type: 'quantitative', title: null, axis: { format: '~s', tickCount: 3 } },
        y2: { datum: 0 },
        opacity: { condition: { param: 'brush', value: 1 }, value: 0.35 },
      },
    },
  },
];
