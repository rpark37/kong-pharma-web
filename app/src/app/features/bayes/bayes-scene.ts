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
const MARGIN = 32;
const FACET_SPACING = 0.25;
/** Gap between blocks as a share of the cell: crisp separation on a flat-lit paper ground. */
const PADDING = 0.14;
/** Block depth as a share of the edge — deep enough to read as an object under ambient light. */
export const BLOCK_DEPTH = 0.45;

/**
 * The light-surface encoding every 2D element on the page uses (flow bars, icon array, outcome
 * chart): rose = true positive, amber = false positive, teal = negative. Values mirror
 * PALETTE_LIGHT.error / warning and VEGA_COLORS.teal; the neutral is a slate the plates cannot
 * swallow.
 */
const COLORS = {
  person: [0.29, 0.36, 0.4] as [number, number, number], // #4A5D66 slate
  negative: [0.004, 0.502, 0.416] as [number, number, number], // #01806A teal
  positive: [0.6, 0.4, 0] as [number, number, number], // #996600 amber — false positive
  selected: [0.7, 0.15, 0.12] as [number, number, number], // #B3261E rose — true positive
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
  /** 0..1 per block: its place in the morph's start-time wave (bottom-left first). */
  stagger: Float32Array;
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
      stagger: target.stagger,
      depthOf: (size) => Math.max(2, size * BLOCK_DEPTH),
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

/**
 * A grid per facet, each sized to its own blocks, the facets packed into cells sized by their
 * contents and the whole arrangement scaled to fill the plot. Within a row, plates share a
 * baseline (like bars on a shelf) so the titles line up; within a column they are centred.
 */
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

  // Block size (`unit`) is shared across facets — a block is a person, and the morph depends on
  // it — so each facet's grid is just big enough for its own count. Hidden blocks (view 3) do
  // not count; they fade in place.
  const facetKeyOf = (i: number): [number, number] => (index === 3 ? [0, 0] : facetOf(i));
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (!visible[i]) continue;
    const key = facetKeyOf(i).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sideOf = (fx: number, fy: number): number => Math.max(1, Math.ceil(Math.sqrt(counts.get(`${fx},${fy}`) ?? 0)));

  // Cells sized by content: a column is as wide as its widest plate, a row as tall as its tallest.
  const colW = Array.from({ length: facetsX }, (_, fx) => Math.max(...Array.from({ length: facetsY }, (__, fy) => sideOf(fx, fy))));
  const rowH = Array.from({ length: facetsY }, (_, fy) => Math.max(...Array.from({ length: facetsX }, (__, fx) => sideOf(fx, fy))));
  const largest = Math.max(...colW, ...rowH);
  // Units: one grid cell = 1 unit. Text bands above (heading) and below (title) each facet row.
  const textBand = Math.max(2, 0.22 * largest);
  const facets = describeFacets(index, data, config);
  const headingFor = (u: number): number => Math.max(14, Math.min(34, textBand * u * 0.42));
  const fit = (g: number) => {
    const totalW = colW.reduce((a, b) => a + b, 0) + (facetsX - 1) * g;
    const totalH = rowH.reduce((a, b) => a + b, 0) + (facetsY - 1) * (g + 2 * textBand) + 2 * textBand;
    return { totalW, totalH, unit: Math.min((BAYES_PLOT.width - 2 * MARGIN) / totalW, (BAYES_PLOT.height - 2 * MARGIN) / totalH) };
  };
  let gap = Math.max(1.5, FACET_SPACING * largest);
  let { totalW, totalH, unit } = fit(gap);
  if (facetsX > 1) {
    // Labels are centred on their plates, so a narrow column's text can reach across the gap into
    // its neighbour. Widen the gap until the widest labels of adjacent columns clear each other,
    // then refit; text is sized from `unit`, so one pass is enough (it only shrinks on refit).
    const h = headingFor(unit), t = h * 0.72;
    const widest = (fx: number): number => Math.max(0, ...facets.filter((f) => f.fx === fx).map((f) => Math.max(f.heading.length * 0.5 * h, f.title.length * 0.5 * t)));
    const need = (widest(0) + widest(1)) / 2 / unit - (colW[0] + colW[1]) / 2 + 1;
    if (need > gap) { gap = need; ({ totalW, totalH, unit } = fit(gap)); }
  }
  const gapY = gap + 2 * textBand;
  const originX = (BAYES_PLOT.width - totalW * unit) / 2;
  const originY = (BAYES_PLOT.height - totalH * unit) / 2 + textBand * unit; // bottom of the lowest row
  /** Bottom-left of a facet's cell. Rows are indexed top-down, so the bottom row is `facetsY - 1`. */
  const cellOrigin = (fx: number, fy: number): [number, number] => {
    let x = originX;
    for (let c = 0; c < fx; c++) x += (colW[c] + gap) * unit;
    let y = originY;
    for (let r = facetsY - 1; r > fy; r--) y += (rowH[r] + gapY) * unit;
    return [x, y];
  };
  /** Bottom-left of a facet's block grid: centred in its column, sitting on its row's baseline. */
  const gridOrigin = (fx: number, fy: number, sideF: number): [number, number] => {
    const [x, y] = cellOrigin(fx, fy);
    return [x + ((colW[fx] - sideF) * unit) / 2, y];
  };

  // Order within each facet follows id order (as FacetHelper.split does).
  const counters = new Map<string, number>();
  const positions = new Float32Array(n * 3);
  const [hx, hy] = gridOrigin(0, 0, side);
  for (let i = 0; i < n; i++) {
    positions[i * 3 + 2] = BAYES_PLOT.depth / 2;
    if (!visible[i]) {
      // Hidden blocks park on the full grid so they do not fly anywhere while they fade.
      positions[i * 3] = hx + ((i % side) + 0.5) * unit;
      positions[i * 3 + 1] = hy + (Math.floor(i / side) + 0.5) * unit;
      continue;
    }
    const [fx, fy] = facetKeyOf(i);
    const key = `${fx},${fy}`;
    const sideF = sideOf(fx, fy);
    const k = counters.get(key) ?? 0;
    counters.set(key, k + 1);
    const [gx, gy] = gridOrigin(fx, fy, sideF);
    positions[i * 3] = gx + ((k % sideF) + 0.5) * unit;
    positions[i * 3 + 1] = gy + (Math.floor(k / sideF) + 0.5) * unit;
  }

  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let c = COLORS.person;
    if (index >= 2) c = data.truePositiveIds.has(i) ? COLORS.selected : data.positiveTest[i] ? COLORS.positive : COLORS.negative;
    colors.set(c, i * 3);
  }

  // Start-time wave: blocks leave in order of where they are going, bottom-left first, so a morph
  // reads as a sweep across the plot rather than as noise.
  const stagger = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = positions[i * 3] + positions[i * 3 + 1];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi > lo ? hi - lo : 1;
  for (let i = 0; i < n; i++) stagger[i] = (positions[i * 3] + positions[i * 3 + 1] - lo) / span;

  const texts: TextItem[] = [];
  const plates: Plate[] = [];
  const headingSize = headingFor(unit);
  const titleSize = headingSize * 0.72;
  for (const f of facets) {
    const sideF = sideOf(f.fx, f.fy);
    const [gx, gy] = gridOrigin(f.fx, f.fy, sideF);
    const cx = gx + (sideF * unit) / 2;
    const cy = gy + (sideF * unit) / 2;
    // The plate fits the facet's own grid; heading and title hang off the plate, not the cell.
    const plate = sideF * unit + unit * 0.5;
    plates.push({ x: cx, y: cy, w: plate, h: plate });
    texts.push({ x: cx, y: cy + plate / 2 + textBand * unit * 0.5, text: f.heading, size: headingSize });
    texts.push({ x: cx, y: cy - plate / 2 - textBand * unit * 0.45, text: f.title, size: titleSize });
  }
  return { positions, size: unit * (1 - PADDING), visible, colors, texts, plates, stagger };
}

function people(n: number): string { return `${n} ${n === 1 ? 'person' : 'people'}`; }
function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? '' : 's'}`; }

function describeFacets(index: number, data: BayesData, config: FormConfig): Facet[] {
  const se = Math.round(config.sensitivity * 100), sp = Math.round(config.specificity * 100), prior = (config.prior * 100).toFixed(1);
  switch (index) {
    // Facet titles carry the count only: the rates and totals already sit in the readout strip
    // and the flow bars, and a small facet cannot carry a sentence beside its neighbour.
    case 1:
      return [
        { fx: 0, fy: 0, heading: 'disease', title: `${people(data.diseaseTotal)} · ${prior}%` },
        { fx: 1, fy: 0, heading: 'healthy', title: people(data.healthyTotal) },
      ];
    case 2:
      return [
        { fx: 0, fy: 0, heading: 'disease, positive test', title: `${plural(data.truePositiveIds.size, 'true positive')} · ${se}% sensitive` },
        { fx: 1, fy: 0, heading: 'healthy, positive test', title: plural(data.falsePositiveIds.size, 'false positive') },
        { fx: 0, fy: 1, heading: 'disease, negative test', title: plural(data.falseNegativeIds.size, 'false negative') },
        { fx: 1, fy: 1, heading: 'healthy, negative test', title: `${plural(data.trueNegativeIds.size, 'true negative')} · ${sp}% specific` },
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
  const depth = Math.max(2, layout.size * BLOCK_DEPTH);
  const W = BAYES_PLOT.width, H = BAYES_PLOT.height, D = BAYES_PLOT.depth;
  const fov = 40;
  const distance = Math.max(H / (2 * Math.tan((fov * Math.PI) / 360)), W / (2 * 1.6 * Math.tan((fov * Math.PI) / 360))) * 0.95;
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
      { name: 'units', type: 'rect', geometry: 'box', material: 'glossy', from: { data: 'units' }, encode: { enter: { xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { field: 'zc' }, width: { field: 'size' }, height: { field: 'size' }, depth: { value: depth }, fuzz: { value: 0.1 }, fill: { color: { r: { field: 'r' }, g: { field: 'g' }, b: { field: 'b' } } } } } },
      { type: 'rect', geometry: 'xyrect', material: 'diffuse', from: { data: 'plates' }, encode: { enter: { xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { value: D / 2 - depth }, width: { field: 'width' }, height: { field: 'height' }, fill: { value: '#E4E4E1' } } } },
      { type: 'text', from: { data: 'texts' }, encode: { enter: { x: { field: 'x' }, y: { field: 'y' }, z: { value: D / 2 + 2 }, text: { field: 'text' }, fontSize: { field: 'size' }, font: { value: 'Rajdhani' }, fontWeight: { value: 600 }, align: { value: 'center' }, baseline: { value: 'middle' }, fill: { value: '#2D2D2D' } } } },
      { type: 'rect', geometry: 'xyrect', material: 'diffuse', encode: { enter: { xc: { value: W / 2 }, yc: { value: H / 2 }, zc: { value: -D }, width: { value: W * 4 }, height: { value: H * 4 }, fill: { value: '#E8E8E6' } } } },
    ],
  };
}
