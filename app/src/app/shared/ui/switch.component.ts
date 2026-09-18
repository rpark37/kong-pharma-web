import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-switch',
  template: `
    <button type="button" role="switch" class="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()" [disabled]="disabled()" (click)="toggle()">
      <span class="knob"></span>
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    .switch { width: 36px; height: 20px; border-radius: 999px; border: 1px solid var(--hairline); background: rgba(255,255,255,0.08); padding: 0; position: relative; cursor: pointer; transition: background var(--dur-fast) var(--ease-out); }
    .switch[aria-checked="true"] { background: var(--teal); border-color: var(--teal); }
    .knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--on-ink); transition: transform var(--dur-fast) var(--ease-out); }
    .switch[aria-checked="true"] .knob { transform: translateX(16px); background: var(--teal-deep); }
    .switch:disabled { opacity: 0.4; cursor: not-allowed; }
  `,
})
export class SwitchComponent {
  readonly checked = model(false);
  readonly label = input('');
  readonly disabled = input(false);

  toggle(): void {
    this.checked.set(!this.checked());
  }
}
