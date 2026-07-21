import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MATCH_BAND_LABELS, MatchBand, matchBand } from './match';

/**
 * Skill-match indicator. Now that the brand hue is green, a green badge would
 * stop reading as a signal, so match quality lives off the brand entirely: a
 * neutral pill (surface background, hairline border, primary text) carrying the
 * score, with a small traffic-light dot that encodes the band. The dot colours
 * are the --match-* tokens, never the brand green.
 *
 * Renders nothing below MATCH_BADGE_MIN_SCORE, so a 0% match is never surfaced.
 */
@Component({
  selector: 'app-match-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (band(); as tier) {
      <span class="match" [attr.title]="tooltip()">
        {{ score() }}%
      </span>
    }
  `,
  styles: [
    `
      .match {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 5px 10px;
        border-radius: 999px;
        white-space: nowrap;
        color: var(--color-text-primary, var(--color-foreground));
        background: var(--color-surface);
        border: 1px solid var(--color-border);
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

  // The band name and breakdown live in the tooltip, so hovering explains the
  // tier and how the score was reached.
  protected readonly tooltip = computed(() => {
    const band = this.band();
    const label = band ? MATCH_BAND_LABELS[band] : '';
    const matched = this.matchedSkillCount();
    const required = this.requiredSkillCount();
    const head = `${label}, ${this.score()}% skill match`;
    return matched !== null && required !== null
      ? `${head}, you have ${matched} of ${required} required skills`
      : head;
  });
}
