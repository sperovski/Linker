import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MaskIconComponent } from './mask-icon.component';
import { MATCH_BAND_LABELS, MatchBand, matchBand } from './match';

/**
 * Skill-match indicator. Shows a band ("Strong match"), not a raw percentage:
 * with three required skills per role the raw number can only be 0/33/67/100,
 * and showing that implies a precision the score doesn't have. The exact figure
 * stays in the tooltip.
 *
 * Renders nothing below MATCH_BADGE_MIN_SCORE — a 0% match is never surfaced.
 */
@Component({
  selector: 'app-match-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MaskIconComponent],
  template: `
    @if (band(); as tier) {
      <span class="match" [class]="tier" [attr.title]="tooltip()">
        <app-mask-icon name="gear" [size]="13" />
        {{ label() }}
      </span>
    }
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

      .match.good {
        color: #92400e;
        background: #fef3c7;
        border-color: #fde68a;
      }

      .match.possible {
        color: var(--color-text-soft);
        background: var(--color-muted);
        border-color: var(--color-border);
      }
    `,
  ],
})
export class MatchBadgeComponent {
  readonly score = input.required<number | null>();
  /** Optional breakdown; when present the tooltip names the skills you have. */
  readonly matchedSkillCount = input<number | null>(null);
  readonly requiredSkillCount = input<number | null>(null);

  protected readonly band = computed<MatchBand | null>(() => matchBand(this.score()));
  protected readonly label = computed(() => {
    const band = this.band();
    return band ? MATCH_BAND_LABELS[band] : '';
  });

  // The raw percentage stays reachable here, so the precision isn't lost — just
  // not asserted on the card face.
  protected readonly tooltip = computed(() => {
    const matched = this.matchedSkillCount();
    const required = this.requiredSkillCount();
    const percent = `${this.score()}% skill match`;
    return matched !== null && required !== null
      ? `${percent} — you have ${matched} of ${required} required skills`
      : percent;
  });
}
