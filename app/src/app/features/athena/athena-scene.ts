/**
 * A control field distributed through a volume, with the camera travelling through it.
 *
 * The two components before this one (`features/hud`, `features/map`) compose on parallel planes, so
 * their blur could be baked into the textures. Here the camera dollies past the panels, which means
 * the out-of-focus set changes continuously — the one case where a real `BokehPass` earns its cost.
 *
 * What makes it read as a volume rather than as layers is the orientation mix: `wall` panels are
 * rotated 90° on Y, so they start edge-on and swing to face-on as the camera passes. No amount of
 * z-stacking produces that.
 */
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { paintPanel, type PanelKind } from './athena-panels';

type Family = 'facing' | 'wall' | 'deck';

interface PanelDef {
  kind: PanelKind;
  family: Family;
  pos: [number, number, number];
  scale: number;
  flip?: boolean;
}

/** Hand-authored so the volume has deliberate sightlines rather than scattered noise. */
const LAYOUT: PanelDef[] = [
  // Dense enough that the camera always has content at several depths at once: a sparse field
  // just reads as two panels and a lot of empty space.
  { kind: 'serial', family: 'facing', pos: [-0.7, 1.3, 3.6], scale: 1.0 },
  { kind: 'gauges', family: 'wall', pos: [-1.5, 0.05, 3.0], scale: 1.3 },
  { kind: 'stack', family: 'wall', pos: [1.6, 0.3, 2.6], scale: 1.15, flip: true },
  { kind: 'channels', family: 'facing', pos: [0.75, 0.55, 2.0], scale: 1.25 },
  { kind: 'plot', family: 'facing', pos: [-0.9, -0.15, 1.4], scale: 1.3 },
  { kind: 'viewport', family: 'deck', pos: [0.15, -1.15, 0.9], scale: 1.4 },
  { kind: 'timer', family: 'facing', pos: [1.35, -0.35, 0.4], scale: 1.05 },
  { kind: 'stack', family: 'wall', pos: [-1.7, 0.7, -0.2], scale: 1.2 },
  { kind: 'serial', family: 'facing', pos: [0.5, 1.45, -0.8], scale: 0.95 },
  { kind: 'channels', family: 'wall', pos: [1.75, 0.15, -1.4], scale: 1.25, flip: true },
  { kind: 'plot', family: 'facing', pos: [-0.55, -0.55, -2.0], scale: 1.2 },
  { kind: 'gauges', family: 'facing', pos: [1.0, 0.45, -2.6], scale: 1.15 },
  { kind: 'viewport', family: 'facing', pos: [-1.25, 0.25, -3.2], scale: 1.3 },
  { kind: 'timer', family: 'wall', pos: [1.65, -0.5, -3.8], scale: 1.05, flip: true },
  { kind: 'stack', family: 'facing', pos: [-0.35, 0.9, -4.4], scale: 1.1 },
  { kind: 'channels', family: 'deck', pos: [0.8, -1.25, -5.0], scale: 1.3 },
  { kind: 'serial', family: 'facing', pos: [-1.4, -0.3, -5.6], scale: 0.95 },
  { kind: 'plot', family: 'wall', pos: [1.5, 0.6, -6.2], scale: 1.15 },
  { kind: 'gauges', family: 'wall', pos: [-1.6, 0.4, -6.8], scale: 1.2 },
  { kind: 'viewport', family: 'facing', pos: [0.35, 0.1, -7.4], scale: 1.25 },
];

const LOOP = 13;
const PHASE = { rails: 2, panels: 6, traces: 10 };

const quadOut = (t: number): number => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

interface Panel {
  def: PanelDef;
  mesh: T.Mesh;
  mat: T.MeshBasicMaterial;
  tex: T.CanvasTexture;
  canvas: HTMLCanvasElement;
  order: number;
}

export class AthenaScene {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(55, 16 / 9, 0.1, 60);
  private readonly composer: EffectComposer;
  private readonly bokeh: BokehPass;
  private readonly panels: Panel[] = [];
  private readonly rails: Array<{ line: T.Line; count: number }> = [];
  private readonly traces: Array<{ line: T.Line; count: number; dots: T.Points }> = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly path: T.CatmullRomCurve3;
  private raf = 0;
  private clock = 0;
  private disposed = false;
  private lastPaint = -1;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1); // Bokeh at full DPR is the expensive part and reads fine at 1.
    this.scene.fog = new T.FogExp2(0x0b1318, 0.032);

    // The path has to END INSIDE the field. Running it to the far edge meant the last quarter of
    // every loop looked out past the last panel into empty space, which read as the scene breaking.
    this.path = new T.CatmullRomCurve3([
      new T.Vector3(0.4, 0.45, 4.6),
      new T.Vector3(-0.45, 0.3, 2.8),
      new T.Vector3(0.5, 0.55, 1.0),
      new T.Vector3(-0.3, 0.25, -0.8),
      new T.Vector3(0.15, 0.4, -2.4),
    ]);

    for (const [i, def] of LAYOUT.entries()) {
      const art = paintPanel(def.kind, 0);
      const tex = new T.CanvasTexture(art.canvas);
      tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const h = def.scale;
      const w = h * art.aspect;
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
      mesh.position.set(...def.pos);
      if (def.family === 'wall') mesh.rotation.y = (def.flip ? -1 : 1) * Math.PI * 0.42;
      if (def.family === 'deck') mesh.rotation.x = -Math.PI * 0.38;
      this.scene.add(mesh);
      this.panels.push({ def, mesh, mat, tex, canvas: art.canvas, order: i });
      this.disposables.push(tex, mesh.geometry, mat);
    }

    // Spine rails: long runs the panels hang off, so the field has structure to read against.
    for (const [ax, ay] of [[-2.0, 1.4], [2.1, 1.1], [0, -1.6]] as Array<[number, number]>) {
      const pts = [new T.Vector3(ax, ay, 7), new T.Vector3(ax, ay, -8)];
      const geo = new T.BufferGeometry().setFromPoints(pts);
      const mat = new T.LineBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false });
      const line = new T.Line(geo, mat);
      this.scene.add(line);
      this.rails.push({ line, count: 2 });
      this.disposables.push(geo, mat);
    }

    // Traces: right-angle routes from a rail to each panel anchor, revealed by draw range so they
    // route through space instead of appearing all at once.
    for (const p of this.panels) {
      const [px, py, pz] = p.def.pos;
      const railX = px < 0 ? -2.0 : 2.1;
      const railY = px < 0 ? 1.4 : 1.1;
      const pts = [
        new T.Vector3(railX, railY, pz),
        new T.Vector3(railX, py, pz),
        new T.Vector3(px + (px < 0 ? -0.1 : 0.1), py, pz),
      ];
      const geo = new T.BufferGeometry().setFromPoints(pts);
      const mat = new T.LineBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false });
      const line = new T.Line(geo, mat);
      geo.setDrawRange(0, 0);
      this.scene.add(line);

      const dotGeo = new T.BufferGeometry().setFromPoints(pts.slice(0, 2));
      const dotMat = new T.PointsMaterial({ color: 0x44e0cc, size: 0.05, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const dots = new T.Points(dotGeo, dotMat);
      this.scene.add(dots);

      this.traces.push({ line, count: pts.length, dots });
      this.disposables.push(geo, mat, dotGeo, dotMat);
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 4, aperture: 0.0013, maxblur: 0.010 });
    this.composer.addPass(this.bokeh);
  }

  track(nx: number, ny: number): void {
    this.target.x = nx;
    this.target.y = ny;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.reduced) {
      this.clock = LOOP; // Land on the fully built state and hold it.
      this.step(0);
      this.composer.render();
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.clock = (this.clock + dt) % LOOP;
      this.step(dt);
      this.composer.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private step(dt: number): void {
    const t = this.clock;

    // Panel textures are expensive; repaint on a coarse cadence, not every frame.
    if (Math.floor(t * 6) !== this.lastPaint) {
      this.lastPaint = Math.floor(t * 6);
      for (const p of this.panels) {
        paintPanel(p.def.kind, t, p.canvas);
        p.tex.needsUpdate = true;
      }
    }

    // Phase 1: rails draw on.
    const railT = clamp01(t / PHASE.rails);
    for (const r of this.rails) (r.line.material as T.LineBasicMaterial).opacity = 0.3 * quadOut(railT);

    // Phase 2: panels arrive near to far, staggered.
    for (const p of this.panels) {
      const slot = p.order / this.panels.length;
      const local = clamp01((t - PHASE.rails - slot * (PHASE.panels - PHASE.rails) * 0.85) / 0.9);
      const e = quadOut(local);
      p.mat.opacity = e;
      p.mesh.scale.y = 0.04 + 0.96 * e;
      p.mesh.scale.x = 0.9 + 0.1 * e;
    }

    // Phase 3: traces route, then their junction dots pop.
    for (const [i, tr] of this.traces.entries()) {
      const slot = i / this.traces.length;
      const local = clamp01((t - PHASE.panels - slot * (PHASE.traces - PHASE.panels) * 0.8) / 0.7);
      tr.line.geometry.setDrawRange(0, Math.max(0, Math.ceil(local * tr.count)));
      (tr.dots.material as T.PointsMaterial).opacity = local > 0.9 ? 0.9 : 0;
    }

    // Camera: travel the path, look slightly ahead, with pointer parallax layered on top.
    this.pointer.x += (this.target.x - this.pointer.x) * Math.min(1, dt * 3);
    this.pointer.y += (this.target.y - this.pointer.y) * Math.min(1, dt * 3);
    const u = this.reduced ? 0.72 : clamp01(t / LOOP);
    const pos = this.path.getPointAt(u);
    const ahead = this.path.getPointAt(Math.min(1, u + 0.08));
    this.camera.position.set(pos.x + this.pointer.x * 0.5, pos.y - this.pointer.y * 0.3, pos.z);
    this.camera.lookAt(ahead.x, ahead.y, ahead.z - 1.4);

    // Focus tracks whatever the camera is pointed at, so the blur set changes as it moves.
    (this.bokeh.uniforms as Record<string, { value: number }>)['focus'].value = 2.6 + Math.sin(t * 0.4) * 0.5;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposables) d.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
