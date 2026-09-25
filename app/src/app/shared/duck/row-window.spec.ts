import { MAX_SCROLL_PX, RowWindow, scrollToStart, spacerHeight, startToScroll, windowRange } from './row-window';

describe('scaled scrollbar', () => {
  const rowH = 28, viewport = 560, visible = 20;

  it('is linear while the content fits under the cap', () => {
    expect(spacerHeight(1000, rowH)).toBe(28_000);
    expect(startToScroll(10, 1000, visible, rowH, viewport)).toBe(280);
    expect(scrollToStart(280, 1000, visible, rowH, viewport)).toBe(10);
  });

  it('caps the spacer and still reaches both ends at 10M rows', () => {
    const total = 10_000_000;
    expect(spacerHeight(total, rowH)).toBe(MAX_SCROLL_PX);
    expect(startToScroll(0, total, visible, rowH, viewport)).toBe(0);
    const last = total - visible;
    const bottom = startToScroll(last, total, visible, rowH, viewport);
    expect(bottom).toBe(MAX_SCROLL_PX - viewport);
    expect(scrollToStart(bottom, total, visible, rowH, viewport)).toBe(last);
    expect(scrollToStart(0, total, visible, rowH, viewport)).toBe(0);
  });

  it('never returns a start past the last page or below zero', () => {
    expect(scrollToStart(-50, 100, visible, rowH, viewport)).toBe(0);
    expect(scrollToStart(1e9, 100, visible, rowH, viewport)).toBe(80);
    expect(scrollToStart(0, 0, visible, rowH, viewport)).toBe(0);
    expect(scrollToStart(0, 5, visible, rowH, viewport)).toBe(0); // fewer rows than the viewport
  });
});

describe('windowRange', () => {
  it('adds overscan on both sides and clamps to the table', () => {
    expect(windowRange(100, 20, 1000, 20)).toEqual({ start: 80, end: 140 });
    expect(windowRange(0, 20, 1000, 20)).toEqual({ start: 0, end: 40 });
    expect(windowRange(990, 20, 1000, 20)).toEqual({ start: 970, end: 1000 });
    expect(windowRange(0, 20, 0, 20)).toEqual({ start: 0, end: 0 });
  });
});

describe('RowWindow', () => {
  it('stores accepted rows by absolute index and serves them back', () => {
    const w = new RowWindow();
    const t = w.begin();
    expect(w.accept(t, { start: 10, end: 12 }, [['a'], ['b']])).toBe(true);
    expect(w.get(10)).toEqual(['a']);
    expect(w.get(11)).toEqual(['b']);
    expect(w.get(12)).toBeUndefined();
  });

  it('drops a response whose token is stale', () => {
    const w = new RowWindow();
    const old = w.begin();
    w.begin();
    expect(w.accept(old, { start: 0, end: 1 }, [['stale']])).toBe(false);
    expect(w.get(0)).toBeUndefined();
  });

  it('clear() forgets rows and invalidates outstanding tokens', () => {
    const w = new RowWindow();
    const t = w.begin();
    w.accept(t, { start: 0, end: 1 }, [['x']]);
    w.clear();
    expect(w.get(0)).toBeUndefined();
    expect(w.accept(t, { start: 0, end: 1 }, [['x']])).toBe(false);
  });

  it('evicts everything once the cache passes its cap', () => {
    const w = new RowWindow(100);
    const t = w.begin();
    w.accept(t, { start: 0, end: 101 }, Array.from({ length: 101 }, (_, i) => [i]));
    expect(w.size).toBeLessThanOrEqual(101);
    const t2 = w.begin();
    w.accept(t2, { start: 500, end: 501 }, [['new']]);
    expect(w.get(0)).toBeUndefined();
    expect(w.get(500)).toEqual(['new']);
  });
});
