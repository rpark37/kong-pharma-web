import type { Flight, Quake, Sat } from '../gev/tracks';
import { CONFLICT_ZONES } from './conflict-zones';
import {
  DEFAULT_ON,
  LAYERS,
  mapExtent,
  marksFromCraft,
  marksFromEvents,
  marksFromFeeds,
  marksFromFires,
  marksFromQuakes,
  marksFromSats,
  marksFromZones,
  nearest,
} from './layers';
import { NEWS_FEEDS } from './news-feeds';

const jet: Flight = { id: 'ASI993', lat: 0, lon: 0, alt: 7475, hdg: 90, spd: 600, type: 'PA-28' };
const iss: Sat = { name: 'ISS (ZARYA)', inc: 51.6, raan: 0, ma: 0, revsPerDay: 15.5, altKm: 420, epoch: Date.UTC(2026, 8, 21) };
const quake: Quake = { lat: 36.1, lon: 140.2, mag: 5.4, depth: 42, time: Date.UTC(2026, 8, 20, 3, 4) };

describe('LAYERS', () => {
  it('lists seven layers with unique ids and the default set is a subset', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['fires', 'events', 'quakes', 'zones', 'news', 'sats', 'craft']);
    for (const id of DEFAULT_ON) expect(LAYERS.some((l) => l.id === id)).toBe(true);
    expect(DEFAULT_ON.has('craft')).toBe(true);
    expect(DEFAULT_ON.has('news')).toBe(false);
  });
});

describe('mappers', () => {
  it('leaves craft where captured at elapsed 0 and moves them east afterwards', () => {
    const [still] = marksFromCraft([jet], 0);
    expect(still.lon).toBe(0);
    expect(still.layer).toBe('craft');
    expect(still.label).toBe('ASI993');
    const [moved] = marksFromCraft([jet], 60);
    // 60 s of replay at 60x is one hour: 600 kts ≈ 9.99° of arc eastwards.
    expect(moved.lon).toBeCloseTo(9.99, 1);
    expect(moved.lat).toBeCloseTo(0, 6);
  });

  it('propagates satellites and keeps them on the globe', () => {
    const [m] = marksFromSats([iss], iss.epoch, 120);
    expect(Math.abs(m.lat)).toBeLessThanOrEqual(51.7);
    expect(Math.abs(m.lon)).toBeLessThanOrEqual(180);
    expect(m.lines[0]).toContain('420 KM');
  });

  it('sizes quakes by magnitude and labels with magnitude', () => {
    const [m] = marksFromQuakes([quake]);
    expect(m.label).toBe('M5.4');
    expect(m.size).toBeGreaterThan(marksFromQuakes([{ ...quake, mag: 3 }])[0].size);
    expect(m.lines.some((l) => l.includes('42 KM'))).toBe(true);
  });

  it('maps fires, events, feeds and zones one-to-one', () => {
    expect(marksFromFires([{ lat: 1, lon: 2, frp: 12.5, conf: 80, day: true }])[0]).toMatchObject({ layer: 'fires', lat: 1, lon: 2, label: 'FRP 12.5' });
    const [ev] = marksFromEvents([{ id: 'EONET_1', title: 'Hurricane Polo', cat: 'severeStorms', lat: 15.1, lon: -104.8, date: '2026-09-21T00:00:00Z', url: 'https://x' }]);
    expect(ev).toMatchObject({ layer: 'events', label: 'Hurricane Polo', url: 'https://x' });
    expect(ev.lines[0]).toBe('SEVERE STORMS');
    expect(marksFromCraft([{ ...jet, hdg: 7 }], 0)[0].lines[1]).toBe('HDG 007');
    expect(marksFromFeeds()).toHaveLength(NEWS_FEEDS.length);
    expect(marksFromFeeds().find((m) => m.id === 'skynews')?.embed).toContain('youtube-nocookie.com');
    expect(marksFromZones()).toHaveLength(CONFLICT_ZONES.length);
    expect(marksFromZones().every((m) => m.color)).toBe(true);
    for (const m of marksFromZones()) for (const l of m.lines) expect(l).toBe(l.toUpperCase());
  });
});

describe('nearest', () => {
  const pts = [
    { id: 'a', x: 10, y: 10 },
    { id: 'b', x: 30, y: 10 },
  ];
  it('picks the closer point inside the radius', () => {
    expect(nearest(pts, 24, 10, 12)?.id).toBe('b');
    expect(nearest(pts, 14, 10, 12)?.id).toBe('a');
  });
  it('returns null outside the radius', () => {
    expect(nearest(pts, 100, 100, 12)).toBeNull();
  });
  it('breaks a tie by list order', () => {
    expect(nearest(pts, 20, 10, 12)?.id).toBe('a');
  });
});

describe('mapExtent', () => {
  it('leaves the right column free on a wide stage', () => {
    const { extent } = mapExtent(1600, 900);
    expect(extent[0]).toEqual([48, 110]);
    expect(extent[1]).toEqual([1600 - 360, 900 - 96]);
  });
  it('keeps the map at least half the width on a phone in portrait', () => {
    const { extent } = mapExtent(390, 844);
    expect(extent[1][0] - extent[0][0]).toBeGreaterThanOrEqual(195);
    expect(extent[1][1]).toBeLessThanOrEqual(844);
  });
  it('never lets the scaled chrome exceed the stage width', () => {
    for (const [w, h] of [
      [390, 844],
      [390, 700],
      [1280, 800],
      [1600, 900],
    ])
      expect(mapExtent(w, h).scale * 900).toBeLessThanOrEqual(Math.max(w, h) + 1e-9);
  });
});
