// Ported from the user's therapeutic-tests-bayes-theorem project (src/app/services/data-generator.service.ts).
// A deterministic synthetic population: the first `prior*count` people have the disease, the test
// catches `sensitivity` of them and wrongly flags `1-specificity` of the healthy.
import type { BayesData, FormConfig } from './bayes-data.model';

/** Minimal seeded generator matching MorphCharts.Helpers.PseudoRandom(0) (mulberry32-style), kept
 * here so the data generator has no dependency on the 3D library. */
export class PseudoRandom {
  private state: number;
  constructor(seed = 0) { this.state = seed >>> 0; }
  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function generateBayesData(config: FormConfig): BayesData {
  const { count, sensitivity, specificity, prior } = config;
  const diseaseTotal = Math.round(prior * count);
  const healthyTotal = count - diseaseTotal;
  const truePositiveTotal = Math.round(diseaseTotal * sensitivity);
  const falsePositiveTotal = Math.round(healthyTotal * (1 - specificity));

  const positiveIdsArray: number[] = [];
  const negativeIdsArray: number[] = [];
  const truePositiveIdsArray: number[] = [];
  const trueNegativeIdsArray: number[] = [];
  const falsePositiveIdsArray: number[] = [];
  const falseNegativeIdsArray: number[] = [];

  const disease = new Float64Array(count);
  const positiveTest = new Float64Array(count);
  const random = new Float64Array(count);
  const ids = new Uint32Array(count);
  const pseudoRandom = new PseudoRandom(0);

  let diseaseCount = 0;
  let truePositiveCount = 0;
  let falsePositiveCount = 0;
  for (let i = 0; i < count; i++) {
    ids[i] = i;
    random[i] = pseudoRandom.nextFloat();
    if (diseaseCount++ < diseaseTotal) {
      disease[i] = 1;
      if (truePositiveCount++ < truePositiveTotal) {
        positiveTest[i] = 1;
        positiveIdsArray.push(i);
        truePositiveIdsArray.push(i);
      } else {
        negativeIdsArray.push(i);
        falseNegativeIdsArray.push(i);
      }
    } else if (falsePositiveCount++ < falsePositiveTotal) {
      positiveTest[i] = 1;
      positiveIdsArray.push(i);
      falsePositiveIdsArray.push(i);
    } else {
      negativeIdsArray.push(i);
      trueNegativeIdsArray.push(i);
    }
  }

  return {
    ids,
    diseaseTotal,
    healthyTotal,
    positiveIds: new Uint32Array(positiveIdsArray),
    negativeIds: new Uint32Array(negativeIdsArray),
    truePositiveIds: new Set(truePositiveIdsArray),
    trueNegativeIds: new Set(trueNegativeIdsArray),
    falsePositiveIds: new Set(falsePositiveIdsArray),
    falseNegativeIds: new Set(falseNegativeIdsArray),
    disease,
    random,
    positiveTest,
  };
}
