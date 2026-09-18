export interface FormConfig {
  count: number;
  sensitivity: number;
  specificity: number;
  prior: number;
  transitionDuration: number;
  transitionStaggering: number;
}

export interface BayesData {
  ids: Uint32Array;
  diseaseTotal: number;
  healthyTotal: number;
  positiveIds: Uint32Array;
  negativeIds: Uint32Array;
  truePositiveIds: Set<number>;
  trueNegativeIds: Set<number>;
  falsePositiveIds: Set<number>;
  falseNegativeIds: Set<number>;
  disease: Float64Array;
  random: Float64Array;
  positiveTest: Float64Array;
}

export interface LayoutConstants {
  minBoundsX: number;
  maxBoundsX: number;
  minBoundsY: number;
  maxBoundsY: number;
  padding: number;
  thickness: number;
  facetSpacingX: number;
  facetSpacingY: number;
  side: number;
}
