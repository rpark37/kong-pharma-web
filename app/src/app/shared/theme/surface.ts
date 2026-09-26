import type { Theme } from './palette';

/** The colours a 3D scene bakes into its spec: what the page's paper looks like from inside the render. */
export interface SceneSurface { background: string; backdrop: string; plate: string; text: string; grid: string; }

export const SURFACES: Record<Theme, SceneSurface> = {
  light: { background: '#F5F5F3', backdrop: '#E8E8E6', plate: '#E4E4E1', text: '#2D2D2D', grid: '#D4D4D2' },
  dark: { background: '#171C1A', backdrop: '#1F2523', plate: '#242B28', text: '#E7E5E0', grid: '#3A423E' },
};

export const THEME_KEY = 'richos-theme';

/** The theme in force, as the `data-theme` attribute index.html sets before first paint. */
export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
}

export function sceneSurface(): SceneSurface {
  return SURFACES[currentTheme()];
}
