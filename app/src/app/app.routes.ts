import { Routes } from '@angular/router';

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
  { path: 'transition', loadComponent: () => import('./features/transition/transition-page.component').then((m) => m.TransitionPageComponent), title: 'Transition - Deck.gl' },
  { path: 'science-rac1', loadComponent: () => import('./features/science/rac1-page.component').then((m) => m.Rac1PageComponent), title: 'RAC1 target dossier' },
  { path: 'science-trials', loadComponent: () => import('./features/science/trials-page.component').then((m) => m.TrialsPageComponent), title: 'Trial landscape' },
  { path: 'science-bladder', loadComponent: () => import('./features/science/bladder-page.component').then((m) => m.BladderPageComponent), title: 'Bladder carcinoma targets' },
  { path: 'controls', loadComponent: () => import('./features/athena/athena-page.component').then((m) => m.AthenaPageComponent), title: 'Network console' },
  { path: '**', redirectTo: '' },
];
