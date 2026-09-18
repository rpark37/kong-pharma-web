import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RouteTransitionDirective } from './shared/animation/route-transition.directive';

/** A nav entry: either a direct link (`path`) or a labelled group of them (`children`). */
export interface NavItem {
  label: string;
  path?: string;
  children?: { path: string; label: string }[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RouteTransitionDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly links: NavItem[] = [
    {
      label: 'Data',
      children: [
        { path: '/ares', label: 'People' },
        { path: '/merchandise', label: 'Merchandise' },
      ],
    },
    {
      label: 'Charts',
      children: [
        { path: '/morphcharts', label: 'MorphCharts' },
        { path: '/vega-charts', label: 'Vega Charts' },
        { path: '/transition', label: 'Transition - Deck.gl' },
        { path: '/sanddance-specs', label: 'Sanddance Specs' },
      ],
    },
    {
      label: 'Examples',
      children: [
        { path: '/bayes', label: 'Clinical (Bayes Theorem)' },
        { path: '/google', label: 'Google Merchandise' },
        { path: '/gev', label: "God's Eye" },
      ],
    },
    {
      // The three.js FUI scenes, grouped apart because they are their own family: they kept the
      // original dark instrument palette when the rest of the app went light. That split is
      // deliberate and settled — consoles are dark, reading surfaces are light. See the "Theme"
      // section of /.impeccable.md before proposing to unify them; the cost is concentrated in
      // the 19 hardcoded teal literals inside shared/fui/fui-panels.ts.
      label: 'HUD',
      children: [
        { path: '/hud', label: 'Readout' },
        { path: '/site-map', label: 'Site map' },
        { path: '/controls', label: 'Controls' },
      ],
    },
    {
      // Public evidence for the pipeline: XTL-152's target, K-119's indication, and the
      // competitive field around all three programmes. Snapshots, refreshed by
      // app/scripts/fetch-science.py.
      label: 'Science',
      children: [
        { path: '/science-rac1', label: 'RAC1 target' },
        { path: '/science-bladder', label: 'Bladder targets' },
        { path: '/science-trials', label: 'Trial landscape' },
      ],
    },
    { path: '/atlas', label: 'Human Atlas' },
  ];

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** <details> stays open on its own, so close any menu the click landed outside of. */
  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    for (const menu of this.openMenus()) {
      if (!menu.contains(event.target as Node)) menu.open = false;
    }
  }

  /** <details> has no native Escape handling; without this a keyboard user is stuck in the menu. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    for (const menu of this.openMenus()) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  }

  private openMenus(): HTMLDetailsElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLDetailsElement>('.nav details[open]'));
  }
}
