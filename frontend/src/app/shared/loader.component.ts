import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tapping-hand loader.
 *
 * - `inline`  — small, sits in place inside buttons and sections.
 * - `overlay` — centred on a translucent backdrop for full-section loads. The
 *   nearest positioned ancestor is the backdrop's bounds, so give the section
 *   you cover `position: relative`.
 *
 * Not for the internship grid — that keeps its skeleton cards.
 */
@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="loader"
      [class.inline]="mode() === 'inline'"
      [class.overlay]="mode() === 'overlay'"
      role="status"
      [attr.aria-label]="label()"
    >
      <div class="loader-hand" aria-hidden="true">
        <div class="loader-palm"></div>
        <div class="loader-thumb"></div>
        <div class="loader-finger"></div>
        <div class="loader-finger"></div>
        <div class="loader-finger"></div>
        <div class="loader-finger"></div>
      </div>
      @if (mode() === 'overlay' && label()) {
        <p class="loader-label">{{ label() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .loader {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Inline sizing. The hand's declared box is 80x60, but the fingers and thumb
         are positioned OUTSIDE it (fingers sit at right:64%), so its real painted
         bounds are 119x119 — overflowing 34px left, 23px top, 36px bottom.
         Reserving only 80x60 makes the hand bleed across whatever it sits next to,
         e.g. a button label. So: size the box to the true bounds and nudge the
         hand in by the same overflow, all scaled together. */
      .loader.inline {
        --loader-scale: 0.3;
        position: relative;
        width: calc(119px * var(--loader-scale));
        height: calc(119px * var(--loader-scale));
        vertical-align: middle;
        flex-shrink: 0;
      }

      .loader.inline .loader-hand {
        position: absolute;
        top: calc(23px * var(--loader-scale));
        left: calc(34px * var(--loader-scale));
        transform: scale(var(--loader-scale));
        transform-origin: top left;
      }

      /* The drop shadow is 180% wide and anchored right, so it reaches ~80px to
         the LEFT of the hand — at inline size that bleeds across whatever it sits
         next to. Drop it; it reads as noise this small. */
      .loader.inline .loader-hand:before { display: none; }

      .loader.overlay {
        position: absolute;
        inset: 0;
        z-index: 20;
        flex-direction: column;
        background: rgb(255 255 255 / 72%);
        backdrop-filter: blur(2px);
      }

      /* The thumb and the blurred shadow spill ~30px below the hand's 60px box,
         so the label needs to clear more than the box height suggests. */
      .loader.overlay .loader-hand { margin-bottom: 40px; }

      .loader-label {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-soft);
      }

      .loader-hand {
        --skin-color: #6FB37E;
        --tap-speed: 0.6s;
        --tap-stagger: 0.1s;
        position: relative;
        width: 80px;
        height: 60px;
      }

      .loader-hand:before {
        content: '';
        display: block;
        width: 180%;
        height: 75%;
        position: absolute;
        top: 70%;
        right: 20%;
        background: #0d0c22;
        border-radius: 40px 10px;
        filter: blur(10px);
        opacity: 0.15;
      }

      .loader-palm {
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background: var(--skin-color);
        border-radius: 10px 40px;
      }

      .loader-thumb {
        position: absolute;
        width: 120%;
        height: 38px;
        background: var(--skin-color);
        bottom: -18%;
        right: 1%;
        transform-origin: calc(100% - 20px) 20px;
        transform: rotate(-20deg);
        border-radius: 30px 20px 20px 10px;
        border-bottom: 2px solid rgb(0 0 0 / 10%);
        border-left: 2px solid rgb(0 0 0 / 10%);
      }

      .loader-finger {
        position: absolute;
        width: 80%;
        height: 35px;
        background: var(--skin-color);
        bottom: 32%;
        right: 64%;
        transform-origin: 100% 20px;
        transform: rotate(10deg);
        animation-duration: calc(var(--tap-speed) * 2);
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }

      .loader-finger:before {
        content: '';
        position: absolute;
        width: 140%;
        height: 30px;
        background: var(--skin-color);
        bottom: 8%;
        right: 65%;
        transform-origin: calc(100% - 20px) 20px;
        transform: rotate(-60deg);
        border-radius: 20px;
      }

      /* The four fingers are children 3-6, not 1-4: .loader-palm and .loader-thumb
         come first (they must paint underneath). Targeting nth-child(1)-(4) would
         match nothing and leave the hand frozen. */
      .loader-finger:nth-child(3) {
        animation-delay: 0s;
        filter: brightness(70%);
        animation-name: tap-1;
      }

      .loader-finger:nth-child(4) {
        animation-delay: var(--tap-stagger);
        filter: brightness(80%);
        animation-name: tap-2;
      }

      .loader-finger:nth-child(5) {
        animation-delay: calc(var(--tap-stagger) * 2);
        filter: brightness(90%);
        animation-name: tap-3;
      }

      .loader-finger:nth-child(6) {
        animation-delay: calc(var(--tap-stagger) * 3);
        filter: brightness(100%);
        animation-name: tap-4;
      }

      @keyframes tap-1 {
        0%, 50%, 100% { transform: rotate(10deg) scale(0.4); }
        40% { transform: rotate(50deg) scale(0.4); }
      }

      @keyframes tap-2 {
        0%, 50%, 100% { transform: rotate(10deg) scale(0.6); }
        40% { transform: rotate(50deg) scale(0.6); }
      }

      @keyframes tap-3 {
        0%, 50%, 100% { transform: rotate(10deg) scale(0.8); }
        40% { transform: rotate(50deg) scale(0.8); }
      }

      @keyframes tap-4 {
        0%, 50%, 100% { transform: rotate(10deg) scale(1); }
        40% { transform: rotate(50deg) scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .loader-finger { animation: none; }
      }
    `,
  ],
})
export class LoaderComponent {
  readonly mode = input<'inline' | 'overlay'>('inline');
  readonly label = input('Loading…');
}
