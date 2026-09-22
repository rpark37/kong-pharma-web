// app/src/app/features/osiris/osiris-scene.ts
/**
 * The OSIRIS board painter: a flat world map with the layers from `layers.ts` on top and the FUI
 * chrome around it, all on one 2D canvas. No three.js — every mark is a point, so Canvas 2D at
 * these counts (a few thousand arcs a frame) is cheaper than a WebGL setup.
 *
 * d3-geo does two things the hand-rolled `(lon + 180) / 360` cannot: `fitExtent` sizes the map to
 * whatever rectangle the chrome leaves free, and `geoPath` clips the coastline arcs at the
 * antimeridian, so no arc draws a line across the whole Pacific.
 *
 * Static layers (everything but aircraft and satellites) are painted once to an offscreen canvas
 * whenever the size or the visible set changes, then blitted; the two moving layers are
 * re-reckoned every frame. Chrome is painted in a 900-high reference space scaled to the stage,
 * the same convention as gev, so the DOM islands positioned in cqh line up with it.
 */
import { geoEquirectangular, geoPath, type GeoProjection } from 'd3-geo';
import * as P from '../../shared/fui/fui-panels';
import { type Snapshot, type Topology, decodeArcs } from '../gev/tracks';
import {
  DEFAULT_ON,
  type Hazards,
  LAYERS,
  type LayerId,
  type Mark,
  marksFromCraft,
  marksFromEvents,
  marksFromFeeds,
  marksFromFires,
  marksFromQuakes,
  marksFromSats,
  marksFromZones,
  nearest,
} from './layers';

const OH = 900;
/** Reference-space margins: header above, footer below, the right column for the DOM rail. */
const MAP = { left: 48, top: 110, right: 360, bottom: 96 };
const HIT_PX = 10;

interface Projected {
  x: number;
  y: number;
  mark: Mark;
}

export class OsirisScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly still: HTMLCanvasElement;
  private readonly stillCtx: CanvasRenderingContext2D;
  private readonly projection: GeoProjection = geoEquirectangular();
  private coast: GeoJSON.MultiLineString | null = null;
  private snapshot: Snapshot | null = null;
  private hazards: Hazards | null = null;
  private hazardsFailed = false;
  private staticMarks = new Map<LayerId, Mark[]>();
  private visible = new Set<LayerId>(DEFAULT_ON);
  private projected: Projected[] = [];
  private hovered: Projected | null = null;
  private selected: Mark | null = null;

  private w = 1600;
  private h = OH;
  private dpr = 1;
  private frame = 0;
  private raf = 0;
  private disposed = false;
  private stillDirty = true;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly reduced = false) {
    this.ctx = canvas.getContext('2d')!;
    this.still = document.createElement('canvas');
    this.stillCtx = this.still.getContext('2d')!;
  }

  async load(): Promise<void> {
    const json = <T>(url: string) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${r.status} ${url}`))));
    const [topo, snap, hazards] = await Promise.all([
      json<Topology>('data/gev/world-110m.json'),
      json<Snapshot>('data/gev/tracks.json'),
      json<Hazards>('data/osiris/hazards.json').catch(() => null),
    ]);
    if (this.disposed) return;
    this.coast = { type: 'MultiLineString', coordinates: decodeArcs(topo) };
    this.snapshot = snap;
    this.hazards = hazards;
    this.hazardsFailed = hazards === null;
    this.staticMarks.set('quakes', marksFromQuakes(snap.quakes));
    this.staticMarks.set('fires', hazards ? marksFromFires(hazards.fires) : []);
    this.staticMarks.set('events', hazards ? marksFromEvents(hazards.events) : []);
    this.staticMarks.set('news', marksFromFeeds());
    this.staticMarks.set('zones', marksFromZones());
    this.stillDirty = true;
  }

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.still]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
    }
    const s = this.scale();
    this.projection.fitExtent(
      [
        [MAP.left * s, MAP.top * s],
        [w - MAP.right * s, h - MAP.bottom * s],
      ],
      { type: 'Sphere' },
    );
    this.stillDirty = true;
    if (this.reduced) this.paint();
  }

  start(): void {
    if (this.reduced) {
      this.paint();
      return;
    }
    const tick = () => {
      if (this.disposed) return;
      if (!document.hidden) {
        this.frame += 1;
        this.paint();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setVisible(ids: Set<LayerId>): void {
    this.visible = new Set(ids);
    this.stillDirty = true;
    if (this.selected && !this.visible.has(this.selected.layer)) this.selected = null;
    if (this.reduced) this.paint();
  }

  hover(nx: number, ny: number): void {
    const x = ((nx + 1) / 2) * this.w;
    const y = ((ny + 1) / 2) * this.h;
    this.hovered = nearest(this.projected, x, y, HIT_PX * this.scale());
    if (this.reduced) this.paint();
  }

  pick(): Mark | null {
    return this.hovered?.mark ?? null;
  }

  select(m: Mark | null): void {
    this.selected = m;
    if (this.reduced) this.paint();
  }

  count(id: LayerId): number | null {
    if (id === 'craft') return this.snapshot?.craft.length ?? null;
    if (id === 'sats') return this.snapshot?.sats.length ?? null;
    if ((id === 'fires' || id === 'events') && this.hazardsFailed) return null;
    return this.staticMarks.get(id)?.length ?? null;
  }

  named(): Mark[] {
    return LAYERS.filter((l) => l.named).flatMap((l) => this.staticMarks.get(l.id) ?? []);
  }

  captured(): number {
    return this.snapshot?.captured ?? 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  /** Stage px per reference px: chrome is laid out against a 900-high frame. */
  private scale(): number {
    return this.h / OH;
  }

  /** Seconds of replay elapsed. Reduced motion freezes the snapshot at its captured instant. */
  private elapsed(): number {
    return this.reduced ? 0 : this.frame / 60;
  }

  private glyph(ctx: CanvasRenderingContext2D, m: Mark, x: number, y: number, color: string): void {
    const r = m.size * this.scale();
    const meta = LAYERS.find((l) => l.id === m.layer)!;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    switch (meta.glyph) {
      case 'ring':
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        return;
      case 'square':
        ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.stroke();
        return;
      case 'diamond':
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.stroke();
        return;
      default:
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  /** Coastlines and the static layers, painted once per size/visibility change. */
  private paintStill(): void {
    const ctx = this.stillCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.coast) {
      ctx.strokeStyle = P.PALETTE.tealDim;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      geoPath(this.projection, ctx)(this.coast);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    for (const l of LAYERS) {
      if (l.id === 'craft' || l.id === 'sats' || !this.visible.has(l.id)) continue;
      for (const m of this.staticMarks.get(l.id) ?? []) {
        const p = this.projection([m.lon, m.lat]);
        if (!p) continue;
        this.glyph(ctx, m, p[0], p[1], m.color ?? l.color);
      }
    }
    ctx.globalAlpha = 1;
    this.stillDirty = false;
  }

  private paint(): void {
    const ctx = this.ctx;
    const snap = this.snapshot;
    if (this.stillDirty) this.paintStill();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#05090c';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(this.still, 0, 0, this.w, this.h);

    // Moving layers, and the hit-test list rebuilt from whatever is on screen this frame.
    this.projected = [];
    const push = (m: Mark) => {
      const p = this.projection([m.lon, m.lat]);
      if (p) this.projected.push({ x: p[0], y: p[1], mark: m });
    };
    if (snap) {
      const t = this.elapsed();
      if (this.visible.has('craft')) for (const m of marksFromCraft(snap.craft, t)) push(m);
      if (this.visible.has('sats')) for (const m of marksFromSats(snap.sats, snap.captured, t)) push(m);
      for (const p of this.projected) this.glyph(ctx, p.mark, p.x, p.y, LAYERS.find((l) => l.id === p.mark.layer)!.color);
      for (const l of LAYERS) {
        if (l.id === 'craft' || l.id === 'sats' || !this.visible.has(l.id)) continue;
        for (const m of this.staticMarks.get(l.id) ?? []) push(m);
      }
    }

    this.paintChrome(ctx);
    this.paintCallouts(ctx);
  }

  private paintChrome(ctx: CanvasRenderingContext2D): void {
    const s = this.scale();
    const ow = this.w / s;
    const f = this.frame;
    ctx.save();
    ctx.scale(s, s);

    P.corners(ctx, 26, 26, ow - 52, OH - 52, 26, P.PALETTE.tealDim);
    P.font(ctx, 20, 600, 0.1);
    P.text(ctx, 'OSIRIS BOARD', 48, 60, P.PALETTE.text);
    P.font(ctx, 9, 400);
    P.text(ctx, 'GLOBAL SITUATION · KONG ATLAS LABS', 48, 78, P.PALETTE.tealDim);

    const captured = this.captured();
    ctx.textAlign = 'right';
    const stamp = new Date(captured + this.elapsed() * 60000);
    P.font(ctx, 10, 500);
    P.text(ctx, `● REC ${stamp.toISOString().slice(0, 19).replace('T', ' ')}Z`, ow - 48, 60, f % 60 < 40 ? P.PALETTE.rose : P.PALETTE.dim);
    P.font(ctx, 9, 400);
    P.text(ctx, `SNAPSHOT ${new Date(captured).toISOString().slice(0, 10)} · REPLAY 60X`, ow - 48, 78, P.PALETTE.tealDim);
    ctx.textAlign = 'left';

    // Left foot: layer channel panel painted from the same registry the DOM checkboxes use.
    P.channelPanel(
      ctx,
      48,
      OH - 88 - LAYERS.length * 18 - 16,
      210,
      LAYERS.map((l) => [`${l.label.toUpperCase()} ${String(this.count(l.id) ?? '—').padStart(5)}`, this.visible.has(l.id)] as [string, boolean]),
      'L01',
    );

    ctx.textAlign = 'center';
    P.font(ctx, 9, 400, 0.14);
    P.text(ctx, 'ADSB.LOL · CELESTRAK · USGS · NASA FIRMS · NASA EONET — SNAPSHOT REPLAY, NO NETWORK', (ow - MAP.right + MAP.left) / 2, OH - 34, P.PALETTE.faint);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private paintCallouts(ctx: CanvasRenderingContext2D): void {
    const s = this.scale();
    const mid = (this.w - MAP.right * s + MAP.left * s) / 2;
    const draw = (p: Projected, strong: boolean) => {
      ctx.save();
      ctx.scale(s, s);
      const x = p.x / s;
      const y = p.y / s;
      if (strong) {
        P.callout(ctx, x, y, p.mark.label, p.mark.lines, p.x > mid ? -1 : 1, 96);
        P.corners(ctx, x - 26, y - 26, 52, 52, 10, P.PALETTE.teal);
      } else {
        ctx.strokeStyle = P.PALETTE.tealDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 6, y - 6, 12, 12);
        P.font(ctx, 8, 400);
        P.text(ctx, p.mark.label, x + 10, y + 3, P.PALETTE.dim);
      }
      ctx.restore();
    };
    if (this.selected) {
      const sel = this.projected.find((p) => p.mark.layer === this.selected!.layer && p.mark.id === this.selected!.id);
      if (sel) draw(sel, true);
    }
    if (this.hovered && this.hovered.mark !== this.selected) draw(this.hovered, false);
  }
}
