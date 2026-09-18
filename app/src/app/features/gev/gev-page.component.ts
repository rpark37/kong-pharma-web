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
 */
@Component({
  selector: 'app-gev-page',
  imports: [CdkListbox, CdkOption],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>three.js · vector globe · snapshot replay</p>
      <h1 data-reveal>God's eye view</h1>
      <p class="lede" data-reveal>
        A spy-satellite console built on the FUI vocabulary the other three.js pages share. The
        globe is drawn straight from a TopoJSON world file — arcs as line segments, so coastlines
        and borders cost one draw call and no decoder. Aircraft are dead-reckoned from a captured
        frame, satellites propagated from their orbital elements. Drag to spin it; switch sensors
        below.
      </p>
    </section>

    <div class="card glass" data-reveal>
      <div class="card-head">
        <span class="eyebrow">KH11-4894 · OPS-4120</span>
        <h3>Spatial intelligence console</h3>
      </div>

      <div
        class="stage"
        #stage
        [style.filter]="stageFilter()"
        (pointermove)="onMove($event)"
        (pointerdown)="onDown($event)"
        (pointerup)="onUp()"
        (pointerleave)="onUp()"
      >
        <canvas #canvas role="img" aria-label="Decorative animation: a rotating globe showing 631 aircraft, 140 satellites and 160 recent earthquakes, replayed from a captured snapshot. The nearby aircraft it plots are listed in the contacts rail beside it."></canvas>

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

        @if (mode() === 'crt') { <div class="scanlines"></div> }
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>

      <div class="tray" role="group" aria-label="Sensor mode">
        @for (s of sensors; track s.id) {
          <button type="button" class="preset" [class.on]="mode() === s.id" [attr.aria-pressed]="mode() === s.id" (click)="setMode(s)">
            {{ s.label }}
          </button>
        }
      </div>

      <p class="note">
        After <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noopener">God's Eye View</a>
        by Bilawal Sidhu (MIT). This is an independent reimplementation of the look on this app's
        three.js stack — no upstream code and no CesiumJS. Contact data captured from adsb.lol,
        orbital elements from Celestrak, seismic events from USGS; each remains the property of its
        source.
      </p>
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
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    h1 { font-size: clamp(1.5rem, 3.2vw, 2.3rem); margin: 6px 0 10px; max-width: 900px; }
    .lede { color: var(--on-ink-dim); max-width: 860px; margin-bottom: 20px; }
    .card { padding: 14px 16px; }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-head h3 { font-size: 18px; }
    /* container-type lets the rail size itself in cqw, so it tracks the canvas's own 1600x900
       coordinate space at any stage width instead of drifting out of alignment with it. */
    .stage { position: relative; container-type: size; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--hairline); background: #05090c; touch-action: none; cursor: grab; }
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
    .tray { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
    .preset { font: 500 10px/1 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.14em; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--hairline); background: transparent; color: var(--on-ink-dim); cursor: pointer; transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
    .preset:hover { color: var(--on-ink); border-color: var(--teal); }
    .preset.on { color: var(--teal); border-color: var(--teal); }
    .note { margin-top: 12px; font-size: 12px; color: var(--on-ink-faint); max-width: 820px; }
    .note a { color: var(--teal); }
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
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly gsap = inject(GsapService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: GevScene | null = null;
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

  onMove(e: PointerEvent): void {
    const r = this.stage().nativeElement.getBoundingClientRect();
    this.scene?.track(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  }

  onDown(e: PointerEvent): void {
    // Dragging the globe must not start when the pointer went down on the rail.
    if ((e.target as HTMLElement).closest('.rail')) return;
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
