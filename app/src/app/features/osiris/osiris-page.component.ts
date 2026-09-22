import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import { DEFAULT_ON, LAYERS, type LayerId, type Mark } from './layers';
import type { OsirisScene } from './osiris-scene';

/**
 * A situational-awareness board after OSIRIS (github.com/simplifaisoul/osiris): a flat world map
 * with toggleable intelligence layers and click-to-inspect. Nothing here is live — every layer is
 * a committed snapshot, so the page works with the network off.
 *
 * The canvas is decorative. Everything with a payload is reachable in the DOM: the layer toggles
 * are native checkboxes, the named marks (bureaus, zones, events) are a `cdkListbox`, and the
 * selected mark's details are a region beside the map. Selecting from the rail and clicking on
 * the map both land in the same `selected` signal.
 */
@Component({
  selector: 'app-osiris-page',
  imports: [CdkListbox, CdkOption, ConsoleStageComponent],
  template: `
    <app-console-stage background="#05090c" label="Osiris board" [fill]="true" (track)="scene?.hover($event.nx, $event.ny)">
      <canvas #canvas role="img" [attr.aria-label]="summary()" (click)="pickFromMap()"></canvas>

      <div class="rail" console-island>
        <fieldset class="layers">
          <legend class="rail-title">Layers</legend>
          @for (l of layers; track l.id) {
            <label class="layer-row" [class.off]="counts()[l.id] === null">
              <input type="checkbox" [checked]="enabled().has(l.id)" [disabled]="counts()[l.id] === null" [attr.title]="counts()[l.id] === null ? 'snapshot missing' : null" (change)="toggle(l.id)" />
              <span class="swatch" [style.background]="l.color"></span>
              <span class="name">{{ l.label }}</span>
              <span class="count">{{ counts()[l.id] ?? '—' }}</span>
            </label>
          }
        </fieldset>

        <p class="rail-title" id="osiris-rail-title">Named marks</p>
        @if (named().length) {
          <ul class="rail-list" cdkListbox aria-labelledby="osiris-rail-title" [cdkListboxValue]="selectedKeys()" (cdkListboxValueChange)="pickFromRail($event.value)">
            @for (m of named(); track key(m)) {
              <li class="rail-row" [cdkOption]="key(m)">
                <span class="id">{{ m.label }}</span>
                <span class="km">{{ layerLabel(m.layer) }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="rail-empty">No named layers on</p>
        }

        @if (selected(); as sel) {
          <div class="rail-detail" role="region" aria-label="Selected item">
            <p class="rail-sub">{{ layerLabel(sel.layer) }}</p>
            <p class="rail-callsign">{{ sel.label }}</p>
            <ul class="lines">
              @for (line of sel.lines; track $index) { <li>{{ line }}</li> }
            </ul>
            @if (embed(); as src) {
              <iframe [src]="src" [title]="sel.label + ' live stream'" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin"></iframe>
            }
            <p class="rail-actions">
              @if (sel.url) { <a [href]="sel.url" target="_blank" rel="noopener">{{ sel.embed ? 'Open on YouTube' : 'Source' }}</a> }
              <button type="button" class="chip" (click)="select(null)">Close</button>
            </p>
          </div>
        }
      </div>

      @if (error()) { <p class="error">{{ error() }}</p> }

      <div console-info>
        <p class="eyebrow">canvas 2d · d3-geo · snapshot replay</p>
        <p class="lede">
          A global situation board in the console vocabulary the other pages share: a flat world map
          with toggleable intelligence layers. Aircraft are dead-reckoned from a captured frame,
          satellites propagated from their elements; fires, quakes and NASA events sit where they
          were captured. Toggle layers on the right and pick a mark to read it.
        </p>
        <p class="note">
          After <a href="https://github.com/simplifaisoul/osiris" target="_blank" rel="noopener">OSIRIS</a>
          by simplifaisoul (MIT) — an independent reimplementation of a subset on this app's stack; the
          news-bureau and conflict-zone tables are copied from upstream as of September 2026 and are
          editorial snapshots, not live. Data captured from adsb.lol, Celestrak, USGS, NASA FIRMS and
          NASA EONET; each remains the property of its source.
        </p>
      </div>
    </app-console-stage>
  `,
  styles: `
    :host { display: block; }
    canvas { display: block; width: 100%; height: 100%; }

    /* The right column the scene leaves unpainted (MAP.right = 360 of 900 → 40cqh), top 12cqh so the
       Info / Fullscreen chips (at 11cqh) sit above it. */
    .rail { position: absolute; right: 5.33cqh; top: 12cqh; width: 33cqh; max-height: 80cqh; overflow-y: auto; box-sizing: border-box; color: #e6f6f3; font-family: 'JetBrains Mono', ui-monospace, monospace; cursor: default; }
    .rail-title { margin: 0; font-size: max(9px, 1.87cqh); font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
    .rail-sub { margin: 0.53cqh 0 0; font-size: max(9px, 1.42cqh); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    .layers { margin: 0 0 2cqh; padding: 0; border: 0; }
    .layers legend { padding: 0; margin-bottom: 0.8cqh; }
    .layer-row { display: flex; align-items: center; gap: 1cqh; padding: 0.4cqh 0; font-size: max(10px, 1.53cqh); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
    .layer-row.off { color: rgba(230, 246, 243, 0.3); cursor: default; }
    .layer-row input { accent-color: #44e0cc; margin: 0; }
    .layer-row input:focus-visible { outline: 1px solid #44e0cc; outline-offset: 2px; }
    .swatch { width: 1.2cqh; height: 1.2cqh; border-radius: 1px; }
    .name { flex: 1; }
    .count { color: rgba(230, 246, 243, 0.62); font-variant-numeric: tabular-nums; }
    .rail-list { list-style: none; margin: 0.8cqh 0 0; padding: 0.36cqh 0 0; border-top: 1px dashed rgba(68, 224, 204, 0.35); max-height: 28cqh; overflow-y: auto; }
    .rail-row { display: flex; justify-content: space-between; gap: 1.42cqh; padding: 0.46cqh 0.62cqh; font-size: max(10px, 1.42cqh); letter-spacing: 0.1em; cursor: pointer; }
    .rail-row:hover { background: rgba(68, 224, 204, 0.10); }
    .rail-row[aria-selected='true'] { background: rgba(68, 224, 204, 0.18); color: #fff; }
    .rail-row:focus-visible { outline: 1px solid #44e0cc; outline-offset: -1px; }
    .rail-row .km { color: rgba(230, 246, 243, 0.62); white-space: nowrap; }
    .rail-empty { margin: 1cqh 0 0; font-size: max(9px, 1.42cqh); letter-spacing: 0.1em; color: rgba(230, 246, 243, 0.3); text-transform: uppercase; }
    .rail-detail { margin-top: 2cqh; padding-top: 1cqh; border-top: 1px dashed rgba(68, 224, 204, 0.35); }
    .rail-callsign { margin: 0.62cqh 0 0.98cqh; font-size: max(13px, 2.4cqh); font-weight: 500; letter-spacing: 0.04em; }
    .lines { list-style: none; margin: 0; padding: 0; font-size: max(10px, 1.42cqh); letter-spacing: 0.08em; text-transform: uppercase; color: rgba(230, 246, 243, 0.62); }
    .lines li { margin: 0.3cqh 0; }
    iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid rgba(68, 224, 204, 0.35); margin-top: 1cqh; background: #000; }
    .rail-actions { display: flex; gap: 1cqh; align-items: center; margin: 1cqh 0 0; font-size: max(10px, 1.42cqh); }
    .rail-actions a { color: #44e0cc; }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }

    /* Projected content carries its own copy of the chip rule (component styles stop at the stage boundary). */
    .chip {
      font: 500 max(10px, 1.24cqh)/1 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 0.14em; text-transform: uppercase;
      padding: max(6px, 0.98cqh) max(10px, 1.6cqh);
      border-radius: 2px; border: 1px solid rgba(68, 224, 204, 0.35);
      background: rgba(5, 9, 12, 0.72); color: rgba(230, 246, 243, 0.72); cursor: pointer;
    }
    .chip:hover { color: #fff; border-color: #44e0cc; }
    .chip:focus-visible { outline: 1px solid #44e0cc; outline-offset: 2px; }

    @container (max-aspect-ratio: 17/10) {
      .rail { background: rgba(5, 9, 12, 0.82); padding: 1.2cqh 1.4cqh; box-shadow: 0 0 0 1px rgba(68, 224, 204, 0.14); }
    }
    @container (max-aspect-ratio: 1/1) {
      .rail { right: 3%; width: 50%; }
    }
  `,
  host: { '(document:keydown.escape)': 'select(null)' },
})
export class OsirisPageComponent {
  readonly layers = LAYERS;
  readonly error = signal<string | null>(null);
  readonly enabled = signal<Set<LayerId>>(new Set(DEFAULT_ON));
  readonly counts = signal<Record<LayerId, number | null>>(Object.fromEntries(LAYERS.map((l) => [l.id, null])) as Record<LayerId, number | null>);
  readonly named = signal<Mark[]>([]);
  readonly selected = signal<Mark | null>(null);

  readonly selectedKeys = computed(() => {
    const s = this.selected();
    return s ? [this.key(s)] : [];
  });

  readonly summary = computed(() => {
    const c = this.counts();
    const parts = LAYERS.filter((l) => this.enabled().has(l.id) && c[l.id]).map((l) => `${c[l.id]} ${l.label.toLowerCase()}`);
    return `Decorative world map showing ${parts.join(', ') || 'coastlines'}; toggle layers and pick marks in the panel beside it.`;
  });

  /** Only a static-table channel id ever reaches this, never user input, so trusting it is safe. */
  readonly embed = computed(() => {
    const src = this.selected()?.embed;
    return src ? this.sanitizer.bypassSecurityTrustResourceUrl(src) : null;
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: OsirisScene | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => {
      this.scene?.dispose();
      this.resize?.disconnect();
    });
  }

  key(m: Mark): string {
    return `${m.layer}:${m.id}`;
  }

  layerLabel(id: LayerId): string {
    return LAYERS.find((l) => l.id === id)!.label;
  }

  toggle(id: LayerId): void {
    const next = new Set(this.enabled());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (this.selected() && !next.has(this.selected()!.layer)) this.select(null);
    this.enabled.set(next);
    this.scene?.setVisible(next);
    this.refreshNamed();
    void this.announcer.announce(`${this.layerLabel(id)} ${next.has(id) ? 'on' : 'off'}, ${this.counts()[id] ?? 0} marks`, 'polite');
  }

  /** Clicking empty map is a deselect, the same as Escape. */
  pickFromMap(): void {
    this.select(this.scene?.pick() ?? null);
  }

  pickFromRail(keys: readonly string[]): void {
    const k = keys[0];
    const m = k ? this.named().find((n) => this.key(n) === k) ?? null : null;
    this.select(m);
  }

  select(m: Mark | null): void {
    this.selected.set(m);
    this.scene?.select(m);
    if (m) void this.announcer.announce(`Selected ${m.label}. ${m.lines.join('. ')}`, 'polite');
  }

  private refreshNamed(): void {
    const on = this.enabled();
    this.named.set((this.scene?.named() ?? []).filter((m) => on.has(m.layer)));
  }

  private async boot(): Promise<void> {
    try {
      const { OsirisScene } = await import('./osiris-scene');
      const scene = new OsirisScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.console().stageElement();
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.console().stageElement());
      await scene.load();
      scene.setVisible(this.enabled());
      scene.start();
      this.counts.set(Object.fromEntries(LAYERS.map((l) => [l.id, scene.count(l.id)])) as Record<LayerId, number | null>);
      this.refreshNamed();
    } catch (err) {
      this.error.set(`The board could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
