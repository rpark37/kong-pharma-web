import { PALETTE_LIGHT, contrastRatio } from './palette';

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
    for (const key of ['ink', 'inkDim'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the primary accent AA contrast for body text', () => {
    expect(contrastRatio(PALETTE_LIGHT.teal, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('gives secondary accent and muted text at least 3:1 for large text and strokes', () => {
    for (const key of ['orange', 'inkMuted'] as const) {
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
