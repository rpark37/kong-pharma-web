import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RouteTransitionDirective } from './shared/animation/route-transition.directive';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RouteTransitionDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly links = [
    { path: '/morphcharts', label: 'MorphCharts' },
    { path: '/ares', label: 'Ares' },
    { path: '/merchandise', label: 'Merchandise' },
    { path: '/atlas', label: 'Human Atlas' },
    { path: '/bayes', label: 'Bayes' },
  ];
}
