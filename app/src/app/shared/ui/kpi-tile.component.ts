import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { GsapService } from '../animation/gsap.service';
import { MOTION } from '../animation/motion';

/** A stat tile whose number counts up linearly whenever the value changes. */
@Component({
  selector: 'app-kpi-tile',
  template: `
    <div class="tile glass">
      <span class="label">{{ label() }}</span>
      <span class="value mono">{{ prefix() }}{{ display() | number: digits() }}{{ suffix() }}</span>
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
  /** Position in the row; the count-up is offset by index × MOTION.counter.stagger. */
  readonly index = input(0);
  readonly display = signal(0);
  private readonly gsap = inject(GsapService);

  constructor() {
    effect(() => {
      const to = this.value();
      this.gsap.tweenNumber(this.display, to, {
        duration: MOTION.counter.duration,
        delay: this.index() * MOTION.counter.stagger,
        ease: 'none',
        decimals: this.decimals(),
      });
    });
  }

  digits(): string {
    const d = this.decimals();
    return `1.${d}-${d}`;
  }
}
