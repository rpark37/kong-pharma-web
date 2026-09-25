import { Component, computed, input } from '@angular/core';

export type KpiFormat = 'number' | 'currency' | 'percent';

/**
 * A stat tile. The number is shown as-is — no count-up, no entrance animation. A `dl` so the
 * label and the value read as a pair. `format` picks the Intl style: `currency` takes the value
 * in dollars, `percent` takes a fraction (0.0123 → 1.23%). `prefix`/`suffix` stay for callers
 * that want a literal wrapped around a plain number.
 */
@Component({
  selector: 'app-kpi-tile',
  template: `
    <dl class="tile glass">
      <dt class="label">{{ label() }}</dt>
      <dd class="value mono">{{ prefix() }}{{ text() }}{{ suffix() }}</dd>
      @if (hint()) { <dd class="hint">{{ hint() }}</dd> }
    </dl>
  `,
  styles: `
    :host { display: block; }
    .tile { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 16px 18px; }
    dd { margin: 0; }
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
  readonly format = input<KpiFormat>('number');
  readonly currency = input('USD');

  readonly text = computed(() => {
    const d = this.decimals(), f = this.format();
    const opts: Intl.NumberFormatOptions = { minimumFractionDigits: d, maximumFractionDigits: d };
    if (f === 'currency') Object.assign(opts, { style: 'currency', currency: this.currency() });
    if (f === 'percent') opts.style = 'percent';
    return new Intl.NumberFormat(undefined, opts).format(this.value());
  });
}
