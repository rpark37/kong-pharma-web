import { Component } from '@angular/core';
import { BayesVisualizationComponent } from './components/bayes-visualization/bayes-visualization.component';

@Component({
  selector: 'app-root',
  imports: [BayesVisualizationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
