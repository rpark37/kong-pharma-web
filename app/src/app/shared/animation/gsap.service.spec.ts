import { TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { GsapService } from './gsap.service';
import { MOTION, QUAD } from './motion';

describe('GsapService', () => {
  let service: GsapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GsapService);
  });

  it('exposes only Quad eases', () => {
    expect(service.QUAD).toEqual({ in: 'quad.in', out: 'quad.out', inOut: 'quad.inOut' });
    expect(Object.values(QUAD).every((e) => e.startsWith('quad.'))).toBe(true);
  });

  it('reveal uses quad.out with the shared delay and stagger', () => {
    const el = document.createElement('div');
    const tween = service.reveal(el, { delay: 0.3 });
    expect(tween.vars['ease']).toBe('quad.out');
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
