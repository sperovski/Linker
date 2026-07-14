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

/**
 * Horizontal row of compact internship cards. Used for the "Recommended for
 * you" and "Trending now" rails on the browse page.
 *
 * With [carousel]=true it becomes an auto-advancing carousel: the track slides
 * to the next card on a timer, pauses on hover/focus, and gains prev/next
 * arrows, dot indicators and edge fades. Uses native smooth scrolling under the
 * hood so keyboard and drag still work.
 */
@Component({
  selector: 'app-internship-strip',
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
    <section class="strip" [class.is-carousel]="carousel()">
      <div class="strip-head">
        <span class="strip-icon" [class]="accent()">
          <app-mask-icon [name]="icon()" [size]="17" />
        </span>
        <div class="strip-titles">
          <h2>{{ heading() }}</h2>
          @if (subheading()) {
            <p>{{ subheading() }}</p>
          }
        </div>

        @if (carousel() && items().length > 1) {
          <div class="strip-nav">
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
        class="strip-scroll"
        #scroller
        (mouseenter)="pause()"
        (mouseleave)="resume()"
        (focusin)="pause()"
        (focusout)="resume()"
      >
        @for (item of items(); track item.id; let i = $index) {
          <div class="mini-wrap" [style.animation-delay.ms]="i * 55">
            <div class="mini-save">
              <app-save-button [internshipId]="item.id" [initialSaved]="item.isSaved" [compact]="true" />
            </div>
            <a class="mini card" [routerLink]="['/internships', item.id]">
              <div class="mini-top">
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
                } @else if (rank()) {
                  <span class="rank">#{{ i + 1 }}</span>
                }
              </div>
              <h3>{{ item.title }}</h3>
              <span class="mini-company">{{ item.companyName }}</span>
              @if (explain(item); as line) {
                <span class="mini-explain">{{ line }}</span>
              }
              <!-- Two meta chips only: type, then the deadline if there is one,
                   otherwise the location. Keeps the card from overfilling. -->
              <div class="mini-foot">
                <span class="badge badge-type">{{ typeLabel(item.type) }}</span>
                @if (deadline(item); as label) {
                  <span class="mini-loc"><app-icon name="clock" [size]="12" /> {{ label }}</span>
                } @else if (item.location) {
                  <span class="mini-loc"><app-icon name="map-pin" [size]="12" /> {{ item.location }}</span>
                }
              </div>
            </a>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .strip { margin-bottom: var(--space-xl); }

      /* Carousel gets a soft panel so it reads as a distinct, richer section. */
      .strip.is-carousel {
        padding: var(--space-lg) var(--space-lg) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        background:
          radial-gradient(120% 140% at 100% 0%, rgba(245, 158, 11, 0.06), transparent 55%),
          radial-gradient(120% 140% at 0% 100%, rgba(79, 70, 229, 0.05), transparent 55%),
          var(--color-surface);
      }

      .strip-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .strip-titles { flex: 1; min-width: 0; }

      .strip-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: rgba(79, 70, 229, 0.1);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .strip-icon.amber { background: #fef3c7; color: #b45309; }

      .strip-head h2 { font-size: 1.2rem; margin: 0; letter-spacing: -0.01em; }
      .strip-head p { margin: 2px 0 0; font-size: 0.85rem; color: var(--color-text-soft); }

      /* ---- Nav arrows ---- */
      .strip-nav { display: flex; gap: 8px; flex-shrink: 0; }

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
        box-shadow: 0 8px 18px -8px rgba(79, 70, 229, 0.6);
      }

      .nav-btn:active { transform: translateY(0); }
      .nav-btn.prev app-icon { display: inline-flex; transform: rotate(180deg); }

      .strip-scroll { perspective: 1200px; }

      .strip-scroll {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(230px, 1fr);
        gap: var(--space-md);
        overflow-x: auto;
        padding: 4px 4px 12px;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: thin;
      }

      /* In carousel mode, hide the scrollbar (arrows + dots drive it) and fade
         the edges so partially-visible cards feel intentional. */
      .is-carousel .strip-scroll {
        scrollbar-width: none;
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent);
      }

      .is-carousel .strip-scroll::-webkit-scrollbar { display: none; }

      /* The wrapper is the grid child so the save button can sit outside the
         card's <a> (a button inside an anchor is invalid and unclickable). */
      .mini-wrap {
        position: relative;
        display: flex;
        scroll-snap-align: start;
        animation: mini-in 400ms ease backwards;
      }

      /* Bottom-right, out of the badge's way in mini-top; .mini-foot reserves
         the gutter so the meta chips never run under it. */
      .mini-save {
        position: absolute;
        bottom: 12px;
        right: 12px;
        z-index: 2;
      }

      .mini {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        color: inherit;
        cursor: pointer;
        transform-style: preserve-3d;
        transition:
          transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
          box-shadow 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
      }

      .mini:hover,
      .mini:focus-visible {
        transform: rotate3d(1, -0.35, 0, 6deg) translateY(-4px);
        box-shadow:
          0 18px 32px -18px rgba(23, 26, 43, 0.35),
          0 8px 14px -12px rgba(79, 70, 229, 0.25);
      }

      .mini:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 3px;
      }

      .mini-top,
      .mini h3 {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
      }

      .mini:hover .mini-top,
      .mini:focus-visible .mini-top { transform: translateZ(24px); }

      .mini:hover h3,
      .mini:focus-visible h3 { transform: translateZ(14px); }

      @keyframes mini-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: none; }
      }

      .mini:hover { text-decoration: none; }

      .mini-top { display: flex; align-items: center; justify-content: space-between; }

      .mini h3 { font-size: 1rem; margin: 4px 0 0; line-height: 1.3; }

      .mini-company { color: var(--color-text-soft); font-size: 0.8125rem; font-weight: 600; }

      /* padding-right keeps the chips clear of the absolutely-placed save button. */
      .mini-foot {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-top: auto;
        padding-top: 6px;
        padding-right: 34px;
        flex-wrap: wrap;
      }

      .mini-explain {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-soft);
      }

      .badge-applied {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--color-primary);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
      }

      .mini-loc {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.75rem;
        color: var(--color-text-soft);
        font-weight: 500;
      }

      .rank {
        font-size: 0.85rem;
        font-weight: 800;
        color: #b45309;
        background: #fef3c7;
        border-radius: 999px;
        padding: 2px 9px;
      }

      @media (prefers-reduced-motion: reduce) {
        .mini-wrap { animation: none; }
        .mini { transition: box-shadow 0.2s ease; }
        .mini:hover,
        .mini:focus-visible {
          transform: none;
          box-shadow: 0 10px 20px -12px rgba(23, 26, 43, 0.25);
        }
        .mini-top, .mini h3, .mini:hover .mini-top, .mini:hover h3,
        .mini:focus-visible .mini-top, .mini:focus-visible h3 {
          transition: none;
          transform: none;
        }
        .strip-scroll { scroll-behavior: auto; }
      }
    `,
  ],
})
export class InternshipStripComponent implements OnInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly icon = input.required<MaskIconName>();
  readonly items = input.required<InternshipListItem[]>();
  readonly accent = input('');
  /** Show a #rank chip when an item has no match score (e.g. anonymous popular list). */
  readonly rank = input(false);
  /** Turn the rail into an auto-advancing carousel. */
  readonly carousel = input(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private reducedMotion = false;

  ngOnInit(): void {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.carousel() && !this.reducedMotion) {
      this.start();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected deadline(item: InternshipListItem): string | null {
    return deadlineCountdown(item.applicationDeadline);
  }

  protected explain(item: InternshipListItem): string | null {
    if (item.hasApplied) {
      return null; // The "Applied" badge already carries the message.
    }
    return matchExplanation(item.matchedSkillCount, item.requiredSkillCount);
  }

  // ---- Carousel plumbing (native smooth scroll) ----
  private step(): number {
    const el = this.scroller()?.nativeElement;
    const first = el?.querySelector<HTMLElement>('.mini-wrap');
    if (!el || !first) return 246;
    const gap = parseFloat(getComputedStyle(el).columnGap || '16') || 16;
    return first.getBoundingClientRect().width + gap;
  }

  private advance(): void {
    const el = this.scroller()?.nativeElement;
    if (!el || this.paused) return;
    const max = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft >= max - 4) {
      el.scrollTo({ left: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' });
    } else {
      el.scrollBy({ left: this.step(), behavior: this.reducedMotion ? 'auto' : 'smooth' });
    }
  }

  protected next(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: 'smooth' });
    else el.scrollBy({ left: this.step(), behavior: 'smooth' });
    this.restart();
  }

  protected prev(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    if (el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    else el.scrollBy({ left: -this.step(), behavior: 'smooth' });
    this.restart();
  }

  protected pause(): void {
    this.paused = true;
  }

  protected resume(): void {
    this.paused = false;
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => this.advance(), 3600);
  }

  private restart(): void {
    if (this.carousel() && !this.reducedMotion) this.start();
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
