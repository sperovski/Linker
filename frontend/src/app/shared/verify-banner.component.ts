import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { AccountService } from '../core/api/account.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

/**
 * Slim reminder shown under the header when a logged-in user hasn't verified
 * their email yet. Lets them resend the link without leaving the page.
 */
@Component({
  selector: 'app-verify-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (auth.isLoggedIn() && !auth.emailVerified() && !dismissed()) {
      <div class="banner" role="status">
        <div class="container inner">
          <span class="text">
            <app-icon name="mail" [size]="16" />
            Please verify your email to secure your account.
          </span>
          <span class="actions">
            <button type="button" class="link" [disabled]="sending()" (click)="resend()">
              {{ sending() ? 'Sending…' : 'Resend link' }}
            </button>
            <button type="button" class="dismiss" aria-label="Dismiss" (click)="dismissed.set(true)">
              <app-icon name="x" [size]="15" />
            </button>
          </span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .banner {
        background: #fffbeb;
        border-bottom: 1px solid #fde68a;
        color: #92400e;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding-top: 9px;
        padding-bottom: 9px;
        flex-wrap: wrap;
      }

      .text { display: inline-flex; align-items: center; gap: var(--space-sm); }

      .actions { display: inline-flex; align-items: center; gap: var(--space-sm); }

      .link {
        background: none;
        border: none;
        color: #92400e;
        font-family: var(--font-sans);
        font-size: 0.875rem;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
        padding: 4px;
      }

      .link:disabled { opacity: 0.6; cursor: default; }

      .dismiss {
        display: inline-flex;
        background: none;
        border: none;
        color: #92400e;
        cursor: pointer;
        padding: 4px;
        border-radius: var(--radius-sm);
      }

      .dismiss:hover { background: rgba(146, 64, 14, 0.1); }
    `,
  ],
})
export class VerifyBannerComponent {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);

  protected readonly sending = signal(false);
  protected readonly dismissed = signal(false);

  protected resend(): void {
    const email = this.auth.email();
    if (!email) return;
    this.sending.set(true);
    this.account.resendVerification(email).subscribe({
      next: () => {
        this.sending.set(false);
        this.toast.success('Verification email sent. Check your inbox.');
      },
      error: () => {
        this.sending.set(false);
        this.toast.error('Could not send the verification email.');
      },
    });
  }
}
