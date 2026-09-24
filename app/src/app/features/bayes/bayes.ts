/**
 * Bayes' theorem for diagnostic and therapeutic tests.
 *
 * Analogy: prevalence is how many needles are in the haystack, sensitivity is how good the
 * magnet is at picking up needles, specificity is how well it ignores hay. The posterior
 * (predictive value) is what a positive or negative result should make you believe.
 */
export interface TestInputs {
  /** Pre-test probability of disease, 0..1 */
  prevalence: number;
  /** P(test positive | disease), 0..1 */
  sensitivity: number;
  /** P(test negative | no disease), 0..1 */
  specificity: number;
  /** Population size used for the natural-frequency view */
  population: number;
}

export interface TestOutputs {
  ppv: number;
  npv: number;
  lrPositive: number;
  lrNegative: number;
  preOdds: number;
  postOddsPositive: number;
  postOddsNegative: number;
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  trueNegatives: number;
  diseased: number;
  healthy: number;
  positives: number;
  negatives: number;
  accuracy: number;
}

export function bayes(i: TestInputs): TestOutputs {
  const p = clamp01(i.prevalence);
  const se = clamp01(i.sensitivity);
  const sp = clamp01(i.specificity);
  const n = Math.max(1, i.population);
  const diseased = n * p;
  const healthy = n - diseased;
  const truePositives = diseased * se;
  const falseNegatives = diseased - truePositives;
  const trueNegatives = healthy * sp;
  const falsePositives = healthy - trueNegatives;
  const positives = truePositives + falsePositives;
  const negatives = trueNegatives + falseNegatives;
  const ppv = positives > 0 ? truePositives / positives : 0;
  const npv = negatives > 0 ? trueNegatives / negatives : 0;
  const lrPositive = 1 - sp > 0 ? se / (1 - sp) : Infinity;
  const lrNegative = sp > 0 ? (1 - se) / sp : Infinity;
  const preOdds = p < 1 ? p / (1 - p) : Infinity;
  return {
    ppv, npv, lrPositive, lrNegative, preOdds,
    postOddsPositive: preOdds * lrPositive,
    postOddsNegative: preOdds * lrNegative,
    truePositives, falseNegatives, falsePositives, trueNegatives, diseased, healthy, positives, negatives,
    accuracy: (truePositives + trueNegatives) / n,
  };
}

/** PPV / NPV as a function of prevalence for the given test, for the curve chart. */
export function predictiveCurve(sensitivity: number, specificity: number, steps = 60): Array<{ prevalence: number; ppv: number; npv: number }> {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const prevalence = k / steps;
    const o = bayes({ prevalence, sensitivity, specificity, population: 1 });
    out.push({ prevalence, ppv: o.ppv, npv: o.npv });
  }
  return out;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, isFinite(x) ? x : 0));
}

/** `short` is the code on the segmented preset rail; `name` is its tooltip and caption. */
export interface TestPreset { id: string; name: string; short: string; note: string; inputs: TestInputs; }

/** Illustrative presets (rounded textbook figures, not clinical guidance). */
export const PRESETS: TestPreset[] = [
  { id: 'mammography', name: 'Screening mammography', short: 'MAMMO', note: 'Roughly 1% prevalence in a screening population.', inputs: { prevalence: 0.01, sensitivity: 0.9, specificity: 0.91, population: 10000 } },
  { id: 'rapid-antigen', name: 'Rapid antigen test', short: 'RAPID', note: 'Symptomatic clinic, moderate prevalence.', inputs: { prevalence: 0.2, sensitivity: 0.8, specificity: 0.98, population: 10000 } },
  { id: 'companion', name: 'Companion diagnostic', short: 'CDx', note: 'Biomarker gating a targeted therapy; prevalence of the marker.', inputs: { prevalence: 0.15, sensitivity: 0.95, specificity: 0.9, population: 10000 } },
  { id: 'rare-disease', name: 'Rare disease screen', short: 'RARE', note: 'Very low prevalence: most positives are false even with a good test.', inputs: { prevalence: 0.001, sensitivity: 0.99, specificity: 0.99, population: 100000 } },
];
