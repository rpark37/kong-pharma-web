/**
 * The anatomical view: the real BodyParts3D meshes in three.js. A class port of
 * ashemag/human-atlas app/scene.tsx (MIT). Geometry is merged per system into one draw call;
 * per-structure translation, visibility and selection live in two 1-D textures sampled by a
 * patched MeshStandardMaterial. Explode amount and camera moves are driven from outside by GSAP.
 */
import { gsap } from 'gsap';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QUAD } from '../../shared/animation/motion';
import { SYSTEMS, type ChunkInfo, type Part, type SystemId, type View } from './anatomy';
import { createExplosionLayout } from './explosion-layout';

export interface ViewerState { visible: SystemId[]; selected: string[]; isolate: boolean; view: View; rotate: boolean; reset: number; inspectorOpen: boolean; }
export interface ViewerCallbacks { onSelect: (id: string) => void; onProgress: (pct: number) => void; onError: (message: string) => void; }

/** Static hosts may serve .gz as a compressed response or as a gzip file; inspect the payload. */
export async function decodeModelResponse(response: Response, expectedBytes: number, compressed: boolean): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error('An anatomy file could not be loaded.');
  const payload = await response.arrayBuffer();
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b;
  const buffer = gzip ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : payload;
  if (buffer.byteLength !== expectedBytes) throw new Error('An anatomy file was incomplete. Please reload the viewer.');
  return buffer;
}

/** Distinguish a tap from an orbit, pinch, pan, or cancelled touch sequence. */
class PointerTap {
  private active = new Map<number, { x: number; y: number; threshold: number }>();
  private blocked = false;
  down(id: number, x: number, y: number, threshold: number): void { if (this.active.size === 0) this.blocked = false; this.active.set(id, { x, y, threshold }); if (this.active.size > 1) this.blocked = true; }
  move(id: number, x: number, y: number): void { const s = this.active.get(id); if (s && Math.hypot(x - s.x, y - s.y) > s.threshold) this.blocked = true; }
  up(id: number, x: number, y: number): boolean { this.move(id, x, y); const tap = this.active.has(id) && this.active.size === 1 && !this.blocked; this.active.delete(id); return tap; }
  cancel(id: number): void { this.active.delete(id); this.blocked = true; }
}

interface Target { index: number; x: number; y: number; left: number; right: number; top: number; bottom: number; }

export class AnatomyViewer {
  private renderer!: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
  private controls!: OrbitControls;
  private disposed = false;
  private frame = 0;
  private dirty = true;
  private ready = false;
  private amount = 0;
  private state: ViewerState = { visible: [], selected: [], isolate: false, view: 'three-quarter', rotate: false, reset: 0, inspectorOpen: false };
  private lastState: ViewerState | null = null;
  private lastView = '';
  private lastReset = -1;
  private lastIsolate = '';
  private layoutKey = '';
  private lastExtent = -1;
  private packingWidth = 1;
  private packingHeight = 1;
  private readonly abort = new AbortController();
  private readonly geometries: T.BufferGeometry[] = [];
  private readonly materials: T.Material[] = [];
  private readonly pickers: (T.Mesh | undefined)[] = [];
  private readonly centers: T.Vector3[];
  private readonly bounds: T.Box3[];
  private readonly offsets: T.Vector3[] = [];
  private readonly width: number;
  private readonly data: Float32Array;
  private readonly partTexture: T.DataTexture;
  private readonly selectedData: Uint8Array;
  private readonly selectionTexture: T.DataTexture;
  private readonly markerPositions: Float32Array;
  private readonly markerGeometry = new T.BufferGeometry();
  private readonly markers: T.Points;
  private readonly hover: HTMLDivElement;
  private targets: Target[] = [];
  private readonly projected = new T.Vector3();
  private readonly raycaster = new T.Raycaster();
  private readonly pointer = new T.Vector2();
  private readonly tap = new PointerTap();
  private readonly worldBox = new T.Box3();
  private readonly hitPoint = new T.Vector3();
  private readonly clock = new T.Clock();
  private observer: ResizeObserver | null = null;
  private cameraTween: gsap.core.Tween | null = null;
  private ground!: T.Mesh; private platform!: T.Mesh; private ring!: T.Mesh; private innerRing!: T.Mesh;
  private env: T.WebGLRenderTarget | null = null;
  reducedMotion = false;

  constructor(private readonly el: HTMLElement, private readonly parts: Part[], private readonly chunks: ChunkInfo[], private readonly bases: string[], private readonly cb: ViewerCallbacks) {
    this.centers = parts.map((p) => new T.Vector3(p.cx, p.cy, p.cz));
    this.bounds = parts.map((p) => new T.Box3(new T.Vector3(p.cx - p.sx / 2, p.cy - p.sy / 2, p.cz - p.sz / 2), new T.Vector3(p.cx + p.sx / 2, p.cy + p.sy / 2, p.cz + p.sz / 2)));
    this.width = T.MathUtils.ceilPowerOfTwo(parts.length);
    this.data = new Float32Array(this.width * 4);
    this.partTexture = new T.DataTexture(this.data, this.width, 1, T.RGBAFormat, T.FloatType);
    this.partTexture.needsUpdate = true;
    this.selectedData = new Uint8Array(this.width * 4);
    this.selectionTexture = new T.DataTexture(this.selectedData, this.width, 1);
    this.selectionTexture.needsUpdate = true;
    this.markerPositions = new Float32Array(parts.length * 3);
    this.markerGeometry.setAttribute('position', new T.BufferAttribute(this.markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({ color: 0x8fa3b0, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.72, depthTest: false });
    markerMaterial.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;'); };
    this.materials.push(markerMaterial);
    this.markers = new T.Points(this.markerGeometry, markerMaterial);
    this.markers.frustumCulled = false; this.markers.renderOrder = 10; this.markers.visible = false;
    this.hover = document.createElement('div');
    this.hover.className = 'part-hover';
    this.hover.setAttribute('role', 'tooltip');
    this.hover.hidden = true;
  }

  start(): void {
    const el = this.el;
    try {
      this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      this.cb.onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    r.setClearColor('#121c24');
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    el.appendChild(r.domElement);
    el.appendChild(this.hover);
    r.domElement.setAttribute('aria-label', 'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.');
    r.domElement.style.display = 'block';
    const scene = this.scene, camera = this.camera;
    this.controls = new OrbitControls(camera, r.domElement);
    const controls = this.controls;
    camera.position.set(1.4, 1.05, 3.6); controls.target.set(0, 0.85, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.085; controls.minDistance = 0.07; controls.maxDistance = 40; controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener('change', () => { this.dirty = true; });
    const pmrem = new T.PMREMGenerator(r), room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04); scene.environment = this.env.texture; room.dispose(); pmrem.dispose();
    scene.add(new T.HemisphereLight(0xdfe8ee, 0x1a252d, 0.9));
    const key = new T.DirectionalLight(0xfff6ea, 2.2); key.position.set(-2, 4, 3); scene.add(key);
    const rim = new T.DirectionalLight(0x9fe8dc, 1.6); rim.position.set(2, 2, -3); scene.add(rim);
    this.ground = new T.Mesh(new T.CircleGeometry(30, 96), new T.MeshStandardMaterial({ color: 0x151f27, roughness: 1 })); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.019; scene.add(this.ground);
    this.platform = new T.Mesh(new T.CylinderGeometry(0.68, 0.7, 0.028, 100), new T.MeshStandardMaterial({ color: 0x1b2a34, metalness: 0.15, roughness: 0.6 })); this.platform.position.y = -0.016; scene.add(this.platform);
    this.ring = new T.Mesh(new T.RingGeometry(0.63, 0.632, 128), new T.MeshBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.5, side: T.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.001; scene.add(this.ring);
    this.innerRing = new T.Mesh(new T.RingGeometry(0.55, 0.551, 128), new T.MeshBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.18, side: T.DoubleSide })); this.innerRing.rotation.x = -Math.PI / 2; this.innerRing.position.y = 0.001; scene.add(this.innerRing);
    scene.add(this.markers);

    const mats = new Map<SystemId, T.Material>(SYSTEMS.map((s) => [s.id, this.materialFor(s.id)]));
    void this.loadAll(mats);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(el);
    this.resize();

    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointermove', this.onMove);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('pointercancel', this.onCancel);
    r.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.animate();
  }

  setState(state: ViewerState): void { this.state = state; }

  /** Explode amount 0..1, driven each frame by the page's GSAP tween. */
  setExplode(t: number): void { if (Math.abs(t - this.amount) > 1e-5) { this.amount = t; this.dirty = true; } }

  resize(): void {
    const el = this.el;
    if (!this.renderer || el.clientWidth === 0 || el.clientHeight === 0) return;
    this.layoutKey = ''; this.lastState = null;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2));
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.fit(this.state.view, this.amount, false);
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    cancelAnimationFrame(this.frame);
    this.cameraTween?.kill();
    this.observer?.disconnect();
    this.controls?.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.scene.traverse((o) => { if (o instanceof T.Mesh && !this.geometries.includes(o.geometry)) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
    this.env?.dispose();
    this.partTexture.dispose(); this.selectionTexture.dispose(); this.markerGeometry.dispose();
    this.hover.remove();
    if (this.renderer) { this.renderer.domElement.remove(); this.renderer.dispose(); }
  }

  private materialFor(system: SystemId): T.Material {
    const m = new T.MeshStandardMaterial({ color: SYSTEMS.find((s) => s.id === system)?.color ?? '#aebbb8', metalness: 0.08, roughness: 0.53, side: T.DoubleSide, transparent: system === 'integumentary', opacity: system === 'integumentary' ? 0.1 : 1, depthWrite: system !== 'integumentary' });
    m.onBeforeCompile = (shader) => {
      shader.uniforms['partState'] = { value: this.partTexture }; shader.uniforms['selectionState'] = { value: this.selectionTexture }; shader.uniforms['stateWidth'] = { value: this.width };
      shader.vertexShader = 'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;');
      shader.fragmentShader = 'varying float partVisible; varying float partSelected;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.88, 0.80), partSelected * 0.75);');
    };
    this.materials.push(m);
    return m;
  }

  private async fetchChunk(chunk: ChunkInfo): Promise<ArrayBuffer> {
    const compressed = !!chunk.gzip && typeof DecompressionStream !== 'undefined';
    const file = compressed ? chunk.gzip! : chunk.file;
    let lastError: unknown = null;
    for (const base of this.bases) {
      try {
        const response = await fetch(`${base}/${file}`, { signal: this.abort.signal });
        return await decodeModelResponse(response, chunk.bytes, compressed);
      } catch (err) {
        if (this.abort.signal.aborted) throw err;
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('An anatomy file could not be loaded.');
  }

  private async loadAll(mats: Map<SystemId, T.Material>): Promise<void> {
    let loaded = 0;
    const loadChunk = async (ci: number) => {
      const buffer = await this.fetchChunk(this.chunks[ci]);
      if (this.disposed) return;
      const groups = new Map<SystemId, T.BufferGeometry[]>();
      this.parts.forEach((p, i) => {
        if (!p.geom || p.geom[0] !== ci) return;
        const [, positions, normals, indices, vertexCount, indexCount] = p.geom;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(buffer, positions, vertexCount * 3), 3));
        g.setAttribute('normal', new T.BufferAttribute(new Int16Array(buffer, normals, vertexCount * 3), 3, true));
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, indices, indexCount), 1));
        g.boundingBox = this.bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g); pick.matrixAutoUpdate = false; this.pickers[i] = pick; this.geometries.push(g);
        g.setAttribute('partIndex', new T.BufferAttribute(new Float32Array(vertexCount).fill(i), 1));
        const list = groups.get(p.system) ?? []; list.push(g); groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const geometry = mergeGeometries(gs, false);
        if (!geometry) throw new Error('Could not assemble anatomy geometry.');
        this.geometries.push(geometry);
        const mesh = new T.Mesh(geometry, mats.get(system)); mesh.frustumCulled = false; this.scene.add(mesh);
      });
      this.lastState = null; loaded++;
      this.cb.onProgress(Math.round((loaded / this.chunks.length) * 100));
      this.dirty = true;
    };
    try {
      let cursor = 0;
      await Promise.all(Array.from({ length: 3 }, async () => { while (cursor < this.chunks.length) { const i = cursor++; await loadChunk(i); } }));
      if (!this.disposed) { this.ready = true; this.dirty = true; }
    } catch (e) {
      if (!this.disposed && !this.abort.signal.aborted) this.cb.onError(e instanceof Error ? e.message : 'Could not load the anatomy.');
    }
  }

  /** Camera preset. Discrete changes tween with quad.inOut; continuous explode updates set directly. */
  private fit(view: string, extent = 0, animate = true): void {
    const el = this.el, camera = this.camera, controls = this.controls;
    if (!controls) return;
    const mobile = el.clientWidth < 768;
    const normalDistance = mobile ? Math.max(4.5, (1.8 * el.clientHeight) / Math.max(160, el.clientHeight - 350) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) : 4;
    const reservedHeight = mobile ? 350 : 270;
    const availableAspect = Math.max(0.35, (el.clientWidth - (mobile ? 40 : 340)) / Math.max(160, el.clientHeight - reservedHeight));
    const atlasDistance = (Math.max(this.packingHeight, this.packingWidth / availableAspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * (el.clientHeight / Math.max(160, el.clientHeight - reservedHeight)) * 1.08;
    const distance = T.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
    if (extent > 0.8) view = 'front';
    const direction = view === 'front' ? new T.Vector3(0, 0.02, 1) : view === 'back' ? new T.Vector3(0, 0.02, -1) : view === 'side' ? new T.Vector3(1, 0.02, 0) : new T.Vector3(0.35, 0.06, 1).normalize();
    const target = new T.Vector3(extent > 0.1 && el.clientWidth > 767 ? -this.packingWidth * 0.12 : 0, extent > 0.1 || mobile ? 0.85 : 0.68, 0);
    const position = target.clone().addScaledVector(direction, distance);
    this.moveCamera(position, target, animate);
  }

  private moveCamera(position: T.Vector3, target: T.Vector3, animate: boolean): void {
    const controls = this.controls, camera = this.camera;
    this.cameraTween?.kill();
    if (!animate || this.reducedMotion) { controls.target.copy(target); camera.position.copy(position); controls.update(); this.dirty = true; return; }
    const from = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, tx: controls.target.x, ty: controls.target.y, tz: controls.target.z };
    this.cameraTween = gsap.to(from, {
      px: position.x, py: position.y, pz: position.z, tx: target.x, ty: target.y, tz: target.z,
      duration: 0.8, ease: QUAD.inOut, overwrite: 'auto',
      onUpdate: () => { camera.position.set(from.px, from.py, from.pz); controls.target.set(from.tx, from.ty, from.tz); controls.update(); this.dirty = true; },
    });
  }

  private findTarget(x: number, y: number, radius: number): number {
    let best = -1, score = Infinity;
    for (const t of this.targets) {
      const dx = Math.max(t.left - x, 0, x - t.right), dy = Math.max(t.top - y, 0, y - t.bottom), distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
      if (candidate < score) { score = candidate; best = t.index; }
    }
    return best;
  }

  private readonly onDown = (e: PointerEvent) => { this.hover.hidden = true; this.tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5); };
  private readonly onMove = (e: PointerEvent) => {
    this.tap.move(e.pointerId, e.clientX, e.clientY);
    if (e.buttons || this.amount < 0.5 || e.pointerType === 'touch') { this.hover.hidden = true; return; }
    const rect = this.el.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, index = this.findTarget(x, y, 12);
    this.hover.hidden = index < 0;
    this.renderer.domElement.style.cursor = index < 0 ? 'grab' : 'pointer';
    if (index >= 0) { this.hover.textContent = this.parts[index].name; this.hover.style.left = `${Math.max(8, Math.min(x + 14, this.el.clientWidth - 260))}px`; this.hover.style.top = `${Math.max(8, Math.min(y + 18, this.el.clientHeight - 55))}px`; }
  };
  private readonly onCancel = (e: PointerEvent) => this.tap.cancel(e.pointerId);
  private readonly onUp = (e: PointerEvent) => {
    const validTap = this.tap.up(e.pointerId, e.clientX, e.clientY);
    if (!validTap || !this.ready) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    let nearest = Infinity, found = -1;
    const data = this.data;
    const hasSolid = this.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);
    this.pickers.forEach((mesh, i) => {
      if (!mesh || data[i * 4 + 3] < 0.5 || (hasSolid && this.parts[i].system === 'integumentary')) return;
      this.worldBox.copy(this.bounds[i]).translate(mesh.position);
      if (!this.raycaster.ray.intersectBox(this.worldBox, this.hitPoint)) return;
      const hits = this.raycaster.intersectObject(mesh, false);
      if (hits[0] && hits[0].distance < nearest) { nearest = hits[0].distance; found = i; }
    });
    if (found < 0 && this.amount > 0.45) found = this.findTarget(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'touch' ? 24 : 16);
    if (found >= 0) { this.hover.hidden = true; this.cb.onSelect(this.parts[found].id); }
  };
  private readonly onContextLost = (e: Event) => { e.preventDefault(); this.cb.onError('The 3D session was paused by your device. Reload to continue.'); };

  private readonly animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const el = this.el, s = this.state, data = this.data, camera = this.camera, controls = this.controls, amount = this.amount;
    this.clock.getDelta();
    const changed = this.lastState?.visible !== s.visible || this.lastState?.selected !== s.selected || this.lastState?.isolate !== s.isolate;
    const moving = Math.abs(amount - this.lastExtent) > 0.0001;
    if (changed || moving || this.lastExtent < 0) {
      const visible = new Set(s.visible), selection = new Set(s.selected);
      const visibleParts = this.parts.filter((p) => (s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id)));
      const nextLayoutKey = visibleParts.map((p) => p.id).join(',') + ':' + camera.aspect.toFixed(3);
      if (nextLayoutKey !== this.layoutKey) {
        const layout = createExplosionLayout(visibleParts, camera.aspect);
        this.packingWidth = layout.width; this.packingHeight = layout.height;
        this.parts.forEach((p, i) => { const cell = layout.cells.get(p.id); this.offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : this.centers[i].clone(); });
        this.layoutKey = nextLayoutKey;
        if (amount > 0.05 && !s.isolate) this.fit(s.view, Math.max(0, (amount - 0.3) / 0.7), false);
      }
      this.parts.forEach((p, i) => {
        const c = this.centers[i], destination = this.offsets[i];
        let dx = 0, dy = 0, dz = 0;
        const group = SYSTEMS.findIndex((sys) => sys.id === p.system), angle = (group / SYSTEMS.length) * Math.PI * 2;
        if (amount <= 0.45) { const t = amount / 0.45; dx = Math.sin(angle) * t * 0.48; dy = (c.y - 0.85) * t * 0.28; dz = Math.cos(angle) * t * 0.48; }
        else { const t = (amount - 0.45) / 0.55; dx = T.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t); dy = T.MathUtils.lerp((c.y - 0.85) * 0.28, destination.y - c.y, t); dz = T.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t); }
        const selected = selection.has(p.id);
        data.set([dx, dy, dz, (s.isolate ? selected : visible.has(p.system) || selected) ? 1 : 0], i * 4);
        this.selectedData[i * 4] = selected ? 255 : 0;
        this.markerPositions.set(data[i * 4 + 3] > 0.5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000], i * 3);
        const mesh = this.pickers[i];
        if (mesh) { mesh.position.set(dx, dy, dz); mesh.updateMatrix(); mesh.updateMatrixWorld(true); }
      });
      this.partTexture.needsUpdate = true; this.selectionTexture.needsUpdate = true; this.markerGeometry.attributes['position'].needsUpdate = true;
      this.lastState = s; this.lastExtent = amount; this.dirty = true;
    }
    if (s.view !== this.lastView || s.reset !== this.lastReset) { this.fit(s.view, amount, this.lastView !== ''); this.lastView = s.view; this.lastReset = s.reset; }
    if (moving && !s.isolate) this.fit(amount > 0.5 ? 'front' : s.view, Math.max(0, (amount - 0.3) / 0.7), false);
    const isolateKey = s.isolate ? s.selected.join(',') + ':' + s.reset + ':' + s.inspectorOpen + ':' + camera.aspect : '';
    if (isolateKey !== this.lastIsolate || (s.isolate && moving)) {
      if (s.isolate) {
        const box = new T.Box3();
        this.parts.forEach((p, i) => { if (s.selected.includes(p.id)) box.union(this.bounds[i].clone().translate(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]))); });
        if (!box.isEmpty()) {
          const center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
          const w = el.clientWidth, h = el.clientHeight, mobile = w < 768, landscape = w > h && h <= 600;
          let left = 20, right = w - 20, top = mobile ? 175 : 110, bottom = h - 170;
          if (s.inspectorOpen) { if (landscape) { right = w - 335; top = 100; bottom = h - 125; } else if (mobile) { top = 110; bottom = h * 0.58 - 155; } else { right = w - 370; left = w > 1100 ? 285 : 25; } }
          const availableWidth = Math.max(150, right - left), availableHeight = Math.max(40, bottom - top);
          camera.setViewOffset(w, h, w / 2 - (left + right) / 2, h / 2 - (top + bottom) / 2, w, h);
          const distance = Math.max(0.07, (Math.max((size.y * h) / availableHeight, (size.x * w) / availableWidth / camera.aspect, size.z) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) * 1.35);
          controls.maxDistance = Math.max(40, distance * 2);
          this.moveCamera(center.clone().add(new T.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(distance)), center, !(s.isolate && moving));
        }
      } else if (this.lastIsolate) { camera.clearViewOffset(); this.fit(s.view, amount, true); }
      this.lastIsolate = isolateKey;
    }
    controls.enableRotate = amount < 0.8;
    controls.mouseButtons.LEFT = amount < 0.8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
    controls.touches.ONE = amount < 0.8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
    this.ground.visible = this.platform.visible = this.ring.visible = this.innerRing.visible = amount < 0.5 && !s.isolate;
    this.markers.visible = amount > 0.75;
    controls.autoRotate = s.rotate && !s.isolate && amount < 0.4; controls.autoRotateSpeed = 0.65;
    controls.update();
    if (controls.autoRotate) this.dirty = true;
    if (this.dirty) {
      this.renderer.render(this.scene, camera);
      this.targets = [];
      if (amount > 0.45) {
        const hasSolid = this.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);
        this.parts.forEach((p, i) => {
          if (data[i * 4 + 3] < 0.5 || (hasSolid && p.system === 'integumentary')) return;
          const b = this.bounds[i];
          let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
          for (let corner = 0; corner < 8; corner++) {
            this.projected.set((corner & 1 ? b.max.x : b.min.x) + data[i * 4], (corner & 2 ? b.max.y : b.min.y) + data[i * 4 + 1], (corner & 4 ? b.max.z : b.min.z) + data[i * 4 + 2]).project(camera);
            const x = ((this.projected.x + 1) * el.clientWidth) / 2, y = ((1 - this.projected.y) * el.clientHeight) / 2;
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
          this.projected.copy(this.centers[i]).add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).project(camera);
          if (this.projected.z < -1 || this.projected.z > 1) return;
          this.targets.push({ index: i, x: ((this.projected.x + 1) * el.clientWidth) / 2, y: ((1 - this.projected.y) * el.clientHeight) / 2, left, right, top, bottom });
        });
      }
      this.dirty = false;
    }
  };
}
