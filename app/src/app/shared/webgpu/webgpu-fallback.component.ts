import { Component, input } from '@angular/core';

/** Shown in place of a MorphCharts canvas when WebGPU is not available. */
@Component({
  selector: 'app-webgpu-fallback',
  template: `
    <div class="fallback glass">
      <p class="eyebrow">WebGPU unavailable</p>
      <p class="h" role="heading" [attr.aria-level]="level()">{{ title() }}</p>
      <p>
        MorphCharts path-traces its scenes on the GPU through WebGPU, which this browser does not expose.
        Chrome, Edge and recent Safari support it on desktop; on Linux Chromium you may need
        <code>chrome://flags/#enable-unsafe-webgpu</code>.
      </p>
      @if (image()) {
        <img [src]="image()" alt="Reference render of the scene" width="640" height="360" loading="lazy">
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; }
    .fallback { padding: 22px; display: flex; flex-direction: column; gap: 10px; max-width: 640px; }
    .h { font-family: var(--font-display); font-size: 20px; letter-spacing: -0.02em; margin: 0; color: var(--on-ink); }
    img { height: auto; }
    p { color: var(--on-ink-dim); }
    code { font-size: 12px; color: var(--teal); }
    img { width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--hairline); }
  `,
})
export class WebGpuFallbackComponent {
  readonly title = input('This scene needs WebGPU');
  readonly image = input<string | null>(null);
  /** Heading level to slot under the page's structure; the host page knows, this component does not. */
  readonly level = input(3);
}
