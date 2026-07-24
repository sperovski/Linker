import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { InternshipListItem } from '../core/models';
import { InternshipCardComponent } from './internship-card.component';
import { MaskIconComponent, MaskIconName } from './mask-icon.component';

/** One slide's place on the 3D ring, keyed by |distance from center|. */
interface Pose {
  x: number; // translateX, % of card width
  z: number; // translateZ px (negative = deeper)
  ry: number; // rotateY deg, applied toward center
  s: number; // scale
  o: number; // opacity
}

const POSES: Pose[] = [
  { x: 0, z: 0, ry: 0, s: 1, o: 1 },
  { x: 55, z: -150, ry: 25, s: 0.9, o: 0.82 },
  { x: 96, z: -300, ry: 33, s: 0.82, o: 0.34 },
  { x: 122, z: -400, ry: 38, s: 0.77, o: 0 },
];

/**
 * 3D coverflow carousel for the "Trending now" rail. The centred card faces
 * front while its neighbours recede and rotate into perspective. It wraps the
 * shared {@link InternshipCardComponent}, so the slides are the exact same
 * cards the browse grid shows.
 *
 * Interaction (a native rewrite of the React Bits carousel — the behaviour, not
 * the code): pointer drag rotates the whole ring 1:1; on release it snaps to the
 * next/previous card via a distance buffer OR a flick-velocity threshold. Also
 * supports autoplay (paused on hover/focus/drag/hidden tab), an infinite ring,
 * dot indicators (no arrows), arrow keys, and a `cardSelect` output. Under
 * prefers-reduced-motion it drops the depth animation and autoplay.
 */
@Component({
  selector: 'app-trending-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InternshipCardComponent, MaskIconComponent],
  template: `
    <section
      class="tc"
      role="region"
      aria-roledescription="carousel"
      [attr.aria-label]="heading()"
      (mouseenter)="onHover(true)"
      (mouseleave)="onHover(false)"
      (focusin)="pause()"
      (focusout)="resume()"
      (keydown.arrowleft)="prev()"
      (keydown.arrowright)="next()"
    >
      <div class="tc-head">
        <span class="tc-icon">
          <!-- Embers rising behind the glyph; purely decorative. -->
          <span class="ember e1" aria-hidden="true"></span>
          <span class="ember e2" aria-hidden="true"></span>
          <span class="ember e3" aria-hidden="true"></span>
          <app-mask-icon [name]="icon()" [size]="17" />
        </span>
        <div class="tc-titles">
          <h2>{{ heading() }}</h2>
          @if (subheading()) {
            <p>{{ subheading() }}</p>
          }
        </div>
      </div>

      <div
        class="tc-stage"
        #stage
        [class.grabbing]="dragging()"
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd($event)"
        (pointercancel)="dragEnd($event)"
        (dragstart)="$event.preventDefault()"
      >
        <div class="tc-floor" aria-hidden="true"></div>

        @for (item of items(); track item.id; let i = $index) {
          @if (pose(i); as p) {
            <div
              class="tc-slide"
              [class.animate]="animate()"
              [class.center]="p.center"
              [style.transform]="p.transform"
              [style.opacity]="p.opacity"
              [style.zIndex]="p.zIndex"
              [attr.aria-hidden]="p.offstage ? 'true' : null"
              [attr.inert]="p.offstage ? '' : null"
            >
              <app-internship-card
                [internship]="item"
                [initialSaved]="item.isSaved"
                variant="full"
              />
            </div>
          }
        }
      </div>

      @if (items().length > 1) {
        <div class="tc-dots" role="tablist" [attr.aria-label]="heading() + ' slides'">
          @for (item of items(); track item.id; let i = $index) {
            <button
              type="button"
              class="dot"
              role="tab"
              [class.on]="i === active()"
              [attr.aria-selected]="i === active()"
              [attr.aria-label]="'Go to slide ' + (i + 1)"
              (click)="goTo(i)"
            ></button>
          }
        </div>
      }

      <span class="tc-live" aria-live="polite">
        Slide {{ active() + 1 }} of {{ items().length }}
      </span>
    </section>
  `,
  styles: [
    `
      .tc {
        margin-bottom: var(--space-xl);
        padding: var(--space-lg) var(--space-lg) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        overflow: hidden;
        background:
          radial-gradient(120% 140% at 100% 0%, rgba(245, 158, 11, 0.08), transparent 55%),
          radial-gradient(120% 140% at 0% 100%, rgba(29, 77, 36, 0.05), transparent 55%),
          var(--color-surface);
      }

      .tc-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-sm);
      }

      .tc-titles { flex: 1; min-width: 0; }
      .tc-head h2 { font-size: 1.2rem; margin: 0; letter-spacing: -0.01em; }
      .tc-head p { margin: 2px 0 0; font-size: 0.85rem; color: var(--color-text-soft); }

      /* ---- Trending badge: a small fire behind the glyph ----
         Embers rise inside the badge (overflow clips them, so it reads as a
         lit window rather than loose particles), while the badge itself
         flickers. Flicker keyframes are deliberately unevenly spaced — evenly
         spaced ones read as a pulse, not a flame. */
      .tc-icon {
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: #fef3c7;
        color: #b45309;
        flex-shrink: 0;
        animation: tc-flicker 3.1s ease-in-out infinite;
        /* Centred on the h2's line box, matching app-internship-strip's icon — the
           two rails sit next to each other on Browse, so a difference shows. The
           badge is taller than the line, hence the negative pull rather than a
           plain flex-start. */
        align-self: flex-start;
        margin-top: calc((1.2rem * 1.15 - 36px) / 2);
      }

      /* The glyph sits above the embers; currentColor makes it shift with the
         badge's flicker. */
      .tc-icon app-mask-icon { position: relative; z-index: 1; }

      .ember {
        position: absolute;
        bottom: -5px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 60%, #fb923c, #f59e0b 55%, transparent 72%);
        filter: blur(2.5px);
        opacity: 0;
        pointer-events: none;
        animation: tc-ember 2.6s ease-out infinite;
      }

      /* Staggered so the embers never rise in lockstep. */
      .ember.e1 { left: 6px; animation-delay: 0s; }
      .ember.e2 { left: 15px; animation-duration: 3.2s; animation-delay: 0.9s; }
      .ember.e3 { left: 23px; animation-duration: 2.2s; animation-delay: 1.7s; }

      @keyframes tc-ember {
        0% { transform: translateY(0) scale(0.55); opacity: 0; }
        18% { opacity: 0.9; }
        55% { opacity: 0.55; }
        100% { transform: translateY(-30px) scale(0.2); opacity: 0; }
      }

      @keyframes tc-flicker {
        0%, 100% { background: #fef3c7; color: #b45309; }
        22% { background: #fee9b0; color: #ea580c; }
        38% { background: #fef3c7; color: #c2410c; }
        61% { background: #fde3a0; color: #f97316; }
        74% { background: #fef0bd; color: #ea580c; }
        88% { background: #fef3c7; color: #b45309; }
      }

      /* ---- 3D stage ---- */
      .tc-stage {
        --card-w: clamp(250px, 68vw, 320px);
        position: relative;
        height: 340px;
        perspective: 1500px;
        perspective-origin: 50% 42%;
        touch-action: pan-y;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
      }

      .tc-stage.grabbing { cursor: grabbing; }

      .tc-floor {
        position: absolute;
        left: 50%;
        bottom: 8px;
        width: min(66%, 460px);
        height: 26px;
        transform: translateX(-50%);
        background: radial-gradient(50% 50% at 50% 50%, rgba(23, 26, 43, 0.16), transparent 70%);
        filter: blur(2px);
        pointer-events: none;
      }

      .tc-slide {
        position: absolute;
        top: 14px;
        left: 50%;
        width: var(--card-w);
        height: 300px;
        margin-left: calc(var(--card-w) / -2);
        transform-style: preserve-3d;
        will-change: transform, opacity;
        backface-visibility: hidden;
      }

      .tc-slide.animate {
        transition:
          transform 600ms cubic-bezier(0.32, 1.12, 0.4, 1),
          opacity 460ms ease;
      }

      .tc-slide app-internship-card {
        display: block;
        height: 100%;
        backface-visibility: hidden;
      }

      /* Elevate the centre card with a rounded box-shadow. This replaced a
         filter: drop-shadow, which repainted every animation frame and was the
         source of the stutter. ::ng-deep reaches the card inside the child
         component; the .tc-slide prefix keeps it scoped to this carousel. */
      .tc-slide.center ::ng-deep .internship-card {
        box-shadow:
          0 26px 44px -20px rgba(23, 26, 43, 0.32),
          0 10px 18px -12px rgba(29, 77, 36, 0.22);
      }

      /* The slide already supplies the 3D; cancel the card's own hover tilt +
         parallax inside the carousel so nothing re-composites as cards pass
         under the cursor during a drag. */
      .tc-slide ::ng-deep .card-wrap:hover .internship-card,
      .tc-slide ::ng-deep .card-wrap:focus-within .internship-card,
      .tc-slide ::ng-deep .card-wrap:hover .logo-layer,
      .tc-slide ::ng-deep .card-wrap:hover .card-top-text,
      .tc-slide ::ng-deep .card-wrap:hover .skill-chips,
      .tc-slide ::ng-deep .card-wrap:hover .badges,
      .tc-slide ::ng-deep .card-wrap:hover .card-cta,
      .tc-slide ::ng-deep .card-wrap:hover .card-overlay {
        transform: none;
      }

      /* ---- Dots ---- */
      .tc-dots {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: var(--space-sm) 0 2px;
      }

      .dot {
        width: 8px;
        height: 8px;
        padding: 0;
        border: none;
        border-radius: 999px;
        background: var(--color-border);
        cursor: pointer;
        transition: width 260ms cubic-bezier(0.32, 1.15, 0.35, 1), background-color 200ms ease;
      }

      .dot.on { width: 26px; background: #b45309; }
      .dot:hover:not(.on) { background: var(--color-text-muted); }

      .tc-live {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .tc-slide.animate { transition: none; }
        .dot { transition: none; }
        .tc-icon { animation: none; }
        .ember { display: none; }
      }
    `,
  ],
})
export class TrendingCarouselComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly icon = input.required<MaskIconName>();
  readonly items = input.required<InternshipListItem[]>();
  readonly autoplay = input(true);
  readonly autoplayDelay = input(4200);
  readonly pauseOnHover = input(true);
  readonly loop = input(true);

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly active = signal(0);
  protected readonly dragging = signal(false);
  /** Fraction of one card the finger has moved; drives the whole ring live. */
  private readonly dragProgress = signal(0);

  private reducedMotion = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private hovering = false;
  private pointerId: number | null = null;
  private startX = 0;
  private lastX = 0;
  private lastT = 0;
  private velocity = 0;
  private cardWidth = 300;
  private suppressClick = false;

  protected readonly animate = computed(() => !this.reducedMotion && !this.dragging());

  ngOnInit(): void {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.autoplayable()) this.start();
  }

  ngAfterViewInit(): void {
    // Capture phase so this runs before the card's own routerLink click:
    // a plain click anywhere on the stage advances instead of navigating.
    this.stage()?.nativeElement.addEventListener('click', this.onStageClick, true);
  }

  ngOnDestroy(): void {
    this.stop();
    this.stage()?.nativeElement.removeEventListener('click', this.onStageClick, true);
  }

  /** Any click on the stage advances one card (except the bookmark button). */
  private readonly onStageClick = (event: MouseEvent): void => {
    // A click that closes a drag shouldn't also advance or navigate.
    if (this.suppressClick) {
      this.suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    // Let the save/bookmark toggle do its thing.
    if ((event.target as HTMLElement).closest('app-save-button')) return;
    event.stopPropagation();
    event.preventDefault();
    this.next();
  };

  /**
   * Where slide i sits on the ring right now. Poses are interpolated over the
   * card's fractional distance from centre, so a drag moves every card
   * smoothly instead of snapping between slots.
   */
  protected pose(i: number): {
    transform: string;
    opacity: number;
    zIndex: number;
    center: boolean;
    offstage: boolean;
  } {
    const n = this.items().length;
    let off = i - (this.active() + this.dragProgress());
    if (this.loop() && n > 1) {
      off = ((off % n) + n) % n;
      if (off > n / 2) off -= n;
    }

    const t = Math.min(Math.abs(off), POSES.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, POSES.length - 1);
    const fr = t - lo;
    const lerp = (a: number, b: number) => a + (b - a) * fr;
    const dir = off < 0 ? -1 : 1;

    const x = dir * lerp(POSES[lo].x, POSES[hi].x);
    const z = lerp(POSES[lo].z, POSES[hi].z);
    const ry = -dir * lerp(POSES[lo].ry, POSES[hi].ry);
    const s = lerp(POSES[lo].s, POSES[hi].s);
    const o = lerp(POSES[lo].o, POSES[hi].o);

    return {
      transform: `translateX(${x}%) translateZ(${z}px) rotateY(${ry}deg) scale(${s})`,
      opacity: o,
      zIndex: 20 - Math.round(Math.abs(off) * 2),
      center: !this.dragging() && Math.abs(off) < 0.5,
      offstage: Math.abs(off) >= POSES.length - 1.05,
    };
  }

  // ---- Navigation ----
  protected next(): void {
    this.step(1);
  }

  protected prev(): void {
    this.step(-1);
  }

  protected goTo(i: number): void {
    this.active.set(i);
    this.restart();
  }

  private step(dir: 1 | -1): void {
    const n = this.items().length;
    if (n < 2) return;
    if (this.loop()) {
      this.active.set((((this.active() + dir) % n) + n) % n);
    } else {
      this.active.set(Math.min(n - 1, Math.max(0, this.active() + dir)));
    }
    this.restart();
  }

  // ---- Drag ----
  protected dragStart(event: PointerEvent): void {
    if (this.items().length < 2 || event.button !== 0) return;
    this.pointerId = event.pointerId;
    this.startX = this.lastX = event.clientX;
    this.lastT = event.timeStamp;
    this.velocity = 0;
    this.suppressClick = false;
    const el = this.stage()?.nativeElement;
    this.cardWidth =
      el?.querySelector<HTMLElement>('.tc-slide')?.getBoundingClientRect().width ?? 300;
    el?.setPointerCapture(event.pointerId);
    this.pause();
  }

  protected dragMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.startX;
    if (!this.dragging() && Math.abs(dx) < 6) return; // threshold: a shaky tap still clicks
    this.dragging.set(true);
    this.suppressClick = true;
    // Dragging right pulls earlier cards toward centre.
    this.dragProgress.set(-dx / this.cardWidth);
    const dt = event.timeStamp - this.lastT;
    if (dt > 0) this.velocity = (event.clientX - this.lastX) / dt;
    this.lastX = event.clientX;
    this.lastT = event.timeStamp;
  }

  protected dragEnd(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    if (!this.dragging()) return;

    const dx = event.clientX - this.startX;
    const flick = Math.abs(this.velocity) > 0.4;
    // One card per gesture: a firm drag OR a quick flick advances.
    let stepBy = 0;
    if (Math.abs(dx) > this.cardWidth * 0.18 || flick) {
      stepBy = (dx !== 0 ? dx : -this.velocity) < 0 ? 1 : -1;
    }
    this.dragProgress.set(0);
    this.dragging.set(false);
    if (stepBy !== 0) this.step(stepBy as 1 | -1);
    // Touch has no mouseleave to clear the pause, so lift it here.
    if (event.pointerType !== 'mouse') {
      this.hovering = false;
      this.paused = false;
    }
    this.restart();
  }

  // ---- Autoplay ----
  private autoplayable(): boolean {
    return this.autoplay() && !this.reducedMotion && this.items().length > 1;
  }

  protected onHover(entering: boolean): void {
    if (!this.pauseOnHover()) return;
    this.hovering = entering;
    if (entering) this.pause();
    else this.resume();
  }

  protected pause(): void {
    this.paused = true;
  }

  protected resume(): void {
    if (!this.hovering) this.paused = false;
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => {
      if (!this.paused && !this.dragging() && !document.hidden) this.next();
    }, this.autoplayDelay());
  }

  private restart(): void {
    if (this.autoplayable()) this.start();
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
