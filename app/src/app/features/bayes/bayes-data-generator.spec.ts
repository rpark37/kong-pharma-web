import { bayes } from './bayes';
import { generateBayesData } from './bayes-data-generator';

describe('generateBayesData', () => {
  const config = { count: 1000, sensitivity: 0.9, specificity: 0.91, prior: 0.01, transitionDuration: 0, transitionStaggering: 0 };

  it('partitions every person into exactly one outcome', () => {
    const d = generateBayesData(config);
    const total = d.truePositiveIds.size + d.falseNegativeIds.size + d.falsePositiveIds.size + d.trueNegativeIds.size;
    expect(total).toBe(1000);
    expect(d.positiveIds.length + d.negativeIds.length).toBe(1000);
    for (const id of d.truePositiveIds) { expect(d.disease[id]).toBe(1); expect(d.positiveTest[id]).toBe(1); }
    for (const id of d.trueNegativeIds) { expect(d.disease[id]).toBe(0); expect(d.positiveTest[id]).toBe(0); }
  });

  it('agrees with the analytic Bayes calculation', () => {
    const d = generateBayesData(config);
    const o = bayes({ prevalence: 0.01, sensitivity: 0.9, specificity: 0.91, population: 1000 });
    expect(d.diseaseTotal).toBe(Math.round(o.diseased));
    expect(d.truePositiveIds.size).toBe(Math.round(o.truePositives));
    expect(d.falsePositiveIds.size).toBe(Math.round(o.falsePositives));
  });

  it('is deterministic', () => {
    const a = generateBayesData(config);
    const b = generateBayesData(config);
    expect(Array.from(a.random.slice(0, 5))).toEqual(Array.from(b.random.slice(0, 5)));
  });
});
