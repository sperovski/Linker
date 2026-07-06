import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';

/** Route transitions: entering page fades in with a slight upward slide. */
export const routeFade = trigger('routeFade', [
  transition('* <=> *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'none' })),
      ],
      { optional: true },
    ),
  ]),
]);

/**
 * Card entrance with small stagger. Bind to a state that flips from
 * 'loading' to 'loaded' exactly once so filter changes don't re-animate.
 */
export const listStagger = trigger('listStagger', [
  transition('loading => loaded', [
    query(
      '.stagger-item',
      [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        stagger(50, animate('200ms ease-out', style({ opacity: 1, transform: 'none' }))),
      ],
      { optional: true },
    ),
  ]),
]);

/** Inline form errors / small elements sliding in below a field. */
export const fadeSlideIn = trigger('fadeSlideIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-4px)' }),
    animate('180ms ease-out', style({ opacity: 1, transform: 'none' })),
  ]),
  transition(':leave', [
    animate('120ms ease-in', style({ opacity: 0 })),
  ]),
]);

/** Toasts sliding up into view and fading away. */
export const toastAnim = trigger('toastAnim', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'none' })),
  ]),
  transition(':leave', [
    animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' })),
  ]),
]);

/** Simple fade for swapped content (e.g. apply button -> confirmation). */
export const fadeSwap = trigger('fadeSwap', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms 80ms ease-out', style({ opacity: 1 })),
  ]),
]);
