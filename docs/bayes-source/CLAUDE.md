# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Angular 21 application that visualizes Bayes' Theorem applied to therapeutic tests. It demonstrates how sensitivity, specificity, and disease prevalence (prior) affect the interpretation of positive test results. The visualization uses the MorphCharts library for 3D data visualization.

## Running the Project

### Development Server
```sh
ng serve
```
Navigate to `http://localhost:4200`. The application will automatically reload when source files change.

### Production Build
```sh
ng build
```
Build artifacts are stored in the `dist/` directory.

### Running Tests
```sh
ng test
```

## Architecture

```
src/
├── app/
│   ├── app.ts                    # Root component
│   ├── app.html                  # Root template
│   ├── app.scss                  # Root styles
│   ├── app.config.ts             # App configuration
│   ├── components/
│   │   └── bayes-visualization/
│   │       ├── bayes-visualization.component.ts    # Main visualization component
│   │       ├── bayes-visualization.component.html  # Template with form controls
│   │       └── bayes-visualization.component.scss  # Component styles
│   ├── services/
│   │   ├── morphcharts.service.ts    # MorphCharts initialization & rendering
│   │   └── data-generator.service.ts # Synthetic data generation
│   └── models/
│       └── bayes-data.model.ts       # TypeScript interfaces
├── index.html
├── main.ts
└── styles.scss
```

## Key Dependencies

- **Angular 21** - Frontend framework with standalone components
- **MorphCharts** - 3D visualization library (`npm install morphcharts`)
- **Angular Signals** - Used for reactive state management

## Visualization Concepts

The visualization generates synthetic data based on four input parameters:
- **Count** - Total population size
- **Sensitivity** - True positive rate (proportion of diseased correctly identified)
- **Specificity** - True negative rate (proportion of healthy correctly identified)
- **Prior** - Disease prevalence in the population

### Layout Views (cycled with Next/Prev buttons)

1. **Layout 0**: All people displayed as a single grid
2. **Layout 1**: Split into disease vs healthy facets
3. **Layout 2**: 2x2 grid showing true/false positives/negatives
4. **Layout 3**: Only positive test results, showing probability calculation

## Key Angular Patterns Used

- **Signals**: Used for reactive form state (`signal()`, `computed()`)
- **Effects**: Used to trigger visualization updates when form values change
- **Standalone Components**: No NgModules, components import dependencies directly
- **Service Injection**: MorphChartsService and DataGeneratorService are providedIn: 'root'
