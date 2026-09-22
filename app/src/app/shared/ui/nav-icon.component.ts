import { Component, computed, input } from '@angular/core';

/**
 * One glyph per nav entry, drawn on a 16-unit grid in the same hand as the page icons: 1.5 px
 * strokes, round caps, `currentColor`. Each has a static part (`d`, or `fill` for dot patterns)
 * and, where the motion needs it, a moving part (`b`) that carries the animation.
 *
 * The animation is the page's verb — bars grow, a globe turns, a radar sweeps — and it plays
 * once, on hover or keyboard focus of the enclosing link, never on a loop. Reduced motion
 * turns it off entirely.
 */
export const NAV_ICONS = {
  data: { motion: 'slide', d: 'M3 4.5c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5v7c0 1.4-2.2 2.5-5 2.5s-5-1.1-5-2.5z', b: 'M3 4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5M3 8c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5' },
  people: { motion: 'bob', d: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4', b: 'M11 7.5a2 2 0 1 0 0-4M12 10c1.5.5 2.5 1.8 2.5 4' },
  merchandise: { motion: 'swing', d: 'M2 2h5.5L14 8.5 8.5 14 2 7.5z', b: 'M5 4.5a.6.6 0 1 0 .01 0' },
  charts: { motion: 'grow', d: 'M2 14h12', b: 'M4 13V7M8 13V3M12 13V9' },
  morphcharts: { motion: 'spin', d: 'M8 2 14 5v6l-6 3-6-3V5z', b: 'M8 8 14 5M8 8 2 5M8 8v6' },
  vega: { motion: 'draw', d: 'M2 2v12h12', b: 'M4 11l3-4 3 2 3-5' },
  transition: { motion: 'slide', d: 'M8 2 14 5 8 8 2 5z', b: 'M2 8l6 3 6-3M2 11l6 3 6-3' },
  sanddance: { motion: 'pulse', d: '', fill: 'M3 11a1.1 1.1 0 1 0 .01 0zM6 6a1.1 1.1 0 1 0 .01 0zM9 9a1.1 1.1 0 1 0 .01 0zM12 4a1.1 1.1 0 1 0 .01 0zM11.5 12a1.1 1.1 0 1 0 .01 0z' },
  examples: { motion: 'bob', d: 'M6 2h4M7 2v4l-4.5 7a1 1 0 0 0 .8 1.5h9.4a1 1 0 0 0 .8-1.5L9 6V2', b: 'M4.5 11h7' },
  bayes: { motion: 'pulse', d: 'M2 2h3v3H2zM6.5 2h3v3h-3zM11 2h3v3h-3zM2 6.5h3v3H2zM11 6.5h3v3h-3zM2 11h3v3H2zM6.5 11h3v3h-3zM11 11h3v3h-3z', fill: 'M6.5 6.5h3v3h-3z' },
  google: { motion: 'bob', d: 'M3 5h10l-1 9H4zM5.5 5V4a2.5 2.5 0 0 1 5 0v1' },
  gev: { motion: 'spin', d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM2 8h12', b: 'M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12' },
  osiris: { motion: 'sweep', d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM8 5a3 3 0 1 0 0 6', b: 'M8 8l4.2-4.2' },
  hud: { motion: 'pulse', d: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3', b: 'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7' },
  siteMap: { motion: 'pulse', d: 'M4 12 8 4l4 8M4 12h8', fill: 'M8 4a1.4 1.4 0 1 0 .01 0zM4 12a1.4 1.4 0 1 0 .01 0zM12 12a1.4 1.4 0 1 0 .01 0z' },
  controls: { motion: 'slide', d: 'M2 4h12M2 8h12M2 12h12', b: 'M10 2.5v3M5 6.5v3M11 10.5v3' },
  science: { motion: 'draw', d: 'M4 2c0 4 8 4 8 8s-8 4-8 4M12 2c0 4-8 4-8 8s8 4 8 4', b: 'M5.5 5h5M5.5 11h5' },
  /** A GTP switch: the pill and its knob, which slides on. */
  ras: { motion: 'slide', d: 'M5 5h6a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6z', b: 'M11 6.6a1.4 1.4 0 1 0 .01 0z' },
  /** A short stretch of helix: any gene. */
  gene: { motion: 'draw', d: 'M4 2c0 4 8 4 8 8s-8 4-8 4M12 2c0 4-8 4-8 8s8 4 8 4', b: 'M6 5h4M6 11h4' },
  rac1: { motion: 'focus', d: 'M8 5a3 3 0 1 0 0 6 3 3 0 1 0 0-6', b: 'M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2' },
  bladder: { motion: 'draw', d: 'M8 2c4 0 6 3 6 6s-2 6-6 6-6-3-6-6 2-6 6-6z', b: 'M8 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4' },
  trials: { motion: 'draw', d: 'M2 14h12', b: 'M2 12c3-6 5-2 7-6s3 1 5-2' },
  atlas: { motion: 'draw', d: 'M8 1.5a1.5 1.5 0 1 0 .01 0z', b: 'M4.5 6h7M8 6v4M8 10l-2.5 4.5M8 10l2.5 4.5' },
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
interface NavIcon { motion: string; d: string; b?: string; fill?: string; }

@Component({
  selector: 'app-nav-icon',
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" [attr.data-motion]="icon().motion">
      @if (icon().d) { <path class="a" [attr.d]="icon().d" /> }
      @if (icon().b) { <path class="b" [attr.d]="icon().b" /> }
      @if (icon().fill) { <path class="b fill" [attr.d]="icon().fill" /> }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 14px; height: 14px; flex: none; }
    svg { width: 100%; height: 100%; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .fill { fill: currentColor; stroke: none; }
    path { transform-box: fill-box; transform-origin: center; }

    /* Played once per hover/focus of the enclosing link; the verb of each page. */
    $ease: cubic-bezier(0.16, 1, 0.3, 1);
    @each $ctx in 'a:hover', 'summary:hover', 'a:focus-visible', 'summary:focus-visible' {
      :host-context(#{$ctx}) {
        svg[data-motion='spin'] { animation: spin 0.6s #{$ease}; }
        svg[data-motion='sweep'] .b { transform-origin: 50% 50%; transform-box: view-box; animation: sweep 0.6s linear; }
        svg[data-motion='grow'] .b { transform-origin: 50% 100%; animation: grow 0.45s #{$ease}; }
        svg[data-motion='draw'] .b { stroke-dasharray: 40; animation: draw 0.5s #{$ease}; }
        svg[data-motion='pulse'] .b { animation: pulse 0.45s #{$ease}; }
        svg[data-motion='slide'] .b { animation: slide 0.45s #{$ease}; }
        svg[data-motion='swing'] { animation: swing 0.5s #{$ease}; }
        svg[data-motion='bob'] { animation: bob 0.4s #{$ease}; }
        svg[data-motion='focus'] .b { animation: focus 0.4s #{$ease}; }
      }
    }
    @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes sweep { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes grow { from { transform: scaleY(0.15); } to { transform: scaleY(1); } }
    @keyframes draw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes pulse { 0% { transform: scale(0.55); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes slide { from { transform: translateX(-3px); } to { transform: translateX(0); } }
    @keyframes swing { from { transform: rotate(-14deg); } to { transform: rotate(0); } }
    @keyframes bob { 0% { transform: translateY(2px); } 100% { transform: translateY(0); } }
    @keyframes focus { from { transform: scale(1.5); opacity: 0.3; } to { transform: scale(1); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { svg, path { animation: none !important; } }
  `,
})
export class NavIconComponent {
  readonly name = input.required<NavIconName>();
  readonly icon = computed(() => NAV_ICONS[this.name()] as NavIcon);
}
