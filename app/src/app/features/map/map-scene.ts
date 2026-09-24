/**
 * Tactical site map: a raked plane carrying a procedurally drawn world, real geometry for the site
 * beams and route arcs above it, and a screen-aligned overlay for the tracking callouts.
 *
 * The callouts are the reason this is not just a textured quad. Each site's beam head is projected
 * through the camera every frame and the callout is drawn at those screen coordinates, so labels
 * track their markers through the parallax instead of being painted into the map texture.
 *
 * Everything renders through three.js: the perspective pass draws the world, then a second
 * orthographic pass composites the overlay quad on top with `autoClear` disabled.
 */
import * as T from 'three';
import * as P from '../../shared/fui/fui-panels';
import { ORIGIN, SITES, type Site, distanceKm, formatCoord, project } from './sites';

const OW = 1600;
const OH = 900;
const MW = 2048;
const MH = 1024;

/** Mulberry32 — a seeded RNG so the generated coastlines are identical on every load. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An abstract world: graticule, invented landmasses, parcel blocks. Not a real coastline. */
function paintMap(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, MW, MH);
  ctx.fillStyle = '#0b1318';
  ctx.fillRect(0, 0, MW, MH);

  const r = rng(20260918);
  // Landmasses as unions of soft blobs, then a parcel grid clipped to them.
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const cx = r() * MW;
    const cy = 140 + r() * (MH - 320);
    const rx = 90 + r() * 260;
    const ry = 60 + r() * 150;
    ctx.ellipse(cx, cy, rx, ry, r() * Math.PI, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(68, 224, 204, 0.055)';
  ctx.fillRect(0, 0, MW, MH);
  ctx.fillStyle = 'rgba(68, 224, 204, 0.10)';
  for (let i = 0; i < 2600; i++) {
    const x = r() * MW;
    const y = r() * MH;
    ctx.fillRect(x, y, 2 + r() * 9, 2 + r() * 6);
  }
  ctx.restore();

  // Graticule every 15°, heavier on the 60° lines.
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
    const x = ((lon + 180) / 360) * MW;
    ctx.fillText(`${Math.abs(lon)}°${lon < 0 ? 'W' : lon > 0 ? 'E' : ''}`, x + 4, MH / 2 - 6);
  }
}

interface Tracked { site: Site; world: T.Vector3; screen: T.Vector3; locked: boolean }

export class MapScene {
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
  private raf = 0;
  private frame = 0;
  private disposed = false;
  private selected = 0;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = false;
    this.camera.position.set(0, 1.65, 1.85);
    this.camera.lookAt(0, 0, -0.08);
    this.scene.add(this.group);

    // Map plane.
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

    // Site beams: a marker plate on the plane and a thin column rising from it.
    for (const site of [ORIGIN, ...SITES]) {
      const p = project(site);
      const x = p.x * 2;
      const z = p.z * 1;
      const h = site === ORIGIN ? 0.5 : 0.16 + (site.enrolled / 212) * 0.3;
      const mat = new T.MeshBasicMaterial({ color: site === ORIGIN ? 0xe6f6f3 : 0x44e0cc, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
      const beam = new T.Mesh(new T.BoxGeometry(0.008, h, 0.008), mat);
      beam.position.set(x, h / 2, z);
      this.group.add(beam);
      this.beams.push(beam);
      this.disposables.push(beam.geometry, mat);
      this.tracked.push({ site, world: new T.Vector3(x, h + 0.04, z), screen: new T.Vector3(), locked: false });
    }

    // Route arcs from the origin, lifted off the plane so they read as links, not borders.
    const o = project(ORIGIN);
    for (const site of SITES) {
      const p = project(site);
      const a = new T.Vector3(o.x * 2, 0.02, o.z);
      const b = new T.Vector3(p.x * 2, 0.02, p.z);
      const mid = a.clone().lerp(b, 0.5);
      mid.y = 0.1 + a.distanceTo(b) * 0.22;
      const curve = new T.QuadraticBezierCurve3(a, mid, b);
      const geo = new T.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new T.LineBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false });
      this.group.add(new T.Line(geo, mat));
      this.disposables.push(geo, mat);
    }

    // Scan ring: expands from the origin and locks each site as it passes.
    const ringGeo = new T.RingGeometry(0.98, 1, 96);
    const ringMat = new T.MeshBasicMaterial({ color: 0x44e0cc, transparent: true, opacity: 0.4, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false });
    this.ring = new T.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(o.x * 2, 0.012, o.z);
    this.group.add(this.ring);
    this.disposables.push(ringGeo, ringMat);

    // Overlay pass.
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

  private readonly ring: T.Mesh;

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
    return this.reduced ? 1.4 : ((this.frame % 420) / 420) * 2.6;
  }

  private paintOverlay(): void {
    const ctx = this.overlayCtx;
    const f = this.frame;
    ctx.clearRect(0, 0, OW, OH);

    // Header rail.
    P.font(ctx, 11, 500);
    P.text(ctx, 'ATLAS.NET-02:-/SITES', 48, 44, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, `GRID ZONE DESIGNATION: 48T · ${SITES.length + 1} NODES ACTIVE`, 48, 62, P.PALETTE.tealDim);
    P.dashedRule(ctx, 48, 76, 460);
    P.tabBar(ctx, OW - 560, 44, 500, ['TRACKS', 'MAP', 'ROUTES', 'METOC'], 1);

    // Callouts, drawn from projected beam heads so labels follow their markers.
    const sel = this.tracked[this.selected];
    const placed: Array<[number, number]> = [];
    let suppressed = 0;
    let clusterAt: [number, number] | null = null;
    for (const t of this.tracked) {
      if (!t.locked) continue;
      const sx = ((t.screen.x + 1) / 2) * OW;
      const sy = ((1 - t.screen.y) / 2) * OH;
      if (sx < 40 || sx > OW - 40 || sy < 90 || sy > OH - 230) continue;
      const side: 1 | -1 = sx > OW * 0.62 ? -1 : 1;
      // Sites within a few hundred km collapse to one point at world scale; label the first and
      // count the rest rather than stacking unreadable codes on top of each other.
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
        ], side, 92);
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
      P.text(ctx, `+${suppressed} IN CLUSTER`, clusterAt[0] + 10, clusterAt[1] + 30, P.PALETTE.teal);
    }

    // Scan panel: the search that is populating the map.
    const revealed = Math.min(3, Math.floor(((f % 420) / 420) * 4));
    P.scanPanel(ctx, 48, 250, 420, 'SCANNING', 'SITE NETWORK', [
      ['ROUTE A - NORTH ATLANTIC RELAY', 'DISTANCE 5,240 KM   LAST VERIFIED 2026-09-11'],
      ['ROUTE B - PACIFIC TRANSFER PATH', 'DISTANCE 12,180 KM  LAST VERIFIED 2026-08-30'],
      ['ROUTE C - CORAL SEA CORRIDOR', 'DISTANCE 16,010 KM  LAST VERIFIED 2026-09-02'],
    ], revealed);

    // Controls rail: three redundant channels wired to a polar plot.
    const rows: Array<[string, boolean]> = [
      ['COLD CHAIN', true], ['CUSTODY LOG', true], ['ASSAY BUS', f % 180 > 120 ? false : true], ['NAV FAULT', true],
    ];
    const baseY = OH - 190;
    for (let i = 0; i < 3; i++) {
      P.channelPanel(ctx, 470 + i * 190, baseY, 168, rows, `A0${i + 1}`);
      P.circuitTrace(ctx, [[470 + i * 190 + 84, baseY - 10], [470 + i * 190 + 84, baseY - 26], [1030, baseY - 26], [1030, baseY - 44]]);
    }
    P.polarPlot(ctx, 290, OH - 120, 76, this.tracked.slice(1).map((t, i) => [(t.site.lon / 180) * Math.PI, 0.25 + (i % 4) * 0.22] as [number, number]), (f * 0.02) % (Math.PI * 2));

    P.font(ctx, 9, 400);
    P.text(ctx, 'SELECTED NODE', OW - 430, baseY + 6, P.PALETTE.dim);
    P.font(ctx, 24, 500, 0.06);
    P.text(ctx, sel.site.name, OW - 430, baseY + 38, P.PALETTE.text);
    P.dataTable(ctx, OW - 430, baseY + 62, [
      ['CODE', sel.site.code],
      ['ENROLLED', String(sel.site.enrolled)],
      ['RANGE', `${distanceKm(ORIGIN, sel.site)} KM`],
      ['STATUS', sel.locked ? 'LOCKED' : 'ACQUIRING'],
    ], 120);

    ctx.textAlign = 'center';
    P.font(ctx, 12, 400, 0.12);
    P.text(ctx, `SCAN RADIUS ${(this.scanRadius() * 8000).toFixed(0).padStart(5, '0')} KM`, OW / 2, OH - 34, P.PALETTE.dim);
    ctx.textAlign = 'left';

    this.overlayTex.needsUpdate = true;
  }

  start(): void {
    if (this.reduced) { this.step(); this.render(); return; }
    const tick = () => {
      if (this.disposed) return;
      this.frame += 1;
      this.step();
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private step(): void {
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
      const m = this.beams[i].material as T.MeshBasicMaterial;
      m.opacity = this.tracked[i].locked ? 0.9 : 0.12;
    }

    if (!this.reduced && this.frame % 150 === 0) this.selected = this.nextVisible();

    this.pointer.x += (this.target.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.05;
    this.group.rotation.y = this.pointer.x * 0.16;
    this.group.rotation.x = this.pointer.y * 0.05;

    this.paintOverlay();
  }

  /** Advance to the next site that is locked and inside the frame; fall back to simple rotation. */
  private nextVisible(): number {
    for (let step = 1; step <= SITES.length; step++) {
      const i = 1 + ((this.selected - 1 + step) % SITES.length);
      const t = this.tracked[i];
      const sx = ((t.screen.x + 1) / 2) * OW;
      const sy = ((1 - t.screen.y) / 2) * OH;
      if (t.locked && sx > 120 && sx < OW - 120 && sy > 120 && sy < OH - 260) return i;
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
