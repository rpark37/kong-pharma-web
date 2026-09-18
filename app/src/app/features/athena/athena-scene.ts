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

/** Arc centre sits just ahead of the deck, so the bank wraps around the operator. */
const ARC_Z = 1.2;

/**
 * Placed by size class, not on an even grid. A console reads as one dominant display flanked by
 * gauge columns, banded by serial strips and filled out with small modules — a wall of
 * identically-proportioned panels reads as a spreadsheet instead.
 *
 * `theta` is the angle around the arc, `y` the tier height, `r` the tier radius. Aspect comes from
 * the painter, so `scale` only sets height.
 */
interface Placement { kind: PanelKind; theta: number; y: number; r: number; scale: number }

const PLACEMENTS: Placement[] = [
  // Centre stack: the dominant display with a docket strip over it.
  { kind: 'primary', theta: 0, y: 0.62, r: 3.75, scale: 1.55 },
  { kind: 'strip', theta: 0, y: 1.78, r: 3.7, scale: 0.42 },
  { kind: 'profile', theta: 0, y: 2.62, r: 3.6, scale: 0.9 },

  // Inner flanks: the medium instrument set.
  { kind: 'trace', theta: -0.46, y: 1.5, r: 3.8, scale: 0.95 },
  { kind: 'scope', theta: 0.46, y: 1.5, r: 3.8, scale: 0.95 },
  { kind: 'contour', theta: -0.44, y: 0.34, r: 3.95, scale: 0.92 },
  { kind: 'axis', theta: 0.44, y: 0.34, r: 3.95, scale: 0.92 },

  // Module cluster, left and right — small, repeated, read as a bank.
  { kind: 'module', theta: -0.78, y: 1.62, r: 3.95, scale: 0.6 },
  { kind: 'module', theta: -0.78, y: 0.92, r: 3.95, scale: 0.6 },
  { kind: 'module', theta: -1.02, y: 1.62, r: 4.05, scale: 0.6 },
  { kind: 'module', theta: -1.02, y: 0.92, r: 4.05, scale: 0.6 },
  { kind: 'module', theta: 0.78, y: 1.62, r: 3.95, scale: 0.6 },
  { kind: 'module', theta: 0.78, y: 0.92, r: 3.95, scale: 0.6 },
  { kind: 'module', theta: 1.02, y: 1.62, r: 4.05, scale: 0.6 },
  { kind: 'module', theta: 1.02, y: 0.92, r: 4.05, scale: 0.6 },

  // Gauge columns on the outer flanks — tall and narrow, they cap the wall.
  { kind: 'column', theta: -1.3, y: 0.5, r: 4.15, scale: 1.65 },
  { kind: 'column', theta: 1.3, y: 0.5, r: 4.15, scale: 1.65 },

  // Lower band: strips and the wider instruments, nearest the deck.
  { kind: 'strip', theta: -0.62, y: -0.52, r: 4.0, scale: 0.4 },
  { kind: 'strip', theta: 0.62, y: -0.52, r: 4.0, scale: 0.4 },
  { kind: 'trace', theta: -1.06, y: -0.42, r: 4.15, scale: 0.8 },
  { kind: 'scope', theta: 1.06, y: -0.42, r: 4.15, scale: 0.8 },
  { kind: 'contour', theta: 0, y: -0.62, r: 3.9, scale: 0.8 },

  // Upper outriggers.
  { kind: 'strip', theta: -0.95, y: 2.5, r: 3.8, scale: 0.36 },
  { kind: 'strip', theta: 0.95, y: 2.5, r: 3.8, scale: 0.36 },
  { kind: 'axis', theta: -0.52, y: 2.55, r: 3.7, scale: 0.72 },
  { kind: 'scope', theta: 0.52, y: 2.55, r: 3.7, scale: 0.72 },
];

const WINDOWS: WindowDef[] = PLACEMENTS.map((p) => ({
  kind: p.kind,
  pos: [p.r * Math.sin(p.theta), p.y, ARC_Z - p.r * Math.cos(p.theta)] as [number, number, number],
  scale: p.scale,
  yaw: -p.theta,
}));

const ROOT = new T.Vector3(0, -1.92, 2.75);

const LOOP = 13;
const LOOK_AT = new T.Vector3(0, 0.55, -1.5);
const CAM_RADIUS = 7.8;
const GROW_START = 0.6;
const GROW_PER_DEPTH = 0.34;
const GROW_DURATION = 0.9;
const TRACE_DUR = 1.1;

const PULSE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Draws the quad's border. A head runs the perimeter once and the outline lights up *behind* it,
 * so the border reads as being traced rather than as a dot moving along an already-lit frame. Once
 * the circuit completes the outline holds and the head fades out.
 */
const PULSE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTrace;
uniform float uHead;
uniform float uLit;
uniform float uAspect;
uniform vec3 uColor;

void main() {
  vec2 d = min(vUv, 1.0 - vUv);
  float edge = min(d.x, d.y);
  float border = 0.05;
  float band = 1.0 - smoothstep(border * 0.4, border, edge);
  if (band <= 0.002 || uLit <= 0.002) discard;

  float w = uAspect;
  float h = 1.0;
  float perim = 2.0 * (w + h);
  float p;
  if (d.y < d.x) {
    p = vUv.y < 0.5 ? vUv.x * w : w + h + (1.0 - vUv.x) * w;
  } else {
    p = vUv.x > 0.5 ? w + vUv.y * h : 2.0 * w + h + (1.0 - vUv.y) * h;
  }
  p /= perim;

  // Lit behind the head; the head itself is a tight falloff that fades once the circuit closes.
  float drawn = smoothstep(uTrace + 0.006, uTrace - 0.006, p);
  float head = exp(-abs(p - uTrace) * 110.0) * uHead;

  float a = band * (drawn * 0.42 + head * 1.5) * uLit;
  gl_FragColor = vec4(uColor * (0.5 + head * 0.9), a);
}`;

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
  glow: T.ShaderMaterial;
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

  private readonly nodeTex = nodeGlowTexture();

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1); // Bokeh at full DPR is the expensive part and reads fine at 1.
    this.scene.fog = new T.FogExp2(0x0b1318, 0.02);
    this.disposables.push(this.nodeTex);



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
      const glowMat = new T.ShaderMaterial({
        vertexShader: PULSE_VERT,
        fragmentShader: PULSE_FRAG,
        uniforms: { uTrace: { value: 0 }, uHead: { value: 0 }, uLit: { value: 0 }, uAspect: { value: art.aspect }, uColor: { value: new T.Color(0x8ff5e6) } },
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      });
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
    this.kbGroup.position.set(0, -1.78, 2.7);
    this.kbGroup.rotation.x = -Math.PI * 0.34;
    const kbH = 0.9;
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
      // An occasional dip and recover, staggered so only a couple of panels flicker at once.
      const flick = Math.sin(t * 7.3 + i * 8.7) > 0.972 ? 0.55 : 1;
      w.mat.opacity = e * (0.82 + 0.18 * lit) * flick;
      // Trace runs once from the moment the branch lands, then the head fades and the outline holds.
      const traced = clamp01(Math.max(0, since) / TRACE_DUR);
      w.glow.uniforms['uTrace'].value = traced;
      w.glow.uniforms['uHead'].value = 1 - clamp01((Math.max(0, since) - TRACE_DUR) / 0.4);
      w.glow.uniforms['uLit'].value = arrival[i] >= 1 ? 1 : 0;

      // Independent drift on three frequencies, seeded per window so no two share a beat. Small on
      // purpose: branches terminate at fixed points, so visible wander would detach a panel from
      // the conduit holding it up.
      const sd = i * 1.7;
      const [bx, by, bz] = w.def.pos;
      w.mesh.position.set(
        bx + Math.sin(t * 0.63 + sd) * 0.022 + Math.sin(t * 1.47 + sd * 2.1) * 0.009,
        by + Math.sin(t * 0.51 + sd * 1.3) * 0.02 + Math.cos(t * 1.9 + sd) * 0.007,
        bz + Math.cos(t * 0.44 + sd * 0.7) * 0.016,
      );
      w.mesh.rotation.y = (w.def.yaw ?? 0) + Math.sin(t * 0.72 + sd * 1.9) * 0.012;
      w.mesh.rotation.z = Math.sin(t * 0.58 + sd * 2.6) * 0.008;

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
      LOOK_AT.y + 1.25 - this.pointer.y * 0.25,
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
