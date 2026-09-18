/**
 * The two other three.js pages, merged into one instrument.
 *
 * From the site map (`features/map`): a raked plane carrying a generated world, beams at each trial
 * site, route arcs from the origin, a scan ring that locks sites as it passes, and callouts that are
 * *projected* from the beam heads every frame so labels track their markers through the parallax.
 *
 * From the readout (`features/hud`): the unit vocabulary laid over it — hero numeral, the steady
 * anchor bar, slab plates, an evaluation table that renders its vacancies, tick scale, instrument
 * rail and running timecode — plus the motion rule that matters: everything peripheral jitters
 * while the status bar holds perfectly still.
 *
 * Two passes render it: perspective for the world, then an orthographic quad for the overlay, with
 * `autoClear` off.
 */
import * as T from 'three';
import * as P from '../../shared/fui/fui-panels';
// Site data lives with the map feature. Imported rather than copied — if a third page ever needs
// it, it should move to shared/ the way fui-panels.ts did.
import { ORIGIN, SITES, type Site, distanceKm, formatCoord, project } from '../map/sites';

const OW = 1600;
const OH = 900;
const MW = 2048;
const MH = 1024;
const LOOP = 13;

/** Mulberry32 — seeded so the generated coastlines are identical on every load. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic per-frame jitter: the same frame always yields the same value. */
function jitter(seed: number, frame: number, spread: number): number {
  const n = Math.sin(seed * 12.9898 + Math.floor(frame) * 78.233) * 43758.5453;
  return Math.round((n - Math.floor(n)) * spread * 2 - spread);
}

function timecode(frames: number): string {
  const f = Math.floor(frames) % 24;
  const s = Math.floor(frames / 24) % 60;
  const m = Math.floor(frames / 1440) % 60;
  return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}:00-`;
}

/** A line still being written. */
function typed(full: string, t: number): string {
  return full.slice(0, Math.min(full.length, Math.max(0, Math.floor(t * 18))));
}

/** An abstract world: graticule, invented landmasses, parcel blocks. Not a real coastline. */
function paintMap(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, MW, MH);
  ctx.fillStyle = '#0b1318';
  ctx.fillRect(0, 0, MW, MH);

  const r = rng(20260918);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    ctx.ellipse(r() * MW, 140 + r() * (MH - 320), 90 + r() * 260, 60 + r() * 150, r() * Math.PI, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(68, 224, 204, 0.06)';
  ctx.fillRect(0, 0, MW, MH);
  ctx.fillStyle = 'rgba(68, 224, 204, 0.11)';
  for (let i = 0; i < 2600; i++) ctx.fillRect(r() * MW, r() * MH, 2 + r() * 9, 2 + r() * 6);
  ctx.restore();

  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * MW;
    ctx.strokeStyle = lon % 60 === 0 ? 'rgba(68, 224, 204, 0.20)' : 'rgba(68, 224, 204, 0.07)';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MH); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 15) {
    const y = ((90 - lat) / 180) * MH;
    ctx.strokeStyle = lat === 0 ? 'rgba(68, 224, 204, 0.24)' : 'rgba(68, 224, 204, 0.07)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MW, y); ctx.stroke();
  }
  ctx.font = "400 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = 'rgba(230, 246, 243, 0.22)';
  for (let lon = -180; lon <= 180; lon += 30) {
    ctx.fillText(`${Math.abs(lon)}°${lon < 0 ? 'W' : lon > 0 ? 'E' : ''}`, ((lon + 180) / 360) * MW + 4, MH / 2 - 6);
  }
}

interface Tracked { site: Site; world: T.Vector3; screen: T.Vector3; locked: boolean }

export class AthenaScene {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(38, 16 / 9, 0.1, 100);
  private readonly overlayScene = new T.Scene();
  private readonly overlayCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly overlayTex: T.CanvasTexture;
  private readonly group = new T.Group();
  private readonly tracked: Tracked[] = [];
  private readonly beams: T.Mesh[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly ring: T.Mesh;
  private raf = 0;
  private frame = 0;
  private clock = 0;
  private disposed = false;
  private selected = 1;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = false;
    this.camera.position.set(0, 1.55, 1.9);
    this.camera.lookAt(0, 0, -0.1);
    this.scene.add(this.group);

    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = MW;
    mapCanvas.height = MH;
    paintMap(mapCanvas.getContext('2d')!);
    const mapTex = new T.CanvasTexture(mapCanvas);
    mapTex.colorSpace = T.SRGBColorSpace;
    const plane = new T.Mesh(new T.PlaneGeometry(4, 2), new T.MeshBasicMaterial({ map: mapTex, transparent: true }));
    plane.rotation.x = -Math.PI / 2;
    this.group.add(plane);
    this.disposables.push(mapTex, plane.geometry, plane.material as T.Material);

    for (const site of [ORIGIN, ...SITES]) {
      const p = project(site);
      const x = p.x * 2;
      const z = p.z;
      const h = site === ORIGIN ? 0.5 : 0.16 + (site.enrolled / 212) * 0.3;
      const mat = new T.MeshBasicMaterial({ color: site === ORIGIN ? 0xe6f6f3 : 0x44e0cc, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
      const beam = new T.Mesh(new T.BoxGeometry(0.008, h, 0.008), mat);
      beam.position.set(x, h / 2, z);
      this.group.add(beam);
      this.beams.push(beam);
      this.disposables.push(beam.geometry, mat);
      this.tracked.push({ site, world: new T.Vector3(x, h + 0.04, z), screen: new T.Vector3(), locked: false });
    }

    const o = project(ORIGIN);
    for (const site of SITES) {
      const p = project(site);
      const a = new T.Vector3(o.x * 2, 0.02, o.z);
      const b = new T.Vector3(p.x * 2, 0.02, p.z);
      const mid = a.clone().lerp(b, 0.5);
      mid.y = 0.1 + a.distanceTo(b) * 0.22;
      const geo = new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(a, mid, b).getPoints(48));
      const mat = new T.LineBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false });
      this.group.add(new T.Line(geo, mat));
      this.disposables.push(geo, mat);
    }

    const ringGeo = new T.RingGeometry(0.98, 1, 96);
    const ringMat = new T.MeshBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.4, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false });
    this.ring = new T.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(o.x * 2, 0.012, o.z);
    this.group.add(this.ring);
    this.disposables.push(ringGeo, ringMat);

    const oc = document.createElement('canvas');
    oc.width = OW;
    oc.height = OH;
    this.overlayCtx = oc.getContext('2d')!;
    this.overlayTex = new T.CanvasTexture(oc);
    this.overlayTex.colorSpace = T.SRGBColorSpace;
    const oGeo = new T.PlaneGeometry(2, 2);
    const oMat = new T.MeshBasicMaterial({ map: this.overlayTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false });
    this.overlayScene.add(new T.Mesh(oGeo, oMat));
    this.disposables.push(this.overlayTex, oGeo, oMat);
  }

  track(nx: number, ny: number): void {
    this.target.x = nx;
    this.target.y = ny;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private scanRadius(): number {
    return this.reduced ? 1.4 : ((this.clock % LOOP) / LOOP) * 2.6;
  }

  private paintOverlay(): void {
    const ctx = this.overlayCtx;
    const f = this.frame;
    ctx.clearRect(0, 0, OW, OH);

    // Top rail — the readout's dense, namespaced header.
    P.font(ctx, 11, 500);
    P.text(ctx, 'ATLAS.NET-02:-/SITES', 48, 44, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, `QUANTUM YIELD: 21.00X 13.06 · ${SITES.length + 1} NODES`, 48, 62, P.PALETTE.tealDim);
    P.dashedRule(ctx, 48, 76, 440);
    P.font(ctx, 10, 400);
    P.text(ctx, 'XTL.GRID-02.INTERFACE', OW - 320, 44, P.PALETTE.dim);
    P.font(ctx, 13, 500, 0.04);
    P.text(ctx, `STABILITY:0${3640 + jitter(3, f, 4)}`, OW - 320, 70, P.PALETTE.text);
    P.tabBar(ctx, OW - 560, 100, 500, ['TRACKS', 'MAP', 'ROUTES', 'METOC'], 1);

    // Left column — slab plates over an evaluation table that renders its vacancies.
    P.slab(ctx, 48, 250, 330, 'RFN-637.A', 'POINT ORIG-', '[CR.R 10/9]');
    P.slab(ctx, 48, 322, 330, 'RFN-637.A', 'POINT RG-', '[K119 07/10-]');
    P.font(ctx, 10, 400);
    P.text(ctx, 'TRANSFER EVALUATION', 50, 402, P.PALETTE.dim);
    P.dataTable(ctx, 50, 428, [
      ['REQ TRANSFER:VARIABLE', '038'],
      [`HPR-01 - 00:${String(40 + (f % 9)).padStart(2, '0')} - 00:26`, '038'],
      ['3:1', '038'],
      ['4:1', '-'],
      ['5:1', '--'],
    ], 210);
    P.font(ctx, 15, 500, 0.05);
    P.text(ctx, typed('QTIC.</[1.38 X 10-23 J/', (f % 160) / 22), 48, OH - 150, P.PALETTE.teal);
    P.font(ctx, 8, 400);
    P.text(ctx, '303 MAGNIFY RD78', 48, OH - 132, P.PALETTE.faint);

    // Tracking callouts, projected from the beam heads so labels follow their markers.
    const sel = this.tracked[this.selected];
    const placed: Array<[number, number]> = [];
    let suppressed = 0;
    let clusterAt: [number, number] | null = null;
    for (const t of this.tracked) {
      if (!t.locked) continue;
      const sx = ((t.screen.x + 1) / 2) * OW;
      const sy = ((1 - t.screen.y) / 2) * OH;
      if (sx < 420 || sx > OW - 380 || sy < 150 || sy > OH - 260) continue;
      if (t !== sel && placed.some(([px, py]) => Math.hypot(px - sx, py - sy) < 26)) {
        suppressed += 1;
        clusterAt = [sx, sy];
        continue;
      }
      placed.push([sx, sy]);
      if (t === sel) {
        P.callout(ctx, sx, sy, t.site.name, [
          `${t.site.code} · ${t.site.place}`,
          formatCoord(t.site),
          `ENROLLED ${String(t.site.enrolled).padStart(3, '0')} · ${distanceKm(ORIGIN, t.site)} KM`,
        ], sx > OW * 0.58 ? -1 : 1, 88);
        P.corners(ctx, sx - 34, sy - 34, 68, 68, 12, P.PALETTE.teal);
      } else {
        ctx.strokeStyle = P.PALETTE.tealDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 5, sy - 5, 10, 10);
        P.font(ctx, 8, 400);
        P.text(ctx, t.site.code, sx + 10, sy + 3, P.PALETTE.dim);
      }
    }
    if (suppressed && clusterAt) {
      P.font(ctx, 8, 400);
      P.text(ctx, `+${suppressed} IN CLUSTER`, clusterAt[0] + 10, clusterAt[1] + 28, P.PALETTE.teal);
    }

    // Centre — the readout's hero numeral, then the anchor bar that never moves.
    const progress = Math.floor((this.scanRadius() / 2.6) * 100);
    ctx.textAlign = 'center';
    P.font(ctx, 92, 400, -0.01);
    P.text(ctx, String(progress).padStart(2, '0'), OW / 2 - 22, 196, P.PALETTE.text);
    P.font(ctx, 26, 400);
    P.text(ctx, '%', OW / 2 + 62, 168, P.PALETTE.teal);
    P.font(ctx, 9, 400);
    P.text(ctx, 'NETWORK SWEEP', OW / 2, 110, P.PALETTE.tealDim);
    ctx.textAlign = 'left';
    P.corners(ctx, OW / 2 - 190, 86, 380, 140, 16);
    P.statusBar(ctx, OW / 2 - 330, OH - 232, 660, 'SITE SCAN IN PROGRESS', 'B53.FS.21', Math.sin(f * 0.08) * 0.5 + 0.5);

    // Right column — sparse and large, the counterweight to the dense left.
    P.font(ctx, 9, 400);
    P.text(ctx, 'Q-SWITCH:', OW - 320, 250, P.PALETTE.dim);
    P.text(ctx, 'NEAR FIELD IMAGING - ON/6S', OW - 320, 268, P.PALETTE.dim);
    P.font(ctx, 42, 400, 0.02);
    P.text(ctx, '312', OW - 320, 330, P.PALETTE.text);
    P.font(ctx, 24, 400);
    P.text(ctx, '→', OW - 234, 326, P.PALETTE.teal);
    P.font(ctx, 42, 400, 0.02);
    P.text(ctx, `${480 + jitter(5, f, 3)}`, OW - 198, 330, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, 'SELECTED NODE', OW - 320, 392, P.PALETTE.dim);
    P.font(ctx, 22, 500, 0.06);
    P.text(ctx, sel.site.name, OW - 320, 424, P.PALETTE.text);
    P.dataTable(ctx, OW - 320, 452, [
      ['CODE', sel.site.code],
      ['ENROLLED', String(sel.site.enrolled)],
      ['RANGE', `${distanceKm(ORIGIN, sel.site)} KM`],
      ['STATUS', sel.locked ? 'LOCKED' : 'ACQUIRING'],
    ], 150);
    P.tickScale(ctx, OW - 330, 560, 170, ['240', '180', '120', '060']);

    // Bottom instrument rail — ring gauges, bar pair, polar plot, running timecode.
    P.dashedRule(ctx, 48, OH - 196, OW - 96);
    P.ringGauge(ctx, 150, OH - 104, 34, jitter(1, f * 0.3, 6), 0.55 + Math.sin(f * 0.05) * 0.2, 'PULSE/FREQUENCY:MPS');
    P.ringGauge(ctx, 300, OH - 104, 34, jitter(2, f * 0.3, 8), 0.3 + Math.cos(f * 0.04) * 0.2, 'ANGSTROM.WAVE');
    P.barMeter(ctx, 386, OH - 144, 14, 80, 0.4 + Math.sin(f * 0.07) * 0.3);
    P.barMeter(ctx, 408, OH - 144, 14, 80, 0.7 + Math.sin(f * 0.05) * 0.2);
    P.dataTable(ctx, 458, OH - 134, [['RND. MODE', ''], ['COORDINATES', '08.23'], ['UV-A', '(315-400 NM)']], 130);
    P.polarPlot(ctx, OW - 140, OH - 108, 60, this.tracked.slice(1).map((t, i) => [(t.site.lon / 180) * Math.PI, 0.25 + (i % 4) * 0.22] as [number, number]), (f * 0.02) % (Math.PI * 2));
    P.font(ctx, 17, 500, 0.05);
    P.text(ctx, 'DETECTION TEMPER: 1.00X', OW - 560, OH - 120, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, `SCAN RADIUS ${(this.scanRadius() * 8000).toFixed(0).padStart(5, '0')} KM`, OW - 560, OH - 100, P.PALETTE.faint);
    ctx.textAlign = 'center';
    P.font(ctx, 13, 400, 0.12);
    P.text(ctx, timecode(f), OW / 2, OH - 176, P.PALETTE.dim);
    ctx.textAlign = 'left';

    // Tracking brackets that acquire, hold and drop — the readout's front layer.
    const phase = (f % 96) / 96;
    if (phase > 0.12) P.corners(ctx, 470, 236, 190, 140, 18, P.PALETTE.teal, 'tl,br');
    P.corners(ctx, 34, 26, OW - 68, OH - 52, 26, P.PALETTE.tealFaint);
    P.dotMatrix(ctx, OW - 170, 150, 12, 4, f * 0.6);

    this.overlayTex.needsUpdate = true;
  }

  start(): void {
    if (this.reduced) { this.step(0); this.render(); return; }
    let last = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.clock += dt;
      this.frame += 1;
      this.step(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private step(dt: number): void {
    const radius = this.scanRadius();
    this.ring.scale.setScalar(Math.max(0.001, radius));
    (this.ring.material as T.MeshBasicMaterial).opacity = this.reduced ? 0.25 : 0.45 * (1 - radius / 2.6);

    const o = project(ORIGIN);
    for (const t of this.tracked) {
      const d = Math.hypot(t.world.x - o.x * 2, t.world.z - o.z);
      t.locked = this.reduced || d <= radius;
      t.screen.copy(t.world).project(this.camera);
    }
    for (let i = 0; i < this.beams.length; i++) {
      (this.beams[i].material as T.MeshBasicMaterial).opacity = this.tracked[i].locked ? 0.9 : 0.12;
    }

    if (!this.reduced && this.frame % 150 === 0) this.selected = this.nextVisible();

    this.pointer.x += (this.target.x - this.pointer.x) * Math.min(1, dt * 3);
    this.pointer.y += (this.target.y - this.pointer.y) * Math.min(1, dt * 3);
    this.group.rotation.y = this.pointer.x * 0.16;
    this.group.rotation.x = this.pointer.y * 0.05;

    this.paintOverlay();
  }

  /** Advance to the next site that is locked and clear of the overlay's columns. */
  private nextVisible(): number {
    for (let step = 1; step <= SITES.length; step++) {
      const i = 1 + ((this.selected - 1 + step) % SITES.length);
      const t = this.tracked[i];
      const sx = ((t.screen.x + 1) / 2) * OW;
      const sy = ((1 - t.screen.y) / 2) * OH;
      if (t.locked && sx > 440 && sx < OW - 400 && sy > 180 && sy < OH - 280) return i;
    }
    return 1 + (this.selected % SITES.length);
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.render(this.overlayScene, this.overlayCam);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
