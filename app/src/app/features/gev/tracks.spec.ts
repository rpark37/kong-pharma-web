import worldJson from '../../../../public/data/vega/data/world-110m.json';
import { distanceKm } from '../map/sites';
import {
  type Flight,
  type Sat,
  type Topology,
  SENSORS,
  altitudeFromMeanMotion,
  deadReckon,
  decodeArcs,
  gradeLut,
  lutTable,
  nearbyContacts,
  satelliteAt,
  wrapLon,
} from './tracks';

/** 600 knots for an hour is 1111.2 km, which is 9.9933° of arc. Every case below leans on that. */
const jet = (over: Partial<Flight> = {}): Flight => ({
  id: 'ASI993',
  lat: 0,
  lon: 0,
  alt: 7475,
  hdg: 90,
  spd: 600,
  type: 'PA-28',
  ...over,
});

describe('wrapLon', () => {
  it('leaves an ordinary longitude alone', () => {
    expect(wrapLon(0)).toBe(0);
    expect(wrapLon(-71.3162)).toBeCloseTo(-71.3162, 6);
  });

  it('folds a longitude that ran past the antimeridian', () => {
    expect(wrapLon(181)).toBe(-179);
    expect(wrapLon(541)).toBe(-179);
    expect(wrapLon(-181)).toBe(179);
  });

  it('normalises both poles of the seam to the same value', () => {
    expect(wrapLon(180)).toBe(-180);
    expect(wrapLon(-180)).toBe(-180);
  });
});

describe('deadReckon', () => {
  it('returns the contact untouched when no time has passed', () => {
    const c = jet();
    expect(deadReckon(c, 0)).toBe(c);
  });

  it('does not move a stationary contact', () => {
    const c = jet({ spd: 0 });
    expect(deadReckon(c, 3600)).toBe(c);
  });

  it('advances due east along the equator', () => {
    const c = deadReckon(jet(), 3600);
    expect(c.lon).toBeCloseTo(9.9933, 3);
    expect(c.lat).toBeCloseTo(0, 9);
  });

  it('carries the other fields through unchanged', () => {
    const c = deadReckon(jet(), 600);
    expect(c.id).toBe('ASI993');
    expect(c.alt).toBe(7475);
    expect(c.type).toBe('PA-28');
  });

  it('wraps across the antimeridian rather than running past 180', () => {
    const c = deadReckon(jet({ lon: 179 }), 3600);
    expect(c.lon).toBeCloseTo(-171.0067, 3);
  });

  it('reflects over the pole instead of producing a latitude above 90', () => {
    const c = deadReckon(jet({ lat: 89, lon: 0, hdg: 0 }), 3600);
    expect(c.lat).toBeCloseTo(81.0067, 3);
    expect(c.lon).toBe(-180);
  });

  it('never yields NaN for a contact sitting exactly on the pole', () => {
    const c = deadReckon(jet({ lat: 90, hdg: 180 }), 3600);
    expect(Number.isNaN(c.lat)).toBe(false);
    expect(Number.isNaN(c.lon)).toBe(false);
  });
});

describe('nearbyContacts', () => {
  const origin = { lat: 42.6334, lon: -71.3162 };
  const boston = jet({ id: 'BOS', lat: 42.3601, lon: -71.0589 });
  const sydney = jet({ id: 'SYD', lat: -33.8688, lon: 151.2093 });
  const worcester = jet({ id: 'WOR', lat: 42.2762, lon: -71.7612 });

  it('drops anything outside the window', () => {
    const near = nearbyContacts(origin, [boston, sydney]);
    expect(near.map((c) => c.craft.id)).toEqual(['BOS']);
  });

  it('orders by range, nearest first', () => {
    const near = nearbyContacts(origin, [worcester, boston]);
    expect(near.map((c) => c.craft.id)).toEqual(['BOS', 'WOR']);
    expect(near[0].km).toBeLessThan(near[1].km);
  });

  it('honours the limit', () => {
    expect(nearbyContacts(origin, [boston, worcester], 250, 1)).toHaveLength(1);
  });

  it('breaks a range tie on id so the rail does not flicker between frames', () => {
    const a = jet({ id: 'AAA', lat: 42.3601, lon: -71.0589 });
    const b = jet({ id: 'BBB', lat: 42.3601, lon: -71.0589 });
    expect(nearbyContacts(origin, [b, a]).map((c) => c.craft.id)).toEqual(['AAA', 'BBB']);
  });

  it('returns nothing rather than throwing on an empty snapshot', () => {
    expect(nearbyContacts(origin, [])).toEqual([]);
  });
});

describe('gradeLut', () => {
  it('passes luminance straight through for the unmodified modes', () => {
    expect(gradeLut('normal', 0.4)).toEqual([0.4, 0.4, 0.4]);
    expect(gradeLut('crt', 0.4)).toEqual([0.4, 0.4, 0.4]);
  });

  it('clamps out-of-range input instead of extrapolating off the ramp', () => {
    expect(gradeLut('flir', -1)).toEqual(gradeLut('flir', 0));
    expect(gradeLut('flir', 2)).toEqual(gradeLut('flir', 1));
  });

  it('anchors both ends of the ironbow ramp', () => {
    const [r, g, b] = gradeLut('flir', 0);
    expect(r + g + b).toBeLessThan(0.1);
    expect(gradeLut('flir', 1)).toEqual([1, 1, 0.95]);
  });

  it('rises monotonically in brightness across the ironbow ramp', () => {
    let last = -1;
    for (let i = 0; i <= 32; i++) {
      const [r, g, b] = gradeLut('flir', i / 32);
      const lum = r + g + b;
      expect(lum).toBeGreaterThan(last);
      last = lum;
    }
  });

  it('keeps night vision green-dominant everywhere but the blown-out top', () => {
    for (let i = 1; i <= 8; i++) {
      const [r, g, b] = gradeLut('nvg', (i / 8) * 0.8);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });

  it('offers a ramp for every sensor the tray lists', () => {
    for (const s of SENSORS) expect(gradeLut(s.id, 0.5)).toHaveLength(3);
  });
});

describe('satelliteAt', () => {
  /** The ISS, near enough: 51.6° inclination, ~15.5 revolutions a day. */
  const iss: Sat = { name: 'ISS', inc: 51.63, raan: 200.04, ma: 207.67, revsPerDay: 15.4916, altKm: 420, epoch: Date.UTC(2026, 8, 18) };

  it('returns to the same sub-point one sidereal-corrected period later', () => {
    const periodMs = (86400 / iss.revsPerDay) * 1000;
    const a = satelliteAt(iss, iss.epoch);
    const b = satelliteAt(iss, iss.epoch + periodMs);
    expect(b.lat).toBeCloseTo(a.lat, 4);
  });

  it('never exceeds its inclination in latitude', () => {
    const periodMs = (86400 / iss.revsPerDay) * 1000;
    for (let i = 0; i <= 64; i++) {
      const { lat } = satelliteAt(iss, iss.epoch + (periodMs * i) / 64);
      expect(Math.abs(lat)).toBeLessThanOrEqual(iss.inc + 1e-6);
    }
  });

  it('respects the mirrored limit for a retrograde sun-synchronous orbit', () => {
    const sso: Sat = { ...iss, inc: 97.9, revsPerDay: 15.2 };
    const periodMs = (86400 / sso.revsPerDay) * 1000;
    for (let i = 0; i <= 64; i++) {
      const { lat } = satelliteAt(sso, sso.epoch + (periodMs * i) / 64);
      expect(Math.abs(lat)).toBeLessThanOrEqual(180 - sso.inc + 1e-6);
    }
  });

  it('keeps every sub-point on the globe', () => {
    for (let i = 0; i <= 200; i++) {
      const p = satelliteAt(iss, iss.epoch + i * 60000);
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThan(180.000001);
      expect(Number.isFinite(p.lat)).toBe(true);
    }
  });

  it('holds altitude constant, because the orbit is circular by construction', () => {
    expect(satelliteAt(iss, iss.epoch + 5e6).altKm).toBe(420);
  });
});

describe('altitudeFromMeanMotion', () => {
  it('puts the ISS in low earth orbit', () => {
    expect(altitudeFromMeanMotion(15.4916)).toBeGreaterThan(390);
    expect(altitudeFromMeanMotion(15.4916)).toBeLessThan(440);
  });

  it('puts a one-revolution-a-day satellite on the geostationary ring', () => {
    expect(altitudeFromMeanMotion(1.0027)).toBeCloseTo(35786, -2);
  });
});

describe('decodeArcs', () => {
  it('accumulates deltas and applies the transform', () => {
    const topo: Topology = {
      transform: { scale: [2, 4], translate: [-10, -20] },
      arcs: [[[0, 0], [1, 1], [2, 3]]],
    };
    expect(decodeArcs(topo)[0]).toEqual([
      [-10, -20],
      [-8, -16],
      [-4, -4],
    ]);
  });

  /** The guard that fires if the committed world file is ever re-vendored in a different shape. */
  describe('against the committed world-110m.json', () => {
    // Imported, not read from disk: the spec tsconfig carries only vitest globals, so there is no
    // `node:fs` here. Vite resolves it at build time, so this is still the committed file.
    const arcs = decodeArcs(worldJson as unknown as Topology);

    it('decodes every arc', () => {
      expect(arcs).toHaveLength(985);
    });

    it('lands every vertex on the globe', () => {
      for (const arc of arcs) {
        for (const [lon, lat] of arc) {
          expect(lon).toBeGreaterThanOrEqual(-180.001);
          expect(lon).toBeLessThanOrEqual(180.001);
          expect(lat).toBeGreaterThanOrEqual(-90.001);
          expect(lat).toBeLessThanOrEqual(90.001);
        }
      }
    });

    it('keeps segments short enough that a straight chord hugs the sphere', () => {
      // Measured on the sphere, never in longitude degrees: an arc stepping from -179.9 to +179.9
      // looks like a 359.8 jump in raw longitude but is 22 km of ground. Going straight to 3D is
      // what makes the seam a non-issue, and this is the assertion that says so.
      let worstKm = 0;
      for (const arc of arcs) {
        for (let i = 1; i < arc.length; i++) {
          const a = { lon: arc[i - 1][0], lat: arc[i - 1][1] };
          const b = { lon: arc[i][0], lat: arc[i][1] };
          worstKm = Math.max(worstKm, distanceKm(a, b));
        }
      }
      // Worst real step is 5.69 deg / 633 km, which sags 7.9 km off the sphere — under a pixel.
      expect(worstKm).toBeLessThan(700);
    });
  });
});

describe('lutTable', () => {
  it('emits one value per sample for each channel', () => {
    const [r, g, b] = lutTable('flir', 9);
    expect(r.split(' ')).toHaveLength(9);
    expect(g.split(' ')).toHaveLength(9);
    expect(b.split(' ')).toHaveLength(9);
  });

  it('stays inside the 0..1 range an feComponentTransfer table requires', () => {
    for (const s of SENSORS) {
      for (const channel of lutTable(s.id)) {
        for (const v of channel.split(' ').map(Number)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('is an identity ramp for the modes that do not recolor', () => {
    const [r] = lutTable('normal', 3);
    expect(r).toBe('0.000 0.500 1.000');
  });
});
