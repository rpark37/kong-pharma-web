import { DestroyRef, Directive, ElementRef, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { GsapService } from './gsap.service';
import { MOTION } from './motion';

/**
 * Put this on the element that wraps `<router-outlet>` and give it the wipe overlay.
 * On NavigationStart the overlay sweeps over the page (quad.in); when the new route has been
 * activated the overlay sweeps away (quad.out, short delay) and `[data-reveal]` children of the
 * new page are revealed with a stagger.
 */
@Directive({ selector: '[appRouteTransition]' })
export class RouteTransitionDirective {
  @Input({ required: true, alias: 'appRouteTransition' }) overlay!: HTMLElement;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly gsap = inject(GsapService);
  private readonly router = inject(Router);
  private covered: Promise<void> | null = null;
  private first = true;

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          if (this.first) return; // initial navigation: content is not yet on screen
          this.covered = this.gsap.wipeIn(this.overlay);
        } else if (event instanceof NavigationEnd) {
          this.first = false;
          void this.enter();
        } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
          this.first = false;
          void this.enter();
        }
      });
  }

  /** Called after the outlet activated the new component. */
  async enter(): Promise<void> {
    await this.covered;
    this.covered = null;
    this.gsap.wipeOut(this.overlay, MOTION.delay.short);
    // Reveal is deferred one frame so the new component has rendered its template.
    requestAnimationFrame(() => {
      const targets = this.host.nativeElement.querySelectorAll('[data-reveal]');
      if (targets.length) this.gsap.reveal(targets, { delay: MOTION.delay.medium });
    });
  }
}
