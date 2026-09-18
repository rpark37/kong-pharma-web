import { PALETTE_LIGHT, contrastRatio, deltaE76 } from './palette';
import { CATEGORY_RANGE } from '../vega/theme';

const SURFACE = PALETTE_LIGHT.panel;

describe('light palette contrast', () => {
  it('computes known contrast ratios correctly', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
  });

  it('is order independent', () => {
    expect(contrastRatio('#F5F5F3', '#2D2D2D')).toBeCloseTo(contrastRatio('#2D2D2D', '#F5F5F3'), 5);
  });

  it('gives body text at least AA contrast on panel', () => {
    // inkMuted is here, not in the 3:1 group below: it dresses `.note` at 12px on every page,
    // which is body copy. It measured 3.16:1 as #8A8A8A before this was tightened.
    for (const key of ['ink', 'inkDim', 'inkMuted'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the primary accent AA contrast for body text', () => {
    expect(contrastRatio(PALETTE_LIGHT.teal, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the secondary accent at least 3:1 for large text and strokes', () => {
    for (const key of ['orange'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives semantic states AA contrast', () => {
    for (const key of ['warning', 'error', 'success'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps fill-only colours out of text use by documenting them below 4.5', () => {
    expect(contrastRatio(PALETTE_LIGHT.tealBright, SURFACE)).toBeLessThan(4.5);
  });
});

describe('categorical chart palette', () => {
  it('clears 3:1 on panel for every hue', () => {
    for (const hue of CATEGORY_RANGE) {
      expect(contrastRatio(hue, PALETTE_LIGHT.panel), hue).toBeGreaterThanOrEqual(3);
    }
  });

  // contrastRatio is luminance-only and blind to hue, so it can't tell two different-hued
  // colours of similar luminance apart (verified: 4 of 28 pairs in this palette read ~1.0
  // there despite being visually distinct). ΔE76 in Lab space is the perceptual measure.
  it('keeps every hue perceptually distinguishable from its neighbours', () => {
    for (let i = 0; i < CATEGORY_RANGE.length; i++) {
      for (let j = i + 1; j < CATEGORY_RANGE.length; j++) {
        expect(deltaE76(CATEGORY_RANGE[i], CATEGORY_RANGE[j]), `${CATEGORY_RANGE[i]} vs ${CATEGORY_RANGE[j]}`)
          .toBeGreaterThanOrEqual(15);
      }
    }
  });
});
