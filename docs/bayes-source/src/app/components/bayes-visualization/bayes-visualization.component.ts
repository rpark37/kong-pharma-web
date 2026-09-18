import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, effect, computed } from '@angular/core';
import { FormConfig, BayesData } from '../../models/bayes-data.model';
import { DataGeneratorService } from '../../services/data-generator.service';
import { MorphChartsService } from '../../services/morphcharts.service';

@Component({
  selector: 'app-bayes-visualization',
  standalone: true,
  templateUrl: './bayes-visualization.component.html',
  styleUrl: './bayes-visualization.component.scss'
})
export class BayesVisualizationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('morphchartsContainer', { static: true }) containerRef!: ElementRef<HTMLElement>;

  formConfig = signal<FormConfig>({
    count: 1000,
    sensitivity: 0.9,
    specificity: 0.91,
    prior: 0.01,
    transitionDuration: 2000,
    transitionStaggering: 1000
  });

  private data = computed<BayesData>(() => {
    return this.dataGenerator.generateData(this.formConfig());
  });

  private currentLayoutIndex = 0;
  private isInitialized = false;

  constructor(
    private dataGenerator: DataGeneratorService,
    private morphChartsService: MorphChartsService
  ) {
    effect(() => {
      if (this.isInitialized) {
        const config = this.formConfig();
        this.morphChartsService.updateConfig(config);
        const data = this.data();
        this.morphChartsService.layout(this.currentLayoutIndex, data, config, false);
      }
    });
  }

  ngAfterViewInit(): void {
    this.morphChartsService.initialize(this.containerRef.nativeElement);
    this.isInitialized = true;

    const config = this.formConfig();
    const data = this.data();
    this.morphChartsService.layout(0, data, config, false);
  }

  ngOnDestroy(): void {
    this.morphChartsService.destroy();
  }

  updateCount(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value > 0) {
      this.formConfig.update(config => ({ ...config, count: value }));
    }
  }

  updateSensitivity(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.formConfig.update(config => ({ ...config, sensitivity: value }));
  }

  updateSpecificity(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.formConfig.update(config => ({ ...config, specificity: value }));
  }

  updatePrior(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.formConfig.update(config => ({ ...config, prior: value }));
  }

  updateTransitionDuration(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.formConfig.update(config => ({ ...config, transitionDuration: value }));
  }

  updateTransitionStaggering(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.formConfig.update(config => ({ ...config, transitionStaggering: value }));
  }

  onReset(): void {
    this.morphChartsService.reset();
  }

  onPrev(): void {
    if (this.currentLayoutIndex === 0) {
      this.currentLayoutIndex = 3;
    } else {
      this.currentLayoutIndex--;
    }
    const config = this.formConfig();
    const data = this.data();
    this.morphChartsService.layout(this.currentLayoutIndex, data, config, true);
  }

  onNext(): void {
    if (this.currentLayoutIndex === 3) {
      this.currentLayoutIndex = 0;
    } else {
      this.currentLayoutIndex++;
    }
    const config = this.formConfig();
    const data = this.data();
    this.morphChartsService.layout(this.currentLayoutIndex, data, config, true);
  }
}
