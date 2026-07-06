import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MaskIconComponent } from './mask-icon.component';

/**
 * Skill-match indicator (0-100%). Colour shifts from neutral to strong as the
 * share of an internship's required skills the student already has rises.
 */
@Component({
  selector: 'app-match-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MaskIconComponent],
  template: `
    <span class="match" [class]="tier()" [attr.title]="'You have ' + score() + '% of the required skills'">
      <app-mask-icon name="gear" [size]="13" />
      {{ score() }}% match
    </span>
  `,
  styles: [
    `
      .match {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 5px 10px;
        border-radius: 999px;
        white-space: nowrap;
        border: 1px solid transparent;
      }

      .match.strong {
        color: #166534;
        background: #dcfce7;
        border-color: #bbf7d0;
      }

      .match.medium {
        color: #92400e;
        background: #fef3c7;
        border-color: #fde68a;
      }

      .match.low {
        color: var(--color-text-soft);
        background: var(--color-muted);
        border-color: var(--color-border);
      }
    `,
  ],
})
export class MatchBadgeComponent {
  readonly score = input.required<number>();

  protected readonly tier = computed(() => {
    const s = this.score();
    if (s >= 67) return 'strong';
    if (s >= 34) return 'medium';
    return 'low';
  });
}
