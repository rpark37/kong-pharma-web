import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { GsapService } from './gsap.service';
import { MOTION } from './motion';

/**
 * Put this on the element that wraps `<router-outlet>`. Once the new route has been activated,
 * the `[data-reveal]` children of the new page are revealed with a stagger.
 *
 * This is the only thing that reveals some pages — the home page has `[data-reveal]` blocks and
 * no reveal of its own — and `reveal()` animates `autoAlpha`, so without it they stay hidden.
 */
@Directive({ selector: '[appRouteTransition]' })
export class RouteTransitionDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly gsap = inject(GsapService);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => {
        if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
          this.enter();
        }
      });
  }

  /** Called after the outlet activated the new component. */
  enter(): void {
    // Reveal is deferred one frame so the new component has rendered its template.
    requestAnimationFrame(() => {
      const targets = this.host.nativeElement.querySelectorAll('[data-reveal]');
      if (targets.length) this.gsap.reveal(targets, { delay: MOTION.delay.medium });
    });
  }
}
