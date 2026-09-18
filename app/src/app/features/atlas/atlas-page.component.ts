import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GsapService } from '../../shared/animation/gsap.service';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { SwitchComponent } from '../../shared/ui/switch.component';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { DEFAULT_VISIBLE, EXPLANATIONS, SYSTEMS, explanation, type AtlasCatalogue, type Concept, type Part, type SystemId, type View } from './anatomy';
import type { AtlasScene } from './atlas-scene';
import { atlasTreemapSpec } from './atlas-fallback-spec';

const ORGANS: SystemId[] = ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'];
const DEFAULT_SEARCH = ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'urinary bladder', 'trachea'];

/**
 * Human Atlas, reinterpreted as data: 2,234 BodyParts3D structures rendered by MorphCharts as
 * spec-driven primitives. UI mirrors ashemag/human-atlas: systems panel, search, view controls,
 * explode slider, detail and about sheets.
 */
@Component({
  selector: 'app-atlas-page',
  imports: [DecimalPipe, MorphchartsCanvasComponent, WebGpuFallbackComponent, SwitchComponent, VegaChartComponent],
  templateUrl: './atlas-page.component.html',
  styleUrl: './atlas-page.component.scss',
})
export class AtlasPageComponent {
  private readonly http = inject(HttpClient);
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly stage = viewChild<ElementRef<HTMLDivElement>>('stage');

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
  readonly chosen = signal<Concept | null>(null);

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
  readonly caption = computed(() => this.isolate() ? (this.chosen()?.name ?? 'SELECTED STRUCTURE').toUpperCase() : this.explode() > 0.95 ? 'ANATOMICAL INVENTORY' : this.explode() > 0.05 ? 'SEPARATED STRUCTURES' : 'ADULT HUMAN · MALE');
  readonly explanationText = computed(() => { const c = this.chosen(); const p = this.selectedPart(); return c && p ? explanation(c.name, p.system) : ''; });
  readonly hasExplanation = computed(() => !!EXPLANATIONS[(this.chosen()?.name ?? '').toLowerCase()]);
  readonly allVisible = computed(() => this.activeSystems().every((s) => this.visible().includes(s.id)));
  readonly skeletonOnly = computed(() => this.visible().length === 1 && this.visible()[0] === 'skeletal');
  readonly organsOnly = computed(() => this.visible().length === ORGANS.length && ORGANS.every((id) => this.visible().includes(id)));
  readonly fallbackSpec = computed(() => (this.parts().length ? atlasTreemapSpec(this.parts()) : null));
  readonly views: Array<{ id: View; glyph: string }> = [{ id: 'three-quarter', glyph: '¾' }, { id: 'front', glyph: 'F' }, { id: 'side', glyph: 'S' }, { id: 'back', glyph: 'B' }];

  private host: MorphChartsHost | null = null;
  private scene: AtlasScene | null = null;
  private resize: ResizeObserver | null = null;
  private tapStart: { x: number; y: number } | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); this.openPanel('search'); }
    if (e.key === 'Escape') { this.panel.set(null); this.details.set(false); this.about.set(false); }
  };

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      window.addEventListener('keydown', this.onKey);
      void this.loadCatalogue();
    });
    this.destroyRef.onDestroy(() => { window.removeEventListener('keydown', this.onKey); this.scene?.dispose(); this.resize?.disconnect(); });

    // Scene reactions
    effect(() => { const ids = this.visibleIds(); untracked(() => { if (this.scene) { this.scene.setVisibility(ids); this.scene.updateLayout(ids); } }); });
    effect(() => { const sel = new Set(this.selected()); untracked(() => this.scene?.setSelection(sel)); });
    effect(() => { const rot = this.rotate(); untracked(() => this.scene?.setAutoRotate(rot)); });
    effect(() => {
      const open = this.details() && this.selectedParts().length > 0;
      untracked(() => { const sheet = this.el.nativeElement.querySelector('.detail-sheet'); if (sheet) open ? this.gsap.slideIn(sheet, 'right') : this.gsap.slideOut(sheet, 'right'); });
    });
    effect(() => {
      const open = this.about();
      untracked(() => { const sheet = this.el.nativeElement.querySelector('.about-sheet'); if (sheet) open ? this.gsap.slideIn(sheet, 'right') : this.gsap.slideOut(sheet, 'right'); });
    });
    effect(() => {
      const p = this.panel();
      untracked(() => { const search = this.el.nativeElement.querySelector('.search-panel'); if (search && p === 'search') this.gsap.slideIn(search, 'top'); });
    });
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
      this.parts.set(cat.parts.map(([id, name, conceptId, system, cx, cy, cz, sx, sy, sz]) => ({ id, name, conceptId, system, cx, cy, cz, sx, sy, sz })));
      this.concepts.set(concepts.map(([id, name, elements]) => ({ id, name, elements })));
      this.progress.set(this.host ? 100 : 80);
      if (this.host) await this.buildScene();
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

  private async buildScene(): Promise<void> {
    if (!this.host || this.scene) return;
    try {
      const { AtlasScene } = await import('./atlas-scene');
      this.scene = new AtlasScene(this.host, { geometry: 'sphere', reducedMotion: this.gsap.reducedMotion });
      this.scene.aspect = this.aspect();
      await this.scene.load(this.parts(), this.view(), this.explode());
      this.scene.setVisibility(this.visibleIds());
      this.scene.updateLayout(this.visibleIds());
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
    if (this.scene) this.scene.aspect = w / h;
  }

  // Pointer taps select a structure (drags orbit the camera, handled by the host).
  onPointerDown(e: PointerEvent): void { this.tapStart = { x: e.clientX, y: e.clientY }; }
  onPointerUp(e: PointerEvent): void {
    const start = this.tapStart;
    this.tapStart = null;
    if (!start || !this.scene || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
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
    if (iso) this.scene?.frame(this.selectedParts()); else this.scene?.goToView(this.view(), 0);
  }

  setView(v: View): void {
    this.view.set(v);
    this.rotate.set(false);
    this.scene?.goToView(v, this.explode());
  }
  toggleRotate(): void { this.rotate.set(!this.rotate()); }

  onExplodeInput(value: number, commit: boolean): void {
    const t = value / 100;
    this.rotate.set(false);
    if (t > 0.8) this.view.set('front');
    this.setExplodeValue(t, commit);
  }
  private setExplodeValue(t: number, animate: boolean): void {
    this.explode.set(t);
    if (!this.scene) return;
    this.scene.setExplode(t, this.visibleIds(), animate);
    if (!this.isolate()) this.scene.goToView(t > 0.5 ? 'front' : this.view(), t, animate);
  }

  reset(): void {
    this.visible.set(DEFAULT_VISIBLE);
    this.selected.set([]);
    this.isolate.set(false);
    this.rotate.set(false);
    this.view.set('three-quarter');
    this.chosen.set(null);
    this.details.set(false);
    this.panel.set(null);
    this.setExplodeValue(0, true);
    this.scene?.goToView('three-quarter', 0);
  }

  openPanel(next: 'layers' | 'search'): void { this.details.set(false); this.panel.set(this.panel() === next ? null : next); }
  openAbout(): void { this.details.set(false); this.panel.set(null); this.about.set(true); }
  count(id: SystemId): number { return this.counts()[id] ?? 0; }
  reload(): void { location.reload(); }
}
