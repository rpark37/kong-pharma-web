/** Vega-Lite specification builders for the Ares-style data characterization reports. */
import { VEGA_COLORS } from '../../shared/vega/theme';

const VL = 'https://vega.github.io/schema/vega-lite/v6.json';

export interface Report { id: string; group: string; title: string; description: string; dataset: string; spec: Record<string, unknown>; height?: number; wide?: boolean; }

const bar = (dataset: string, x: string, y: string, opts: Record<string, unknown> = {}): Record<string, unknown> => ({
  $schema: VL,
  width: 'container',
  height: 220,
  data: { name: dataset },
  mark: { type: 'bar', cornerRadiusEnd: 2 },
  encoding: {
    x: { field: x, type: 'ordinal', title: opts['xTitle'] ?? x, axis: { labelAngle: 0 } },
    y: { field: y, type: 'quantitative', title: opts['yTitle'] ?? y },
    tooltip: [{ field: x }, { field: y, format: ',' }],
  },
});

export const REPORTS: Report[] = [
  {
    id: 'records-by-domain', group: 'Overview', title: 'Records by domain', description: 'Row counts per clinical domain and the persons they cover.', dataset: 'recordsByDomain', wide: true,
    spec: {
      $schema: VL, width: 'container', height: 200, data: { name: 'recordsByDomain' },
      transform: [{ fold: ['records', 'persons'], as: ['measure', 'count'] }],
      mark: { type: 'bar', cornerRadiusEnd: 2 },
      encoding: { y: { field: 'domain', type: 'nominal', title: null, sort: '-x' }, x: { field: 'count', type: 'quantitative', title: null, scale: { type: 'sqrt' } }, color: { field: 'measure', type: 'nominal', title: null }, yOffset: { field: 'measure' }, tooltip: [{ field: 'domain' }, { field: 'measure' }, { field: 'count', format: ',' }] },
    },
  },
  {
    id: 'age-first-obs', group: 'Person', title: 'Age at first observation', description: 'How old people were when their observation period started.', dataset: 'ageAtFirstObservation',
    spec: {
      $schema: VL, width: 'container', height: 220, data: { name: 'ageAtFirstObservation' },
      mark: { type: 'bar' }, encoding: { x: { field: 'age', type: 'quantitative', bin: { step: 5 }, title: 'Age (years)' }, y: { field: 'persons', type: 'quantitative', aggregate: 'sum', title: 'Persons' }, tooltip: [{ field: 'age', bin: { step: 5 }, title: 'Age' }, { field: 'persons', aggregate: 'sum' }] },
    },
  },
  {
    id: 'year-of-birth', group: 'Person', title: 'Year of birth', description: 'Distribution of birth years.', dataset: 'yearOfBirth',
    spec: { $schema: VL, width: 'container', height: 220, data: { name: 'yearOfBirth' }, mark: { type: 'area', line: true, interpolate: 'monotone', opacity: 0.35 }, encoding: { x: { field: 'year', type: 'quantitative', title: 'Year', axis: { format: 'd' } }, y: { field: 'persons', type: 'quantitative', title: 'Persons' }, tooltip: [{ field: 'year' }, { field: 'persons' }] } },
  },
  {
    id: 'sex', group: 'Person', title: 'Sex', description: 'Persons by administrative sex.', dataset: 'sex',
    spec: { $schema: VL, width: 'container', height: 200, data: { name: 'sex' }, mark: { type: 'arc', innerRadius: 50 }, encoding: { theta: { field: 'persons', type: 'quantitative' }, color: { field: 'sex', type: 'nominal', title: null }, tooltip: [{ field: 'sex' }, { field: 'persons' }] } },
  },
  {
    id: 'race', group: 'Person', title: 'Race', description: 'Persons by recorded race concept.', dataset: 'race',
    spec: { $schema: VL, width: 'container', height: 200, data: { name: 'race' }, mark: { type: 'bar', cornerRadiusEnd: 2 }, encoding: { y: { field: 'race', type: 'nominal', sort: '-x', title: null }, x: { field: 'persons', type: 'quantitative', title: 'Persons' }, tooltip: [{ field: 'race' }, { field: 'persons' }] } },
  },
  {
    id: 'obs-length', group: 'Observation period', title: 'Observation period length', description: 'Years of continuous observation per person.', dataset: 'observationLength',
    spec: bar('observationLength', 'years', 'persons', { xTitle: 'Years observed', yTitle: 'Persons' }),
  },
  {
    id: 'obs-cumulative', group: 'Observation period', title: 'Cumulative observation', description: 'Share of persons observed for at least N years.', dataset: 'observationCumulative',
    spec: { $schema: VL, width: 'container', height: 220, data: { name: 'observationCumulative' }, mark: { type: 'line', interpolate: 'step-after', strokeWidth: 2, point: false }, encoding: { x: { field: 'years', type: 'quantitative', title: 'At least N years' }, y: { field: 'pct_persons_at_least', type: 'quantitative', title: 'Persons', axis: { format: '.0%' } }, tooltip: [{ field: 'years' }, { field: 'pct_persons_at_least', format: '.1%' }] } },
  },
  {
    id: 'age-by-sex', group: 'Observation period', title: 'Age by sex', description: 'Population pyramid at the end of observation.', dataset: 'ageBySex', wide: true,
    spec: {
      $schema: VL, width: 'container', height: 240, data: { name: 'ageBySex' },
      transform: [{ calculate: "datum.sex === 'MALE' ? -datum.persons : datum.persons", as: 'signed' }],
      mark: { type: 'bar' },
      encoding: { y: { field: 'age_band', type: 'ordinal', title: 'Age band', sort: 'descending' }, x: { field: 'signed', type: 'quantitative', title: 'Persons', axis: { format: '~s', labelExpr: 'abs(datum.value)' } }, color: { field: 'sex', type: 'nominal', title: null, scale: { range: [VEGA_COLORS.violet, VEGA_COLORS.teal] } }, tooltip: [{ field: 'sex' }, { field: 'age_band' }, { field: 'persons' }] },
    },
  },
  {
    id: 'records-per-month', group: 'Data density', title: 'Records per month', description: 'Total records per month for each domain, on a log scale.', dataset: 'recordsPerMonth', wide: true,
    spec: { $schema: VL, width: 'container', height: 260, data: { name: 'recordsPerMonth' }, mark: { type: 'line', strokeWidth: 1.5 }, encoding: { x: { field: 'month', type: 'temporal', title: null }, y: { field: 'records', type: 'quantitative', scale: { type: 'log' }, title: 'Records (log)' }, color: { field: 'domain', type: 'nominal', title: null }, tooltip: [{ field: 'domain' }, { field: 'month', type: 'temporal', timeUnit: 'yearmonth', title: 'Month' }, { field: 'records' }] } },
  },
  {
    id: 'records-per-person', group: 'Data density', title: 'Records per person', description: 'How many records each person has, by domain (capped at 60).', dataset: 'recordsPerPerson',
    spec: { $schema: VL, width: 'container', height: 220, data: { name: 'recordsPerPerson' }, mark: { type: 'area', interpolate: 'monotone', opacity: 0.45 }, encoding: { x: { field: 'records', type: 'quantitative', title: 'Records' }, y: { field: 'persons', type: 'quantitative', stack: null, title: 'Persons' }, color: { field: 'domain', type: 'nominal', title: null }, tooltip: [{ field: 'domain' }, { field: 'records' }, { field: 'persons' }] } },
  },
  {
    id: 'concepts-per-person', group: 'Data density', title: 'Concepts per person', description: 'Distinct concepts recorded per person, by domain.', dataset: 'conceptsPerPerson',
    spec: { $schema: VL, width: 'container', height: 220, data: { name: 'conceptsPerPerson' }, mark: { type: 'bar', opacity: 0.8 }, encoding: { x: { field: 'concepts', type: 'ordinal', title: 'Distinct concepts', axis: { labelAngle: 0 } }, y: { field: 'persons', type: 'quantitative', title: 'Persons' }, color: { field: 'domain', type: 'nominal', title: null }, xOffset: { field: 'domain' }, tooltip: [{ field: 'domain' }, { field: 'concepts' }, { field: 'persons' }] } },
  },
  {
    id: 'top-concepts', group: 'Concepts', title: 'Most frequent concepts', description: 'Top concepts by record count. Click a bar, or choose from the list, to see its prevalence over time.', dataset: 'topConcepts',
    spec: {
      $schema: VL, width: 'container', height: 320, data: { name: 'topConcepts' },
      params: [{ name: 'pick', select: { type: 'point', fields: ['concept_id'], on: 'click' } }],
      mark: { type: 'bar', cornerRadiusEnd: 2, cursor: 'pointer' },
      encoding: { y: { field: 'concept_name', type: 'nominal', sort: '-x', title: null, axis: { labelLimit: 200 } }, x: { field: 'records', type: 'quantitative', title: 'Records' }, color: { condition: { param: 'pick', value: VEGA_COLORS.teal, empty: true }, value: VEGA_COLORS.faint }, tooltip: [{ field: 'concept_name' }, { field: 'records' }, { field: 'persons' }, { field: 'per_1000_persons', format: '.1f', title: 'per 1,000 persons' }] },
    },
  },
  {
    id: 'prevalence', group: 'Concepts', title: 'Prevalence over time', description: 'Records and persons per month for the selected concept.', dataset: 'prevalence',
    spec: { $schema: VL, width: 'container', height: 320, data: { name: 'prevalence' }, transform: [{ fold: ['records', 'persons'], as: ['measure', 'count'] }], mark: { type: 'line', point: true }, encoding: { x: { field: 'month', type: 'temporal', title: null }, y: { field: 'count', type: 'quantitative', title: null }, color: { field: 'measure', type: 'nominal', title: null }, tooltip: [{ field: 'month', type: 'temporal', timeUnit: 'yearmonth', title: 'Month' }, { field: 'measure' }, { field: 'count' }] } },
  },
  {
    id: 'quality', group: 'Data quality', title: 'Quality checks by category', description: 'Data Quality Dashboard-style checks: passed versus failed by category and table.', dataset: 'quality', wide: true,
    spec: {
      $schema: VL, width: 'container', height: 260, data: { name: 'quality' },
      transform: [{ fold: ['passed', 'failed'], as: ['result', 'count'] }],
      mark: { type: 'bar', cornerRadiusEnd: 2 },
      encoding: { y: { field: 'cdm_table', type: 'nominal', title: null }, x: { field: 'count', type: 'quantitative', title: 'Checks', aggregate: 'sum' }, yOffset: { field: 'category' }, color: { field: 'result', type: 'nominal', title: null, scale: { domain: ['passed', 'failed'], range: [VEGA_COLORS.good, VEGA_COLORS.bad] } }, opacity: { field: 'category', type: 'nominal', scale: { range: [1, 0.75, 0.5] }, title: 'Category' }, tooltip: [{ field: 'category' }, { field: 'cdm_table' }, { field: 'result' }, { field: 'count', aggregate: 'sum' }] },
    },
  },
  {
    id: 'quality-failures', group: 'Data quality', title: 'Failed checks', description: 'Checks that failed, with the share of violating rows.', dataset: 'qualityFailures', wide: true,
    spec: { $schema: VL, width: 'container', height: 240, data: { name: 'qualityFailures' }, mark: { type: 'point', filled: true, size: 90 }, encoding: { x: { field: 'pct_violated_rows', type: 'quantitative', title: '% rows violated' }, y: { field: 'check_name', type: 'nominal', title: null }, color: { field: 'category', type: 'nominal', title: null }, shape: { field: 'context', type: 'nominal', title: null }, tooltip: [{ field: 'cdm_table' }, { field: 'check_name' }, { field: 'category' }, { field: 'context' }, { field: 'pct_violated_rows', format: '.2f' }] } },
  },
];

export const REPORT_GROUPS = Array.from(new Set(REPORTS.map((r) => r.group)));
