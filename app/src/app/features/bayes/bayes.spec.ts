import { bayes, predictiveCurve } from './bayes';

describe('bayes', () => {
  it('reproduces the classic mammography example', () => {
    const o = bayes({ prevalence: 0.01, sensitivity: 0.9, specificity: 0.91, population: 10000 });
    expect(o.truePositives).toBeCloseTo(90);
    expect(o.falsePositives).toBeCloseTo(891);
    expect(o.ppv).toBeCloseTo(90 / 981, 5);
    expect(o.npv).toBeGreaterThan(0.99);
  });

  it('conserves the population across the four outcomes', () => {
    const o = bayes({ prevalence: 0.2, sensitivity: 0.8, specificity: 0.98, population: 5000 });
    expect(o.truePositives + o.falseNegatives + o.falsePositives + o.trueNegatives).toBeCloseTo(5000);
    expect(o.postOddsPositive).toBeCloseTo(o.preOdds * o.lrPositive);
  });

  it('clamps inputs and keeps the curve monotonic in prevalence for PPV', () => {
    const curve = predictiveCurve(0.9, 0.9, 20);
    expect(curve[0].ppv).toBe(0);
    for (let i = 1; i < curve.length; i++) expect(curve[i].ppv).toBeGreaterThanOrEqual(curve[i - 1].ppv);
    expect(bayes({ prevalence: 2, sensitivity: -1, specificity: 5, population: 0 }).accuracy).toBeGreaterThanOrEqual(0);
  });
});
