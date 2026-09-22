import { inject } from '@angular/core';
import { Router, Routes, UrlSegment } from '@angular/router';

/** `gene-rab5a` and friends: one segment (see above) carrying the symbol, bound to the page's `symbol` input. */
const geneMatcher = (segments: UrlSegment[]) => {
  const m = segments.length === 1 ? /^gene-([a-z0-9]+)$/i.exec(segments[0].path) : null;
  return m ? { consumed: segments, posParams: { symbol: new UrlSegment(m[1].toUpperCase(), {}) } } : null;
};

/** The old per-topic science routes are chapters of one dossier now; keep the links alive. */
const chapter = (fragment: string) => () => inject(Router).createUrlTree(['/science'], { fragment });

// Every path is a single segment on purpose. angular.json sets baseHref "./" for the GitHub Pages
// subfolder deploy, so a two-segment route like science/rac1 makes the browser resolve main.js
// against /science/ and the app never boots. Hyphens, not slashes.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent), title: 'RichOS' },
  { path: 'morphcharts', loadComponent: () => import('./features/morphcharts/morphcharts-page.component').then((m) => m.MorphchartsPageComponent), title: 'MorphCharts client' },
  { path: 'ares', loadComponent: () => import('./features/ares/ares-page.component').then((m) => m.AresPageComponent), title: 'People' },
  { path: 'merchandise', loadComponent: () => import('./features/merchandise/merchandise-page.component').then((m) => m.MerchandisePageComponent), title: 'Google Merchandise' },
  { path: 'atlas', loadComponent: () => import('./features/atlas/atlas-page.component').then((m) => m.AtlasPageComponent), title: 'Human Atlas' },
  { path: 'bayes', loadComponent: () => import('./features/bayes/bayes-page.component').then((m) => m.BayesPageComponent), title: 'Bayes for tests' },
  { path: 'vega-charts', loadComponent: () => import('./features/vega-charts/vega-charts-page.component').then((m) => m.VegaChartsPageComponent), title: 'Vega chart gallery' },
  { path: 'google', loadComponent: () => import('./features/google/google-page.component').then((m) => m.GooglePageComponent), title: 'Google Merchandise Sales' },
  { path: 'hud', loadComponent: () => import('./features/hud/hud-page.component').then((m) => m.HudPageComponent), title: 'Holographic readout' },
  { path: 'site-map', loadComponent: () => import('./features/map/map-page.component').then((m) => m.MapPageComponent), title: 'Site network map' },
  { path: 'gev', loadComponent: () => import('./features/gev/gev-page.component').then((m) => m.GevPageComponent), title: "God's eye view" },
  { path: 'sanddance-specs', loadComponent: () => import('./features/sanddance-specs/sanddance-specs-page.component').then((m) => m.SanddanceSpecsPageComponent), title: 'Sanddance Specs' },
  { path: 'transition', loadComponent: () => import('./features/transition/transition-page.component').then((m) => m.TransitionPageComponent), title: 'Transition - Deck.gl' },
  { path: 'science', loadComponent: () => import('./features/science/science-page.component').then((m) => m.SciencePageComponent), title: 'Science · the RAS dossier' },
  { matcher: geneMatcher, loadComponent: () => import('./features/science/gene-page.component').then((m) => m.GenePageComponent), title: 'Research' },
  { path: 'science-rac1', redirectTo: chapter('rac1') },
  { path: 'science-trials', redirectTo: chapter('trials') },
  { path: 'science-bladder', redirectTo: chapter('bladder') },
  { path: 'controls', loadComponent: () => import('./features/athena/athena-page.component').then((m) => m.AthenaPageComponent), title: 'Network console' },
  { path: 'osiris', loadComponent: () => import('./features/osiris/osiris-page.component').then((m) => m.OsirisPageComponent), title: 'Osiris board' },
  { path: '**', redirectTo: '' },
];
