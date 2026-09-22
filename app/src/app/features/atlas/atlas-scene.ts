/**
 * Drives the MorphCharts scene for the Human Atlas: keeps the assembled/exploded positions of
 * every part, writes GSAP-tweened translations straight into the mark buffer, animates camera
 * poses, and does CPU ray picking. Imported lazily (it pulls the MorphCharts runtime).
 */
import { gsap } from 'gsap';
import { Core, Spec, type MorphChartsHost, type RenderMode } from '../../shared/morphcharts/morphcharts-host';
import { CameraRig } from '../../shared/morphcharts/camera-rig';
import { sceneSurface } from '../../shared/theme/surface';
import { EASE, MOTION } from '../../shared/animation/motion';
import type { Part, View } from './anatomy';
import { ATLAS_VIEWS, PLOT, assembledPosition, buildAtlasSpec, cameraPose, explodedPositions, framePose, orbitPose, partSize, type CameraPose, type Geometry, type Stage } from './atlas-spec';

const SETTLE_MS = 300;
const HIGHLIGHT: Core.Vector3 = [0.42, 0.85, 0.78];
/** The page's paper as a unit RGB: what unselected parts fade toward. */
function paper(): Core.Vector3 {
  const n = parseInt(sceneSurface().background.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface AtlasSceneOptions {
  geometry?: Geometry;
  reducedMotion?: boolean;
}

export class AtlasScene {
  private buffer: Core.Buffer | null = null;
  private indexById = new Map<string, number>();
  private baseTranslation = new Float32Array(0);
  private baseFill = new Float32Array(0);
  private assembled = new Float32Array(0);
  private current = new Float32Array(0);
  private target = new Float32Array(0);
  private hidden = new Uint8Array(0);
  private scaling = 1;
  private explodeState = { t: 0 };
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  /** The pose the camera rig orbits about: the front view for this explode amount, or a framed structure. Tweened. */
  private readonly base = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };
  private layout = { width: 0, height: 0 };
  readonly geometry: Geometry;
  readonly reducedMotion: boolean;
  /** View, dolly, orbit and render mode; the page binds the shared camera panel to it. */
  readonly rig: CameraRig;
  /** What a motion settles back to; the rig sets it. */
  stillMode: RenderMode = 'raytrace';
  aspect = 1.6;
  /** Stage size in pixels; lets the exploded inventory clear the panels. */
  stage: Stage | null = null;
  parts: Part[] = [];

  constructor(readonly host: MorphChartsHost, options: AtlasSceneOptions = {}) {
    this.geometry = options.geometry ?? 'sphere';
    this.reducedMotion = options.reducedMotion ?? false;
    this.rig = new CameraRig(host, {
      views: ATLAS_VIEWS,
      pose: (yaw, pitch, zoom) => this.setCamera(orbitPose(this.basePose(), yaw, pitch, zoom)),
      reducedMotion: () => this.reducedMotion,
      onStillMode: (mode) => { this.stillMode = mode; },
    });
  }

  get plot(): Spec.Plot | null { return this.host.plot; }

  /** Parse the spec for these parts and cache buffer state. */
  async load(parts: Part[], view: View, explode: number): Promise<void> {
    this.parts = parts;
    this.indexById = new Map(parts.map((p, i) => [p.id, i]));
    const spec = buildAtlasSpec({ parts, geometry: this.geometry, view, aspect: this.aspect, explode });
    await this.host.loadSpec(spec, { includeCamera: true });
    const plot = this.host.plot!;
    this.scaling = plot.size / Math.max(plot.width, plot.height, plot.depth);
    this.buffer = (this.host.scene?.buffers ?? []).find((b) => b.length === parts.length) as Core.Buffer | undefined ?? null;
    const n = parts.length;
    this.baseTranslation = new Float32Array(n * 3);
    this.baseFill = new Float32Array(n * 3);
    this.assembled = new Float32Array(n * 3);
    this.hidden = new Uint8Array(n);
    const v: Core.Vector3 = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const a = assembledPosition(parts[i]);
      this.assembled.set(a, i * 3);
      if (this.buffer) {
        Core.UnitVertex.getTranslation(this.buffer.dataView, i, v);
        this.baseTranslation.set(v, i * 3);
        Core.UnitVertex.getFill(this.buffer.dataView, i, v);
        this.baseFill.set(v, i * 3);
      }
    }
    this.current = new Float32Array(this.assembled);
    this.target = new Float32Array(this.assembled);
    this.explodeState.t = explode;
    this.host.renderer.renderMode = this.stillMode;
    this.host.maxSamplesPerPixel = 800;
    this.writeBase(cameraPose('front', explode, this.aspect));
    this.rig.apply();
  }

  /** Recompute exploded targets for the currently visible parts (layout depends on the visible set). */
  updateLayout(visibleIds: ReadonlySet<string>): void {
    const visible = this.parts.filter((p) => visibleIds.has(p.id));
    const t = this.explodeState.t;
    const { positions, layoutWidth, layoutHeight } = explodedPositions(visible, t, this.aspect);
    this.layout = { width: layoutWidth, height: layoutHeight };
    visible.forEach((p, k) => {
      const i = this.indexById.get(p.id)!;
      this.target[i * 3] = positions[k * 3];
      this.target[i * 3 + 1] = positions[k * 3 + 1];
      this.target[i * 3 + 2] = positions[k * 3 + 2];
    });
  }

  get layoutSize() { return this.layout; }

  /** Animate (or scrub) the explode amount. */
  setExplode(t: number, visibleIds: ReadonlySet<string>, animate = true): gsap.core.Tween | null {
    gsap.killTweensOf(this.explodeState);
    const apply = () => {
      const visible = this.parts.filter((p) => visibleIds.has(p.id));
      const { positions, layoutWidth, layoutHeight } = explodedPositions(visible, this.explodeState.t, this.aspect);
      this.layout = { width: layoutWidth, height: layoutHeight };
      visible.forEach((p, k) => {
        const i = this.indexById.get(p.id)!;
        this.current[i * 3] = positions[k * 3];
        this.current[i * 3 + 1] = positions[k * 3 + 1];
        this.current[i * 3 + 2] = positions[k * 3 + 2];
      });
      this.writeTranslations();
    };
    if (!animate || this.reducedMotion) {
      this.explodeState.t = t;
      apply();
      this.settle();
      return null;
    }
    this.startMotion();
    return gsap.to(this.explodeState, {
      t,
      duration: MOTION.duration.slow,
      ease: EASE.inOut,
      onUpdate: apply,
      onComplete: () => this.settle(),
    });
  }

  get explode(): number { return this.explodeState.t; }

  /** Hide or show parts by id (hidden parts are shrunk to nothing and parked under the floor). */
  setVisibility(visibleIds: ReadonlySet<string>): void {
    if (!this.buffer) return;
    const dv = this.buffer.dataView;
    for (let i = 0; i < this.parts.length; i++) {
      const show = visibleIds.has(this.parts[i].id);
      const wasHidden = this.hidden[i] === 1;
      this.hidden[i] = show ? 0 : 1;
      if (show && wasHidden) {
        const s = partSize(this.parts[i]);
        Core.UnitVertex.setScale(dv, i, [s[0] * this.scaling, s[1] * this.scaling, s[2] * this.scaling]);
      } else if (!show && !wasHidden) {
        Core.UnitVertex.setScale(dv, i, [1e-6, 1e-6, 1e-6]);
      }
    }
    this.writeTranslations();
  }

  /**
   * Highlight selected parts by tinting their fill teal; while anything is selected the rest
   * recedes halfway into the paper, so a structure inside the torso still reads through the gaps.
   */
  setSelection(selectedIds: ReadonlySet<string>): void {
    if (!this.buffer) return;
    const dv = this.buffer.dataView;
    const v: Core.Vector3 = [0, 0, 0];
    const dim = selectedIds.size ? 0.55 : 0;
    const PAPER = paper();
    for (let i = 0; i < this.parts.length; i++) {
      const sel = selectedIds.has(this.parts[i].id);
      if (sel) {
        v[0] = this.baseFill[i * 3] * 0.35 + HIGHLIGHT[0] * 0.65;
        v[1] = this.baseFill[i * 3 + 1] * 0.35 + HIGHLIGHT[1] * 0.65;
        v[2] = this.baseFill[i * 3 + 2] * 0.35 + HIGHLIGHT[2] * 0.65;
      } else {
        v[0] = this.baseFill[i * 3] * (1 - dim) + PAPER[0] * dim;
        v[1] = this.baseFill[i * 3 + 1] * (1 - dim) + PAPER[1] * dim;
        v[2] = this.baseFill[i * 3 + 2] * (1 - dim) + PAPER[2] * dim;
      }
      Core.UnitVertex.setFill(dv, i, v);
      Core.UnitVertex.setSelected(dv, i, sel ? 1 : 0);
    }
    this.flag();
  }

  /** Re-frame the body for this explode amount; the rig's view preset turns about it. */
  goToView(explode: number, animate = true): void {
    this.goToPose(cameraPose('front', explode, this.aspect, this.layout.width ? this.layout : undefined, 45, this.stage ?? undefined), animate);
  }

  /** Frame the given parts (isolate). */
  frame(parts: Part[], animate = true): void {
    if (parts.length) this.goToPose(framePose(parts), animate);
  }

  private goToPose(pose: CameraPose, animate: boolean): void {
    if (!this.host.plot) return;
    gsap.killTweensOf(this.base);
    if (!animate || this.reducedMotion) {
      this.writeBase(pose);
      this.rig.apply();
      return;
    }
    this.startMotion();
    gsap.to(this.base, {
      px: pose.worldPosition[0], py: pose.worldPosition[1], pz: pose.worldPosition[2], tx: pose.worldTarget[0], ty: pose.worldTarget[1], tz: pose.worldTarget[2],
      duration: MOTION.duration.slow, ease: EASE.inOut, onUpdate: () => this.rig.apply(), onComplete: () => this.settle(),
    });
  }

  private writeBase(pose: CameraPose): void {
    Object.assign(this.base, { px: pose.worldPosition[0], py: pose.worldPosition[1], pz: pose.worldPosition[2], tx: pose.worldTarget[0], ty: pose.worldTarget[1], tz: pose.worldTarget[2] });
  }

  private basePose(): CameraPose {
    const b = this.base;
    return { worldPosition: [b.px, b.py, b.pz], worldTarget: [b.tx, b.ty, b.tz] };
  }

  private setCamera(pose: CameraPose): void {
    const plot = this.host.plot!;
    const spec = Spec.Camera.fromJSON(plot, { worldPosition: pose.worldPosition, worldTarget: pose.worldTarget, fov: 45 });
    const cam = this.host.camera;
    cam.position = spec.position;
    cam.forward = spec.forward;
    cam.right = spec.right;
    cam.up = spec.up;
    const origin: Core.Vector3 = [0, 0, 0];
    plot.worldToCameraPosition(pose.worldTarget, origin);
    cam.manipulationOrigin = origin;
  }

  /** Ray/sphere pick in camera space. Returns the part index or -1. */
  pick(px: number, py: number): number {
    const cam = this.host.camera;
    const w = this.host.canvas.clientWidth || cam.width;
    const h = this.host.canvas.clientHeight || cam.height;
    const tanHalf = Math.tan(cam.fov / 2);
    const aspect = w / h;
    const sx = (px / w - 0.5) * 2 * tanHalf * aspect;
    const sy = (0.5 - py / h) * 2 * tanHalf;
    const f = cam.forward, r = cam.right, u = cam.up;
    const dir: Core.Vector3 = [-f[0] + r[0] * sx + u[0] * sy, -f[1] + r[1] * sx + u[1] * sy, -f[2] + r[2] * sx + u[2] * sy];
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    dir[0] /= len; dir[1] /= len; dir[2] /= len;
    const o = cam.position;
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < this.parts.length; i++) {
      if (this.hidden[i]) continue;
      const c = this.cameraSpace(i);
      const s = partSize(this.parts[i]);
      const radius = (Math.max(s[0], s[1], s[2]) * this.scaling) / 2;
      const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
      const b = ox * dir[0] + oy * dir[1] + oz * dir[2];
      const cc = ox * ox + oy * oy + oz * oz - radius * radius;
      const disc = b * b - cc;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestT) { bestT = t; best = i; }
    }
    return best;
  }

  dispose(): void {
    this.rig.dispose();
    gsap.killTweensOf(this.explodeState);
    gsap.killTweensOf(this.base);
    if (this.settleTimer) clearTimeout(this.settleTimer);
  }

  private cameraSpace(i: number): Core.Vector3 {
    return [
      this.baseTranslation[i * 3] + (this.current[i * 3] - this.assembled[i * 3]) * this.scaling,
      this.baseTranslation[i * 3 + 1] + (this.current[i * 3 + 1] - this.assembled[i * 3 + 1]) * this.scaling,
      this.baseTranslation[i * 3 + 2] + (this.current[i * 3 + 2] - this.assembled[i * 3 + 2]) * this.scaling,
    ];
  }

  private writeTranslations(): void {
    if (!this.buffer) return;
    const dv = this.buffer.dataView;
    const v: Core.Vector3 = [0, 0, 0];
    for (let i = 0; i < this.parts.length; i++) {
      if (this.hidden[i]) {
        v[0] = this.baseTranslation[i * 3]; v[1] = -PLOT.height * this.scaling; v[2] = this.baseTranslation[i * 3 + 2];
      } else {
        const c = this.cameraSpace(i);
        v[0] = c[0]; v[1] = c[1]; v[2] = c[2];
      }
      Core.UnitVertex.setTranslation(dv, i, v);
    }
    this.flag();
  }

  private flag(): void {
    this.buffer?.hasChangedCallback?.();
    this.host.renderer.frameCount = 0;
    this.ensureRunning();
  }

  private startMotion(): void {
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
    this.host.renderer.renderMode = 'color';
  }

  private settle(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      if (!this.rig.orbiting()) { this.host.renderer.renderMode = this.stillMode; this.host.renderer.frameCount = 0; this.ensureRunning(); }
    }, SETTLE_MS);
  }

  private ensureRunning(): void {
    if (!this.host.running() && this.host.hasMarks()) this.host.start();
  }
}
