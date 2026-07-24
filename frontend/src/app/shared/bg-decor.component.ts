import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MaskIconComponent } from './mask-icon.component';

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
  imports: [MaskIconComponent],
  template: `
    <div class="bg-decor" [class.subtle]="variant() === 'subtle'" aria-hidden="true">
      <span class="bg-block tl"></span>
      <span class="bg-block br"></span>

      <!-- Every icon sits in an outer band; the middle of the viewport stays clear.
           All 11 are the /public SVGs, drawn as mask-icons so they tint indigo — the
           background is the product's own icon set rather than a second, unrelated
           one. Two ideas run down the two edges: what a student brings (CV,
           university, experience, projects, skills) on the left, and the fields they
           bring it to (dev, ML, medicine, design, robotics, mechanical) on the right. -->
      <app-mask-icon class="bg-icon i1" name="cv" [size]="34" />
      <app-mask-icon class="bg-icon i2" name="code-branch" [size]="34" />
      <app-mask-icon class="bg-icon i3" name="university" [size]="34" />
      <app-mask-icon class="bg-icon i4" name="machine-learning" [size]="34" />
      <app-mask-icon class="bg-icon i5" name="experience" [size]="34" />
      <app-mask-icon class="bg-icon i6" name="stethoscope" [size]="34" />
      <app-mask-icon class="bg-icon i7" name="projects" [size]="34" />
      <app-mask-icon class="bg-icon i8" name="drafting-compass" [size]="34" />
      <app-mask-icon class="bg-icon i9" name="skills" [size]="34" />
      <app-mask-icon class="bg-icon i10" name="robotic-arm" [size]="34" />
      <app-mask-icon class="bg-icon i11" name="engine" [size]="34" />
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
        /* Tuned for filled glyphs, which carry much more ink than a hairline
           outline — 0.13 (what the old stroke icons used) reads as solid blobs. */
        --icon-opacity: 0.09;
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
        background: radial-gradient(circle, #6FB37E, transparent 70%);
      }

      .bg-block.br {
        bottom: -120px;
        right: -120px;
        background: radial-gradient(circle, #B7DCC0, transparent 70%);
      }

      /* app-mask-icon renders a background-color:currentColor span, so it takes its
         colour from here rather than from a background set directly on it. */
      .bg-icon {
        display: inline-flex;
        color: #1D4D24;
        opacity: var(--icon-opacity);
      }

      /* Content pages: quieter, and the icons level with the card are dropped so
         nothing sits behind it. */
      .bg-decor.subtle { --icon-opacity: 0.05; }
      .bg-decor.subtle .bg-block { opacity: 0.22; }
      .bg-decor.subtle .bg-icon.i5,
      .bg-decor.subtle .bg-icon.i6,
      .bg-decor.subtle .bg-icon.i11 { display: none; }

      /* Two edge columns, top to bottom, plus one low-centre. Nothing lands in the
         middle, where the card sits. Odd = left edge, even = right edge. */
      .bg-icon.i1 { top: 7%;  left: 5%;    --tilt: -12deg; }
      .bg-icon.i2 { top: 12%; right: 6%;   --tilt: 8deg; }
      .bg-icon.i3 { top: 26%; left: 3%;    --tilt: 6deg; }
      .bg-icon.i4 { top: 30%; right: 4%;   --tilt: -8deg; }
      .bg-icon.i5 { top: 45%; left: 6%;    --tilt: 10deg; }
      .bg-icon.i6 { top: 50%; right: 3%;   --tilt: -6deg; }
      .bg-icon.i7 { bottom: 27%; left: 4%; --tilt: 14deg; }
      .bg-icon.i8 { bottom: 30%; right: 6%; --tilt: -11deg; }
      .bg-icon.i9 { bottom: 11%; left: 8%; --tilt: -5deg; }
      .bg-icon.i10 { bottom: 8%; right: 11%; --tilt: 9deg; }
      /* Horizontally central but low — below where a centred card ends, so it reads
         without crowding it. Hidden on the subtle variant, where cards run further down. */
      .bg-icon.i11 { bottom: 5%; right: 38%; --tilt: -10deg; }

      .bg-icon { transform: rotate(var(--tilt, 0deg)); }

      /* The float keyframe carries the tilt too — a bare translateY would otherwise
         overwrite the rotation the moment the animation starts. */
      @media (prefers-reduced-motion: no-preference) {
        .bg-icon {
          animation: bg-float 9s ease-in-out infinite;
        }

        /* Spread across the 9s cycle so the band never bobs in unison. */
        .bg-icon.i2 { animation-delay: -0.8s; }
        .bg-icon.i3 { animation-delay: -1.6s; }
        .bg-icon.i4 { animation-delay: -2.4s; }
        .bg-icon.i5 { animation-delay: -3.3s; }
        .bg-icon.i6 { animation-delay: -4.1s; }
        .bg-icon.i7 { animation-delay: -4.9s; }
        .bg-icon.i8 { animation-delay: -5.7s; }
        .bg-icon.i9 { animation-delay: -6.5s; }
        .bg-icon.i10 { animation-delay: -7.4s; }
        .bg-icon.i11 { animation-delay: -8.2s; }

        @keyframes bg-float {
          0%, 100% { transform: translateY(0) rotate(var(--tilt, 0deg)); }
          50% { transform: translateY(-10px) rotate(var(--tilt, 0deg)); }
        }
      }

      @media (max-width: 640px) {
        .bg-decor { --icon-opacity: 0.06; }
        .bg-decor.subtle { --icon-opacity: 0.035; }
        .bg-block { opacity: 0.28; }
        .bg-decor.subtle .bg-block { opacity: 0.16; }
        /* Eleven icons crowd a narrow screen, and the mid-height ones sit level with
           the card. Thinned to six — the two edge columns, top and bottom only. */
        .bg-icon.i5,
        .bg-icon.i6,
        .bg-icon.i7,
        .bg-icon.i8,
        .bg-icon.i11 { display: none; }
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
