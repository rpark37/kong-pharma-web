import { Component, computed, input } from '@angular/core';

/**
 * The app's instrument glyphs, drawn on a 16-unit grid in one hand: 1.5 px strokes, round caps,
 * `currentColor`. Each is one `d` string (subpaths allowed), so an icon is a table row rather than
 * a component. `fill` ones are dot patterns, painted not stroked. Nav entries have their own
 * animated set in nav-icon.component.ts.
 */
export const GLYPHS = {
  count: { d: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z' },
  /** One filled block among nine: a prior. */
  prior: { d: 'M2 2h3v3H2zM6.5 2h3v3h-3zM11 2h3v3h-3zM2 6.5h3v3H2zM11 6.5h3v3h-3zM2 11h3v3H2zM6.5 11h3v3h-3zM11 11h3v3h-3z', fill: 'M6.5 6.5h3v3h-3z' },
  /** Crosshair: what the test catches. */
  sensitivity: { d: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7' },
  /** Check in a ring: what the test clears. */
  specificity: { d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM5.3 8.2l1.9 1.9 3.6-4' },
  motion: { d: 'M8 4.5a5 5 0 1 0 0 10 5 5 0 1 0 0-10zM8 9.5V6.5M6.3 1.8h3.4' },
  duration: { d: 'M2 8h10M8.5 4.5 12 8l-3.5 3.5' },
  stagger: { d: 'M2 4h6M4.5 8h6M7 12h6' },
  ppv: { d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM8 5v6M5 8h6' },
  npv: { d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM5 8h6' },
  lrPlus: { d: 'M3.5 12.5 12.5 3.5M6 3.5h6.5V10' },
  lrMinus: { d: 'M3.5 3.5 12.5 12.5M6 12.5h6.5V6' },
  /** A fork: the population splitting. */
  flow: { d: 'M8 2v4.5M8 6.5 3.5 10.5V14M8 6.5l4.5 4V14' },
  bars: { d: 'M2 13.5h12M4.5 13V8M8 13V3.5M11.5 13V6' },
  dots: { d: '', fill: 'M2.5 2.5h2.5v2.5H2.5zM6.75 2.5h2.5v2.5h-2.5zM11 2.5h2.5v2.5H11zM2.5 6.75h2.5v2.5H2.5zM6.75 6.75h2.5v2.5h-2.5zM11 6.75h2.5v2.5H11zM2.5 11h2.5v2.5H2.5zM6.75 11h2.5v2.5h-2.5zM11 11h2.5v2.5H11z' },
  curve: { d: 'M2 13.5C5 13.5 5.5 2.5 14 2.5' },
  camera: { d: 'M2 5.5a1.5 1.5 0 0 1 1.5-1.5H5l1-1.5h4l1 1.5h1.5A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5zM8 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5' },
  zoom: { d: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM10.3 10.3 14 14M5 7h4M7 5v4' },
  render: { d: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z', fill: 'M9 9h5v5H9z' },
  /** A globe with an orbit line: drag to look around. */
  orbit: { d: 'M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM1.5 9.5c2.5-1 10.5-1 13 0' },
  search: { d: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM10.3 10.3 14 14' },
  info: { d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM8 7.2v4M8 4.9v.2' },
  close: { d: 'M4 4l8 8M12 4l-8 8' },
  /** Counter-clockwise arc with an arrowhead: back to the start. */
  reset: { d: 'M3.6 6.2A4.8 4.8 0 1 1 3.4 9.8M3 3.2v3.3h3.3' },
  pause: { d: 'M5.5 3.5v9M10.5 3.5v9' },
  /** Four arrows from the centre: parts flying apart. */
  explode: { d: 'M6.3 6.3 3 3M3 6V3h3M9.7 6.3 13 3M10 3h3v3M6.3 9.7 3 13M3 10v3h3M9.7 9.7 13 13M13 10v3h-3' },
  /** Three stacked plates: the system layers. */
  layers: { d: 'M8 2l6 3.2L8 8.4 2 5.2zM2 8.2l6 3.2 6-3.2M2 11.2l6 3.2 6-3.2' },
  /** Reticle with a centre dot: one structure, framed. */
  isolate: { d: 'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2', fill: 'M8 6.9a1.1 1.1 0 1 0 .01 0z' },
  chevron: { d: 'M6 3.5 10.5 8 6 12.5' },
  external: { d: 'M6.5 3H3v10h10V9.5M9 3h4v4M13 3 7.5 8.5' },
  body: { d: 'M8 1.5a1.5 1.5 0 1 0 .01 0zM4.5 6h7M8 6v4M8 10l-2.5 4.5M8 10l2.5 4.5' },
  /** Transport: the same keys the Bayes deck draws inline. */
  prev: { d: 'M4 3.5v9', fill: 'M12 3.5 6 8l6 4.5z' },
  next: { d: 'M12 3.5v9', fill: 'M4 3.5 10 8l-6 4.5z' },
  play: { d: '', fill: 'M5 3.5v9l8-4.5z' },
  shuffle: { d: 'M2 4h2.5l6 8H14M2 12h2.5l1.6-2.1M9.2 6.1 10.5 4H14M12 2l2 2-2 2M12 10l2 2-2 2' },
} as const;

export type GlyphName = keyof typeof GLYPHS;

@Component({
  selector: 'app-glyph',
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      @if (icon().d) { <path [attr.d]="icon().d" /> }
      @if (icon().fill) { <path class="fill" [attr.d]="icon().fill" /> }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 12px; height: 12px; flex: none; vertical-align: -1px; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .fill { fill: currentColor; stroke: none; }
  `,
})
export class GlyphComponent {
  readonly name = input.required<GlyphName>();
  readonly icon = computed(() => GLYPHS[this.name()] as { d: string; fill?: string });
}
