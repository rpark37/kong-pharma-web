import { Injectable } from '@angular/core';
import * as MorphCharts from 'morphcharts';
import { BayesData, FormConfig } from '../models/bayes-data.model';

@Injectable({
  providedIn: 'root'
})
export class DataGeneratorService {
  generateData(config: FormConfig): BayesData {
    const { count, sensitivity, specificity, prior } = config;

    const diseaseTotal = Math.round(prior * count);
    const healthyTotal = count - diseaseTotal;
    const truePositiveTotal = Math.round(diseaseTotal * sensitivity);
    const trueNegativeTotal = Math.round(healthyTotal * specificity);
    const falseNegativeTotal = Math.round(diseaseTotal * (1 - sensitivity));
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

    const pseudoRandom = new MorphCharts.Helpers.PseudoRandom(0);

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
      } else {
        if (falsePositiveCount++ < falsePositiveTotal) {
          positiveTest[i] = 1;
          positiveIdsArray.push(i);
          falsePositiveIdsArray.push(i);
        } else {
          negativeIdsArray.push(i);
          trueNegativeIdsArray.push(i);
        }
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
      positiveTest
    };
  }
}
