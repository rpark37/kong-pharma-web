/**
 * Single source of truth for motion. Every tween in the app uses a Quad ease (GSAP's
 * `quad` family) with explicit delays and staggers taken from here, so pages feel like one
 * system rather than a collection of animations.
 */
export const QUAD = {
  in: 'quad.in',
  out: 'quad.out',
  inOut: 'quad.inOut',
} as const;

export const MOTION = {
  duration: {
    fast: 0.2,
    base: 0.45,
    slow: 0.9,
  },
  delay: {
    none: 0,
    short: 0.05,
    medium: 0.12,
    long: 0.25,
  },
  stagger: 0.06,
  distance: 18,
} as const;
