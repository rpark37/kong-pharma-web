import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { ConsoleStageComponent } from '../../shared/fui/console-stage.component';
import { type Contact, type SensorMode, SENSORS, lutTable } from './tracks';
import type { GevScene } from './gev-scene';

/**
 * A spatial-intelligence console in the style of Bilawal Sidhu's God's Eye View — a vector globe
 * behind a circular aperture, framed by monospace classification chrome, with air, orbital and
 * seismic contacts labelled by leader lines.
 *
 * Nothing here is live: the tracks are a committed snapshot replayed forward locally, so the page
 * works with the network off. See `scripts/capture-gev-snapshot.mjs` for how it was captured and
 * `tracks.ts` for the propagation.
 *
 * The sensor modes are an SVG filter rather than a WebGL post pass. One `filter` declaration on
 * the stage grades the three.js globe and the canvas chrome together, with no render target, and
 * `feComponentTransfer` carries an arbitrary lookup table — so the real multi-hue ironbow ramp
 * survives, which a chain of `hue-rotate()` could not express. The tables come from `gradeLut`,
 * which is unit-tested, so the ramps are written down exactly once.
 *
 * The contacts rail is the one part of this console that is NOT canvas. The rest is atmosphere and
 * is labelled decorative, but the rail carries real data and is the page's primary control, so it
 * is real DOM sitting over the canvas: a `cdkListbox` gives it roving tabindex, arrow and Home/End
 * keys and type-ahead, and `LiveAnnouncer` speaks the selection. It is sized in container-query
 * units so it tracks the canvas's own 1600x900 coordinate space at any stage width.
 *
 * The page is the console, not a page about the console: `ConsoleStageComponent` gives it the
 * whole viewport below the nav (`fill`, since `GevScene` re-paints its overlay at the stage's own
 * aspect), plus Info and Fullscreen. The controls that used to sit around the card (sensor tray,
 * attribution, lede) live on the stage as small DOM islands in the bands the painted chrome
 * leaves free, positioned in cqh so they track the 900 px-high overlay at any width.
 */
@Component({
  selector: 'app-gev-page',
  imports: [CdkListbox, CdkOption, ConsoleStageComponent],
  template: `
    <app-console-stage
      background="#05090c"
      label="God's eye view"
      [filter]="stageFilter()"
      [draggable]="true"
      [fill]="true"
      (track)="scene?.track($event.nx, $event.ny)"
      (dragStart)="scene?.setDragging(true)"
      (dragEnd)="scene?.setDragging(false)"
    >
      <canvas #canvas role="img" aria-label="Decorative animation: a rotating globe showing 631 aircraft, 140 satellites and 160 recent earthquakes, replayed from a captured snapshot. The nearby aircraft it plots are listed in the contacts rail beside it."></canvas>

      <div class="rail" console-island>
        <p class="rail-title" id="gev-rail-title">Contacts</p>
        <p class="rail-sub">Lowell · 250 km flight window</p>
        @if (contacts().length) {
          <ul
            class="rail-list"
            cdkListbox
            aria-labelledby="gev-rail-title"
            [cdkListboxValue]="selectedIds()"
            (cdkListboxValueChange)="onPick($event.value)"
          >
            @for (c of contacts(); track c.craft.id) {
              <li class="rail-row" [cdkOption]="c.craft.id">
                <span class="id">{{ c.craft.id }}</span>
                <span class="km">{{ c.km }} km</span>
              </li>
            }
          </ul>
        } @else {
          <p class="rail-empty">No contacts in window</p>
        }

        @if (selected(); as sel) {
          <div class="rail-detail">
            <p class="rail-sub">Selected</p>
            <p class="rail-callsign">{{ sel.craft.id }}</p>
            <dl>
              <dt>Type</dt><dd>{{ sel.craft.type }}</dd>
              <dt>Alt</dt><dd>{{ sel.craft.alt.toLocaleString('en-US') }} ft</dd>
              <dt>Speed</dt><dd>{{ sel.craft.spd }} kts</dd>
            </dl>
          </div>
        }
      </div>

      <!-- Sensor tray: the left column between the painted header block and the channel panel. -->
      <div class="ui tray" role="group" aria-label="Sensor mode">
        <p class="ui-label">Sensor</p>
        @for (s of sensors; track s.id) {
          <button type="button" class="chip" [class.on]="mode() === s.id" [attr.aria-pressed]="mode() === s.id" (click)="setMode(s)">
            {{ s.label }}
          </button>
        }
      </div>

      @if (mode() === 'crt') { <div class="scanlines"></div> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      <div console-info>
        <p class="eyebrow">three.js · vector globe · snapshot replay</p>
        <p class="lede">
          A spy-satellite console built on the FUI vocabulary the other three.js pages share. The
          globe is drawn straight from a TopoJSON world file — arcs as line segments, so coastlines
          and borders cost one draw call and no decoder. Aircraft are dead-reckoned from a captured
          frame, satellites propagated from their orbital elements. Drag to spin it; switch sensors
          on the left.
        </p>
        <p class="note">
          After <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noopener">God's Eye View</a>
          by Bilawal Sidhu (MIT). This is an independent reimplementation of the look on this app's
          three.js stack — no upstream code and no CesiumJS. Contact data captured from adsb.lol,
          orbital elements from Celestrak, seismic events from USGS; each remains the property of its
          source.
        </p>
      </div>
    </app-console-stage>

    <!-- Sensor ramps as component-transfer tables. Generated from gradeLut so the ramp is not
         written down a second time in CSS. -->
    <svg class="defs" aria-hidden="true" focusable="false">
      <defs>
        @for (f of filters; track f.id) {
          <filter [attr.id]="'gev-' + f.id" color-interpolation-filters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" [attr.tableValues]="f.r" />
              <feFuncG type="table" [attr.tableValues]="f.g" />
              <feFuncB type="table" [attr.tableValues]="f.b" />
            </feComponentTransfer>
          </filter>
        }
      </defs>
    </svg>
  `,
  styles: `
    :host { display: block; }
    canvas { display: block; width: 100%; height: 100%; }

    /* Sits where the canvas used to paint this panel: just outside the aperture (centre + 0.45 of
       the 900 px overlay height + a gap) and 216 px down, 336 px wide — hence cqh. The min() keeps
       it inside the stage when the aspect is narrower than 16:9; below that the right column is
       gone and the container queries further down let it sit over the globe on a backdrop. */
    .rail { position: absolute; left: min(calc(50% + 47.33cqh), calc(100% - 42.66cqh)); top: 24cqh; width: 37.33cqh; box-sizing: border-box; color: #e6f6f3; font-family: 'JetBrains Mono', ui-monospace, monospace; cursor: default; }
    .rail-title { margin: 0; font-size: 1.87cqh; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
    .rail-sub { margin: 0.53cqh 0 0; font-size: 1.42cqh; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    .rail-list { list-style: none; margin: 1.6cqh 0 0; padding: 0.36cqh 0 0; border-top: 1px dashed rgba(68, 224, 204, 0.35); max-height: 42.67cqh; overflow-y: auto; }
    .rail-row { display: flex; justify-content: space-between; gap: 1.42cqh; padding: 0.46cqh 0.62cqh; font-size: 1.53cqh; letter-spacing: 0.1em; cursor: pointer; }
    .rail-row:hover { background: rgba(68, 224, 204, 0.10); }
    /* Styled from aria-selected, which the CDK owns, so the visual state cannot disagree with
       what a screen reader is told. */
    .rail-row[aria-selected='true'] { background: rgba(68, 224, 204, 0.18); color: #fff; }
    .rail-row:focus-visible { outline: 1px solid #44e0cc; outline-offset: -1px; }
    .rail-row .km { color: rgba(230, 246, 243, 0.62); }
    .rail-empty { margin: 1.78cqh 0 0; font-size: 1.51cqh; letter-spacing: 0.1em; color: rgba(230, 246, 243, 0.3); text-transform: uppercase; }
    .rail-detail { margin-top: 2.49cqh; }
    .rail-callsign { margin: 0.62cqh 0 0.98cqh; font-size: 3.2cqh; font-weight: 500; letter-spacing: 0.04em; }
    .rail-detail dl { display: grid; grid-template-columns: auto 1fr; gap: 0.39cqh 1.42cqh; margin: 0; font-size: 1.42cqh; letter-spacing: 0.1em; text-transform: uppercase; }
    .rail-detail dt { color: rgba(230, 246, 243, 0.62); }
    .rail-detail dd { margin: 0; text-align: right; }

    .scanlines { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: multiply; background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.96) 0 2px, rgba(120,120,120,0.72) 2px 4px); }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }

    /* The sensor tray is projected content, so it carries its own copy of the island rules from
       ConsoleStageComponent (component styles do not cross that boundary). Sized in cqh like the
       rail, with px floors so a phone-width stage stays tappable. */
    .ui { position: absolute; font-family: 'JetBrains Mono', ui-monospace, monospace; color: #e6f6f3; cursor: default; }
    .ui-label { margin: 0 0 0.89cqh; font-size: max(9px, 1.42cqh); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    /* Left column: y 270..585 of the overlay sits between the header micro-rail and the channel panel. */
    .tray { left: 5.33cqh; top: 31cqh; width: 33.8cqh; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0.71cqh; }
    /* Narrower than 16:9 the aperture reaches into the side columns, so the islands get a backdrop;
       in portrait they also shrink to the width, since the cqh sizing would cover the globe. */
    @container (max-aspect-ratio: 17/10) {
      .rail, .tray { background: rgba(5, 9, 12, 0.82); padding: 1.2cqh 1.4cqh; box-shadow: 0 0 0 1px rgba(68, 224, 204, 0.14); }
    }
    @container (max-aspect-ratio: 1/1) {
      .rail { left: auto; right: 3%; width: 50%; }
      .tray { width: 44%; }
    }
    .tray .ui-label { flex-basis: 100%; }
    .chip {
      font: 500 max(10px, 1.24cqh)/1 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: max(6px, 0.98cqh) max(10px, 1.6cqh);
      border-radius: 2px;
      border: 1px solid rgba(68, 224, 204, 0.35);
      background: rgba(5, 9, 12, 0.72);
      color: rgba(230, 246, 243, 0.72);
      cursor: pointer;
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
    }
    .chip:hover { color: #fff; border-color: #44e0cc; }
    .chip.on { color: #44e0cc; border-color: #44e0cc; background: rgba(68, 224, 204, 0.12); }
    .chip:focus-visible { outline: 1px solid #44e0cc; outline-offset: 2px; }
    .defs { position: absolute; width: 0; height: 0; }
  `,
})
export class GevPageComponent {
  readonly error = signal<string | null>(null);
  readonly mode = signal<SensorMode>('normal');
  readonly sensors = SENSORS;

  /**
   * Sampled from the scene rather than pushed by it. The scene re-reckons every contact at 60fps;
   * re-rendering the list that often would be work nobody can read. 4 Hz still looks live.
   */
  readonly contacts = signal<Contact[]>([]);
  readonly selectedId = signal<string | null>(null);

  /** cdkListbox works in values rather than indices, so selection is keyed on the callsign. */
  readonly selectedIds = computed(() => {
    const id = this.selectedId();
    return id ? [id] : [];
  });

  readonly selected = computed(() => this.contacts().find((c) => c.craft.id === this.selectedId()) ?? null);

  /** Only the recolouring modes need a filter element; the others are plain CSS or nothing. */
  readonly filters = SENSORS.filter((s) => s.lut > 0).map((s) => {
    const [r, g, b] = lutTable(s.id);
    return { id: s.id, r, g, b };
  });

  readonly stageFilter = computed(() => {
    const m = this.mode();
    if (m === 'crt') return 'saturate(1.3) contrast(1.12) brightness(1.04)';
    return SENSORS.find((s) => s.id === m)!.lut > 0 ? `url(#gev-${m})` : 'none';
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly console = viewChild.required(ConsoleStageComponent);
  private readonly gsap = inject(GsapService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  scene: GevScene | null = null;
  private resize: ResizeObserver | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => {
      this.scene?.dispose();
      this.resize?.disconnect();
      if (this.poll) clearInterval(this.poll);
    });
  }

  onPick(ids: readonly string[]): void {
    const id = ids[0];
    if (!id) return;
    this.selectedId.set(id);
    const i = this.contacts().findIndex((c) => c.craft.id === id);
    if (i >= 0) this.scene?.select(i);
    const sel = this.selected();
    if (sel) {
      void this.announcer.announce(
        `${sel.craft.id} selected. ${sel.craft.type}, ${sel.craft.alt.toLocaleString('en-US')} feet, ${sel.craft.spd} knots, ${sel.km} kilometres away.`,
        'polite',
      );
    }
  }

  setMode(s: (typeof SENSORS)[number]): void {
    this.mode.set(s.id);
    void this.announcer.announce(`Sensor mode ${s.label}`, 'polite');
  }

  /** three.js is ~600 kB; it loads only when this page does, like the atlas viewer. */
  private async boot(): Promise<void> {
    try {
      const { GevScene } = await import('./gev-scene');
      const scene = new GevScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.console().stageElement();
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.console().stageElement());
      await scene.load();
      scene.start();

      const sync = () => {
        const list = scene.contactList();
        this.contacts.set([...list]);
        // The scene cycles its own selection; follow it until the user picks one themselves.
        if (!this.selectedId() && list.length) this.selectedId.set(list[scene.selectedIndex()]?.craft.id ?? null);
      };
      sync();
      this.poll = setInterval(sync, 250);
    } catch (err) {
      this.error.set(`The console could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
