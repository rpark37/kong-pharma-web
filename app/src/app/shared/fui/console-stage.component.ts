import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

/**
 * The full-screen frame the three.js consoles (God's Eye, the holographic readout, the site map)
 * share. The host takes the viewport below the nav, black to the edges, and the stage inside it
 * is the largest 16:9 box that fits — full width on a wide-and-short viewport, full height on a
 * tall one, letterboxed either way.
 *
 * 16:9 is a hard constraint, not taste. Each console paints its chrome on a 1600x900 canvas that
 * is stretched over the whole stage, so any other ratio squashes the drawing and drifts DOM
 * islands (positioned in cqw) off the panels they sit on. The Fullscreen button hands the
 * `.console` wrapper, not the stage, to the Fullscreen API: the UA forces the fullscreen element
 * to the screen's own ratio, and the stage keeps 16:9 inside it.
 *
 * Pages project their canvas and any overlays as content, size their scene from `stageElement()`
 * with a ResizeObserver, and get pointer positions normalised to the stage through `track`. Two
 * islands are the component's own: Info / Fullscreen under the painted REC stamp, and the info
 * panel that shows the page's `[console-info]` content — the lede and attribution that used to
 * sit around the card.
 */
@Component({
  selector: 'app-console-stage',
  template: `
    <div class="console" #console [style.background]="background()" (keydown.escape)="info.set(false)">
      <div
        class="stage"
        #stage
        data-reveal
        [class.draggable]="draggable()"
        [style.background]="background()"
        [style.filter]="filter()"
        (pointermove)="onMove($event)"
        (pointerdown)="onDown($event)"
        (pointerup)="dragEnd.emit()"
        (pointerleave)="dragEnd.emit()"
      >
        <!-- The visible title is painted by each console's overlay; this one is for the document outline. -->
        <h1 class="sr-only">{{ label() }}</h1>

        <ng-content />

        <!-- Right column: under the painted REC stamp (y 78 of 900) and above anything at y 216+. -->
        <div class="ui actions">
          <button type="button" class="chip" [class.on]="info()" [attr.aria-expanded]="info()" aria-controls="console-info" (click)="info.set(!info())">
            Info
          </button>
          @if (fullscreenEnabled) {
            <button type="button" class="chip" [class.on]="fullscreen()" (click)="toggleFullscreen()">
              {{ fullscreen() ? 'Exit fullscreen' : 'Fullscreen' }}
            </button>
          }
        </div>

        @if (info()) {
          <div class="ui info" id="console-info" role="region" aria-label="About this console">
            <ng-content select="[console-info]" />
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    /* Height is the viewport minus the sticky nav; the shell's .page is only min-height, so
       flex: 1 would not bound it. */
    :host { display: block; height: calc(100dvh - var(--nav-h)); overflow: hidden; }
    .console { height: 100%; display: grid; place-items: center; }
    /* container-type lets projected islands size themselves in cqw, so they track the overlay's
       own 1600x900 coordinate space at any stage width instead of drifting out of alignment. */
    .stage {
      position: relative;
      container-type: size;
      width: min(100%, calc((100dvh - var(--nav-h)) * 16 / 9));
      aspect-ratio: 16 / 9;
      overflow: hidden;
      touch-action: none;
    }
    .stage.draggable { cursor: grab; }
    .stage.draggable:active { cursor: grabbing; }
    /* In fullscreen the console is the screen, with no nav to subtract. */
    .console:fullscreen .stage { width: min(100%, calc(100dvh * 16 / 9)); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

    /* DOM islands over the canvas. Sized in cqw like the consoles' own overlays, with px floors so
       a phone-width stage stays tappable. */
    .ui { position: absolute; font-family: 'JetBrains Mono', ui-monospace, monospace; color: #e6f6f3; cursor: default; }
    .ui-label { margin: 0 0 0.5cqw; font-size: max(9px, 0.8cqw); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
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
    /* The info panel opens in the left column and out across the middle; a toggle, so nothing
       else has to make room for it. Its text is the page's, so the type rules reach into the
       projected content by element rather than by class. */
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
    .info ::ng-deep .eyebrow { margin: 0 0 0.5cqw; font: 400 max(9px, 0.8cqw)/1.3 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(68, 224, 204, 0.75); }
    .info ::ng-deep .lede { margin: 0 0 0.8cqw; font-size: max(12px, 0.9cqw); line-height: 1.45; color: rgba(230, 246, 243, 0.86); }
    .info ::ng-deep .note { margin: 0; font-size: max(11px, 0.75cqw); line-height: 1.45; color: rgba(230, 246, 243, 0.55); }
    .info ::ng-deep a { color: #44e0cc; }
  `,
})
export class ConsoleStageComponent {
  /** The console's own black, used for the stage and the letterbox around it. */
  readonly background = input('#05090c');
  /** The page title for the document outline; the visible one is painted by the console. */
  readonly label = input.required<string>();
  /** A CSS filter graded over the whole stage (the God's Eye sensor modes). */
  readonly filter = input('none');
  /** Shows the grab cursor for consoles that turn on drag. */
  readonly draggable = input(false);

  /** Pointer position normalised to the stage, -1..1 on both axes, for parallax and tracking. */
  readonly track = output<{ nx: number; ny: number }>();
  /** Pointer went down on the stage itself, not on the rail or a DOM island; capture is taken. */
  readonly dragStart = output<PointerEvent>();
  readonly dragEnd = output<void>();

  /** The lede and attribution, folded into a panel so the stage can have the whole viewport. */
  readonly info = signal(false);
  /** Mirrors `document.fullscreenElement`; the document owns the state, this only reflects it. */
  readonly fullscreen = signal(false);
  /** iOS Safari cannot fullscreen an element, so it never gets a button that would do nothing. */
  readonly fullscreenEnabled = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly console = viewChild.required<ElementRef<HTMLDivElement>>('console');

  constructor() {
    const onFullscreenChange = () => this.fullscreen.set(document.fullscreenElement === this.console().nativeElement);
    afterNextRender(() => document.addEventListener('fullscreenchange', onFullscreenChange));
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      // Navigating away while fullscreen would leave the next page fullscreen with no way out.
      if (this.fullscreen()) void document.exitFullscreen().catch(() => undefined);
    });
  }

  /** The 16:9 box the page's scene should size itself to. */
  stageElement(): HTMLDivElement {
    return this.stage().nativeElement;
  }

  /**
   * The console (not the stage) is what goes fullscreen: the UA stretches the fullscreen element to
   * the screen, and the stage must keep its 16:9 inside that. The page's ResizeObserver picks up
   * the new stage size, so no scene needs a fullscreen-specific path.
   */
  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.console().nativeElement.requestFullscreen();
    } catch {
      // Refused (no user gesture, an iframe without allowfullscreen): the button simply does nothing.
    }
  }

  onMove(e: PointerEvent): void {
    const r = this.stage().nativeElement.getBoundingClientRect();
    this.track.emit({ nx: ((e.clientX - r.left) / r.width) * 2 - 1, ny: ((e.clientY - r.top) / r.height) * 2 - 1 });
  }

  onDown(e: PointerEvent): void {
    // A drag must not start when the pointer went down on a rail, a button or a panel.
    if ((e.target as HTMLElement).closest('.ui, [console-island]')) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.dragStart.emit(e);
  }
}
