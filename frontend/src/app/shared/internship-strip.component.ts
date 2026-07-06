import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InternshipListItem } from '../core/models';
import { CompanyLogoComponent } from './company-logo.component';
import { MatchBadgeComponent } from './match-badge.component';
import { IconComponent } from './icon.component';
import { MaskIconComponent, MaskIconName } from './mask-icon.component';
import { TYPE_LABELS } from './dates';

/**
 * Horizontal, scrollable row of compact internship cards. Used for the
 * "Recommended for you" and "Trending now" rails on the browse page.
 */
@Component({
  selector: 'app-internship-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CompanyLogoComponent, MatchBadgeComponent, IconComponent, MaskIconComponent],
  template: `
    <section class="strip">
      <div class="strip-head">
        <span class="strip-icon" [class]="accent()">
          <app-mask-icon [name]="icon()" [size]="17" />
        </span>
        <div>
          <h2>{{ heading() }}</h2>
          @if (subheading()) {
            <p>{{ subheading() }}</p>
          }
        </div>
      </div>

      <div class="strip-scroll">
        @for (item of items(); track item.id; let i = $index) {
          <a
            class="mini card card-hover"
            [routerLink]="['/internships', item.id]"
            [style.animation-delay.ms]="i * 55"
          >
            <div class="mini-top">
              <app-company-logo [name]="item.companyName" [size]="36" />
              @if (item.matchScore !== null) {
                <app-match-badge [score]="item.matchScore" />
              } @else if (rank()) {
                <span class="rank">#{{ i + 1 }}</span>
              }
            </div>
            <h3>{{ item.title }}</h3>
            <span class="mini-company">{{ item.companyName }}</span>
            <div class="mini-foot">
              <span class="badge badge-type">{{ typeLabel(item.type) }}</span>
              @if (item.location) {
                <span class="mini-loc"><app-icon name="map-pin" [size]="12" /> {{ item.location }}</span>
              }
            </div>
          </a>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .strip { margin-bottom: var(--space-xl); }

      .strip-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .strip-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-md);
        background: rgba(3, 105, 161, 0.1);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .strip-icon.amber { background: #fef3c7; color: #b45309; }

      .strip-head h2 { font-size: 1.15rem; margin: 0; }
      .strip-head p { margin: 0; font-size: 0.85rem; color: var(--color-text-soft); }

      .strip-scroll {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(230px, 1fr);
        gap: var(--space-md);
        overflow-x: auto;
        padding: 4px 4px 12px;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
      }

      .mini {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: inherit;
        scroll-snap-align: start;
        animation: mini-in 400ms ease both;
      }

      @keyframes mini-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: none; }
      }

      .mini:hover { text-decoration: none; }

      .mini-top { display: flex; align-items: center; justify-content: space-between; }

      .mini h3 { font-size: 1rem; margin: 4px 0 0; line-height: 1.3; }

      .mini-company { color: var(--color-text-soft); font-size: 0.8125rem; font-weight: 600; }

      .mini-foot { display: flex; align-items: center; gap: var(--space-sm); margin-top: auto; padding-top: 6px; flex-wrap: wrap; }

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
        color: var(--color-primary);
        background: rgba(3, 105, 161, 0.1);
        border-radius: 999px;
        padding: 2px 9px;
      }

      @media (prefers-reduced-motion: reduce) {
        .mini { animation: none; }
      }
    `,
  ],
})
export class InternshipStripComponent {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly icon = input.required<MaskIconName>();
  readonly items = input.required<InternshipListItem[]>();
  readonly accent = input('');
  /** Show a #rank chip when an item has no match score (e.g. anonymous popular list). */
  readonly rank = input(false);

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }
}
