import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * The "this really is an employer" marker shown beside a company's name in chat.
 * It renders only what the server said: `verified` comes from the admin-granted
 * flag on the company record, never from anything the account can set itself.
 *
 * An unverified company still gets a (muted, unchecked) company chip rather than
 * nothing — silently dropping the marker would make an unverified employer look
 * like an ordinary student, which is the confusion this is meant to prevent.
 */
@Component({
  selector: 'app-company-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span
      class="badge"
      [class.verified]="verified()"
      [attr.title]="
        verified()
          ? 'Verified company — Linker confirmed this account represents ' + companyName()
          : 'Company account, not yet verified by Linker'
      "
    >
      @if (verified()) {
        <app-icon name="check" [size]="11" />
      }
      {{ verified() ? 'Company' : 'Unverified company' }}
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        white-space: nowrap;
        background: var(--color-surface-alt, #f1f5f9);
        color: var(--color-text-soft);
        border: 1px solid var(--color-border);
      }

      .badge.verified {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }
    `,
  ],
})
export class CompanyBadgeComponent {
  readonly verified = input.required<boolean>();
  readonly companyName = input<string | null>(null);
}
