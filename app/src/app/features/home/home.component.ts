import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShaderBackdropComponent } from '../../shared/ui/shader-backdrop.component';

interface LabCard {
  path: string;
  eyebrow: string;
  title: string;
  blurb: string;
  tags: string[];
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, ShaderBackdropComponent],
  template: `
    <!-- The colour field runs the full viewport width behind the hero and fades out by the cards. -->
    <div class="field"><app-shader-backdrop [amount]="0.85" /></div>
    <section class="hero">
      <p class="eyebrow" data-reveal>Visualization labs</p>
      <h1 data-reveal>Four ways to look at data.</h1>
      <p class="lede" data-reveal>
        Every chart here is a Vega-style specification. Two-dimensional reports render with Vega
        (which draws with D3), three-dimensional scenes are path-traced by MorphCharts on WebGPU,
        and the numbers come from DuckDB behind a FastAPI service.
      </p>
    </section>
    <section class="grid">
      @for (card of cards; track card.path) {
        <a class="card glass" [routerLink]="card.path" data-reveal>
          <span class="eyebrow">{{ card.eyebrow }}</span>
          <h2>{{ card.title }}</h2>
          <p>{{ card.blurb }}</p>
          <ul>
            @for (tag of card.tags; track tag) { <li>{{ tag }}</li> }
          </ul>
        </a>
      }
    </section>
  `,
  styles: `
    :host { display: block; position: relative; padding: clamp(2rem, 6vh, 4rem) var(--pad-x) 4rem; max-width: 1200px; margin: 0 auto; width: 100%; }
    .field { position: absolute; top: 0; left: 50%; width: 100vw; height: min(72vh, 640px); transform: translateX(-50%); z-index: 0; pointer-events: none;
             mask-image: linear-gradient(to bottom, black 55%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 55%, transparent 100%); }
    .hero, .grid { position: relative; z-index: 1; }
    .hero { max-width: 760px; margin-bottom: 2.5rem; }
    h1 { font-size: clamp(2rem, 5vw, 3.6rem); font-weight: 700; margin: 8px 0 14px; }
    .lede { color: var(--on-ink-dim); font-size: 17px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card {
      display: flex; flex-direction: column; gap: 10px; padding: 22px; color: var(--on-ink);
      transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
      h2 { font-size: 22px; }
      p { color: var(--on-ink-dim); flex: 1; }
      ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
      li { font-family: var(--font-mono); font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--hairline); color: var(--on-ink-dim); }
      &:hover { border-color: rgba(68, 224, 204, 0.5); transform: translateY(-2px); }
    }
  `,
})
export class HomeComponent {
  readonly cards: LabCard[] = [
    {
      path: '/morphcharts',
      eyebrow: '3D · WebGPU',
      title: 'MorphCharts client',
      blurb: 'The Microsoft MorphCharts editor rebuilt in Angular: write a Vega-style spec, path-trace it, capture it at 8K.',
      tags: ['MorphCharts', 'Vega grammar', 'ray tracing'],
    },
    {
      path: '/ares',
      eyebrow: 'Reports · Vega + D3',
      title: 'People data characterization',
      blurb: 'OHDSI Ares-style reports over a synthetic OMOP dataset: persons, observation periods, density, concepts, quality.',
      tags: ['Vega', 'D3', 'DuckDB'],
    },
    {
      path: '/merchandise',
      eyebrow: 'Analytics · GA4',
      title: 'Google Merchandise Store',
      blurb: 'Sessions, funnel, geography and revenue from the public GA4 e-commerce sample, queried with DuckDB.',
      tags: ['Vega-Lite', 'FastAPI', '3D revenue cube'],
    },
    {
      path: '/screen',
      eyebrow: 'Data · DuckDB-wasm + Mosaic',
      title: 'Screen',
      blurb: 'Ten million assay wells generated inside the browser, a windowed grid and four linked charts that each query DuckDB, brushing coordinated by Mosaic. The bench numbers are on the page.',
      tags: ['DuckDB-wasm', 'Mosaic', 'Vega-Lite'],
    },
    {
      path: '/atlas',
      eyebrow: 'Anatomy · three.js + MorphCharts',
      title: 'Human Atlas',
      blurb: 'The human-atlas explorer: the real BodyParts3D meshes in three.js, or the same 2,234 structures as a spec-driven MorphCharts scene, with explode, isolate and search.',
      tags: ['three.js', 'MorphCharts', 'BodyParts3D', 'GSAP'],
    },
    {
      path: '/bayes',
      eyebrow: 'Explainer · Vega-Lite',
      title: 'Bayes for therapeutic tests',
      blurb: 'A synthetic population of blocks morphs through four views to show what a positive test really means, with natural frequencies and the PPV curve alongside.',
      tags: ['MorphCharts', 'Vega-Lite', 'GSAP'],
    },
    {
      path: '/vega-charts',
      eyebrow: 'Gallery · Vega-Lite',
      title: 'Chart gallery',
      blurb: 'Fifteen Vega-Lite specifications with their data inlined, each editable in place: change the JSON, apply it, and the chart re-renders.',
      tags: ['Vega-Lite', 'spec editor'],
    },
  ];
}
