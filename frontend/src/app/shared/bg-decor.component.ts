import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Decorative background: two blurred gradient blocks in opposite corners plus
 * outline icons scattered around the edges. Purely ornamental — pointer-events
 * are off and the whole thing is aria-hidden, so it never touches focus order or
 * screen readers.
 *
 * Absolutely positioned, so the host section needs `position: relative` and the
 * real content needs a higher z-index to sit above it.
 */
@Component({
  selector: 'app-bg-decor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="bg-decor" [class.subtle]="variant() === 'subtle'" aria-hidden="true">
      <span class="bg-block tl"></span>
      <span class="bg-block br"></span>

      <!-- Every icon sits in an outer band; the middle of the viewport stays clear. -->
      <app-icon class="bg-icon i1" name="paperclip" [size]="34" />
      <app-icon class="bg-icon i2" name="graduation-cap" [size]="34" />
      <app-icon class="bg-icon i3" name="briefcase" [size]="34" />
      <app-icon class="bg-icon i4" name="map-pin" [size]="34" />
      <app-icon class="bg-icon i5" name="code" [size]="34" />
      <app-icon class="bg-icon i6" name="mail" [size]="34" />
      <app-icon class="bg-icon i7" name="bookmark" [size]="34" />
      <app-icon class="bg-icon i8" name="link" [size]="34" />
    </div>
  `,
  styles: [
    `
      .bg-decor {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }

      .bg-decor > * { position: absolute; }

      .bg-block {
        width: 320px;
        height: 320px;
        border-radius: 40px;
        filter: blur(70px);
        opacity: 0.42;
      }

      .bg-block.tl {
        top: -120px;
        left: -120px;
        background: radial-gradient(circle, #818cf8, transparent 70%);
      }

      .bg-block.br {
        bottom: -120px;
        right: -120px;
        background: radial-gradient(circle, #a5b4fc, transparent 70%);
      }

      /* app-icon renders an <svg stroke="currentColor" fill="none">, so colour comes
         from the color property here, not from stroke. */
      .bg-icon {
        display: inline-flex;
        color: #4f46e5;
        opacity: 0.13;
      }

      /* Content pages: quieter, and the two icons nearest the middle are dropped
         so nothing sits behind a card. */
      .bg-decor.subtle .bg-icon { opacity: 0.07; }
      .bg-decor.subtle .bg-block { opacity: 0.22; }
      .bg-decor.subtle .bg-icon.i7,
      .bg-decor.subtle .bg-icon.i8 { display: none; }

      /* Corners and edges only — nothing lands in the middle, where the card sits. */
      .bg-icon.i1 { top: 8%;  left: 5%;   --tilt: -12deg; }
      .bg-icon.i2 { top: 22%; right: 7%;  --tilt: 8deg; }
      .bg-icon.i3 { bottom: 14%; left: 9%;  --tilt: 6deg; }
      .bg-icon.i4 { bottom: 9%;  right: 12%; --tilt: -8deg; }
      .bg-icon.i5 { top: 45%; left: 3%;   --tilt: 10deg; }
      .bg-icon.i6 { top: 52%; right: 4%;  --tilt: -6deg; }
      /* i7 hugs the left edge: at left:34% it sat behind the centred card and was
         never seen. i8 stays horizontally central but low, below where the card
         ends, so it stays visible without crowding it. */
      .bg-icon.i7 { bottom: 34%; left: 5%; --tilt: 14deg; }
      .bg-icon.i8 { bottom: 6%; right: 38%; --tilt: -10deg; }

      .bg-icon { transform: rotate(var(--tilt, 0deg)); }

      /* The float keyframe carries the tilt too — a bare translateY would otherwise
         overwrite the rotation the moment the animation starts. */
      @media (prefers-reduced-motion: no-preference) {
        .bg-icon {
          animation: bg-float 9s ease-in-out infinite;
        }

        .bg-icon.i2 { animation-delay: -1.2s; }
        .bg-icon.i3 { animation-delay: -2.4s; }
        .bg-icon.i4 { animation-delay: -3.6s; }
        .bg-icon.i5 { animation-delay: -4.8s; }
        .bg-icon.i6 { animation-delay: -6s; }
        .bg-icon.i7 { animation-delay: -7.2s; }
        .bg-icon.i8 { animation-delay: -8.4s; }

        @keyframes bg-float {
          0%, 100% { transform: translateY(0) rotate(var(--tilt, 0deg)); }
          50% { transform: translateY(-10px) rotate(var(--tilt, 0deg)); }
        }
      }

      @media (max-width: 640px) {
        .bg-icon { opacity: 0.09; }
        .bg-block { opacity: 0.28; }
        .bg-decor.subtle .bg-icon { opacity: 0.05; }
        .bg-decor.subtle .bg-block { opacity: 0.16; }
        /* The two icons nearest the middle would crowd the card on a narrow screen. */
        .bg-icon.i7,
        .bg-icon.i8 { display: none; }
      }
    `,
  ],
})
export class BgDecorComponent {
  /**
   * `full`   — auth screens, where the decor is the only thing behind the card.
   * `subtle` — content pages (internship grid, landing): fainter and edge-only,
   *            so it never competes with the cards it sits behind.
   */
  readonly variant = input<'full' | 'subtle'>('full');
}
