import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

/** A stat tile. The number is shown as-is — no count-up, no entrance animation. */
@Component({
  selector: 'app-kpi-tile',
  template: `
    <div class="tile glass">
      <span class="label">{{ label() }}</span>
      <span class="value mono">{{ prefix() }}{{ value() | number: digits() }}{{ suffix() }}</span>
      @if (hint()) { <span class="hint">{{ hint() }}</span> }
    </div>
  `,
  imports: [DecimalPipe],
  styles: `
    :host { display: block; }
    .tile { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; }
    .label { font-size: 12px; color: var(--on-ink-dim); text-transform: uppercase; letter-spacing: 0.08em; }
    .value { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--on-ink); font-variant-numeric: tabular-nums; }
    .hint { font-size: 12px; color: var(--on-ink-faint); }
  `,
})
export class KpiTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly prefix = input('');
  readonly suffix = input('');
  readonly hint = input('');
  readonly decimals = input(0);

  digits(): string {
    const d = this.decimals();
    return `1.${d}-${d}`;
  }
}
