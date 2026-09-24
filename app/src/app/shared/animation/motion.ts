/**
 * Single source of truth for motion. Every tween in the app uses one of these eases with explicit
 * delays and staggers taken from here, so pages feel like one system rather than a collection of
 * animations.
 *
 * The feel is fast and settled: `expo.out` snaps in over the first frames and glides to rest, which
 * reads as responsive HUD chrome rather than a page loading; `power3` (cubic) for symmetric moves
 * such as camera orbits, where an exponential start would feel like a cut. Nothing longer than
 * 0.3 s except camera and geometry moves, which get `slow`.
 */
export const EASE = {
  in: 'power3.in',
  out: 'expo.out',
  inOut: 'power3.inOut',
} as const;

export const MOTION = {
  duration: {
    fast: 0.15,
    base: 0.3,
    /** Camera orbits and the atlas explode: 0.3 s reads as a cut when the whole scene moves. */
    slow: 0.5,
  },
  delay: {
    none: 0,
    short: 0.03,
    medium: 0.08,
    long: 0.15,
  },
  stagger: 0.1,
  distance: 18,
} as const;
