/**
 * The operator's console: an input deck with readout windows growing out of it on a branching tree.
 *
 * The tree is the organising idea. Branches root at the keyboard — the thing actually driving the
 * session — and fork outward, and each window fades in *as its branch arrives* rather than on an
 * independent timer. That makes the build read as causal: the structure reaches a place, and a
 * window opens there.
 *
 * Windows are framed instrument displays sharing one chrome (see `athena-panels.ts`). `BokehPass`
 * stays because the camera still moves, so the out-of-focus set changes and the blur cannot be
 * baked into the textures the way `features/hud` does it.
 */
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { paintPanel, type PanelKind } from './athena-panels';
import { KB_H, KB_W, litKeysAt, paintKeyboardBase, paintKeyboardLit } from './athena-keyboard';
import { SEGMENT_SAMPLES, buildTree, growthAt, type Segment } from './athena-tree';

interface WindowDef {
  kind: PanelKind;
  pos: [number, number, number];
  scale: number;
  yaw?: number;
}

/** Arc centre sits just ahead of the deck, so the tiers wrap around the operator. */
const ARC_Z = 1.2;
const KINDS: PanelKind[] = ['trace', 'scope', 'contour', 'profile', 'axis'];

/**
 * Tiers of a wedding cake: each level steps up and pulls its radius in, so the bank closes over
 * the operator rather than standing as one flat wall.
 */
const TIERS = [
  { y: -0.5, radius: 4.3, count: 7, spread: 1.26, scale: 0.92 },
  { y: 0.72, radius: 4.0, count: 6, spread: 1.04, scale: 0.9 },
  { y: 1.88, radius: 3.7, count: 5, spread: 0.82, scale: 0.86 },
  { y: 2.92, radius: 3.4, count: 2, spread: 0.3, scale: 0.8 },
];

function buildWindows(): WindowDef[] {
  const out: WindowDef[] = [];
  let k = 0;
  for (const tier of TIERS) {
    for (let i = 0; i < tier.count; i++) {
      // Single-panel tiers would divide by zero; centre them instead.
      const f = tier.count === 1 ? 0 : (i / (tier.count - 1)) * 2 - 1;
      const theta = f * tier.spread;
      out.push({
        kind: KINDS[k++ % KINDS.length],
        pos: [tier.radius * Math.sin(theta), tier.y, ARC_Z - tier.radius * Math.cos(theta)],
        scale: tier.scale,
        yaw: -theta,
      });
    }
  }
  return out;
}

const WINDOWS: WindowDef[] = buildWindows();

const ROOT = new T.Vector3(0, -1.5, 2.3);

const LOOP = 13;
const LOOK_AT = new T.Vector3(0, 0.85, -1.4);
const CAM_RADIUS = 8.6;
const GROW_START = 0.6;
const GROW_PER_DEPTH = 0.34;
const GROW_DURATION = 0.9;

/** A wash that is brightest along the bottom edge, where a branch lands, fading out upward. */
function bottomGlowTexture(): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(120, 245, 225, 0.85)');
  g.addColorStop(0.18, 'rgba(68, 224, 204, 0.38)');
  g.addColorStop(0.55, 'rgba(68, 224, 204, 0.10)');
  g.addColorStop(1, 'rgba(68, 224, 204, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Radial falloff for the node itself. */
function nodeGlowTexture(): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(180, 255, 245, 1)');
  g.addColorStop(0.25, 'rgba(120, 245, 225, 0.55)');
  g.addColorStop(1, 'rgba(68, 224, 204, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

const quadOut = (t: number): number => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

interface Win {
  def: WindowDef;
  mesh: T.Mesh;
  mat: T.MeshBasicMaterial;
  tex: T.CanvasTexture;
  canvas: HTMLCanvasElement;
  glow: T.MeshBasicMaterial;
  node: T.Sprite;
}

interface Branch {
  seg: Segment;
  line: T.Line;
  mat: T.LineBasicMaterial;
  dot: T.Points | null;
  dotMat: T.PointsMaterial | null;
}

export class AthenaScene {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(55, 16 / 9, 0.1, 60);
  private readonly composer: EffectComposer;
  private readonly bokeh: BokehPass;
  private readonly windows: Win[] = [];
  private readonly branches: Branch[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private raf = 0;
  private clock = 0;
  private disposed = false;
  private lastPaint = -1;
  private lastBeat = -1;
  private kbLitCanvas!: HTMLCanvasElement;
  private kbLitTex!: T.CanvasTexture;
  private kbGroup!: T.Group;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  private readonly glowTex = bottomGlowTexture();
  private readonly nodeTex = nodeGlowTexture();

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1); // Bokeh at full DPR is the expensive part and reads fine at 1.
    this.scene.fog = new T.FogExp2(0x0b1318, 0.02);
    this.disposables.push(this.glowTex, this.nodeTex);



    for (const def of WINDOWS) {
      const art = paintPanel(def.kind, 0);
      const tex = new T.CanvasTexture(art.canvas);
      tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const h = def.scale;
      const mesh = new T.Mesh(new T.PlaneGeometry(h * art.aspect, h), mat);
      mesh.position.set(...def.pos);
      if (def.yaw) mesh.rotation.y = def.yaw;
      this.scene.add(mesh);

      // The wash sits just in front of the window on the same transform, so the panel reads as
      // lit from the edge its branch arrives at rather than merely faded up.
      const glowMat = new T.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const glowMesh = new T.Mesh(new T.PlaneGeometry(h * art.aspect, h), glowMat);
      glowMesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      if (def.yaw) glowMesh.rotation.y = def.yaw;
      glowMesh.translateZ(0.006);
      this.scene.add(glowMesh);

      const node = new T.Sprite(new T.SpriteMaterial({ map: this.nodeTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      node.position.set(def.pos[0], def.pos[1] - h / 2, def.pos[2]);
      node.scale.setScalar(0.62);
      this.scene.add(node);

      this.windows.push({ def, mesh, mat, tex, canvas: art.canvas, glow: glowMat, node });
      this.disposables.push(tex, mesh.geometry, mat, glowMesh.geometry, glowMat, node.material);
    }

    // The operator's input deck, raked toward the viewer at the front of the console.
    this.kbGroup = new T.Group();
    this.kbGroup.position.set(0, -1.32, 2.5);
    this.kbGroup.rotation.x = -Math.PI * 0.34;
    const kbH = 1.45;
    for (const [i, kbCanvas] of [paintKeyboardBase(), paintKeyboardLit(new Set())].entries()) {
      const tex = new T.CanvasTexture(kbCanvas);
      tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 });
      const mesh = new T.Mesh(new T.PlaneGeometry(kbH * (KB_W / KB_H), kbH), mat);
      mesh.position.z = i * 0.004; // lit layer sits just proud of the base to avoid z-fighting
      this.kbGroup.add(mesh);
      this.disposables.push(tex, mesh.geometry, mat);
      if (i === 1) { this.kbLitCanvas = kbCanvas; this.kbLitTex = tex; }
    }
    this.scene.add(this.kbGroup);

    // The tree: root at the deck, forking out to every window.
    // Attach to the bottom edge so branches arrive underneath a window and hold it up.
    const segments = buildTree(ROOT, WINDOWS.map((w) => new T.Vector3(w.pos[0], w.pos[1] - w.scale / 2, w.pos[2])));
    for (const seg of segments) {
      const geo = new T.BufferGeometry().setFromPoints(seg.points);
      geo.setDrawRange(0, 0);
      const mat = new T.LineBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
      const line = new T.Line(geo, mat);
      this.scene.add(line);
      this.disposables.push(geo, mat);

      let dot: T.Points | null = null;
      let dotMat: T.PointsMaterial | null = null;
      if (seg.fork) {
        const dGeo = new T.BufferGeometry().setFromPoints([seg.fork]);
        dotMat = new T.PointsMaterial({ color: 0x8ff5e6, size: 0.075, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
        dot = new T.Points(dGeo, dotMat);
        this.scene.add(dot);
        this.disposables.push(dGeo, dotMat);
      }
      this.branches.push({ seg, line, mat, dot, dotMat });
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 8.2, aperture: 0.0006, maxblur: 0.006 });
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

    // Window textures are expensive; repaint on a coarse cadence, not every frame.
    if (Math.floor(t * 6) !== this.lastPaint) {
      this.lastPaint = Math.floor(t * 6);
      for (const w of this.windows) {
        paintPanel(w.def.kind, t, w.canvas);
        w.tex.needsUpdate = true;
      }
    }

    // Grow the tree, and let each terminal branch open the window it reaches.
    const arrival = new Array<number>(this.windows.length).fill(0);
    const depthOf = new Array<number>(this.windows.length).fill(0);
    for (const b of this.branches) {
      const g = this.reduced ? 1 : growthAt(b.seg, t, GROW_START, GROW_PER_DEPTH, GROW_DURATION);
      b.line.geometry.setDrawRange(0, Math.max(0, Math.ceil(quadOut(g) * SEGMENT_SAMPLES)));
      b.mat.opacity = 0.2 + 0.4 * g;
      if (b.dotMat) b.dotMat.opacity = g > 0.95 ? 0.95 : 0;
      if (b.seg.target !== null) { arrival[b.seg.target] = g; depthOf[b.seg.target] = b.seg.depth; }
    }

    for (const [i, w] of this.windows.entries()) {
      const e = quadOut(clamp01((arrival[i] - 0.55) / 0.45));
      // Flash as the branch lands, then settle: a constant glow reads as decoration, a decaying
      // one reads as the node having just delivered power to the panel.
      const since = this.reduced ? 2 : t - (GROW_START + (depthOf[i] ?? 0) * GROW_PER_DEPTH + GROW_DURATION);
      const lit = arrival[i] >= 1 ? 0.34 + 0.66 * Math.exp(-Math.max(0, since) * 2.1) : 0;
      w.mat.opacity = e * (0.82 + 0.18 * lit);
      w.glow.opacity = lit * 0.9;
      (w.node.material as T.SpriteMaterial).opacity = lit;
      w.node.scale.setScalar(0.42 + 0.34 * lit);
      w.mesh.scale.y = 0.06 + 0.94 * e;
      w.mesh.scale.x = 0.88 + 0.12 * e;
    }

    // The deck is the root, so it arrives before anything grows out of it.
    const kbIn = quadOut(clamp01(t / 0.9));
    for (const child of this.kbGroup.children) ((child as T.Mesh).material as T.MeshBasicMaterial).opacity = kbIn;
    const beat = Math.floor(t * 6);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      paintKeyboardLit(litKeysAt(t), this.kbLitCanvas);
      this.kbLitTex.needsUpdate = true;
    }

    this.pointer.x += (this.target.x - this.pointer.x) * Math.min(1, dt * 3);
    this.pointer.y += (this.target.y - this.pointer.y) * Math.min(1, dt * 3);
    // Over the operator's shoulder, swinging left to right along an arc centred on the bank. A
    // sine keeps the sweep continuous across the loop instead of snapping back at the wrap.
    const phase = this.reduced ? 0.4 : Math.sin((t / LOOP) * Math.PI * 2);
    const phi = phase * 0.26 + this.pointer.x * 0.1;
    this.camera.position.set(
      LOOK_AT.x + CAM_RADIUS * Math.sin(phi),
      LOOK_AT.y + 0.62 - this.pointer.y * 0.2,
      LOOK_AT.z + CAM_RADIUS * Math.cos(phi),
    );
    this.camera.lookAt(LOOK_AT.x + phase * 0.25, LOOK_AT.y, LOOK_AT.z);

    (this.bokeh.uniforms as Record<string, { value: number }>)['focus'].value = 8.2 + Math.sin(t * 0.3) * 0.5;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposables) d.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
