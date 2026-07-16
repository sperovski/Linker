import {
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
import { RouterLink } from '@angular/router';
import { InternshipListItem } from '../core/models';
import { CompanyLogoComponent } from './company-logo.component';
import { MatchBadgeComponent } from './match-badge.component';
import { IconComponent } from './icon.component';
import { MaskIconComponent, MaskIconName } from './mask-icon.component';
import { SaveButtonComponent } from './save-button.component';
import { TYPE_LABELS, deadlineCountdown } from './dates';
import { matchExplanation } from './match';

/** One card's place on the 3D stage, indexed by |distance from center|. */
interface Pose {
  x: number; // translateX, % of the card's own width
  z: number; // translateZ px (negative = further away)
  ry: number; // rotateY deg, applied toward the center
  s: number; // scale
  o: number; // opacity
}

const POSES: Pose[] = [
  { x: 0, z: 0, ry: 0, s: 1, o: 1 },
  { x: 62, z: -120, ry: 27, s: 0.92, o: 0.88 },
  { x: 108, z: -250, ry: 37, s: 0.84, o: 0.5 },
  { x: 136, z: -360, ry: 42, s: 0.78, o: 0 },
];

/**
 * 3D coverflow carousel for the "Trending now" rail: the spotlit card faces
 * front while its neighbours recede into perspective. Auto-advances on a
 * timer (paused on hover/focus/hidden tab), and supports arrows, dots,
 * arrow keys, and finger-tracking drag — the whole ring follows the pointer
 * in real time and snaps on release. Falls back to instant, motionless slide
 * changes under prefers-reduced-motion.
 */
@Component({
  selector: 'app-trending-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CompanyLogoComponent,
    MatchBadgeComponent,
    IconComponent,
    MaskIconComponent,
    SaveButtonComponent,
  ],
  template: `
    <section
      class="tc"
      role="region"
      aria-roledescription="carousel"
      [attr.aria-label]="heading()"
      (mouseenter)="pause()"
      (mouseleave)="resume()"
      (focusin)="pause()"
      (focusout)="resume()"
      (keydown.arrowleft)="prev()"
      (keydown.arrowright)="next()"
    >
      <div class="tc-head">
        <span class="tc-icon">
          <app-mask-icon [name]="icon()" [size]="17" />
        </span>
        <div class="tc-titles">
          <h2>{{ heading() }}</h2>
          @if (subheading()) {
            <p>{{ subheading() }}</p>
          }
        </div>

        @if (items().length > 1) {
          <div class="tc-nav">
            <button type="button" class="nav-btn prev" (click)="prev()" aria-label="Previous">
              <app-icon name="arrow-right" [size]="16" />
            </button>
            <button type="button" class="nav-btn" (click)="next()" aria-label="Next">
              <app-icon name="arrow-right" [size]="16" />
            </button>
          </div>
        }
      </div>

      <div
        class="tc-stage"
        #stage
        [class.dragging]="dragging()"
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd($event)"
        (pointercancel)="dragEnd($event)"
        (dragstart)="$event.preventDefault()"
      >
        <div class="tc-floor" aria-hidden="true"></div>

        @for (item of items(); track item.id; let i = $index) {
          @if (slideStyle(i); as pose) {
            <div
              class="tc-slide"
              role="group"
              aria-roledescription="slide"
              [attr.aria-label]="i + 1 + ' of ' + items().length"
              [attr.inert]="pose.offstage ? '' : null"
              [class.center]="pose.center"
              [style.transform]="pose.transform"
              [style.opacity]="pose.opacity"
              [style.z-index]="pose.zIndex"
              [style.animation-delay.ms]="i * 70"
              (focusin)="centerOn(i)"
              (click)="guardClick($event)"
            >
              <div class="tc-save">
                <app-save-button
                  [internshipId]="item.id"
                  [initialSaved]="item.isSaved"
                  [compact]="true"
                />
              </div>
              <a class="tc-card card" [routerLink]="['/internships', item.id]" [tabindex]="pose.offstage ? -1 : 0">
                <span class="tc-rank" aria-hidden="true">#{{ i + 1 }}</span>
                <div class="tc-top">
                  <app-company-logo [name]="item.companyName" [size]="36" />
                  @if (item.hasApplied) {
                    <span class="badge badge-applied">
                      <app-icon name="check" [size]="12" />
                      Applied
                    </span>
                  } @else if (item.matchScore !== null) {
                    <app-match-badge
                      [score]="item.matchScore"
                      [matchedSkillCount]="item.matchedSkillCount"
                      [requiredSkillCount]="item.requiredSkillCount"
                    />
                  }
                </div>
                <h3>{{ item.title }}</h3>
                <span class="tc-company">{{ item.companyName }}</span>
                @if (explain(item); as line) {
                  <span class="tc-explain">{{ line }}</span>
                }
                <div class="tc-foot">
                  <span class="badge badge-type">{{ typeLabel(item.type) }}</span>
                  @if (deadline(item); as label) {
                    <span class="tc-loc"><app-icon name="clock" [size]="12" /> {{ label }}</span>
                  } @else if (item.location) {
                    <span class="tc-loc"><app-icon name="map-pin" [size]="12" /> {{ item.location }}</span>
                  }
                </div>
              </a>
            </div>
          }
        }
      </div>

      @if (items().length > 1) {
        <div class="tc-dots" role="tablist" aria-label="Trending slides">
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
        @if (autoplaying()) {
          <!-- Re-created per slide (track by active index) so the fill restarts. -->
          @for (k of [active()]; track k) {
            <div class="tc-progress" aria-hidden="true"><span></span></div>
          }
        }
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

      .tc-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: #fef3c7;
        color: #b45309;
        flex-shrink: 0;
      }

      .tc-nav { display: flex; gap: 8px; flex-shrink: 0; }

      .nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-primary);
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
        transition: transform 150ms ease, box-shadow 200ms ease, background-color 160ms ease,
          color 160ms ease;
      }

      .nav-btn:hover {
        transform: translateY(-1px);
        background: var(--color-primary);
        color: #fff;
        box-shadow: 0 8px 18px -8px rgba(29, 77, 36, 0.6);
      }

      .nav-btn:active { transform: translateY(0); }
      .nav-btn.prev app-icon { display: inline-flex; transform: rotate(180deg); }

      /* ---- The 3D stage ---- */
      .tc-stage {
        --card-w: clamp(230px, 62vw, 290px);
        position: relative;
        height: 264px;
        perspective: 1400px;
        perspective-origin: 50% 38%;
        touch-action: pan-y;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
      }

      .tc-stage.dragging { cursor: grabbing; }

      /* Soft elliptical ground shadow that anchors the ring in space. */
      .tc-floor {
        position: absolute;
        left: 50%;
        bottom: 2px;
        width: min(70%, 460px);
        height: 26px;
        transform: translateX(-50%);
        background: radial-gradient(50% 50% at 50% 50%, rgba(23, 26, 43, 0.16), transparent 70%);
        filter: blur(2px);
        pointer-events: none;
      }

      .tc-slide {
        position: absolute;
        top: 12px;
        left: 50%;
        width: var(--card-w);
        margin-left: calc(var(--card-w) / -2);
        transform-style: preserve-3d;
        transition:
          transform 620ms cubic-bezier(0.32, 1.15, 0.35, 1),
          opacity 480ms ease;
        animation: tc-in 600ms ease backwards;
        will-change: transform, opacity;
      }

      /* While the finger drives the ring, motion must track it 1:1. */
      .tc-stage.dragging .tc-slide { transition: none; }

      @keyframes tc-in {
        from { opacity: 0; }
      }

      .tc-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        height: 212px;
        color: inherit;
        cursor: pointer;
        overflow: hidden;
        position: relative;
        box-shadow:
          0 24px 44px -24px rgba(23, 26, 43, 0.4),
          0 6px 14px -10px rgba(29, 77, 36, 0.22);
      }

      .tc-card:hover { text-decoration: none; }

      .tc-card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 3px;
      }

      /* A light sweep across the card that takes center stage. */
      .tc-slide.center .tc-card::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          105deg,
          transparent 38%,
          rgba(255, 255, 255, 0.5) 50%,
          transparent 62%
        );
        transform: translateX(-120%);
        animation: tc-sheen 900ms ease-out 180ms forwards;
        pointer-events: none;
      }

      @keyframes tc-sheen {
        to { transform: translateX(120%); }
      }

      .tc-rank {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translate(-50%, 0);
        font-size: 0.78rem;
        font-weight: 800;
        color: #b45309;
        background: #fef3c7;
        border-radius: 999px;
        padding: 2px 10px;
        box-shadow: 0 2px 6px -2px rgba(180, 83, 9, 0.4);
      }

      .tc-save {
        position: absolute;
        bottom: 12px;
        right: 12px;
        z-index: 2;
      }

      .tc-top { display: flex; align-items: center; justify-content: space-between; }

      /* flex-shrink 0: when narrow widths make the text wrap taller than the
         fixed card, the title must never be the line that gets crushed. */
      .tc-card h3 {
        font-size: 1rem;
        margin: 4px 0 0;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex-shrink: 0;
      }

      .tc-company {
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 600;
        flex-shrink: 0;
      }

      /* The explanation is the sacrificial line when space runs out. */
      .tc-explain {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-soft);
        overflow: hidden;
      }

      .tc-foot {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-top: auto;
        padding-top: 6px;
        padding-right: 34px;
        flex-wrap: wrap;
      }

      .badge-applied {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--color-primary);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
      }

      .tc-loc {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.75rem;
        color: var(--color-text-soft);
        font-weight: 500;
      }

      /* ---- Dots + autoplay progress ---- */
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

      .tc-progress {
        height: 2px;
        margin-top: 6px;
        border-radius: 999px;
        background: rgba(180, 83, 9, 0.15);
        overflow: hidden;
      }

      .tc-progress span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #f59e0b, #b45309);
        transform-origin: left;
        transform: scaleX(0);
        animation: tc-fill 4200ms linear forwards;
      }

      @keyframes tc-fill {
        to { transform: scaleX(1); }
      }

      .tc-live {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .tc-slide {
          transition: none;
          animation: none;
        }
        .tc-slide.center .tc-card::after { animation: none; }
        .tc-progress { display: none; }
        .dot { transition: none; }
      }
    `,
  ],
})
export class TrendingCarouselComponent implements OnInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly icon = input.required<MaskIconName>();
  readonly items = input.required<InternshipListItem[]>();

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly active = signal(0);
  protected readonly dragging = signal(false);
  /** Fraction of one card width the pointer has moved; drives the whole ring. */
  private readonly dragProgress = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private reducedMotion = false;
  private pointerId: number | null = null;
  private dragStartX = 0;
  private cardWidth = 270;
  private suppressClick = false;

  protected readonly autoplaying = computed(
    () => !this.reducedMotion && this.items().length > 1,
  );

  ngOnInit(): void {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.autoplaying()) {
      this.start();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * Where card i sits on the ring right now. Poses are interpolated over the
   * card's fractional distance from center, so a drag moves every card
   * continuously instead of snapping between slots.
   */
  protected slideStyle(i: number): {
    transform: string;
    opacity: number;
    zIndex: number;
    center: boolean;
    offstage: boolean;
  } {
    const n = this.items().length;
    let off = i - (this.active() + this.dragProgress());
    off = ((off % n) + n) % n;
    if (off > n / 2) off -= n;

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

    const offstage = Math.abs(off) >= POSES.length - 1.05;
    return {
      transform: `translateX(${x}%) translateZ(${z}px) rotateY(${ry}deg) scale(${s})`,
      opacity: o,
      zIndex: 10 - Math.round(Math.abs(off) * 2),
      center: !this.dragging() && Math.abs(off) < 0.5,
      offstage,
    };
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected deadline(item: InternshipListItem): string | null {
    return deadlineCountdown(item.applicationDeadline);
  }

  protected explain(item: InternshipListItem): string | null {
    if (item.hasApplied) {
      return null;
    }
    return matchExplanation(item.matchedSkillCount, item.requiredSkillCount);
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

  protected centerOn(i: number): void {
    this.pause();
    if (this.active() !== i) {
      this.active.set(i);
    }
  }

  private step(dir: 1 | -1): void {
    const n = this.items().length;
    if (n === 0) return;
    this.active.set((((this.active() + dir) % n) + n) % n);
    this.restart();
  }

  // ---- Finger-tracking drag ----
  protected dragStart(event: PointerEvent): void {
    if (this.items().length < 2 || event.button !== 0) return;
    this.pointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.suppressClick = false;
    const el = this.stage()?.nativeElement;
    this.cardWidth =
      el?.querySelector<HTMLElement>('.tc-slide')?.getBoundingClientRect().width ?? 270;
    el?.setPointerCapture(event.pointerId);
    this.pause();
  }

  protected dragMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.dragStartX;
    if (!this.dragging() && Math.abs(dx) < 6) {
      return; // movement threshold: a shaky tap is still a click
    }
    this.dragging.set(true);
    this.suppressClick = true;
    // Dragging right pulls earlier cards toward center.
    this.dragProgress.set(-dx / this.cardWidth);
  }

  protected dragEnd(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    if (!this.dragging()) return;

    const n = this.items().length;
    const moved = Math.round(this.dragProgress());
    const settled = this.active() + (moved !== 0 ? moved : Math.round(this.dragProgress() * 2));
    this.active.set(((settled % n) + n) % n);
    this.dragProgress.set(0);
    this.dragging.set(false);
    // Touch has no mouseleave: un-pause here or autoplay dies after the first
    // swipe. A mouse is still hovering, so its pause holds until it leaves.
    if (event.pointerType !== 'mouse') {
      this.paused = false;
    }
    this.restart();
  }

  /** A drag that ends on a card must not follow the link. */
  protected guardClick(event: MouseEvent): void {
    if (this.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
    }
  }

  // ---- Autoplay ----
  protected pause(): void {
    this.paused = true;
  }

  protected resume(): void {
    this.paused = false;
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => {
      if (!this.paused && !this.dragging() && !document.hidden) {
        this.step(1);
      }
    }, 4200);
  }

  private restart(): void {
    if (this.autoplaying()) this.start();
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
