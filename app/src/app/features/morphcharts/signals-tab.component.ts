import { Component, input } from '@angular/core';
import type { SignalInfo } from '../../shared/morphcharts/morphcharts-host';

@Component({
  selector: 'app-signals-tab',
  template: `
    @if (signals().length) {
      <table class="table">
        <thead><tr><th>Signal</th><th>Value</th></tr></thead>
        <tbody>
          @for (s of signals(); track s.name) {
            <tr><td>{{ s.name }}</td><td class="mono">{{ format(s.value) }}</td></tr>
          }
        </tbody>
      </table>
    } @else {
      <p class="empty">No signals in the current plot. Start a render to parse the spec.</p>
    }
  `,
  styles: `
    :host { display: block; padding: 8px 4px; }
    .table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid var(--hairline); padding: 6px 10px; text-align: left; overflow-wrap: anywhere; }
    th { color: var(--on-ink-dim); font-weight: 500; }
    .empty { color: var(--on-ink-dim); font-size: 13px; }
  `,
})
export class SignalsTabComponent {
  readonly signals = input<SignalInfo[]>([]);
  format(value: unknown): string {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
