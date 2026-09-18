import { Component, ElementRef, effect, inject, input, model } from '@angular/core';
import { GsapService } from '../animation/gsap.service';

/** Horizontal tab strip. The active tab's underline slides with a Quad ease. */
@Component({
  selector: 'app-tabs',
  template: `
    <div class="tabs" role="tablist">
      @for (tab of tabs(); track tab) {
        <button type="button" role="tab" class="tab" [class.active]="tab === active()" [attr.aria-selected]="tab === active()" (click)="select(tab)">{{ tab }}</button>
      }
      <span class="ink" #ink></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .tabs { position: relative; display: flex; gap: 2px; border-bottom: 1px solid var(--hairline); }
    .tab { background: none; border: 0; padding: 10px 14px; color: var(--on-ink-dim); cursor: pointer; font-size: 14px; border-radius: 6px 6px 0 0; }
    .tab:hover { color: var(--on-ink); }
    .tab.active { color: var(--teal); }
    .ink { position: absolute; bottom: -1px; left: 0; height: 2px; width: 0; background: var(--teal); }
  `,
})
export class TabsComponent {
  readonly tabs = input.required<readonly string[]>();
  readonly active = model<string>('');
  private readonly gsap = inject(GsapService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const active = this.active();
      queueMicrotask(() => this.moveInk(active));
    });
  }

  select(tab: string): void {
    this.active.set(tab);
  }

  private moveInk(active: string): void {
    const root = this.el.nativeElement;
    const ink = root.querySelector<HTMLElement>('.ink');
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab'));
    const target = buttons.find((b) => b.textContent?.trim() === active);
    if (!ink || !target) return;
    this.gsap.tweenObject(ink, { x: target.offsetLeft, width: target.offsetWidth, duration: this.gsap.MOTION.duration.fast, ease: this.gsap.QUAD.out });
  }
}
