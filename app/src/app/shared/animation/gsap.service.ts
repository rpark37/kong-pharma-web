import { Injectable, WritableSignal } from '@angular/core';
import { gsap } from 'gsap';
import { MOTION, QUAD } from './motion';

export interface RevealOptions {
  delay?: number;
  stagger?: number;
  duration?: number;
  distance?: number;
  from?: 'up' | 'down' | 'left' | 'right';
}

export interface NumberTweenOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  decimals?: number;
}

/**
 * Thin wrapper over GreenSock so components never pick eases or timings ad hoc.
 * Think of it as the choreographer: components say "reveal these" or "count this up",
 * and the service decides the Quad ease, delay and stagger.
 */
@Injectable({ providedIn: 'root' })
export class GsapService {
  readonly QUAD = QUAD;
  readonly MOTION = MOTION;

  get reducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private dur(seconds: number): number {
    return this.reducedMotion ? 0 : seconds;
  }

  private delay(seconds: number): number {
    return this.reducedMotion ? 0 : seconds;
  }

  /** Fade + slide a set of elements in, staggered. Returns the tween for chaining. */
  reveal(targets: gsap.TweenTarget, options: RevealOptions = {}): gsap.core.Tween {
    const distance = options.distance ?? MOTION.distance;
    const axis = options.from === 'left' || options.from === 'right' ? 'x' : 'y';
    const sign = options.from === 'down' || options.from === 'right' ? -1 : 1;
    return gsap.fromTo(
      targets,
      { autoAlpha: 0, [axis]: sign * distance },
      {
        autoAlpha: 1,
        [axis]: 0,
        duration: this.dur(options.duration ?? MOTION.duration.base),
        delay: this.delay(options.delay ?? MOTION.delay.short),
        stagger: this.reducedMotion ? 0 : (options.stagger ?? MOTION.stagger),
        ease: QUAD.out,
        overwrite: 'auto',
        clearProps: 'transform',
      },
    );
  }

  /** Fade + slide elements out (used before content is replaced). */
  leave(targets: gsap.TweenTarget, options: RevealOptions = {}): gsap.core.Tween {
    return gsap.to(targets, {
      autoAlpha: 0,
      y: -(options.distance ?? MOTION.distance / 2),
      duration: this.dur(options.duration ?? MOTION.duration.fast),
      delay: this.delay(options.delay ?? 0),
      stagger: this.reducedMotion ? 0 : (options.stagger ?? MOTION.stagger / 2),
      ease: QUAD.in,
      overwrite: 'auto',
    });
  }

  /** Slide a panel in from an edge. */
  slideIn(target: gsap.TweenTarget, from: 'right' | 'left' | 'bottom' | 'top' = 'right', delay: number = MOTION.delay.none): gsap.core.Tween {
    const axis = from === 'left' || from === 'right' ? 'x' : 'y';
    const sign = from === 'right' || from === 'bottom' ? 1 : -1;
    return gsap.fromTo(
      target,
      { autoAlpha: 0, [axis]: sign * 32 },
      { autoAlpha: 1, [axis]: 0, duration: this.dur(MOTION.duration.base), delay: this.delay(delay), ease: QUAD.out, overwrite: 'auto' },
    );
  }

  slideOut(target: gsap.TweenTarget, to: 'right' | 'left' | 'bottom' | 'top' = 'right'): gsap.core.Tween {
    const axis = to === 'left' || to === 'right' ? 'x' : 'y';
    const sign = to === 'right' || to === 'bottom' ? 1 : -1;
    return gsap.to(target, { autoAlpha: 0, [axis]: sign * 32, duration: this.dur(MOTION.duration.fast), ease: QUAD.in, overwrite: 'auto' });
  }

  /** Tween a numeric signal (for KPI count-ups). */
  tweenNumber(target: WritableSignal<number>, to: number, options: NumberTweenOptions = {}): gsap.core.Tween {
    const proxy = { value: target() };
    const decimals = options.decimals ?? 0;
    const factor = Math.pow(10, decimals);
    return gsap.to(proxy, {
      value: to,
      duration: this.dur(options.duration ?? MOTION.duration.slow),
      delay: this.delay(options.delay ?? 0),
      ease: options.ease ?? QUAD.out,
      overwrite: 'auto',
      onUpdate: () => target.set(Math.round(proxy.value * factor) / factor),
      onComplete: () => target.set(to),
    });
  }

  /** Tween arbitrary numeric properties on a plain object (camera state, explode factor...). */
  tweenObject<T extends object>(target: T, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.to(target, {
      ease: QUAD.inOut,
      ...vars,
      duration: this.dur((vars['duration'] as number | undefined) ?? MOTION.duration.slow),
      delay: this.delay((vars['delay'] as number | undefined) ?? 0),
      overwrite: 'auto',
    });
  }

  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
    return gsap.timeline({ defaults: { ease: QUAD.out }, ...vars });
  }

  /** Page wipe: teal overlay sweeps in (quad.in) then out (quad.out). Resolves when the content is covered. */
  wipeIn(overlay: Element): Promise<void> {
    return new Promise((resolve) => {
      gsap.fromTo(
        overlay,
        { scaleX: 0, transformOrigin: 'left center', autoAlpha: 1 },
        { scaleX: 1, duration: this.dur(MOTION.duration.wipeOut), ease: QUAD.in, overwrite: 'auto', onComplete: resolve },
      );
    });
  }

  wipeOut(overlay: Element, delay: number = MOTION.delay.short): gsap.core.Tween {
    return gsap.to(overlay, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: this.dur(MOTION.duration.wipeIn),
      delay: this.delay(delay),
      ease: QUAD.out,
      overwrite: 'auto',
      onComplete: () => gsap.set(overlay, { autoAlpha: 0, scaleX: 0 }),
    });
  }

  kill(targets: gsap.TweenTarget): void {
    gsap.killTweensOf(targets);
  }

  get ticker() {
    return gsap.ticker;
  }
}
