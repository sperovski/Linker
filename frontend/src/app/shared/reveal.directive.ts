import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * Scroll-triggered reveal: element starts hidden and fades+slides in the
 * first time it enters the viewport. No-ops under prefers-reduced-motion.
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: IntersectionObserver | null = null;

  /** Optional delay in ms, for staggering siblings. */
  readonly revealDelay = input(0);

  ngOnInit(): void {
    const element = this.el.nativeElement;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      return;
    }

    element.classList.add('reveal-pending');
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const delay = this.revealDelay();
            element.style.transitionDelay = delay ? `${delay}ms` : '';
            element.classList.add('reveal-visible');
            element.classList.remove('reveal-pending');
            this.observer?.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
