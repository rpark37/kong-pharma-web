import { BrushTimer, median } from './bench';

describe('median', () => {
  it('handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('BrushTimer', () => {
  it('measures from a brush to the last settle before the next brush', () => {
    const t = new BrushTimer();
    t.brushed(100);
    t.settled(130); // first client
    t.settled(160); // last client: the sample becomes 60
    expect(t.samples).toEqual([60]);
    t.brushed(200);
    t.settled(210);
    expect(t.samples).toEqual([60, 10]);
  });

  it('ignores settles with no brush in flight and keeps only the last ten samples', () => {
    const t = new BrushTimer();
    t.settled(50);
    expect(t.samples).toEqual([]);
    for (let i = 0; i < 12; i++) { t.brushed(i * 100); t.settled(i * 100 + i); }
    expect(t.samples.length).toBe(10);
    expect(t.samples[0]).toBe(2);
  });
});
