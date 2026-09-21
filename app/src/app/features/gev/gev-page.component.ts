import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
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
 * The page is the console, not a page about the console: the stage is the largest 16:9 frame the
 * viewport below the nav allows, letterboxed on the console's own black, and the Fullscreen button
 * hands that frame to the browser's Fullscreen API for a true edge-to-edge view. 16:9 is a hard
 * constraint, not taste — the overlay is a 1600x900 canvas stretched over the whole stage, so any
 * other ratio turns the circular aperture into an ellipse and drifts the rail off its panel. The
 * controls that used to sit around the card (sensor tray, attribution, lede) now live on the stage
 * as small DOM islands in the bands the painted chrome leaves free.
 */
@Component({
  selector: 'app-gev-page',
  imports: [CdkListbox, CdkOption],
  template: `
    <div class="console" #console (keydown.escape)="info.set(false)">
      <div
        class="stage"
        #stage
        data-reveal
        [style.filter]="stageFilter()"
        (pointermove)="onMove($event)"
        (pointerdown)="onDown($event)"
        (pointerup)="onUp()"
        (pointerleave)="onUp()"
      >
        <canvas #canvas role="img" aria-label="Decorative animation: a rotating globe showing 631 aircraft, 140 satellites and 160 recent earthquakes, replayed from a captured snapshot. The nearby aircraft it plots are listed in the contacts rail beside it."></canvas>
        <!-- The visible title is painted by the overlay canvas; this one is for the document outline. -->
        <h1 class="sr-only">God's eye view</h1>

        <div class="rail">
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

        <!-- Console actions: the right column under the painted REC stamp, above the rail. -->
        <div class="ui actions">
          <button type="button" class="chip" [class.on]="info()" [attr.aria-expanded]="info()" aria-controls="gev-info" (click)="info.set(!info())">
            Info
          </button>
          @if (fullscreenEnabled) {
            <button type="button" class="chip" [class.on]="fullscreen()" (click)="toggleFullscreen()">
              {{ fullscreen() ? 'Exit fullscreen' : 'Fullscreen' }}
            </button>
          }
        </div>

        @if (info()) {
          <div class="ui info" id="gev-info" role="region" aria-label="About this console">
            <p class="ui-label">three.js · vector globe · snapshot replay</p>
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
        }

        @if (mode() === 'crt') { <div class="scanlines"></div> }
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
    </div>

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
    /* The whole page is the console: black to the edges, the stage centred inside it. Height is
       the viewport minus the sticky nav; the shell's .page is only min-height, so flex: 1 would
       not bound it. */
    :host { display: block; height: calc(100dvh - var(--nav-h)); background: #05090c; overflow: hidden; }
    .console { height: 100%; display: grid; place-items: center; background: #05090c; }
    /* container-type lets the rail and the DOM islands size themselves in cqw, so they track the
       canvas's own 1600x900 coordinate space at any stage width instead of drifting out of
       alignment with it. The width rule picks the largest 16:9 box that fits: full width on a
       wide-and-short viewport, full height on a tall one, letterboxed either way. */
    .stage {
      position: relative;
      container-type: size;
      width: min(100%, calc((100dvh - var(--nav-h)) * 16 / 9));
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: #05090c;
      touch-action: none;
      cursor: grab;
    }
    /* In fullscreen the console is the screen, with no nav to subtract. The UA forces the
       fullscreen element to 100% x 100%, which is why the console, not the stage, goes fullscreen:
       the stage keeps its ratio inside it. */
    .console:fullscreen .stage { width: min(100%, calc(100dvh * 16 / 9)); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .stage:active { cursor: grabbing; }
    canvas { display: block; width: 100%; height: 100%; }

    /* Sits where the canvas used to paint this panel: x 1226/1600, y 216/900 of the overlay. */
    .rail { position: absolute; left: 76.6%; top: 24%; width: 21%; color: #e6f6f3; font-family: 'JetBrains Mono', ui-monospace, monospace; cursor: default; }
    .rail-title { margin: 0; font-size: 1.05cqw; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
    .rail-sub { margin: 0.3cqw 0 0; font-size: 0.8cqw; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    .rail-list { list-style: none; margin: 0.9cqw 0 0; padding: 0.2cqw 0 0; border-top: 1px dashed rgba(68, 224, 204, 0.35); max-height: 24cqw; overflow-y: auto; }
    .rail-row { display: flex; justify-content: space-between; gap: 0.8cqw; padding: 0.26cqw 0.35cqw; font-size: 0.86cqw; letter-spacing: 0.1em; cursor: pointer; }
    .rail-row:hover { background: rgba(68, 224, 204, 0.10); }
    /* Styled from aria-selected, which the CDK owns, so the visual state cannot disagree with
       what a screen reader is told. */
    .rail-row[aria-selected='true'] { background: rgba(68, 224, 204, 0.18); color: #fff; }
    .rail-row:focus-visible { outline: 1px solid #44e0cc; outline-offset: -1px; }
    .rail-row .km { color: rgba(230, 246, 243, 0.62); }
    .rail-empty { margin: 1cqw 0 0; font-size: 0.85cqw; letter-spacing: 0.1em; color: rgba(230, 246, 243, 0.3); text-transform: uppercase; }
    .rail-detail { margin-top: 1.4cqw; }
    .rail-callsign { margin: 0.35cqw 0 0.55cqw; font-size: 1.8cqw; font-weight: 500; letter-spacing: 0.04em; }
    .rail-detail dl { display: grid; grid-template-columns: auto 1fr; gap: 0.22cqw 0.8cqw; margin: 0; font-size: 0.8cqw; letter-spacing: 0.1em; text-transform: uppercase; }
    .rail-detail dt { color: rgba(230, 246, 243, 0.62); }
    .rail-detail dd { margin: 0; text-align: right; }

    .scanlines { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: multiply; background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.96) 0 2px, rgba(120,120,120,0.72) 2px 4px); }
    .error { position: absolute; inset: auto 12px 12px; color: var(--rose); font-size: 13px; }

    /* DOM islands over the canvas. Sized in cqw like the rail (with px floors so a phone-width
       stage stays tappable) and placed in the bands the painted chrome leaves free. */
    .ui { position: absolute; font-family: 'JetBrains Mono', ui-monospace, monospace; color: #e6f6f3; cursor: default; }
    .ui-label { margin: 0 0 0.5cqw; font-size: max(9px, 0.8cqw); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    /* Left column: y 270..585 of the overlay sits between the header micro-rail and the channel panel. */
    .tray { left: 3%; top: 31%; width: 19%; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0.4cqw; }
    .tray .ui-label { flex-basis: 100%; }
    /* Right column: under the REC stamp (y 78) and above the rail (y 216). */
    .actions { right: 3%; top: 11%; display: flex; gap: 0.4cqw; }
    .chip {
      font: 500 max(10px, 0.7cqw)/1 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: max(6px, 0.55cqw) max(10px, 0.9cqw);
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
    /* The info panel opens over the tray's band and out across the aperture; a toggle, so nothing
       else has to make room for it. */
    .info {
      left: 3%;
      top: 31%;
      width: min(34%, 560px);
      max-height: 36%;
      overflow-y: auto;
      padding: 1cqw 1.1cqw;
      border: 1px solid rgba(68, 224, 204, 0.35);
      background: rgba(5, 9, 12, 0.86);
      backdrop-filter: blur(6px);
      font-family: var(--font-body);
    }
    .info .ui-label { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .info .lede { margin: 0 0 0.8cqw; font-size: max(12px, 0.9cqw); line-height: 1.45; color: rgba(230, 246, 243, 0.86); }
    .info .note { margin: 0; font-size: max(11px, 0.75cqw); line-height: 1.45; color: rgba(230, 246, 243, 0.55); }
    .info a { color: #44e0cc; }
    .defs { position: absolute; width: 0; height: 0; }
  `,
})
export class GevPageComponent {
  readonly error = signal<string | null>(null);
  readonly mode = signal<SensorMode>('normal');
  readonly sensors = SENSORS;
  /** The lede and attribution, folded into a panel so the stage can have the whole viewport. */
  readonly info = signal(false);
  /** Mirrors `document.fullscreenElement`; the document owns the state, this only reflects it. */
  readonly fullscreen = signal(false);
  /** iOS Safari cannot fullscreen an element, so it never gets a button that would do nothing. */
  readonly fullscreenEnabled = typeof document !== 'undefined' && !!document.fullscreenEnabled;

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
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly console = viewChild.required<ElementRef<HTMLDivElement>>('console');
  private readonly gsap = inject(GsapService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: GevScene | null = null;
  private resize: ResizeObserver | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const onFullscreenChange = () => this.fullscreen.set(document.fullscreenElement === this.console().nativeElement);
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
      document.addEventListener('fullscreenchange', onFullscreenChange);
      void this.boot();
    });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      // Navigating away while fullscreen would leave the next page fullscreen with no way out.
      if (this.fullscreen()) void document.exitFullscreen().catch(() => undefined);
      this.scene?.dispose();
      this.resize?.disconnect();
      if (this.poll) clearInterval(this.poll);
    });
  }

  /**
   * The console (not the stage) is what goes fullscreen: the UA stretches the fullscreen element to
   * the screen, and the stage must keep its 16:9 inside that. The ResizeObserver in `boot` picks up
   * the new stage size, so the scene needs no fullscreen-specific path.
   */
  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.console().nativeElement.requestFullscreen();
    } catch (err) {
      this.error.set(`Fullscreen was refused: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  onMove(e: PointerEvent): void {
    const r = this.stage().nativeElement.getBoundingClientRect();
    this.scene?.track(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  }

  onDown(e: PointerEvent): void {
    // Dragging the globe must not start when the pointer went down on the rail or a DOM island.
    if ((e.target as HTMLElement).closest('.rail, .ui')) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.scene?.setDragging(true);
  }

  onUp(): void {
    this.scene?.setDragging(false);
  }

  /** three.js is ~600 kB; it loads only when this page does, like the atlas viewer. */
  private async boot(): Promise<void> {
    try {
      const { GevScene } = await import('./gev-scene');
      const scene = new GevScene(this.canvas().nativeElement, this.gsap.reducedMotion);
      this.scene = scene;
      const fit = () => {
        const el = this.stage().nativeElement;
        scene.resize(Math.max(64, el.clientWidth), Math.max(64, el.clientHeight));
      };
      fit();
      this.resize = new ResizeObserver(fit);
      this.resize.observe(this.stage().nativeElement);
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
