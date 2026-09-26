# Therapeutic Tests (Bayes' Theorem)

An Angular 21 application that visualizes Bayes' Theorem applied to therapeutic tests. It demonstrates how sensitivity, specificity, and disease prevalence (prior) affect the interpretation of positive test results.

## Features

- Interactive 3D visualization using MorphCharts
- Adjustable parameters (count, sensitivity, specificity, prior)
- Four different layout views showing:
  1. All people as a single grid
  2. Disease vs healthy split
  3. 2x2 grid of true/false positives/negatives
  4. Positive tests only with probability calculation
- Smooth animated transitions between views

## Development Server

```sh
ng serve
```

Navigate to `http://localhost:4200`. The application will automatically reload when source files change.

## Build

```sh
ng build
```

Build artifacts are stored in the `dist/` directory.

## Running Tests

```sh
ng test
```

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   └── bayes-visualization/   # Main visualization component
│   ├── services/
│   │   ├── morphcharts.service.ts    # MorphCharts integration
│   │   └── data-generator.service.ts # Synthetic data generation
│   └── models/
│       └── bayes-data.model.ts       # TypeScript interfaces
├── index.html
├── main.ts
└── styles.scss
```

## Technologies

- Angular 21 (standalone components)
- Angular Signals for reactive state management
- MorphCharts for 3D visualization
- SCSS for styling
