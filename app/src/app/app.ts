import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RouteTransitionDirective } from './shared/animation/route-transition.directive';
import { NavIconComponent, type NavIconName } from './shared/ui/nav-icon.component';
import { ThemeService } from './shared/theme/theme.service';

/** A nav entry: either a direct link (`path`) or a labelled group of them (`children`). */
export interface NavItem {
  label: string;
  icon: NavIconName;
  path?: string;
  children?: { path: string; label: string; icon: NavIconName; fragment?: string }[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RouteTransitionDirective, NavIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly links: NavItem[] = [
    {
      label: 'Data',
      icon: 'data',
      children: [
        { path: '/ares', label: 'People', icon: 'people' },
        { path: '/merchandise', label: 'Merchandise', icon: 'merchandise' },
      ],
    },
    {
      label: 'Charts',
      icon: 'charts',
      children: [
        { path: '/morphcharts', label: 'MorphCharts', icon: 'morphcharts' },
        { path: '/vega-charts', label: 'Vega Charts', icon: 'vega' },
        { path: '/transition', label: 'Transition - Deck.gl', icon: 'transition' },
        { path: '/sanddance-specs', label: 'Sanddance Specs', icon: 'sanddance' },
      ],
    },
    {
      label: 'Examples',
      icon: 'examples',
      children: [
        { path: '/bayes', label: 'Clinical (Bayes Theorem)', icon: 'bayes' },
        { path: '/google', label: 'Google Merchandise', icon: 'google' },
        { path: '/gev', label: "God's Eye", icon: 'gev' },
        { path: '/osiris', label: 'Osiris', icon: 'osiris' },
        // The three.js FUI consoles. They kept the original dark instrument palette when the rest
        // of the app went light; that split is deliberate and settled — consoles are dark, reading
        // surfaces are light. See the "Theme" section of /.impeccable.md before proposing to
        // unify them; the cost is concentrated in the 19 hardcoded teal literals inside
        // shared/fui/fui-panels.ts.
        { path: '/hud', label: 'Readout', icon: 'hud' },
        { path: '/site-map', label: 'Site map', icon: 'siteMap' },
        { path: '/controls', label: 'Controls', icon: 'controls' },
      ],
    },
    {
      // One dossier in six chapters — RAS, macropinocytosis, RAC1, the machinery, the bladder
      // indication, the trial field — from public snapshots refreshed by app/scripts/fetch-science.py.
      // The menu lists the genes; each is an anchor inside /science, not a page.
      label: 'Research',
      icon: 'science',
      children: [
        { path: '/science', fragment: 'ras', label: 'RAS · KRAS HRAS NRAS', icon: 'ras' },
        { path: '/science', fragment: 'rac1', label: 'RAC1', icon: 'rac1' },
        { path: '/science', fragment: 'pak1', label: 'PAK1', icon: 'gene' },
        { path: '/science', fragment: 'cdc42', label: 'CDC42', icon: 'gene' },
        { path: '/science', fragment: 'pik3ca', label: 'PIK3CA', icon: 'gene' },
        { path: '/science', fragment: 'pten', label: 'PTEN', icon: 'gene' },
        { path: '/science', fragment: 'slc9a1', label: 'SLC9A1 · NHE1', icon: 'gene' },
        { path: '/science', fragment: 'arf6', label: 'ARF6', icon: 'gene' },
        { path: '/science', fragment: 'rab5a', label: 'RAB5A', icon: 'gene' },
        { path: '/science', fragment: 'rab7a', label: 'RAB7A', icon: 'gene' },
        { path: '/science', fragment: 'mtor', label: 'MTOR', icon: 'gene' },
        { path: '/science', fragment: 'hif1a', label: 'HIF1A', icon: 'gene' },
        { path: '/science', fragment: 'bladder', label: 'Bladder indication', icon: 'bladder' },
        { path: '/science', fragment: 'trials', label: 'Trial field', icon: 'trials' },
      ],
    },
    { path: '/atlas', label: 'Human Atlas', icon: 'atlas' },
  ];

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly theme = inject(ThemeService);

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
