import { TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { GsapService } from './gsap.service';
import { EASE, MOTION } from './motion';

describe('GsapService', () => {
  let service: GsapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GsapService);
  });

  it('exposes the shared eases: expo out, cubic in and in-out', () => {
    expect(service.EASE).toEqual({ in: 'power3.in', out: 'expo.out', inOut: 'power3.inOut' });
    expect(EASE).toBe(service.EASE);
  });

  it('keeps every duration at 0.3 s or under except the slow camera move, with 0.1 s staggers', () => {
    expect(MOTION.duration.fast).toBeLessThanOrEqual(0.3);
    expect(MOTION.duration.base).toBeLessThanOrEqual(0.3);
    expect(MOTION.duration.slow).toBeLessThanOrEqual(0.5);
    expect(MOTION.stagger).toBe(0.1);
  });

  it('reveal uses expo.out with the shared delay and stagger', () => {
    const el = document.createElement('div');
    const tween = service.reveal(el, { delay: 0.3 });
    expect(tween.vars['ease']).toBe('expo.out');
    expect(tween.vars['delay']).toBeCloseTo(service.reducedMotion ? 0 : 0.3);
    expect(tween.vars['stagger']).toBe(service.reducedMotion ? 0 : MOTION.stagger);
    tween.kill();
  });

  it('kill removes tweens for a target', () => {
    const obj = { x: 0 };
    service.tweenObject(obj, { x: 10, duration: 1 });
    service.kill(obj);
    expect(gsap.getTweensOf(obj).length).toBe(0);
  });
});
