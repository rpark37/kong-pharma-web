import hazards from '../../../../public/data/osiris/hazards.json';
import type { Hazards } from './layers';

const h = hazards as Hazards;
const onGlobe = (p: { lat: number; lon: number }) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

describe('public/data/osiris/hazards.json', () => {
  it('was captured, with fires sorted hottest first and capped', () => {
    expect(Number.isFinite(h.captured)).toBe(true);
    expect(h.fires.length).toBeGreaterThan(0);
    expect(h.fires.length).toBeLessThanOrEqual(1500);
    for (let i = 1; i < h.fires.length; i++) expect(h.fires[i - 1].frp).toBeGreaterThanOrEqual(h.fires[i].frp);
  });

  it('keeps every row on the globe with the fields the mappers read', () => {
    expect(h.fires.every((f) => onGlobe(f) && f.conf >= 30 && typeof f.day === 'boolean')).toBe(true);
    expect(h.events.every((e) => onGlobe(e) && e.id && e.title && e.cat && /^\d{4}-\d{2}-\d{2}/.test(e.date))).toBe(true);
    expect(new Set(h.events.map((e) => e.id)).size).toBe(h.events.length);
  });
});
