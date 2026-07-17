import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InternshipListItem } from '../core/models';
import { CompanyLogoComponent } from './company-logo.component';
import { MatchBadgeComponent } from './match-badge.component';
import { IconComponent } from './icon.component';
import { SaveButtonComponent } from './save-button.component';
import { TYPE_LABELS, deadlineCountdown, daysUntil, startCountdown } from './dates';
import { matchExplanation } from './match';

/**
 * The internship card used across the browse grid, the saved grid, and the
 * Trending carousel. Its look — 22px corners, border, shadow, hover tilt and
 * parallax layers — lives in the shared `.internship-card` rules in styles.css,
 * so every surface renders the exact same card. This component owns only the
 * markup, so the three call sites stop duplicating it.
 *
 * `variant` captures the one real difference between the surfaces:
 * - `full` (browse, carousel): skill overflow "+N", the "Applied" badge,
 *   detailed match tooltip, a start-date countdown, the match explanation
 *   line and the "View role" call-to-action.
 * - `compact` (saved): a leaner card without those extras.
 */
@Component({
  selector: 'app-internship-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CompanyLogoComponent, MatchBadgeComponent, IconComponent, SaveButtonComponent],
  host: { class: 'card-wrap' },
  template: `
    <div class="card-overlay">
      <app-save-button
        [internshipId]="internship().id"
        [initialSaved]="initialSaved()"
        [compact]="true"
        (savedChange)="savedChange.emit($event)"
      />
    </div>
    <a class="internship-card" [routerLink]="['/internships', internship().id]">
      <div class="card-top">
        <span class="logo-layer">
          <app-company-logo [name]="internship().companyName" [size]="44" />
        </span>
        <div class="card-top-text">
          <span class="company">{{ internship().companyName }}</span>
          <h3>{{ internship().title }}</h3>
        </div>
      </div>

      @if (internship().requiredSkills.length) {
        <div class="skill-chips">
          @for (skill of internship().requiredSkills.slice(0, 4); track skill.id) {
            <span class="skill-chip">{{ skill.name }}</span>
          }
          @if (full() && internship().requiredSkills.length > 4) {
            <span class="skill-chip more">+{{ internship().requiredSkills.length - 4 }}</span>
          }
        </div>
      }

      <div class="badges">
        @if (full() && internship().hasApplied) {
          <span class="badge badge-applied">
            <app-icon name="check" [size]="12" />
            Applied
          </span>
        } @else if (full()) {
          <app-match-badge
            [score]="internship().matchScore"
            [matchedSkillCount]="internship().matchedSkillCount"
            [requiredSkillCount]="internship().requiredSkillCount"
          />
        } @else if (internship().matchScore !== null) {
          <app-match-badge [score]="internship().matchScore" />
        }

        <span class="badge badge-type">{{ typeLabel() }}</span>

        @if (internship().location) {
          <span class="badge badge-location">
            <app-icon name="map-pin" [size]="12" />
            {{ internship().location }}
          </span>
        }

        @if (deadline(); as label) {
          <span
            class="badge"
            [class.badge-deadline]="!deadlineSoon()"
            [class.badge-deadline-soon]="deadlineSoon()"
          >
            <app-icon name="clock" [size]="12" />
            {{ label }}
          </span>
        } @else if (full() && countdown(); as label) {
          <span class="badge badge-deadline">
            <app-icon name="calendar" [size]="12" />
            {{ label }}
          </span>
        }
      </div>

      @if (full()) {
        @if (explain(); as line) {
          <p class="match-explain">{{ line }}</p>
        }
        <span class="card-cta">
          View role
          <app-icon name="arrow-right" [size]="14" />
        </span>
      }
    </a>
  `,
  styles: [
    `
      /* Layout only — every visual comes from the global .internship-card
         rules. Host stands in for the old .card-wrap grid item. */
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class InternshipCardComponent {
  readonly internship = input.required<InternshipListItem>();
  readonly variant = input<'full' | 'compact'>('full');
  readonly initialSaved = input(false);

  /** Bubbles the save toggle so the saved grid can drop an un-saved card. */
  readonly savedChange = output<boolean>();

  protected readonly full = computed(() => this.variant() === 'full');
  protected readonly typeLabel = computed(() => TYPE_LABELS[this.internship().type] ?? this.internship().type);
  protected readonly deadline = computed(() => deadlineCountdown(this.internship().applicationDeadline));
  protected readonly countdown = computed(() => startCountdown(this.internship().startDate));
  protected readonly deadlineSoon = computed(() => {
    const days = daysUntil(this.internship().applicationDeadline);
    return days !== null && days <= 7;
  });
  protected readonly explain = computed(() => {
    const item = this.internship();
    if (item.hasApplied) {
      return null; // The "Applied" badge already says what matters.
    }
    return matchExplanation(item.matchedSkillCount, item.requiredSkillCount);
  });
}
