/**
 * The therapeutic-tests visualization on the current MorphCharts (spec-driven, WebGPU path
 * traced). Every person is a block; the four views are layouts computed here and written to the
 * mark buffer, so a view change morphs blocks with a GSAP cubic ease and per-block staggering
 * (like the original MorphCharts transition buffers, but under our control).
 *
 * Analogy: the spec describes the stage and the props; this class is the choreographer telling
 * each block where to stand for the next scene, and when to start walking.
 */
import { type MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { MorphController } from '../../shared/morphcharts/morph-controller';
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

export class BayesScene {
  private readonly morph: MorphController;
  layoutIndex = 0;
  reducedMotion = false;
  set onTransitionEnd(fn: (() => void) | null) { this.morph.onTransitionEnd = fn; }
  get isTransitioning(): boolean { return this.morph.isTransitioning; }

  constructor(readonly host: MorphChartsHost) {
    this.morph = new MorphController(host);
  }

  /** Lay out a view. With `transition`, morph from the current view using config's duration and staggering. */
  async layout(index: number, data: BayesData, config: FormConfig, transition: boolean): Promise<void> {
    const target = computeLayout(index, data, config);
    if (!transition) this.morph.reset();
    this.layoutIndex = index;
    // Convergence budget for the still frame the morph settles into.
    this.host.maxSamplesPerPixel = 600;
    await this.morph.to(buildSpec(target, data.ids.length), target, data.ids.length, {
      durationMs: config.transitionDuration,
      staggerMs: config.transitionStaggering,
      stagger: data.random,
      reducedMotion: this.reducedMotion,
    });
  }

  resetCamera(): void {
    this.host.resetCamera();
    this.host.renderer.frameCount = 0;
    if (!this.host.running() && this.host.hasMarks()) this.host.start();
  }

  dispose(): void {
    this.morph.dispose();
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
    // No lights: ambient-only (the spec's default, white) gives flat, even illumination with no cast
    // shadows, so the blocks read as an icon array rather than as lit objects.
    camera: { worldPosition: [W / 2, H / 2, D / 2 + distance], worldTarget: [W / 2, H / 2, D / 2], fov },
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
