import { PALETTE_DARK, PALETTE_LIGHT, contrastRatio, deltaE76 } from './palette';
import { CATEGORY_RANGE, CATEGORY_RANGE_DARK } from '../vega/theme';

describe('contrast ratio', () => {
  it('computes known contrast ratios correctly', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
  });

  it('is order independent', () => {
    expect(contrastRatio('#F5F5F3', '#2D2D2D')).toBeCloseTo(contrastRatio('#2D2D2D', '#F5F5F3'), 5);
  });
});

describe.each([
  ['light', PALETTE_LIGHT, CATEGORY_RANGE],
  ['dark', PALETTE_DARK, CATEGORY_RANGE_DARK],
] as const)('%s palette contrast', (_name, palette, range) => {
  const surface = palette.panel;

  it('gives body text at least AA contrast on panel', () => {
    // inkMuted is here, not in the 3:1 group below: it dresses `.note` at 12px on every page,
    // which is body copy. It measured 3.16:1 as #8A8A8A before this was tightened.
    for (const key of ['ink', 'inkDim', 'inkMuted'] as const) {
      expect(contrastRatio(palette[key], surface), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the primary accent AA contrast for body text', () => {
    expect(contrastRatio(palette.teal, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the secondary accent at least 3:1 for large text and strokes', () => {
    expect(contrastRatio(palette.orange, surface)).toBeGreaterThanOrEqual(3);
  });

  it('gives semantic states AA contrast', () => {
    for (const key of ['warning', 'error', 'success'] as const) {
      expect(contrastRatio(palette[key], surface), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('clears 3:1 on panel for every categorical hue', () => {
    for (const hue of range) {
      expect(contrastRatio(hue, surface), hue).toBeGreaterThanOrEqual(3);
    }
  });

  // contrastRatio is luminance-only and blind to hue, so it can't tell two different-hued
  // colours of similar luminance apart (verified: 4 of 28 pairs in this palette read ~1.0
  // there despite being visually distinct). ΔE76 in Lab space is the perceptual measure.
  it('keeps every categorical hue perceptually distinguishable from its neighbours', () => {
    for (let i = 0; i < range.length; i++) {
      for (let j = i + 1; j < range.length; j++) {
        expect(deltaE76(range[i], range[j]), `${range[i]} vs ${range[j]}`).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('light palette fills', () => {
  it('keeps fill-only colours out of text use by documenting them below 4.5', () => {
    expect(contrastRatio(PALETTE_LIGHT.tealBright, PALETTE_LIGHT.panel)).toBeLessThan(4.5);
  });
});
