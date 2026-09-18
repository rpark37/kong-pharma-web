import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent), title: "Kong's Labs" },
  { path: 'morphcharts', loadComponent: () => import('./features/morphcharts/morphcharts-page.component').then((m) => m.MorphchartsPageComponent), title: 'MorphCharts client' },
  { path: 'ares', loadComponent: () => import('./features/ares/ares-page.component').then((m) => m.AresPageComponent), title: 'People' },
  { path: 'merchandise', loadComponent: () => import('./features/merchandise/merchandise-page.component').then((m) => m.MerchandisePageComponent), title: 'Google Merchandise' },
  { path: 'atlas', loadComponent: () => import('./features/atlas/atlas-page.component').then((m) => m.AtlasPageComponent), title: 'Human Atlas' },
  { path: 'bayes', loadComponent: () => import('./features/bayes/bayes-page.component').then((m) => m.BayesPageComponent), title: 'Bayes for tests' },
  { path: 'vega-charts', loadComponent: () => import('./features/vega-charts/vega-charts-page.component').then((m) => m.VegaChartsPageComponent), title: 'Vega chart gallery' },
  { path: 'google', loadComponent: () => import('./features/google/google-page.component').then((m) => m.GooglePageComponent), title: 'Google Merchandise Sales' },
  { path: '**', redirectTo: '' },
];
