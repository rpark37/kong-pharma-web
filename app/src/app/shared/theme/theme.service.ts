import { Injectable, signal } from '@angular/core';
import type { Theme } from './palette';
import { SURFACES, THEME_KEY, currentTheme } from './surface';

/**
 * Light or dark, chosen from the nav and remembered. The switch is a crossfade of the whole page
 * through the View Transitions API where the browser has it; elsewhere it is instant. Scenes that
 * bake colours into a spec (MorphCharts, Vega) read `theme()` and rebuild.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(currentTheme());

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(next: Theme): void {
    if (next === this.theme()) return;
    const apply = () => {
      document.documentElement.dataset['theme'] = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', SURFACES[next].background);
      this.theme.set(next);
      try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function') { apply(); return; }
    // The attribute flips synchronously; the promise gives Angular a turn to repaint bound colours
    // before the new snapshot is taken.
    document.startViewTransition(() => { apply(); return new Promise<void>((r) => setTimeout(r, 40)); });
  }
}
