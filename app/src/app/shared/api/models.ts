/** Response shapes of the FastAPI service (see api/openapi.json). Hand-written: openapi-typescript
 * does not yet support TypeScript 6. Keep in sync with api/app/routers. */

export interface MerchandiseKpis {
  users: number;
  sessions: number;
  events: number;
  purchases: number;
  revenue: number;
  first_day: string;
  last_day: string;
  conversion_rate: number;
  avg_order_value: number;
  source: 'bigquery' | 'synthetic' | 'unknown';
}

export interface DailyRow { day: string; sessions: number; users: number; purchases: number; revenue: number; }
export interface FunnelRow { order: number; step: string; sessions: number; pct_of_first: number; pct_of_previous: number; }
export interface GroupRow { sessions: number; users: number; purchases: number; revenue: number; }
export interface CountryRow extends GroupRow { country: string; }
export interface DeviceRow extends GroupRow { device: string; }
export interface SourceRow extends GroupRow { source: string; }
export interface ItemRow { item: string; category: string; brand: string; quantity: number; revenue: number; orders: number; }
export interface RevenueCubeRow { country: string; month: string; revenue: number; purchases: number; }

export interface AresSummary {
  persons: number;
  records: number;
  records_by_domain: Record<string, number>;
  checks: number;
  checks_failed: number;
  quality_pct: number;
  period_start: string;
  period_end: string;
  source: string;
}
export interface DomainRow { domain: string; records: number; persons: number; }
export interface AgeRow { age: number; persons: number; }
export interface YearRow { year: number; persons: number; }
export interface SexRow { sex: string; persons: number; }
export interface RaceRow { race: string; persons: number; }
export interface ObservationLengthRow { years: number; persons: number; }
export interface ObservationCumulativeRow { years: number; pct_persons_at_least: number; }
export interface AgeBySexRow { age_band: number; sex: string; persons: number; }
export interface RecordsPerMonthRow { domain: string; month: string; records: number; }
export interface RecordsPerPersonRow { domain: string; records: number; persons: number; }
export interface ConceptsPerPersonRow { domain: string; concepts: number; persons: number; }
export interface TopConceptRow { concept_id: number; concept_name: string; records: number; persons: number; per_1000_persons: number; }
export interface PrevalenceRow { month: string; records: number; persons: number; }
export interface QualityRow { category: string; context: string; cdm_table: string; checks: number; failed: number; passed: number; }
export interface QualityFailureRow { cdm_table: string; check_name: string; category: string; context: string; pct_violated_rows: number; }

export interface AtlasStats { parts: number; systems: number; triangles: number; min_y: number; max_y: number; concepts: number; attribution: string; }
export interface AtlasSystemRow { system: string; parts: number; volume: number; triangles: number; }
export interface AtlasPartRow { id: string; name: string; concept_id: string; system: string; cx: number; cy: number; cz: number; sx: number; sy: number; sz: number; triangles: number; }
export interface AtlasConceptRow { concept_id: string; name: string; elements: string[]; pieces: number; }

export interface DateRange { from?: string; to?: string; }
