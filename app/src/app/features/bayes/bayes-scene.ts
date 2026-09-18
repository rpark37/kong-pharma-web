/**
 * The therapeutic-tests visualization on the current MorphCharts (spec-driven, WebGPU path
 * traced). Every person is a block; the four views are layouts computed here and written to the
 * mark buffer, so a view change morphs blocks with a GSAP Quad ease and per-block staggering
 * (like the original MorphCharts transition buffers, but under our control).
 *
 * Analogy: the spec describes the stage and the props; this class is the choreographer telling
 * each block where to stand for the next scene, and when to start walking.
 */
import { gsap } from 'gsap';
import { Core, type MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { LAYOUT_NAMES, type BayesData, type FormConfig } from './bayes-data.model';

export const BAYES_PLOT = { width: 1600, height: 1000, depth: 80 } as const;
const MARGIN = 60;
const FACET_SPACING = 0.25;
const PADDING = 0.1;

const COLORS = {
  person: [0.69, 0.78, 0.81] as [number, number, number], // #b0c8ce
  negative: [0.27, 0.88, 0.8] as [number, number, number], // #44e0cc teal
  positive: [0.94, 0.48, 0.54] as [number, number, number], // #ef7a8a rose
  selected: [0.95, 0.76, 0.31] as [number, number, number], // #f2c14e amber
};

interface Facet { fx: number; fy: number; heading: string; title: string; }
interface TextItem { x: number; y: number; text: string; size: number; }
interface Plate { x: number; y: number; w: number; h: number; }

export interface LayoutResult {
  positions: Float32Array; // N * 3, plot mm
  size: number; // block edge, mm
  visible: Uint8Array;
  colors: Float32Array; // N * 3
  texts: TextItem[];
  plates: Plate[];
}

const quadInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class BayesScene {
  private buffer: Core.Buffer | null = null;
  private base = new Float32Array(0);
  private scaling = 1;
  private current: LayoutResult | null = null;
  private progress = { t: 0 };
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  layoutIndex = 0;
  reducedMotion = false;
  onTransitionEnd: (() => void) | null = null;
  get isTransitioning(): boolean { return gsap.isTweening(this.progress); }

  constructor(readonly host: MorphChartsHost) {}

  /** Lay out a view. With `transition`, morph from the current view using config's duration and staggering. */
  async layout(index: number, data: BayesData, config: FormConfig, transition: boolean): Promise<void> {
    const target = computeLayout(index, data, config);
    const start = transition && this.current && this.current.positions.length === target.positions.length ? this.current : null;
    gsap.killTweensOf(this.progress);
    await this.host.loadSpec(buildSpec(target, data.ids.length), { includeCamera: !this.current });
    this.layoutIndex = index;
    this.current = target;
    this.buffer = (this.host.scene?.buffers ?? []).find((b) => b.length === data.ids.length) as Core.Buffer | undefined ?? null;
    const plot = this.host.plot!;
    this.scaling = plot.size / Math.max(plot.width, plot.height, plot.depth);
    const n = data.ids.length;
    this.base = new Float32Array(n * 3);
    if (this.buffer) {
      const v: Core.Vector3 = [0, 0, 0];
      for (let i = 0; i < n; i++) { Core.UnitVertex.getTranslation(this.buffer.dataView, i, v); this.base.set(v, i * 3); }
    }
    this.host.renderer.frameCount = 0;
    this.host.maxSamplesPerPixel = 600;
    if (!start || this.reducedMotion || config.transitionDuration + config.transitionStaggering <= 0) {
      this.write(target, target, 1, data, config);
      this.settle();
      this.onTransitionEnd?.();
      return;
    }
    this.startMotion();
    this.progress.t = 0;
    this.write(start, target, 0, data, config);
    gsap.to(this.progress, {
      t: 1,
      duration: (config.transitionDuration + config.transitionStaggering) / 1000,
      ease: 'none', // each block applies its own quad.inOut inside its staggered window
      onUpdate: () => this.write(start, target, this.progress.t, data, config),
      onComplete: () => { this.settle(); this.onTransitionEnd?.(); },
    });
  }

  resetCamera(): void {
    this.host.resetCamera();
    this.host.renderer.frameCount = 0;
    this.ensureRunning();
  }

  dispose(): void {
    gsap.killTweensOf(this.progress);
    if (this.settleTimer) clearTimeout(this.settleTimer);
  }

  /** Write interpolated translations, scales and colours for global progress t in [0,1]. */
  private write(start: LayoutResult, target: LayoutResult, t: number, data: BayesData, config: FormConfig): void {
    if (!this.buffer) return;
    const dv = this.buffer.dataView;
    const total = config.transitionDuration + config.transitionStaggering;
    const window = total > 0 ? config.transitionDuration / total : 1;
    const staggerSpan = total > 0 ? config.transitionStaggering / total : 0;
    const n = data.ids.length;
    const v: Core.Vector3 = [0, 0, 0];
    const s = this.scaling;
    const startSize = start.size * s;
    const targetSize = target.size * s;
    const depth = Math.max(2, target.size * 0.35) * s;
    for (let i = 0; i < n; i++) {
      const delay = data.random[i] * staggerSpan;
      const p = t >= 1 ? 1 : window > 0 ? quadInOut(Math.min(1, Math.max(0, (t - delay) / window))) : 1;
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
      const sz3 = Math.max(1e-6, size);
      Core.UnitVertex.setScale(dv, i, [sz3, sz3, size > 0 ? depth : 1e-6]);
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

  private settle(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => { this.host.renderer.renderMode = 'raytrace'; this.host.renderer.frameCount = 0; this.ensureRunning(); }, 250);
  }

  private ensureRunning(): void {
    if (!this.host.running() && this.host.hasMarks()) this.host.start();
  }
}

/** Sheet-style grid per facet, facets spaced apart, everything scaled to fit the plot. */
export function computeLayout(index: number, data: BayesData, config: FormConfig): LayoutResult {
  const n = data.ids.length;
  const side = Math.max(1, Math.ceil(Math.sqrt(config.count)));
  const facetsX = index === 1 || index === 2 ? 2 : 1;
  const facetsY = index === 2 ? 2 : 1;
  const facetOf = (i: number): [number, number] => {
    if (index === 1) return [1 - data.disease[i], 0];
    if (index === 2) return [1 - data.disease[i], 1 - data.positiveTest[i]]; // fy 0 = top row
    return [0, 0];
  };
  const visible = new Uint8Array(n);
  for (let i = 0; i < n; i++) visible[i] = index === 3 ? data.positiveTest[i] : 1;

  // Units: one grid cell = 1 unit. Text bands above (heading) and below (title) each facet row.
  const textBand = 0.22 * side;
  const facetW = side, facetH = side;
  const gapX = FACET_SPACING * side, gapY = FACET_SPACING * side + 2 * textBand;
  const totalW = facetsX * facetW + (facetsX - 1) * gapX;
  const totalH = facetsY * facetH + (facetsY - 1) * gapY + 2 * textBand;
  const unit = Math.min((BAYES_PLOT.width - 2 * MARGIN) / totalW, (BAYES_PLOT.height - 2 * MARGIN) / totalH);
  const originX = (BAYES_PLOT.width - totalW * unit) / 2;
  const originY = (BAYES_PLOT.height - totalH * unit) / 2 + textBand * unit; // bottom of the lowest facet grid
  const facetOrigin = (fx: number, fy: number): [number, number] => [originX + fx * (facetW + gapX) * unit, originY + (facetsY - 1 - fy) * (facetH + gapY) * unit];

  // Order within each facet follows id order (as FacetHelper.split does).
  const counters = new Map<string, number>();
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [fx, fy] = facetOf(i);
    const key = `${fx},${fy}`;
    const k = counters.get(key) ?? 0;
    counters.set(key, k + 1);
    const col = k % side, row = Math.floor(k / side);
    const [ox, oy] = facetOrigin(fx, fy);
    positions[i * 3] = ox + (col + 0.5) * unit;
    positions[i * 3 + 1] = oy + (row + 0.5) * unit;
    positions[i * 3 + 2] = BAYES_PLOT.depth / 2;
  }
  if (index === 3) {
    // Positives only: re-pack the visible blocks into one grid.
    let k = 0;
    const [ox, oy] = facetOrigin(0, 0);
    for (let i = 0; i < n; i++) {
      if (!visible[i]) continue;
      positions[i * 3] = ox + ((k % side) + 0.5) * unit;
      positions[i * 3 + 1] = oy + (Math.floor(k / side) + 0.5) * unit;
      k++;
    }
  }

  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let c = COLORS.person;
    if (index >= 2) c = data.truePositiveIds.has(i) ? COLORS.selected : data.positiveTest[i] ? COLORS.positive : COLORS.negative;
    colors.set(c, i * 3);
  }

  const facets = describeFacets(index, data, config);
  const texts: TextItem[] = [];
  const plates: Plate[] = [];
  const headingSize = Math.max(14, Math.min(34, textBand * unit * 0.42));
  const titleSize = headingSize * 0.72;
  for (const f of facets) {
    const [ox, oy] = facetOrigin(f.fx, f.fy);
    const cx = ox + (facetW * unit) / 2;
    plates.push({ x: cx, y: oy + (facetH * unit) / 2, w: facetW * unit + unit * 0.5, h: facetH * unit + unit * 0.5 });
    texts.push({ x: cx, y: oy + facetH * unit + textBand * unit * 0.5, text: f.heading, size: headingSize });
    texts.push({ x: cx, y: oy - textBand * unit * 0.45, text: f.title, size: titleSize });
  }
  return { positions, size: unit * (1 - PADDING), visible, colors, texts, plates };
}

function people(n: number): string { return `${n} ${n === 1 ? 'person' : 'people'}`; }
function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? '' : 's'}`; }

function describeFacets(index: number, data: BayesData, config: FormConfig): Facet[] {
  const se = Math.round(config.sensitivity * 100), sp = Math.round(config.specificity * 100), prior = (config.prior * 100).toFixed(1);
  switch (index) {
    case 1:
      return [
        { fx: 0, fy: 0, heading: 'disease', title: `${people(data.diseaseTotal)} (${config.count} total, ${prior}% with disease)` },
        { fx: 1, fy: 0, heading: 'healthy', title: people(data.healthyTotal) },
      ];
    case 2:
      return [
        { fx: 0, fy: 0, heading: 'disease, positive test', title: `${plural(data.truePositiveIds.size, 'true positive')} (${data.diseaseTotal} with disease, ${se}% sensitive)` },
        { fx: 1, fy: 0, heading: 'healthy, positive test', title: plural(data.falsePositiveIds.size, 'false positive') },
        { fx: 0, fy: 1, heading: 'disease, negative test', title: plural(data.falseNegativeIds.size, 'false negative') },
        { fx: 1, fy: 1, heading: 'healthy, negative test', title: `${plural(data.trueNegativeIds.size, 'true negative')} (${data.healthyTotal} healthy, ${sp}% specific)` },
      ];
    case 3: {
      const totalPositive = data.truePositiveIds.size + data.falsePositiveIds.size;
      const probability = totalPositive > 0 ? (100 * data.truePositiveIds.size) / totalPositive : 0;
      const ratio = data.truePositiveIds.size > 0 ? Math.round(totalPositive / data.truePositiveIds.size) : 0;
      return [{ fx: 0, fy: 0, heading: `Probability of disease for positive test is ${data.truePositiveIds.size}÷${totalPositive} = ${probability.toFixed(1)}% (~1 in ${ratio})`, title: `${plural(totalPositive, 'positive test')} (${plural(data.truePositiveIds.size, 'true positive')}, ${plural(data.falsePositiveIds.size, 'false positive')})` }];
    }
    default:
      return [{ fx: 0, fy: 0, heading: `${prior}% have a disease, for which a test is ${se}% sensitive and ${sp}% specific`, title: people(config.count) }];
  }
}

/** MorphCharts spec for a layout: blocks, facet plates, headings and titles. */
export function buildSpec(layout: LayoutResult, count: number): Record<string, unknown> {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push({ id: i, xc: layout.positions[i * 3], yc: layout.positions[i * 3 + 1], zc: layout.positions[i * 3 + 2], size: layout.visible[i] ? layout.size : 0.001, r: Math.round(layout.colors[i * 3] * 255), g: Math.round(layout.colors[i * 3 + 1] * 255), b: Math.round(layout.colors[i * 3 + 2] * 255) });
  }
  const depth = Math.max(2, layout.size * 0.35);
  const W = BAYES_PLOT.width, H = BAYES_PLOT.height, D = BAYES_PLOT.depth;
  const fov = 40;
  const distance = Math.max(H / (2 * Math.tan((fov * Math.PI) / 360)), W / (2 * 1.6 * Math.tan((fov * Math.PI) / 360))) * 1.12;
  return {
    title: LAYOUT_NAMES[0],
    width: W, height: H, depth: D,
    background: '#F5F5F3',
    ambient: '#1a2731',
    camera: { worldPosition: [W / 2, H / 2, D / 2 + distance], worldTarget: [W / 2, H / 2, D / 2], fov },
    lights: [
      { type: 'directional', direction: [-0.3, -0.6, -1], brightness: 2.0, color: '#f4f8ff' },
      { type: 'rect', position: [W * 0.2, H * 1.3, D + 900], brightness: 2.2, size: 700, color: '#e6f6f3' },
    ],
    data: [
      { name: 'units', values },
      { name: 'plates', values: layout.plates.map((p) => ({ xc: p.x, yc: p.y, width: p.w, height: p.h })) },
      { name: 'texts', values: layout.texts.map((t) => ({ x: t.x, y: t.y, text: t.text, size: t.size })) },
    ],
    marks: [
      { name: 'units', type: 'rect', geometry: 'box', material: 'glossy', from: { data: 'units' }, encode: { enter: { xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { field: 'zc' }, width: { field: 'size' }, height: { field: 'size' }, depth: { value: depth }, fuzz: { value: 0.25 }, fill: { color: { r: { field: 'r' }, g: { field: 'g' }, b: { field: 'b' } } } } } },
      { type: 'rect', geometry: 'xyrect', material: 'diffuse', from: { data: 'plates' }, encode: { enter: { xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { value: D / 2 - depth }, width: { field: 'width' }, height: { field: 'height' }, fill: { value: '#E8E8E6' } } } },
      { type: 'text', from: { data: 'texts' }, encode: { enter: { x: { field: 'x' }, y: { field: 'y' }, z: { value: D / 2 + 2 }, text: { field: 'text' }, fontSize: { field: 'size' }, align: { value: 'center' }, baseline: { value: 'middle' }, fill: { value: '#2D2D2D' } } } },
      { type: 'rect', geometry: 'xyrect', material: 'diffuse', encode: { enter: { xc: { value: W / 2 }, yc: { value: H / 2 }, zc: { value: -D }, width: { value: W * 4 }, height: { value: H * 4 }, fill: { value: '#E8E8E6' } } } },
    ],
  };
}
