import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { GsapService } from '../../shared/animation/gsap.service';
import { VegaChartComponent } from '../../shared/vega/vega-chart.component';
import { PRESETS, bayes, predictiveCurve } from './bayes';
import { LAYOUT_NAMES, type FormConfig } from './bayes-data.model';
import { generateBayesData } from './bayes-data-generator';
import type { BayesScene } from './bayes-scene';
import type { MorphChartsHost } from '../../shared/morphcharts/morphcharts-host';
import { MorphchartsCanvasComponent } from '../../shared/morphcharts/morphcharts-canvas.component';
import { WebGpuFallbackComponent } from '../../shared/webgpu/webgpu-fallback.component';
import { curveSpec, iconArraySpec, outcomeSpec } from './bayes-specs';

/**
 * Therapeutic Tests (Bayes' Theorem): the user's original MorphCharts morphing visualization,
 * ported into the labs app, followed by Vega-Lite companions that share the same inputs.
 */
@Component({
  selector: 'app-bayes-page',
  imports: [DecimalPipe, PercentPipe, VegaChartComponent, MorphchartsCanvasComponent, WebGpuFallbackComponent],
  template: `
    <section class="head">
      <p class="eyebrow" data-reveal>Therapeutic tests · Bayes' theorem</p>
    </section>

    <section class="layout">
      <form class="controls glass" data-reveal (submit)="$event.preventDefault()">
        <!-- Transport: the four views as a segmented progress rail plus tape-deck keys. The active
             segment fills over the real morph time (duration + stagger), so the bar is a readout of
             the transition, not decoration. -->
        <div class="transport" role="group" aria-label="Views" (keydown.arrowleft)="onPrev()" (keydown.arrowright)="onNext()">
          <!-- Only the counter is visible; the view name stays for the accessibility tree and the segment tooltips. -->
          <h2 class="transport-title"><span class="transport-label">{{ layoutIndex() + 1 | number: '2.0-0' }}/04</span><span class="sr-only">{{ layoutName() }}</span></h2>
          <!-- The progress strip is the deck's top edge: a tape counter on the transport. -->
          <div class="deck">
            <ol class="segments" [style.--fill-ms]="fillMs() + 'ms'">
              @for (name of layoutNames; track name; let i = $index) {
                <li [class.active]="i === layoutIndex()" [class.filling]="i === layoutIndex() && transitioning()">
                  <button type="button" [attr.aria-label]="'View ' + (i + 1) + ': ' + name" [attr.aria-current]="i === layoutIndex() ? 'true' : null" [title]="name" (click)="jump(i)"><span class="fill"></span></button>
                </li>
              }
            </ol>
            <div class="keys">
            <button type="button" class="key" (click)="onReset()" aria-label="Reset camera" title="Reset camera">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2" /><path d="M3.5 3.5v3h3" /></svg>
            </button>
            <button type="button" class="key" (click)="onPrev()" [disabled]="transitioning()" aria-label="Previous view" title="Previous view (←)">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5v9" /><path class="solid" d="M12 3.5 6 8l6 4.5z" /></svg>
            </button>
            <button type="button" class="key play" (click)="togglePlay()" [attr.aria-pressed]="playing()" [attr.aria-label]="playing() ? 'Pause' : 'Play all views'" [title]="playing() ? 'Pause' : 'Play all views'">
              @if (playing()) {
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>
              } @else {
                <svg viewBox="0 0 16 16" aria-hidden="true"><path class="solid" d="M5 3.5v9l8-4.5z" /></svg>
              }
            </button>
            <button type="button" class="key" (click)="onNext()" [disabled]="transitioning()" aria-label="Next view" title="Next view (→)">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3.5v9" /><path class="solid" d="M4 3.5 10 8l-6 4.5z" /></svg>
            </button>
            </div>
          </div>
        </div>

        <!-- Scenario presets as a second segmented rail: short codes on the keys, the full name as
             the caption beneath (and the tooltip), so four wrapping pills become one row. -->
        <div class="presets" role="group" aria-label="Scenario preset">
          <div class="rail">
            @for (p of presets; track p.id) {
              <button type="button" class="key code" [class.on]="preset() === p.id" [attr.aria-pressed]="preset() === p.id" (click)="apply(p.id)" [attr.aria-label]="p.name" [title]="p.name + ' — ' + p.note">{{ p.short }}</button>
            }
          </div>
          <p class="caption">{{ activePreset()?.name ?? 'Custom inputs' }}</p>
        </div>
        <div class="field">
          <span title="People in the synthetic population — one block each in the grid">Count <output>{{ form().count | number }}</output></span>
          <div class="stepper" role="group" aria-label="Count">
            <button type="button" class="key" (click)="setCount(form().count - 100)" [disabled]="form().count <= 1" aria-label="100 fewer people" title="−100">−</button>
            <input type="number" min="1" max="20000" step="1" [value]="form().count" (change)="setCount(+$any($event.target).value)" aria-label="Count">
            <button type="button" class="key" (click)="setCount(form().count + 100)" [disabled]="form().count >= 20000" aria-label="100 more people" title="+100">+</button>
          </div>
        </div>
        <div class="field">
          <span title="Prevalence — the pre-test probability of the condition">Prior <output>{{ form().prior | percent: '1.1-2' }}</output></span>
          <input type="range" min="0" max="1" step="0.001" [value]="form().prior" (input)="set('prior', +$any($event.target).value)" aria-label="Prior">
          <small>1 in {{ 1 / (form().prior || 0.0001) | number: '1.0-0' }} have it</small>
        </div>
        <div class="field">
          <span title="Of people with the condition, the share the test catches">Sensitivity <output>{{ form().sensitivity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="form().sensitivity" (input)="set('sensitivity', +$any($event.target).value)" aria-label="Sensitivity">
        </div>
        <div class="field">
          <span title="Of people without it, the share the test clears">Specificity <output>{{ form().specificity | percent: '1.0-1' }}</output></span>
          <input type="range" min="0" max="1" step="0.005" [value]="form().specificity" (input)="set('specificity', +$any($event.target).value)" aria-label="Specificity">
        </div>
        <div class="group" role="group" aria-labelledby="bayes-motion">
          <p class="group-label" id="bayes-motion">Motion</p>
          <div class="field">
            <span title="How long each block takes to travel between views">Duration <output>{{ form().transitionDuration }}ms</output></span>
            <input type="range" min="0" max="10000" step="100" [value]="form().transitionDuration" (input)="set('transitionDuration', +$any($event.target).value)" aria-label="Transition duration">
          </div>
          <div class="field">
            <span title="Blocks start one after another across this window; each eases with a cubic in-out">Stagger <output>{{ form().transitionStaggering }}ms</output></span>
            <input type="range" min="0" max="10000" step="100" [value]="form().transitionStaggering" (input)="set('transitionStaggering', +$any($event.target).value)" aria-label="Transition staggering">
          </div>
        </div>
      </form>

      <div class="results">
        <div class="viz glass wide" data-reveal>
          <div #morphchartsContainer class="morphcharts-container">
            @if (!fallback()) {
              <app-morphcharts-canvas (hostReady)="onHost($event)" (failed)="fallback.set($event)" />
              <span class="hint">Drag to orbit · wheel to zoom · Reset returns the camera</span>
            } @else {
              <div class="fallback-wrap"><app-webgpu-fallback title="The block views need WebGPU"><p class="fallback-text">{{ fallback() }} The Vega charts below show the same numbers.</p></app-webgpu-fallback></div>
            }
          </div>
          @if (morphError()) { <p class="err">{{ morphError() }}</p> }
        </div>

        <!-- The answer first: PPV is what the whole page is asking. One flat strip, sized by weight. -->
        <dl class="readout" data-reveal>
          <div class="cell primary">
            <dt>Positive predictive value</dt>
            <dd class="value">{{ out().ppv * 100 | number: '1.1-1' }}<span class="unit">%</span></dd>
            <dd class="formula">P(disease | positive)</dd>
          </div>
          <div class="cell">
            <dt>Negative predictive value</dt>
            <dd class="value">{{ out().npv * 100 | number: '1.1-1' }}<span class="unit">%</span></dd>
            <dd class="formula">P(no disease | negative)</dd>
          </div>
          <div class="cell small">
            <dt>LR+</dt>
            <dd class="value">{{ lrPlus() | number: '1.1-1' }}</dd>
            <dd class="formula">Se / (1 − Sp)</dd>
          </div>
          <div class="cell small">
            <dt>LR−</dt>
            <dd class="value">{{ out().lrNegative | number: '1.2-2' }}</dd>
            <dd class="formula">(1 − Se) / Sp</dd>
          </div>
        </dl>

        <div class="tree glass" data-reveal>
          <p class="eyebrow">Natural frequencies · {{ form().count | number }} people tested</p>
          <!-- Two stacked bars whose segments are the counts themselves (flex-grow), so the diagram is
               the data. Level 1 splits the population; level 2 splits each half by test result. -->
          <div class="flow">
            <div class="bar" role="img" [attr.aria-label]="(out().diseased | number: '1.0-0') + ' have the condition, ' + (out().healthy | number: '1.0-0') + ' do not'">
              <span class="seg sick" [style.flex-grow]="out().diseased" [title]="(out().diseased | number: '1.0-0') + ' have the condition'"></span>
              <span class="seg well" [style.flex-grow]="out().healthy" [title]="(out().healthy | number: '1.0-0') + ' do not'"></span>
            </div>
            <div class="row2">
              <div class="leaf"><strong>{{ out().diseased | number: '1.0-0' }}</strong><span><i class="swatch sick"></i>have the condition</span></div>
              <div class="leaf right"><strong>{{ out().healthy | number: '1.0-0' }}</strong><span>do not<i class="swatch well"></i></span></div>
            </div>
            <div class="bar" role="img" [attr.aria-label]="(out().truePositives | number: '1.0-0') + ' true positive, ' + (out().falseNegatives | number: '1.0-0') + ' false negative, ' + (out().falsePositives | number: '1.0-0') + ' false positive, ' + (out().trueNegatives | number: '1.0-0') + ' true negative'">
              <span class="seg tp" [style.flex-grow]="out().truePositives" [title]="(out().truePositives | number: '1.0-0') + ' true positive'"></span>
              <span class="seg fn" [style.flex-grow]="out().falseNegatives" [title]="(out().falseNegatives | number: '1.0-0') + ' false negative'"></span>
              <span class="seg fp" [style.flex-grow]="out().falsePositives" [title]="(out().falsePositives | number: '1.0-0') + ' false positive'"></span>
              <span class="seg tn" [style.flex-grow]="out().trueNegatives" [title]="(out().trueNegatives | number: '1.0-0') + ' true negative'"></span>
            </div>
            <div class="row4">
              <div class="leaf"><strong>{{ out().truePositives | number: '1.0-0' }}</strong><span><i class="swatch tp"></i>true positive</span></div>
              <div class="leaf"><strong>{{ out().falseNegatives | number: '1.0-0' }}</strong><span><i class="swatch fn"></i>false negative · missed</span></div>
              <div class="leaf"><strong>{{ out().falsePositives | number: '1.0-0' }}</strong><span><i class="swatch fp"></i>false positive · alarm</span></div>
              <div class="leaf right"><strong>{{ out().trueNegatives | number: '1.0-0' }}</strong><span>true negative<i class="swatch tn"></i></span></div>
            </div>
          </div>
          <p class="reading">
            Of the <strong>{{ out().positives | number: '1.0-0' }}</strong> people who test positive, <strong>{{ out().truePositives | number: '1.0-0' }}</strong> actually have the condition
            ({{ out().ppv | percent: '1.1-1' }}). Of the <strong>{{ out().negatives | number: '1.0-0' }}</strong> who test negative, <strong>{{ out().falseNegatives | number: '1.0-0' }}</strong> are missed.
          </p>
        </div>

        <figure class="fig" data-reveal>
          <figcaption class="eyebrow">What a result means, in people</figcaption>
          <app-vega-chart [spec]="specs.outcome" [data]="{ outcomes: outcomes() }" [height]="170" />
        </figure>
        <figure class="fig" data-reveal>
          <figcaption class="eyebrow">Icon array · each dot is 1 in 100</figcaption>
          <app-vega-chart [spec]="specs.icons" [data]="{ icons: icons() }" [height]="210" />
        </figure>
        <figure class="fig wide" data-reveal>
          <figcaption class="eyebrow">Predictive values across prevalence</figcaption>
          <app-vega-chart [spec]="specs.curve" [data]="{ curve: curve(), marker: marker() }" [height]="250" />
        </figure>
      </div>
    </section>
    <p class="note" data-reveal>
      <span class="mono">PPV = Se·P / (Se·P + (1−Sp)·(1−P)) &nbsp;·&nbsp; post-test odds = pre-test odds × LR</span>
      Presets are rounded illustrative figures for learning, not clinical guidance. Ported from the therapeutic-tests-bayes-theorem project; the block views are MorphCharts specifications path-traced on WebGPU, the companions are Vega-Lite specifications.</p>
  `,
  styles: `
    :host { display: block; padding: clamp(1.5rem, 4vh, 3rem) var(--pad-x) 4rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    /* The render is the card: no inset, the glass border and radius clip it. */
    .viz { padding: 0; overflow: hidden; }
    /* Transport deck at the top of the 160 px controls column: counter + name on one line, then
       the progress strip fused to the top edge of the key rail. */
    .transport { display: flex; flex-direction: column; gap: 6px; }
    .transport-title { margin: 0; line-height: 1; }
    .transport-label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.1em; color: var(--teal); }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .deck { border: 1px solid var(--hairline); border-radius: 6px; overflow: hidden; background: rgba(0, 0, 0, 0.04); }
    /* Four segments, one per view. The active one is teal; while a morph runs it fills left to
       right over --fill-ms, the real duration + stagger the scene was given. */
    .segments { list-style: none; margin: 0; padding: 3px 3px 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; }
    .segments button { display: block; position: relative; width: 100%; height: 10px; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 1px; }
    .segments button::before { content: ''; position: absolute; inset: 3px 0; border-radius: 1px; background: var(--hairline); transition: background var(--dur-fast) var(--ease-out); }
    .segments button:hover::before { background: rgba(0, 112, 93, 0.35); }
    .segments button:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
    .fill { position: absolute; inset: 3px 0; border-radius: 1px; background: var(--teal); transform: scaleX(0); transform-origin: left; }
    .active .fill { transform: scaleX(1); }
    .filling .fill { animation: fill var(--fill-ms, 1000ms) linear both; }
    @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    /* Segmented rails: hairline dividers, one filled key (play, or the active preset). */
    .keys, .rail { display: grid; }
    .keys { grid-template-columns: 1fr 1fr 1.5fr 1fr; }
    .rail { grid-template-columns: repeat(4, 1fr); border: 1px solid var(--hairline); border-radius: 6px; overflow: hidden; background: rgba(0, 0, 0, 0.04); }
    .key { display: flex; align-items: center; justify-content: center; height: 30px; padding: 0; border: 0; background: none; color: var(--on-ink-dim); cursor: pointer; transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
    .key + .key { border-left: 1px solid var(--hairline); }
    .key:hover { background: rgba(0, 112, 93, 0.08); color: var(--on-ink); }
    .key:active { background: rgba(0, 112, 93, 0.16); }
    .key:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    .key:disabled { opacity: 0.35; cursor: not-allowed; background: none; color: var(--on-ink-dim); }
    .key.play, .key.on { background: var(--teal); color: var(--ink); }
    .key.play:hover, .key.on:hover { background: rgba(0, 112, 93, 0.9); color: var(--ink); }
    .key svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .key svg .solid { fill: currentColor; stroke: none; }
    .key.code { height: 26px; padding: 0 2px; font: 500 9px/1 var(--font-mono); letter-spacing: 0.02em; }
    .presets { display: flex; flex-direction: column; gap: 4px; }
    .caption { margin: 0; font-size: 11px; line-height: 1.3; color: var(--on-ink-dim); }
    @media (prefers-reduced-motion: reduce) { .filling .fill { animation: none; transform: scaleX(1); } }
    .morphcharts-container { position: relative; width: 100%; height: 620px; overflow: hidden; background: var(--ink-2); }
    .morphcharts-container app-morphcharts-canvas { position: absolute; inset: 0; }
    .hint { position: absolute; left: 14px; bottom: 10px; font-size: 11px; color: var(--on-ink-faint); pointer-events: none; }
    .fallback-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .fallback-text { font-size: 12px; color: var(--on-ink-faint); }
    .err { color: var(--rose); font-size: 12px; margin: 0; padding: 8px 14px; }
    .layout { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 16px; align-items: start; }
    .controls { position: sticky; top: calc(var(--nav-h) + 16px); padding: 12px; display: flex; flex-direction: column; gap: 12px; }
    /* Fields: label row + input, help copy in the label's tooltip; only Prior keeps a data caption. */
    .field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
    .field > span { display: flex; justify-content: space-between; gap: 6px; color: var(--on-ink); cursor: help; }
    .field small { color: var(--on-ink-faint); font-size: 11px; line-height: 1.3; }
    /* Count as a stepper rail: the same segmented vocabulary as the transport and preset rails. */
    .stepper { display: grid; grid-template-columns: 26px 1fr 26px; border: 1px solid var(--hairline); border-radius: 6px; overflow: hidden; background: rgba(0, 0, 0, 0.04); }
    .stepper .key { height: 26px; font: 500 14px/1 var(--font-mono); }
    .stepper input[type=number] { font: 500 12px/1 var(--font-mono); color: var(--on-ink); background: none; border: 0; border-left: 1px solid var(--hairline); border-right: 1px solid var(--hairline); border-radius: 0; padding: 0 4px; height: 26px; width: 100%; min-width: 0; box-sizing: border-box; text-align: center; font-variant-numeric: tabular-nums; -moz-appearance: textfield; appearance: textfield; }
    .stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { appearance: none; margin: 0; }
    .stepper input:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
    input[type=range] { width: 100%; margin: 0; }
    output { font-family: var(--font-mono); color: var(--teal); }
    .group { display: flex; flex-direction: column; gap: 10px; margin-top: 2px; padding-top: 10px; border-top: 1px solid var(--hairline); }
    .group-label { margin: 0; font: 500 9px/1 var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-ink-faint); }

    .results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
    /* Readout strip: no cards, hairlines only; hierarchy carried by size, PPV the answer. */
    .readout { grid-column: 1 / -1; display: grid; grid-template-columns: 1.6fr 1.3fr 1fr 1fr; margin: 4px 0 0; border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
    .readout .cell { min-width: 0; padding: 14px 18px 12px; }
    .readout .cell + .cell { border-left: 1px solid var(--hairline); }
    .readout dt { font: 500 10px/1.2 var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--on-ink-dim); }
    .readout dd { margin: 0; }
    .readout .value { margin-top: 6px; font-family: var(--font-display); font-weight: 600; font-size: 24px; line-height: 1.05; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .readout .cell:nth-child(2) .value { font-size: 30px; }
    .readout .primary .value { font-size: 40px; color: var(--teal); }
    .readout .unit { margin-left: 2px; font-size: 0.55em; font-weight: 500; color: var(--on-ink-dim); }
    .readout .formula { margin-top: 4px; font: 400 11px/1.3 var(--font-mono); color: var(--on-ink-faint); }

    /* Natural-frequency flow: two proportional stacked bars with their counts beneath. */
    .tree { grid-column: 1 / -1; padding: 16px 18px; }
    .flow { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .bar { display: flex; gap: 2px; height: 14px; }
    .seg { display: block; flex: 0 1 0; min-width: 6px; border-radius: 2px; transition: flex-grow var(--dur-fast) var(--ease-out); }
    .sick { background: var(--rose); }
    .well { background: var(--teal); }
    .tp { background: var(--rose); }
    .fn { background: color-mix(in oklch, var(--rose) 45%, var(--ink)); }
    .fp { background: var(--amber); }
    .tn { background: color-mix(in oklch, var(--teal) 45%, var(--ink)); }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 2px; }
    .leaf { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .leaf strong { font-family: var(--font-display); font-size: 20px; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .leaf span { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--on-ink-dim); }
    .leaf.right { text-align: right; align-items: flex-end; }
    .swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; flex: none; }
    .reading { margin: 14px 0 0; max-width: 70ch; font-size: 14px; color: var(--on-ink-dim); strong { color: var(--on-ink); } }

    /* Companions: figures on the page, not cards — a rule and an eyebrow each. */
    .fig { margin: 0; min-width: 0; padding-top: 10px; border-top: 1px solid var(--hairline); }
    .fig figcaption { margin-bottom: 2px; }
    .wide { grid-column: 1 / -1; }
    .note { margin-top: 20px; font-size: 12px; color: var(--on-ink-faint); }
    .note .mono { display: block; margin-bottom: 4px; color: var(--on-ink-dim); }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .controls { position: static; } .results { grid-template-columns: 1fr; } .morphcharts-container { height: 400px; } }
  `,
})
export class BayesPageComponent {
  readonly presets = PRESETS;
  readonly layoutNames = LAYOUT_NAMES;
  readonly preset = signal<string>('mammography');
  /** The preset the sliders currently match, or null once any slider has been moved by hand. */
  readonly activePreset = computed(() => PRESETS.find((p) => p.id === this.preset()) ?? null);
  readonly form = signal<FormConfig>({ count: 1000, sensitivity: 0.9, specificity: 0.91, prior: 0.01, transitionDuration: 1000, transitionStaggering: 300 });
  readonly layoutIndex = signal(0);
  readonly transitioning = signal(false);
  /** Play steps through the views, holding DWELL_MS after each morph settles, and loops. */
  readonly playing = signal(false);
  /** How long the active segment takes to fill: the morph the scene was actually given. */
  readonly fillMs = computed(() => this.form().transitionDuration + this.form().transitionStaggering);
  readonly morphError = signal<string | null>(null);
  readonly fallback = signal<string | null>(null);
  readonly layoutName = computed(() => LAYOUT_NAMES[this.layoutIndex()]);

  readonly inputs = computed(() => ({ prevalence: this.form().prior, sensitivity: this.form().sensitivity, specificity: this.form().specificity, population: this.form().count }));
  readonly data = computed(() => generateBayesData(this.form()));
  readonly out = computed(() => bayes(this.inputs()));
  readonly lrPlus = computed(() => Math.min(999, this.out().lrPositive));
  readonly curve = computed(() => predictiveCurve(this.form().sensitivity, this.form().specificity));
  readonly marker = computed(() => [{ prevalence: this.form().prior, ppv: this.out().ppv }]);
  readonly outcomes = computed(() => {
    const o = this.out();
    return [
      { result: 'Test positive', truth: 'Diseased', people: o.truePositives, order: 0, label: 'true positives' },
      { result: 'Test positive', truth: 'Healthy', people: o.falsePositives, order: 1, label: 'false positives' },
      { result: 'Test negative', truth: 'Diseased', people: o.falseNegatives, order: 0, label: 'false negatives' },
      { result: 'Test negative', truth: 'Healthy', people: o.trueNegatives, order: 1, label: 'true negatives' },
    ];
  });
  readonly icons = computed(() => {
    const o = bayes({ ...this.inputs(), population: 100 });
    const counts: Array<[string, number]> = [['True positive', o.truePositives], ['False negative', o.falseNegatives], ['False positive', o.falsePositives], ['True negative', o.trueNegatives]];
    const cells: Array<{ col: number; row: number; outcome: string }> = [];
    let k = 0;
    for (const [outcome, n] of counts) for (let i = 0; i < Math.round(n) && k < 100; i++, k++) cells.push({ col: k % 10, row: Math.floor(k / 10), outcome });
    while (k < 100) { cells.push({ col: k % 10, row: Math.floor(k / 10), outcome: 'True negative' }); k++; }
    return cells;
  });
  readonly specs = { outcome: outcomeSpec(), curve: curveSpec(), icons: iconArraySpec() };

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('morphchartsContainer');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private scene: BayesScene | null = null;
  private host: MorphChartsHost | null = null;
  private resize: ResizeObserver | null = null;
  private relayout: Promise<void> = Promise.resolve();
  private dwell: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.gsap.reveal(this.el.nativeElement.querySelectorAll('[data-reveal]'), { delay: this.gsap.MOTION.delay.medium });
    });
    inject(DestroyRef).onDestroy(() => { this.stop(); this.scene?.dispose(); this.resize?.disconnect(); });
    // Re-lay out the current view (no transition) whenever the inputs change.
    effect(() => {
      const config = this.form();
      const data = this.data();
      untracked(() => { if (this.scene) this.queue(() => this.scene!.layout(this.layoutIndex(), data, config, false)); });
    });
  }

  async onHost(host: MorphChartsHost): Promise<void> {
    this.host = host;
    this.fit();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(this.container().nativeElement);
    try {
      // The 3D headings rasterise at spec load, so the display face must be resident first.
      await document.fonts.load('600 32px Rajdhani').catch(() => undefined);
      const { BayesScene } = await import('./bayes-scene');
      const scene = new BayesScene(host);
      scene.reducedMotion = this.gsap.reducedMotion;
      scene.onTransitionEnd = () => this.settle();
      this.scene = scene;
      await this.queue(() => scene.layout(this.layoutIndex(), this.data(), this.form(), false));
    } catch (err) {
      this.morphError.set(`The 3D view could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private fit(): void {
    const host = this.host;
    const el = this.container().nativeElement;
    if (!host) return;
    const w = Math.max(64, Math.floor(el.clientWidth));
    const h = Math.max(64, Math.floor(el.clientHeight));
    host.resize(w, h);
    host.canvas.style.width = `${w}px`;
    host.canvas.style.height = `${h}px`;
    host.renderer.frameCount = 0;
  }

  /** Serialises scene re-layouts (each parses a spec) so rapid slider input cannot interleave. */
  private queue(job: () => Promise<void>): Promise<void> {
    this.relayout = this.relayout.then(job).catch((err) => this.morphError.set(err instanceof Error ? err.message : String(err)));
    return this.relayout;
  }

  set<K extends keyof FormConfig>(key: K, value: FormConfig[K]): void {
    this.preset.set('');
    this.form.set({ ...this.form(), [key]: value });
  }

  setCount(value: number): void {
    if (!isNaN(value) && value > 0) this.set('count', Math.min(20000, Math.round(value)));
  }

  apply(id: string): void {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    this.preset.set(id);
    this.form.set({ ...this.form(), count: p.inputs.population, prior: p.inputs.prevalence, sensitivity: p.inputs.sensitivity, specificity: p.inputs.specificity });
  }

  onReset(): void { this.scene?.resetCamera(); }
  /** Manual steps take the transport back from the player, as scrubbing a video does. */
  onPrev(): void { this.jump((this.layoutIndex() + 3) % 4); }
  onNext(): void { this.jump((this.layoutIndex() + 1) % 4); }

  jump(index: number): void {
    this.stop();
    this.goTo(index);
  }

  togglePlay(): void {
    if (this.playing()) { this.stop(); return; }
    this.playing.set(true);
    if (this.transitioning()) return; // the running morph's settle() schedules the next step
    this.goTo((this.layoutIndex() + 1) % 4);
  }

  private stop(): void {
    this.playing.set(false);
    if (this.dwell) clearTimeout(this.dwell);
    this.dwell = null;
  }

  /** A morph has finished: release the keys and, if playing, hold for a beat before the next view. */
  private settle(): void {
    this.transitioning.set(false);
    if (!this.playing()) return;
    if (this.dwell) clearTimeout(this.dwell);
    this.dwell = setTimeout(() => {
      this.dwell = null;
      if (this.playing()) this.goTo((this.layoutIndex() + 1) % 4);
    }, DWELL_MS);
  }

  private goTo(index: number): void {
    if (index === this.layoutIndex() || !this.scene) { this.layoutIndex.set(index); return; }
    this.layoutIndex.set(index);
    this.transitioning.set(true);
    const scene = this.scene;
    // `layout()` resolves as soon as the morph *starts*; the scene's `onTransitionEnd` (wired in
    // onHost, and fired on a cut as well as a morph) is what releases the keys. The only case it
    // cannot cover is a layout that threw, which `queue()` has already turned into `morphError`.
    void this.queue(() => scene.layout(index, this.data(), this.form(), true)).then(() => { if (this.morphError()) this.settle(); });
  }
}

/** Play holds on each view this long after its morph settles — enough to read the heading and counts. */
const DWELL_MS = 1500;
