/**
 * A spatial-intelligence console: a vector globe under a circular mask, with live-looking air,
 * orbital and seismic contacts labelled by leader lines that track them around the limb.
 *
 * Built the same way as `map-scene.ts` — a perspective pass for the world, then an orthographic
 * quad carrying a canvas overlay, with `autoClear` disabled — with one deliberate difference: the
 * overlay composites with `NormalBlending`, not `AdditiveBlending`. The circular vignette is the
 * defining element of this layout and additive blending can only ever brighten, so a vignette
 * painted into an additive overlay would silently do nothing.
 *
 * The globe is vector, not a texture or a dot field: drawing `world-110m.json`'s arcs as lines,
 * rather than stitching them into polygons, needs no TopoJSON decoder and yields coastlines and
 * country borders in a single draw call.
 *
 * The world file is this page's own copy under `data/gev/`, not the Vega gallery's. It is the same
 * 119 kB either way, and a page reaching into another feature's data folder would break silently
 * the day that folder is tidied.
 */
import * as T from 'three';
import * as P from '../../shared/fui/fui-panels';
import { distanceKm, formatCoord } from '../map/sites';
import {
  type Contact,
  type Flight,
  type Quake,
  type Sat,
  type Snapshot,
  type Topology,
  deadReckon,
  decodeArcs,
  nearbyContacts,
  satelliteAt,
} from './tracks';

const OW = 1600;
const OH = 900;
const R = 1;
/**
 * Radius of the circular aperture in overlay pixels, and its centre.
 *
 * The camera distance below is set from this, not the other way round: the geostationary ring sits
 * at 1.25 R, so a globe framed to fill the aperture would push two thirds of the satellites outside
 * it and the mask would quietly clip them. Framing the globe small enough that the outermost shell
 * still lands inside is also closer to the reference, where the globe is a small disc inside a wide
 * cloud of contacts.
 */
const MASK = Math.min(OW, OH) * 0.45;
const CX = OW / 2;
const CY = OH / 2;

const TEAL = 0x44e0cc;
const AMBER = 0xf2c14e;
const ROSE = 0xef7a8a;

/** The station this console reports from — the same origin the site map and marketing globe use. */
const STATION = { lat: 42.6334, lon: -71.3162, name: 'LOWELL' };

function toVec(lat: number, lon: number, r = R): T.Vector3 {
  const la = lat * (Math.PI / 180);
  const lo = lon * (Math.PI / 180);
  return new T.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

/**
 * Orbits span 320 km to 35 786 km. Drawn to scale the geostationary ring would sit five globe
 * radii out with every LEO satellite welded to the surface, so altitude is compressed
 * logarithmically — the shells stay visually distinct and all three fit the frame.
 */
function orbitRadius(altKm: number): number {
  return R + 0.115 * Math.log10(1 + altKm / 300);
}

interface Marked {
  label: string;
  lines: string[];
  world: T.Vector3;
  screen: T.Vector3;
  facing: number;
}

export class GevScene {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  private readonly overlayScene = new T.Scene();
  private readonly overlayCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly overlayTex: T.CanvasTexture;
  private readonly tilt = new T.Group();
  private readonly globe = new T.Group();
  private readonly disposables: Array<{ dispose(): void }> = [];

  private craftPts: T.Points | null = null;
  private satPts: T.Points | null = null;
  private snapshot: Snapshot | null = null;
  private craftNow: Flight[] = [];
  private contacts: Contact[] = [];
  private marked: Marked[] = [];
  private selected = 0;

  private raf = 0;
  private frame = 0;
  private disposed = false;
  private spin = { y: 0, vy: 0, x: 0.28 };
  private dragging = false;
  private idleUntil = 0;

  constructor(canvas: HTMLCanvasElement, private reduced = false) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = false;
    this.camera.position.set(0, 0, 5.4);

    this.scene.add(this.tilt);
    this.tilt.rotation.set(0.24, 0, 0.1);
    this.tilt.add(this.globe);
    this.spin.y = -STATION.lon * (Math.PI / 180);

    this.addBody();
    this.addGraticule();

    const oc = document.createElement('canvas');
    oc.width = OW;
    oc.height = OH;
    this.overlayCtx = oc.getContext('2d')!;
    this.overlayTex = new T.CanvasTexture(oc);
    this.overlayTex.colorSpace = T.SRGBColorSpace;
    const oGeo = new T.PlaneGeometry(2, 2);
    // NormalBlending, unlike map-scene: the vignette has to be able to darken. See the file note.
    const oMat = new T.MeshBasicMaterial({ map: this.overlayTex, transparent: true, blending: T.NormalBlending, depthWrite: false, depthTest: false });
    this.overlayScene.add(new T.Mesh(oGeo, oMat));
    this.disposables.push(this.overlayTex, oGeo, oMat);
  }

  /** Opaque sphere to occlude the far hemisphere, plus a Fresnel rim that lights only the limb. */
  private addBody(): void {
    const geo = new T.SphereGeometry(R * 0.995, 64, 48);
    const mat = new T.MeshBasicMaterial({ color: 0x08131a });
    this.globe.add(new T.Mesh(geo, mat));
    this.disposables.push(geo, mat);

    const rimGeo = new T.SphereGeometry(R * 1.012, 64, 48);
    const rimMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { uColor: { value: new T.Color(TEAL) } },
      vertexShader: `
        varying float vRim;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vRim;
        void main() { gl_FragColor = vec4(uColor, pow(vRim, 3.4) * 0.6); }`,
    });
    this.globe.add(new T.Mesh(rimGeo, rimMat));
    this.disposables.push(rimGeo, rimMat);
  }

  private addGraticule(): void {
    const pts: T.Vector3[] = [];
    const SEG = 90;
    for (let lat = -60; lat <= 60; lat += 15)
      for (let i = 0; i < SEG; i++)
        pts.push(toVec(lat, (i / SEG) * 360, R * 1.0005), toVec(lat, ((i + 1) / SEG) * 360, R * 1.0005));
    for (let lon = 0; lon < 360; lon += 15)
      for (let i = 0; i < SEG; i++)
        pts.push(toVec(-90 + (i / SEG) * 180, lon, R * 1.0005), toVec(-90 + ((i + 1) / SEG) * 180, lon, R * 1.0005));
    const geo = new T.BufferGeometry().setFromPoints(pts);
    const mat = new T.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.06 });
    this.globe.add(new T.LineSegments(geo, mat));
    this.disposables.push(geo, mat);
  }

  /** Coastlines and borders: every decoded arc becomes a run of line segments on the sphere. */
  private addCoastlines(topo: Topology): void {
    const pts: number[] = [];
    for (const arc of decodeArcs(topo)) {
      for (let i = 1; i < arc.length; i++) {
        const a = toVec(arc[i - 1][1], arc[i - 1][0], R * 1.001);
        const b = toVec(arc[i][1], arc[i][0], R * 1.001);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    const mat = new T.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.72 });
    this.globe.add(new T.LineSegments(geo, mat));
    this.disposables.push(geo, mat);
  }

  private addPoints(count: number, color: number, size: number, opacity: number): T.Points {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new T.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false });
    const pts = new T.Points(geo, mat);
    this.globe.add(pts);
    this.disposables.push(geo, mat);
    return pts;
  }

  /** Earthquakes never move, so they are built once as rings scaled by magnitude. */
  private addQuakes(quakes: Quake[]): void {
    const ringGeo = new T.RingGeometry(0.008, 0.011, 24);
    const mat = new T.MeshBasicMaterial({ color: ROSE, transparent: true, opacity: 0.5, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false });
    this.disposables.push(ringGeo, mat);
    for (const q of quakes) {
      const p = toVec(q.lat, q.lon, R * 1.004);
      const ring = new T.Mesh(ringGeo, mat);
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      ring.scale.setScalar(0.6 + (q.mag - 3) * 0.55);
      this.globe.add(ring);
    }
  }

  /** Fetches the committed world file and the captured tracks. Both are local; neither needs a key. */
  async load(): Promise<void> {
    const [topo, snap] = await Promise.all([
      fetch('data/gev/world-110m.json').then((r) => r.json() as Promise<Topology>),
      fetch('data/gev/tracks.json').then((r) => r.json() as Promise<Snapshot>),
    ]);
    if (this.disposed) return;
    this.addCoastlines(topo);
    this.snapshot = snap;
    this.craftNow = snap.craft;
    this.addQuakes(snap.quakes);
    this.craftPts = this.addPoints(snap.craft.length, AMBER, 0.021, 0.95);
    this.satPts = this.addPoints(snap.sats.length, 0xe6f6f3, 0.017, 0.85);
    this.step();
  }

  track(nx: number, ny: number): void {
    if (!this.dragging) return;
    this.spin.vy = nx * 0.04;
  }

  setDragging(on: boolean): void {
    this.dragging = on;
    if (on) this.idleUntil = this.frame + 240;
  }

  /** Cycle the leader-line target; the page wires this to the contacts rail. */
  select(i: number): void {
    this.selected = i;
    this.idleUntil = this.frame + 240;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Seconds of replay elapsed. Reduced motion freezes the snapshot at its captured instant. */
  private elapsed(): number {
    return this.reduced ? 0 : this.frame * (1 / 60);
  }

  private step(): void {
    const snap = this.snapshot;
    if (!snap) return;
    // Wall-clock speed would take ten minutes to visibly move an airliner; 60x keeps the console alive.
    const dt = this.elapsed() * 60;
    this.craftNow = snap.craft.map((c) => deadReckon(c, dt));

    if (this.craftPts) {
      const arr = this.craftPts.geometry.getAttribute('position') as T.BufferAttribute;
      this.craftNow.forEach((c, i) => {
        const v = toVec(c.lat, c.lon, R * (1.006 + Math.min(c.alt, 45000) / 45000 * 0.01));
        arr.setXYZ(i, v.x, v.y, v.z);
      });
      arr.needsUpdate = true;
    }

    if (this.satPts) {
      const at = snap.captured + dt * 1000;
      const arr = this.satPts.geometry.getAttribute('position') as T.BufferAttribute;
      snap.sats.forEach((s, i) => {
        const p = satelliteAt(s, at);
        const v = toVec(p.lat, p.lon, orbitRadius(p.altKm));
        arr.setXYZ(i, v.x, v.y, v.z);
      });
      arr.needsUpdate = true;
    }

    this.contacts = nearbyContacts(STATION, this.craftNow, 250, 14);
    if (this.selected >= this.contacts.length) this.selected = 0;

    if (!this.reduced) {
      if (this.frame > this.idleUntil) this.spin.vy += (0.0016 - this.spin.vy) * 0.02;
      this.spin.y += this.spin.vy;
      this.spin.vy *= 0.94;
    }
    this.globe.rotation.y = this.spin.y;

    this.buildMarks();
    this.paintOverlay();
  }

  /**
   * Project the marked contacts to screen space, keeping the facing dot product so the overlay can
   * fade a label out as its target crosses the limb — a label left drawn over the far hemisphere
   * is the tell that a globe is faked.
   */
  private buildMarks(): void {
    const camDir = new T.Vector3();
    const world = new T.Vector3();
    const normal = new T.Vector3();
    this.marked = this.contacts.slice(0, 6).map(({ craft, km }) => {
      world.copy(toVec(craft.lat, craft.lon, R * 1.02));
      this.globe.localToWorld(world);
      normal.copy(world).normalize();
      camDir.copy(this.camera.position).sub(world).normalize();
      const facing = normal.dot(camDir);
      const screen = world.clone().project(this.camera);
      return {
        label: craft.id,
        lines: [
          `${craft.type} · ${craft.alt.toLocaleString('en-US')} FT · ${craft.spd} KTS`,
          formatCoord(craft),
          `RANGE ${km} KM · HDG ${String(Math.round(craft.hdg)).padStart(3, '0')}`,
        ],
        world: world.clone(),
        screen,
        facing,
      };
    });
  }

  /** Dark everything outside the disc, so the globe reads as a sensor aperture. */
  private paintMask(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, OW, OH);
    ctx.arc(CX, CY, MASK, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(5, 9, 12, 0.93)';
    ctx.fill();
    ctx.restore();

    // Feathered inner edge so the limb does not end on a hard line.
    const grad = ctx.createRadialGradient(CX, CY, MASK * 0.82, CX, CY, MASK);
    grad.addColorStop(0, 'rgba(5, 9, 12, 0)');
    grad.addColorStop(1, 'rgba(5, 9, 12, 0.93)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(CX, CY, MASK, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = P.PALETTE.tealFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CX, CY, MASK + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  private paintOverlay(): void {
    const ctx = this.overlayCtx;
    const f = this.frame;
    ctx.clearRect(0, 0, OW, OH);

    this.paintMask(ctx);
    // Painted after the mask so the grid bleeds past the aperture, as the reference does.
    P.gridPanel(ctx, 0, 0, OW, OH, 30);
    P.corners(ctx, 26, 26, OW - 52, OH - 52, 26, P.PALETTE.tealDim);

    this.paintHeader(ctx, f);
    this.paintLeftRail(ctx, f);
    this.paintContacts(ctx);
    this.paintCallouts(ctx);
    this.paintFooter(ctx, f);

    this.overlayTex.needsUpdate = true;
  }

  private paintHeader(ctx: CanvasRenderingContext2D, f: number): void {
    P.font(ctx, 20, 600, 0.1);
    P.text(ctx, "GOD'S EYE VIEW", 48, 60, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, 'A PLACE LEFT SHOWING · KONG ATLAS LABS', 48, 78, P.PALETTE.tealDim);

    P.slab(ctx, 48, 100, 300, 'KH11-4894', 'OPS-4120');
    P.font(ctx, 9, 400);
    P.text(ctx, 'TOP SECRET // SI-TK // NOFORN', 48, 156, P.PALETTE.amber);
    P.dashedRule(ctx, 48, 168, 300);
    P.microRail(ctx, 48, 190, [
      `SNAPSHOT ${new Date(this.snapshot?.captured ?? Date.now()).toISOString().slice(0, 10)}`,
      `CONTACTS ${String(this.craftNow.length).padStart(4, '0')} TRACKED`,
      `ORBITALS ${String(this.snapshot?.sats.length ?? 0).padStart(3, '0')} RESOLVED`,
      `SEISMIC  ${String(this.snapshot?.quakes.length ?? 0).padStart(3, '0')} EVENTS 7D`,
    ]);

    ctx.textAlign = 'right';
    const stamp = new Date((this.snapshot?.captured ?? Date.now()) + this.elapsed() * 60000);
    P.font(ctx, 10, 500);
    P.text(ctx, `● REC ${stamp.toISOString().slice(0, 19).replace('T', ' ')}Z`, OW - 48, 60, f % 60 < 40 ? P.PALETTE.rose : P.PALETTE.dim);
    P.font(ctx, 9, 400);
    P.text(ctx, `ORB +${String(Math.round(orbitRadius(420) * 1000))} KM   PASS DESC-${String(100 + (f % 99))}`, OW - 48, 78, P.PALETTE.tealDim);
    ctx.textAlign = 'left';
  }

  private paintLeftRail(ctx: CanvasRenderingContext2D, f: number): void {
    const y = OH - 300;
    P.channelPanel(ctx, 48, y, 210, [
      ['AIR CONTACTS', true],
      ['ORBITALS', true],
      ['SEISMIC', true],
      ['UPLINK', f % 240 > 180 ? false : true],
    ], 'L01');
    P.font(ctx, 9, 400);
    P.text(ctx, 'SENSOR GAIN', 48, y + 128, P.PALETTE.dim);
    P.barMeter(ctx, 48, y + 138, 210, 6, 0.5 + Math.sin(f * 0.01) * 0.18);
    P.text(ctx, 'APERTURE', 48, y + 168, P.PALETTE.dim);
    P.barMeter(ctx, 48, y + 178, 210, 6, 0.72);
    P.tickScale(ctx, 290, y, 190, ['+40', '+20', '000', '-20', '-40']);
  }

  private paintContacts(ctx: CanvasRenderingContext2D): void {
    const x = OW - 360;
    const y = 250;
    P.corners(ctx, x - 14, y - 34, 326, 420, 14, P.PALETTE.tealDim);
    P.font(ctx, 10, 500);
    P.text(ctx, 'CONTACTS', x, y - 12, P.PALETTE.text);
    P.font(ctx, 8, 400);
    P.text(ctx, `${STATION.name} · 250 KM FLIGHT WINDOW`, x, y + 4, P.PALETTE.tealDim);
    P.dashedRule(ctx, x, y + 14, 298);

    if (!this.contacts.length) {
      P.font(ctx, 9, 400);
      P.text(ctx, 'NO CONTACTS IN WINDOW', x, y + 40, P.PALETTE.faint);
      return;
    }
    P.dataTable(
      ctx,
      x,
      y + 36,
      this.contacts.map((c) => [c.craft.id.slice(0, 10), `${String(c.km).padStart(3, '0')} KM`] as [string, string]),
      240,
    );
    const sel = this.contacts[this.selected];
    if (sel) {
      P.font(ctx, 9, 400);
      P.text(ctx, 'SELECTED', x, y + 300, P.PALETTE.dim);
      P.font(ctx, 22, 500, 0.06);
      P.text(ctx, sel.craft.id, x, y + 330, P.PALETTE.text);
      P.dataTable(ctx, x, y + 352, [
        ['TYPE', sel.craft.type],
        ['ALT', `${sel.craft.alt.toLocaleString('en-US')} FT`],
        ['SPD', `${sel.craft.spd} KTS`],
      ], 200);
    }
  }

  private paintCallouts(ctx: CanvasRenderingContext2D): void {
    const placed: Array<[number, number]> = [];
    this.marked.forEach((m, i) => {
      if (m.facing <= 0.08) return;
      const sx = ((m.screen.x + 1) / 2) * OW;
      const sy = ((1 - m.screen.y) / 2) * OH;
      if (Math.hypot(sx - CX, sy - CY) > MASK - 12) return;
      const isSel = i === this.selected;
      if (!isSel && placed.some(([px, py]) => Math.hypot(px - sx, py - sy) < 34)) return;
      placed.push([sx, sy]);

      const fade = Math.min(1, (m.facing - 0.08) * 5);
      ctx.save();
      ctx.globalAlpha = fade;
      if (isSel) {
        P.callout(ctx, sx, sy, m.label, m.lines, sx > CX ? -1 : 1, 96);
        P.corners(ctx, sx - 26, sy - 26, 52, 52, 10, P.PALETTE.teal);
      } else {
        ctx.strokeStyle = P.PALETTE.tealDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 4, sy - 4, 8, 8);
        P.font(ctx, 8, 400);
        P.text(ctx, m.label, sx + 10, sy + 3, P.PALETTE.dim);
      }
      ctx.restore();
    });
  }

  private paintFooter(ctx: CanvasRenderingContext2D, f: number): void {
    const sel = this.contacts[this.selected];
    P.font(ctx, 9, 400);
    P.text(ctx, `MGRS: ${sel ? formatCoord(sel.craft) : formatCoord(STATION)}`, 48, OH - 74, P.PALETTE.dim);
    P.text(ctx, formatCoord(STATION), 48, OH - 56, P.PALETTE.faint);

    P.polarPlot(
      ctx,
      OW - 150,
      OH - 130,
      74,
      this.contacts.slice(0, 8).map((c, i) => [(c.craft.hdg * Math.PI) / 180, 0.2 + (i % 4) * 0.2] as [number, number]),
      (f * 0.02) % (Math.PI * 2),
    );

    ctx.textAlign = 'center';
    P.font(ctx, 9, 400, 0.14);
    P.text(ctx, 'ADSB.LOL · CELESTRAK · USGS — SNAPSHOT REPLAY, NO NETWORK', CX, OH - 34, P.PALETTE.faint);
    ctx.textAlign = 'left';
  }

  start(): void {
    if (this.reduced) {
      this.step();
      this.render();
      return;
    }
    const tick = () => {
      if (this.disposed) return;
      this.frame += 1;
      this.step();
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.render(this.overlayScene, this.overlayCam);
  }

  /** What the contacts rail needs to render itself in the DOM, if the page ever wants it there. */
  contactList(): Contact[] {
    return this.contacts;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
