import { Component, computed, input } from '@angular/core';

/**
 * The Bayes page's glyphs, drawn on a 16-unit grid in the same hand as the transport keys:
 * 1.5 px strokes, round caps, `currentColor`. Each is one `d` string (subpaths allowed), so an
 * icon is a table row rather than a component. `fill` ones are dot patterns, painted not stroked.
 */
export const BAYES_ICONS = {
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
} as const;

export type BayesIconName = keyof typeof BAYES_ICONS;

@Component({
  selector: 'app-bayes-icon',
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
export class BayesIconComponent {
  readonly name = input.required<BayesIconName>();
  readonly icon = computed(() => BAYES_ICONS[this.name()] as { d: string; fill?: string });
}
