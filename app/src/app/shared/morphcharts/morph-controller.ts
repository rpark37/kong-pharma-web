/**
 * Morphing one MorphCharts scene into another.
 *
 * There is no spec-level transition to lean on: `Plot.fromJSONAsync` → `createSceneAsync` →
 * `renderer.loadScene` replaces the scene wholesale, and although core ships a `TransitionBuffer`
 * with `currentBuffer`/`previousBuffer`, the vendored WebGPU ray-trace renderer never reads it.
 * So the move is to load the TARGET spec immediately and then drive the unit buffer from the
 * previous pose to the new one ourselves, one scalar tween writing every block each frame.
 *
 * Analogy: the spec sets the stage and the props; this is the choreographer telling each block
 * where to stand for the next scene, and when to start walking.
 *
 * Two things constrain what is possible, and both are inherent rather than incidental:
 *
 * 1. **Identity.** Index `i` must mean the same block in both frames. There is no key matching
 *    here, so a change in unit count is a cut, not a morph. Populations that grow and shrink
 *    should instead keep a fixed count and use `visible` — absent blocks scale to nothing in
 *    place rather than being removed.
 * 2. **It is a path tracer.** Every write resets `frameCount`, so a moving scene never converges.
 *    Motion therefore runs in the cheap `color` render mode and only returns to `raytrace` once
 *    the scene has been still for a moment.
 */
import { gsap } from 'gsap';
import { Core, type MorphChartsHost, type RenderMode } from './morphcharts-host';

/** One posed state of the whole unit population: where each block stands, how big, what colour. */
export interface MorphFrame {
  /** `count * 3`, in plot units. */
  positions: Float32Array;
  /** `count * 3`, linear RGB in 0..1. */
  colors: Float32Array;
  /** 1 = present in this pose, 0 = grows in / shrinks out. */
  visible: Uint8Array;
  /** Uniform block edge, in plot units. */
  size: number;
}

export interface MorphOptions {
  durationMs: number;
  /** Spread of per-block start times. The tween runs `duration + stagger` and each block eases
   *  inside its own `duration`-wide window, which is why the outer tween is linear. */
  staggerMs?: number;
  /** 0..1 per block, and stable across calls so a block keeps its place in the queue. Without it
   *  every block moves together. Any indexable sequence — callers hold these as typed arrays of
   *  whichever width they already had. */
  stagger?: ArrayLike<number>;
  /** Cut straight to the target pose. */
  reducedMotion?: boolean;
  /** Block depth from the frame's edge size. Defaults to the flat-tile ratio. */
  depthOf?: (size: number) => number;
}

/** Cubic in-out — the same curve as GSAP's `power3.inOut`, which every other tween in the app uses. */
const cubicInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const defaultDepth = (size: number): number => Math.max(2, size * 0.35);
/** How long the scene must hold still before it is worth re-entering the path tracer. */
const SETTLE_MS = 250;

export class MorphController {
  private buffer: Core.Buffer | null = null;
  /** Translations the freshly loaded spec gave each block; writes are offsets from these. */
  private base = new Float32Array(0);
  private scaling = 1;
  private current: MorphFrame | null = null;
  private count = 0;
  private readonly progress = { t: 0 };
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Fires once the scene has reached the target pose, on a cut as well as a morph. */
  onTransitionEnd: (() => void) | null = null;
  /** The mode a still scene renders in; motion always runs in the cheap `color` mode. */
  stillMode: RenderMode = 'raytrace';

  get isTransitioning(): boolean {
    return gsap.isTweening(this.progress);
  }

  constructor(readonly host: MorphChartsHost) {}

  /**
   * Load `spec` — which must describe `frame` — and move into it from whatever is on screen.
   * Cuts rather than morphs on the first call, when the unit count changes, or when motion is off.
   */
  async to(spec: unknown, frame: MorphFrame, count: number, options: MorphOptions): Promise<void> {
    const staggerMs = options.staggerMs ?? 0;
    const start = this.current && this.count === count ? this.current : null;

    gsap.killTweensOf(this.progress);
    // The camera is taken from the spec only on the first load; later ones would snap it.
    await this.host.loadSpec(spec, { includeCamera: !this.current });
    this.current = frame;
    this.count = count;

    this.buffer = ((this.host.scene?.buffers ?? []).find((b) => b.length === count) as Core.Buffer | undefined) ?? null;
    const plot = this.host.plot;
    this.scaling = plot ? plot.size / Math.max(plot.width, plot.height, plot.depth) : 1;
    this.base = new Float32Array(count * 3);
    if (this.buffer) {
      const v: Core.Vector3 = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        Core.UnitVertex.getTranslation(this.buffer.dataView, i, v);
        this.base.set(v, i * 3);
      }
    }

    if (!start || options.reducedMotion || options.durationMs + staggerMs <= 0) {
      this.write(frame, frame, 1, count, options);
      this.settle();
      this.onTransitionEnd?.();
      return;
    }

    this.startMotion();
    this.progress.t = 0;
    this.write(start, frame, 0, count, options);
    gsap.to(this.progress, {
      t: 1,
      duration: (options.durationMs + staggerMs) / 1000,
      ease: 'none', // each block applies its own cubicInOut inside its staggered window
      onUpdate: () => this.write(start, frame, this.progress.t, count, options),
      onComplete: () => { this.settle(); this.onTransitionEnd?.(); },
    });
  }

  /** Forget the current pose, so the next `to()` cuts instead of morphing. */
  reset(): void {
    this.current = null;
  }

  dispose(): void {
    gsap.killTweensOf(this.progress);
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
  }

  /** Write every block's interpolated translation, scale and fill for global progress `t`. */
  private write(start: MorphFrame, target: MorphFrame, t: number, count: number, options: MorphOptions): void {
    if (!this.buffer) return;
    const dv = this.buffer.dataView;
    const staggerMs = options.staggerMs ?? 0;
    const total = options.durationMs + staggerMs;
    const window = total > 0 ? options.durationMs / total : 1;
    const staggerSpan = total > 0 ? staggerMs / total : 0;
    const s = this.scaling;
    const startSize = start.size * s;
    const targetSize = target.size * s;
    const depth = (options.depthOf ?? defaultDepth)(target.size) * s;
    const v: Core.Vector3 = [0, 0, 0];

    for (let i = 0; i < count; i++) {
      const delay = (options.stagger?.[i] ?? 0) * staggerSpan;
      const p = t >= 1 ? 1 : window > 0 ? cubicInOut(Math.min(1, Math.max(0, (t - delay) / window))) : 1;
      const sv = start.visible[i], tv = target.visible[i];
      const sx = start.positions[i * 3], sy = start.positions[i * 3 + 1], sz = start.positions[i * 3 + 2];
      const tx = target.positions[i * 3], ty = target.positions[i * 3 + 1], tz = target.positions[i * 3 + 2];
      let px: number, py: number, pz: number, size: number;
      if (sv && tv) {
        px = sx + (tx - sx) * p; py = sy + (ty - sy) * p; pz = sz + (tz - sz) * p;
        size = startSize + (targetSize - startSize) * p;
      } else if (tv) { // appearing: grow in place
        px = tx; py = ty; pz = tz; size = targetSize * p;
      } else if (sv) { // disappearing: shrink in place
        px = sx; py = sy; pz = sz; size = startSize * (1 - p);
      } else {
        px = tx; py = ty; pz = tz; size = 0;
      }
      v[0] = this.base[i * 3] + (px - tx) * s;
      v[1] = this.base[i * 3 + 1] + (py - ty) * s;
      v[2] = this.base[i * 3 + 2] + (pz - tz) * s;
      Core.UnitVertex.setTranslation(dv, i, v);
      const edge = Math.max(1e-6, size);
      Core.UnitVertex.setScale(dv, i, [edge, edge, size > 0 ? depth : 1e-6]);
      v[0] = start.colors[i * 3] + (target.colors[i * 3] - start.colors[i * 3]) * p;
      v[1] = start.colors[i * 3 + 1] + (target.colors[i * 3 + 1] - start.colors[i * 3 + 1]) * p;
      v[2] = start.colors[i * 3 + 2] + (target.colors[i * 3 + 2] - start.colors[i * 3 + 2]) * p;
      Core.UnitVertex.setFill(dv, i, v);
    }

    this.buffer.hasChangedCallback?.();
    this.host.renderer.frameCount = 0;
    this.ensureRunning();
  }

  private startMotion(): void {
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
    this.host.renderer.renderMode = 'color';
  }

  /** Back to the path tracer once the scene has held still — see the note on convergence above. */
  private settle(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.host.renderer.renderMode = this.stillMode;
      this.host.renderer.frameCount = 0;
      this.ensureRunning();
    }, SETTLE_MS);
  }

  private ensureRunning(): void {
    if (!this.host.running() && this.host.hasMarks()) this.host.start();
  }
}
