import { effect, signal, type Signal } from '@angular/core';

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * One brush produces several settles (one per client). The sample for a brush is the time to
 * its last settle, so it keeps growing until the next brush starts. Ten samples are kept.
 */
export class BrushTimer {
  readonly samples: number[] = [];
  private startAt: number | null = null;
  private open = false;

  brushed(now: number): void { this.startAt = now; this.open = false; }

  settled(now: number): void {
    if (this.startAt === null) return;
    const ms = now - this.startAt;
    if (this.open) this.samples[this.samples.length - 1] = ms; else { this.samples.push(ms); this.open = true; }
    if (this.samples.length > 10) this.samples.shift();
  }
}

/** The page's readout: every number the acceptance section of the spec asks for, as signals. */
export class Bench {
  readonly boot = signal<number | null>(null);
  readonly gen = signal<number | null>(null);
  readonly firstRow = signal<number | null>(null);
  readonly brush = signal<number | null>(null);
  readonly scrollFps = signal<number | null>(null);
  readonly longTasks = signal(0);
  private readonly timer = new BrushTimer();
  private observer: PerformanceObserver | null = null;
  private raf = 0;

  constructor() {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      this.observer = new PerformanceObserver((list) => this.longTasks.update((n) => n + list.getEntries().filter((e) => e.duration > 50).length));
      this.observer.observe({ type: 'longtask', buffered: false });
    }
  }

  setBoot(ms: number | null): void { this.boot.set(ms); }
  setGen(ms: number): void { this.gen.set(ms); this.longTasks.set(0); this.firstRow.set(null); this.brush.set(null); this.timer.samples.length = 0; }
  setFirstRow(ms: number): void { this.firstRow.set(Math.round(ms)); }
  brushed(): void { this.timer.brushed(performance.now()); }
  settled(): void { this.timer.settled(performance.now()); const m = median(this.timer.samples); this.brush.set(m === null ? null : Math.round(m)); }

  /** Samples requestAnimationFrame while `scrolling` is true and reports frames per second. Call from an injection context. */
  startScrollSampling(scrolling: Signal<boolean>): void {
    effect(() => {
      const on = scrolling();
      cancelAnimationFrame(this.raf);
      if (!on) return;
      let frames = 0, t0 = performance.now();
      const tick = () => {
        frames++;
        const dt = performance.now() - t0;
        if (dt >= 1000) { this.scrollFps.set(Math.round((frames / dt) * 1000)); frames = 0; t0 = performance.now(); }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  dispose(): void { this.observer?.disconnect(); cancelAnimationFrame(this.raf); }
}
