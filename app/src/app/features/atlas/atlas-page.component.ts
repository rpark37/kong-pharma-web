import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { MorphchartsCameraComponent } from '../../shared/morphcharts/morphcharts-camera.component';
import type { CameraRig } from '../../shared/morphcharts/camera-rig';
import { GlyphComponent } from '../../shared/ui/glyph.component';
import { ThemeService } from '../../shared/theme/theme.service';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { environment } from '../../../environments/environment';
import { DEFAULT_VISIBLE, EXPLANATIONS, SYSTEMS, explanation, type AtlasCatalogue, type ChunkInfo, type Concept, type Part, type SystemId, type View } from './anatomy';
import { RENDER_PRESETS, type AnatomyViewer, type RenderPreset, type RenderStatus } from './anatomy-viewer';
import type { AtlasScene } from './atlas-scene';
import { atlasTreemapSpec } from './atlas-fallback-spec';
import { readQuery, writeQuery } from '../../shared/url-state';

const ORGANS: SystemId[] = ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'];
const DEFAULT_SEARCH = ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'urinary bladder', 'trachea'];

/**
 * Human Atlas, reinterpreted as data: 2,234 BodyParts3D structures rendered by MorphCharts as
 * spec-driven primitives. The controls follow ashemag/human-atlas — systems, search, views,
 * explode, detail and about sheets — in the app's instrument vocabulary: a mixer-style systems
 * panel (row toggles, solo keys), a command-palette search, and the shared camera panel in
 * Data mode. Anatomy mode keeps its own three.js camera and view keys.
 */
@Component({
  selector: 'app-atlas-page',
  imports: [DecimalPipe, MorphchartsCanvasComponent, MorphchartsCameraComponent, WebGpuFallbackComponent, GlyphComponent, VegaChartComponent],
  templateUrl: './atlas-page.component.html',
  styleUrl: './atlas-page.component.scss',
})
export class AtlasPageComponent {
  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly theme = inject(ThemeService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly stage = viewChild<ElementRef<HTMLDivElement>>('stage');
  readonly findKey = viewChild<ElementRef<HTMLButtonElement>>('findKey');
  readonly anatomyHost = viewChild<ElementRef<HTMLDivElement>>('anatomyHost');
  /** 'anatomy' = real BodyParts3D meshes in three.js; 'data' = MorphCharts spec of the catalogue. */
  readonly mode = signal<'anatomy' | 'data'>('anatomy');
  readonly chunks = signal<ChunkInfo[]>([]);
  readonly viewerError = signal('');
  readonly resetCounter = signal(0);

  readonly systems = SYSTEMS;
  readonly parts = signal<Part[]>([]);
  readonly concepts = signal<Concept[]>([]);
  readonly catalogue = signal<AtlasCatalogue | null>(null);
  readonly progress = signal(0);
  readonly error = signal('');
  readonly fallback = signal<string | null>(null);
  readonly ready = signal(false);

  readonly visible = signal<SystemId[]>(DEFAULT_VISIBLE);
  readonly selected = signal<string[]>([]);
  readonly isolate = signal(false);
  readonly explode = signal(0);
  readonly view = signal<View>('three-quarter');
  readonly rotate = signal(false);
  readonly panel = signal<'layers' | 'search' | null>(null);
  readonly details = signal(false);
  readonly about = signal(false);
  readonly query = signal('');
  /** Keyboard cursor in the search results. */
  readonly cursor = signal(0);
  readonly chosen = signal<Concept | null>(null);
  /** Data mode's camera controls, once the scene exists. */
  readonly rig = signal<CameraRig | null>(null);

  readonly partsById = computed(() => new Map(this.parts().map((p) => [p.id, p])));
  readonly counts = computed(() => { const c: Record<string, number> = {}; for (const p of this.parts()) c[p.system] = (c[p.system] ?? 0) + 1; return c; });
  readonly activeSystems = computed(() => SYSTEMS.filter((s) => (this.counts()[s.id] ?? 0) > 0));
  readonly selectedParts = computed(() => this.selected().map((id) => this.partsById().get(id)).filter((p): p is Part => !!p));
  readonly selectedPart = computed(() => this.selectedParts()[0] ?? null);
  readonly selectedSystem = computed(() => SYSTEMS.find((s) => s.id === this.selectedPart()?.system) ?? null);
  readonly visibleIds = computed(() => {
    const vis = new Set(this.visible());
    const sel = new Set(this.selected());
    const iso = this.isolate();
    return new Set(this.parts().filter((p) => (iso ? sel.has(p.id) : vis.has(p.system) || sel.has(p.id))).map((p) => p.id));
  });
  readonly visibleCount = computed(() => this.visibleIds().size);
  readonly results = computed(() => {
    const term = this.query().toLowerCase().trim();
    const all = this.concepts();
    if (!term) return DEFAULT_SEARCH.map((n) => all.find((c) => c.name.toLowerCase() === n)).filter((c): c is Concept => !!c);
    return all.filter((c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)).sort((a, b) => a.name.length - b.name.length).slice(0, 80);
  });
  /** The stage's accessible name: what is on screen, and what is selected. */
  readonly sceneLabel = computed(() => {
    const sel = this.chosen()?.name;
    const base = `Human Atlas, adult male reference anatomy, ${this.activeSystems().length || 15} systems, ${(this.parts().length || 2234).toLocaleString()} pieces, ${this.mode() === 'anatomy' ? 'meshes' : 'bounding boxes'}`;
    return sel ? `${base}; ${sel} selected` : base;
  });
  /** The palette takes focus when opened on pointer-fine devices only; on a phone the keyboard would cover the results. */
  private readonly finePointer = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  readonly caption = computed(() => this.isolate() ? (this.chosen()?.name ?? 'SELECTED STRUCTURE').toUpperCase() : this.explode() > 0.95 ? 'ANATOMICAL INVENTORY' : this.explode() > 0.05 ? 'SEPARATED STRUCTURES' : 'ADULT HUMAN · MALE');
  readonly explanationText = computed(() => { const c = this.chosen(); const p = this.selectedPart(); return c && p ? explanation(c.name, p.system) : ''; });
  readonly hasExplanation = computed(() => !!EXPLANATIONS[(this.chosen()?.name ?? '').toLowerCase()]);
  readonly allVisible = computed(() => this.activeSystems().every((s) => this.visible().includes(s.id)));
  /** The one system showing alone, if any: its solo key lights. */
  readonly soloed = computed(() => (this.visible().length === 1 ? this.visible()[0] : null));
  /** Bounding box of the selection in centimetres, the only size the catalogue knows. */
  readonly selectedExtent = computed(() => {
    const parts = this.selectedParts();
    if (!parts.length) return '';
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const p of parts) {
      const c = [p.cx, p.cy, p.cz], h = [p.sx / 2, p.sy / 2, p.sz / 2];
      for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - h[i]); max[i] = Math.max(max[i], c[i] + h[i]); }
    }
    const cm = (i: number) => Math.max(1, Math.round((max[i] - min[i]) * 100));
    return `${cm(0)} × ${cm(1)} × ${cm(2)} cm`;
  });
  readonly skeletonOnly = computed(() => this.visible().length === 1 && this.visible()[0] === 'skeletal');
  readonly organsOnly = computed(() => this.visible().length === ORGANS.length && ORGANS.every((id) => this.visible().includes(id)));
  readonly fallbackSpec = computed(() => (this.parts().length ? atlasTreemapSpec(this.parts()) : null));
  readonly renderPresets = RENDER_PRESETS;
  /** Anatomy mode's renderer; path-traced presets are for comparing conditions, raster is the default. */
  readonly renderPreset = signal<RenderPreset>('raster');
  readonly renderStatus = signal<string>('');
  readonly views: Array<{ id: View; code: string; name: string }> = [{ id: 'three-quarter', code: '¾', name: 'Three-quarter' }, { id: 'front', code: 'FRONT', name: 'Front' }, { id: 'side', code: 'SIDE', name: 'Side' }, { id: 'back', code: 'BACK', name: 'Back' }];

  private host: MorphChartsHost | null = null;
  private scene: AtlasScene | null = null;
  private viewer: AnatomyViewer | null = null;
  private readonly explodeAnim = { t: 0 };
  private resize: ResizeObserver | null = null;
  private tapStart: { x: number; y: number } | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); this.openPanel('search'); }
    if (e.key === 'Escape') { if (this.panel() === 'search') this.closeSearch(); else this.panel.set(null); this.details.set(false); this.about.set(false); }
  };

  constructor() {
    this.restoreFromUrl();
    // `?mode=data&select=FMA7088` links to a mode and a selection: a concept id when the selection
    // is a whole concept, otherwise the part ids. Defaults leave the URL bare.
    effect(() => {
      const mode = this.mode(), sel = this.selected(), view = this.view(), explode = Math.round(this.explode() * 100);
      const concept = this.concepts().find((c) => c.elements.length === sel.length && c.elements.every((e) => sel.includes(e)));
      const render = this.renderPreset();
      writeQuery({ mode: mode === 'data' ? mode : null, select: !sel.length ? null : concept ? concept.id : sel.join(','), view: view === 'three-quarter' ? null : view, explode: explode > 0 ? explode : null, render: render === 'raster' ? null : render });
    });
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      window.addEventListener('keydown', this.onKey);
      void this.loadCatalogue();
    });
    this.destroyRef.onDestroy(() => { window.removeEventListener('keydown', this.onKey); this.scene?.dispose(); this.resize?.disconnect(); this.viewer?.dispose(); this.gsap.kill(this.explodeAnim); });

    // three.js viewer lifecycle: mount when in anatomy mode and the catalogue is loaded.
    effect(() => {
      const host = this.anatomyHost()?.nativeElement;
      const parts = this.parts();
      const chunks = this.chunks();
      const mode = this.mode();
      untracked(() => {
        if (mode !== 'anatomy' || !host || !parts.length || !chunks.length) { if (this.viewer && (mode !== 'anatomy' || !host)) { this.viewer.dispose(); this.viewer = null; } return; }
        if (!this.viewer) void this.mountViewer(host, parts, chunks);
      });
    });
    effect(() => {
      const state = { visible: this.visible(), selected: this.selected(), isolate: this.isolate(), view: this.view(), rotate: this.rotate(), reset: this.resetCounter(), inspectorOpen: this.details() && this.selectedParts().length > 0 };
      untracked(() => this.viewer?.setState(state));
    });
    // The data view bakes the paper colour into its spec, so a theme change rebuilds the scene.
    effect(() => {
      this.theme.theme();
      untracked(() => { if (this.scene) { this.scene.dispose(); this.scene = null; void this.buildScene(); } });
    });
    // Scene reactions
    effect(() => { const ids = this.visibleIds(); untracked(() => { if (this.scene) { this.scene.setVisibility(ids); this.scene.updateLayout(ids); } }); });
    effect(() => { const sel = new Set(this.selected()); untracked(() => this.scene?.setSelection(sel)); });
    effect(() => { const rot = this.rotate(); untracked(() => this.scene?.rig.setOrbit(rot)); });
    effect(() => {
      const open = this.details() && this.selectedParts().length > 0;
      untracked(() => { const sheet = this.el.nativeElement.querySelector('.detail-sheet'); if (sheet) open ? this.gsap.slideIn(sheet, 'right').then(() => this.focusTitle(sheet)) : this.gsap.slideOut(sheet, 'right'); });
    });
    effect(() => {
      const open = this.about();
      untracked(() => { const sheet = this.el.nativeElement.querySelector('.about-sheet'); if (sheet) open ? this.gsap.slideIn(sheet, 'right').then(() => this.focusTitle(sheet)) : this.gsap.slideOut(sheet, 'right'); });
    });
    effect(() => {
      const p = this.panel();
      untracked(() => { const search = this.el.nativeElement.querySelector('.search-panel'); if (search && p === 'search') this.gsap.slideIn(search, 'top'); });
    });
  }

  private restoreFromUrl(): void {
    const q = readQuery();
    if (q.get('mode') === 'data') this.mode.set('data');
    const ids = (q.get('select') ?? '').split(',').filter((id) => /^[A-Z]+\d+$/.test(id));
    if (ids.length) { this.selected.set(ids); this.details.set(true); }
    const view = q.get('view');
    if (view && this.views.some((v) => v.id === view)) this.view.set(view as View);
    const explode = Number(q.get('explode'));
    if (Number.isFinite(explode) && explode > 0 && explode <= 100) { this.explode.set(explode / 100); this.explodeAnim.t = explode / 100; }
    const render = q.get('render');
    if (render && RENDER_PRESETS.some((p) => p.id === render)) this.renderPreset.set(render as RenderPreset);
  }

  private async loadCatalogue(): Promise<void> {
    try {
      this.progress.set(10);
      const [cat, concepts] = await Promise.all([
        firstValueFrom(this.http.get<AtlasCatalogue>('data/atlas/parts.json')),
        firstValueFrom(this.http.get<Array<[string, string, string[]]>>('data/atlas/concepts.json')),
      ]);
      this.progress.set(60);
      this.catalogue.set(cat);
      this.parts.set(cat.parts.map(([id, name, conceptId, system, cx, cy, cz, sx, sy, sz, geom]) => ({ id, name, conceptId, system, cx, cy, cz, sx, sy, sz, geom })));
      this.concepts.set(concepts.map(([id, name, elements]) => ({ id, name, elements })));
      this.chunks.set(cat.chunks ?? []);
      // A selection restored from the URL resolves once the catalogue is here: a concept id expands
      // to its parts, part ids get their concept name, unknown ids are dropped.
      const sel = this.selected();
      if (sel.length && !this.chosen()) {
        const concept = this.concepts().find((c) => (sel.length === 1 && c.id === sel[0]) || (c.elements.length === sel.length && c.elements.every((e) => sel.includes(e))));
        const known = sel.filter((id) => this.partsById().has(id));
        const p = this.partsById().get(known[0]);
        if (concept) { this.chosen.set(concept); this.selected.set(concept.elements); }
        else if (p) { this.chosen.set({ id: p.conceptId, name: p.name, elements: [p.id] }); this.selected.set(known); }
        else { this.selected.set([]); this.details.set(false); }
      }
      if (this.mode() === 'data') { this.progress.set(this.host ? 100 : 80); if (this.host) await this.buildScene(); }
      else this.progress.set(15);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'The anatomy catalogue could not be loaded.');
    }
  }

  async onHost(host: MorphChartsHost): Promise<void> {
    this.host = host;
    this.fit();
    this.resize = new ResizeObserver(() => this.fit());
    const stage = this.stage()?.nativeElement;
    if (stage) this.resize.observe(stage);
    if (this.parts().length) await this.buildScene();
  }

  onFailed(message: string): void {
    this.fallback.set(message);
    this.progress.set(100);
  }

  private async mountViewer(host: HTMLDivElement, parts: Part[], chunks: ChunkInfo[]): Promise<void> {
    try {
      const { AnatomyViewer } = await import('./anatomy-viewer');
      if (this.mode() !== 'anatomy' || this.viewer) return;
      const viewer = new AnatomyViewer(host, parts, chunks, environment.atlasModelsBases, {
        onSelect: (id) => this.choosePart(id),
        onProgress: (pct) => { this.progress.set(15 + Math.round(pct * 0.85)); if (pct >= 100) this.ready.set(true); },
        onError: (msg) => this.viewerError.set(msg),
      });
      viewer.reducedMotion = this.gsap.reducedMotion;
      this.viewer = viewer;
      viewer.setState({ visible: this.visible(), selected: this.selected(), isolate: this.isolate(), view: this.view(), rotate: this.rotate(), reset: this.resetCounter(), inspectorOpen: false });
      viewer.setExplode(this.explode());
      viewer.onRenderStatus = (st) => { this.renderStatus.set(renderStatusText(st)); if (st.phase === 'raster' && st.error) this.renderPreset.set('raster'); };
      viewer.start();
      if (this.renderPreset() !== 'raster') viewer.setRenderPreset(this.renderPreset());
    } catch (e) {
      this.viewerError.set(e instanceof Error ? e.message : String(e));
    }
  }

  setMode(mode: 'anatomy' | 'data'): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    this.viewerError.set('');
    if (mode === 'data') {
      if (this.scene) this.progress.set(100); else if (this.host && this.parts().length) { this.progress.set(80); void this.buildScene(); } else this.progress.set(this.parts().length ? 80 : 10);
    } else {
      this.progress.set(this.viewer ? 100 : 15);
    }
  }

  private async buildScene(): Promise<void> {
    if (!this.host || this.scene) return;
    try {
      const { AtlasScene } = await import('./atlas-scene');
      this.scene = new AtlasScene(this.host, { geometry: 'sphere', reducedMotion: this.gsap.reducedMotion });
      this.scene.aspect = this.aspect();
      const stage = this.stage()?.nativeElement;
      if (stage) this.scene.stage = { width: stage.clientWidth, height: stage.clientHeight };
      await this.scene.load(this.parts(), this.view(), this.explode());
      this.scene.setVisibility(this.visibleIds());
      this.scene.updateLayout(this.visibleIds());
      this.scene.setSelection(new Set(this.selected()));
      this.rig.set(this.scene.rig);
      this.progress.set(100);
      this.ready.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private aspect(): number {
    const stage = this.stage()?.nativeElement;
    return stage ? Math.max(0.5, stage.clientWidth / Math.max(1, stage.clientHeight)) : 1.6;
  }

  private fit(): void {
    const host = this.host;
    const stage = this.stage()?.nativeElement;
    if (!host || !stage) return;
    const w = Math.max(64, Math.floor(stage.clientWidth));
    const h = Math.max(64, Math.floor(stage.clientHeight));
    host.resize(w, h);
    host.canvas.style.width = `${w}px`;
    host.canvas.style.height = `${h}px`;
    if (this.scene) { this.scene.aspect = w / h; this.scene.stage = { width: w, height: h }; }
  }

  // Pointer taps select a structure (drags orbit the camera, handled by the host).
  onPointerDown(e: PointerEvent): void { this.tapStart = { x: e.clientX, y: e.clientY }; }
  onPointerUp(e: PointerEvent): void {
    const start = this.tapStart;
    this.tapStart = null;
    if (this.mode() !== 'data' || !start || !this.scene || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = this.scene.pick(e.clientX - rect.left, e.clientY - rect.top);
    if (idx >= 0) this.choosePart(this.parts()[idx].id);
  }

  toggle(id: SystemId): void {
    this.details.set(false);
    this.selected.set([]);
    this.isolate.set(false);
    this.visible.set(this.visible().includes(id) ? this.visible().filter((x) => x !== id) : [...this.visible(), id]);
  }
  showOnly(id: SystemId): void { this.selected.set([]); this.isolate.set(false); this.visible.set([id]); }
  showAll(): void { this.selected.set([]); this.isolate.set(false); this.visible.set(this.activeSystems().map((s) => s.id)); }
  showSkeleton(): void { this.selected.set([]); this.isolate.set(false); this.visible.set(['skeletal']); }
  showOrgans(): void { this.selected.set([]); this.isolate.set(false); this.visible.set([...ORGANS]); }
  hideAll(): void { this.selected.set([]); this.isolate.set(false); this.visible.set([]); }

  choose(c: Concept): void {
    this.chosen.set(c);
    this.selected.set(c.elements);
    this.isolate.set(false);
    this.rotate.set(false);
    this.details.set(true);
    this.panel.set(null);
  }
  choosePart(id: string): void {
    const p = this.partsById().get(id);
    if (!p) return;
    this.chosen.set({ id: p.conceptId, name: p.name, elements: [id] });
    this.selected.set([id]);
    this.isolate.set(false);
    this.rotate.set(false);
    this.details.set(true);
    this.panel.set(null);
  }
  clearSelection(): void { this.selected.set([]); this.isolate.set(false); this.details.set(false); }
  toggleIsolate(): void {
    const iso = !this.isolate();
    this.isolate.set(iso);
    this.setExplodeValue(0, true);
    if (iso) this.scene?.frame(this.selectedParts()); else this.scene?.goToView(0);
  }

  /** Anatomy mode's view keys; Data mode's live on the camera rig, which turns about the same body. */
  setView(v: View): void {
    this.view.set(v);
    this.rotate.set(false);
    this.scene?.rig.setView(v === 'three-quarter' ? 'quarter' : v);
  }
  toggleRotate(): void { this.rotate.set(!this.rotate()); }

  setRenderPreset(id: string): void {
    const preset = RENDER_PRESETS.find((p) => p.id === id)?.id ?? 'raster';
    this.renderPreset.set(preset);
    if (preset === 'raster') this.renderStatus.set('');
    this.viewer?.setRenderPreset(preset);
  }

  onExplodeInput(value: number, commit: boolean): void {
    const t = value / 100;
    this.rotate.set(false);
    if (t > 0.8 && this.view() !== 'front') this.setView('front');
    this.setExplodeValue(t, commit);
  }
  private setExplodeValue(t: number, animate: boolean): void {
    this.explode.set(t);
    this.gsap.kill(this.explodeAnim);
    if (!animate || this.gsap.reducedMotion) { this.explodeAnim.t = t; this.viewer?.setExplode(t); }
    else this.gsap.tweenObject(this.explodeAnim, { t, duration: this.gsap.MOTION.duration.slow, onUpdate: () => this.viewer?.setExplode(this.explodeAnim.t) });
    if (!this.scene) return;
    this.scene.setExplode(t, this.visibleIds(), animate);
    if (!this.isolate()) this.scene.goToView(t, animate);
  }

  reset(): void {
    this.resetCounter.set(this.resetCounter() + 1);
    this.visible.set(DEFAULT_VISIBLE);
    this.selected.set([]);
    this.isolate.set(false);
    this.rotate.set(false);
    this.view.set('three-quarter');
    this.chosen.set(null);
    this.details.set(false);
    this.panel.set(null);
    this.setExplodeValue(0, true);
    this.scene?.rig.reset();
    this.scene?.goToView(0);
  }

  openPanel(next: 'layers' | 'search'): void {
    this.details.set(false);
    this.cursor.set(0);
    this.panel.set(this.panel() === next ? null : next);
    // A dynamically inserted `autofocus` is ignored once the document has processed one, so focus is explicit.
    if (this.panel() === 'search' && this.finePointer) requestAnimationFrame(() => this.el.nativeElement.querySelector<HTMLInputElement>('.search-input')?.focus());
  }
  /** Closing the palette hands focus back to the key that opened it, so Tab carries on from there. */
  closeSearch(): void { this.panel.set(null); this.findKey()?.nativeElement.focus(); }
  /** A sheet that slides in takes focus on its title, once visible; only shown on :focus-visible. */
  private focusTitle(sheet: Element): void { sheet.querySelector<HTMLElement>('.structure-title')?.focus({ preventScroll: true }); }
  onQuery(value: string): void { this.query.set(value); this.cursor.set(0); }
  /** Arrow keys walk the results, Enter picks; Escape is handled at the window. */
  onSearchKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      this.cursor.set((this.cursor() + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
      requestAnimationFrame(() => this.el.nativeElement.querySelector('.search-results .active')?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      const c = this.results()[this.cursor()];
      if (c) { e.preventDefault(); this.choose(c); }
    }
  }
  openAbout(): void { this.details.set(false); this.panel.set(null); this.about.set(true); }
  count(id: SystemId): number { return this.counts()[id] ?? 0; }
  reload(): void { location.reload(); }
}

/** "Building 42%" while the traced copy is made, then samples and elapsed time as it converges. */
function renderStatusText(st: RenderStatus): string {
  if (st.phase === 'raster') return st.error ? `Path tracer unavailable: ${st.error}` : '';
  if (st.phase === 'building') return `Building traced scene ${Math.round(st.progress * 100)}%`;
  return `${st.samples} spp · ${st.seconds.toFixed(1)} s · ${(st.triangles / 1e6).toFixed(2)}M tris`;
}
