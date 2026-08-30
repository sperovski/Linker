import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService } from '../../core/api/account.service';
import { AuthService } from '../../core/auth.service';
import { Account } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { PasswordStrengthComponent } from '../../shared/password-strength.component';
import { strongPasswordValidator } from '../../shared/password-policy';
import { formatDate } from '../../shared/dates';

/**
 * Account settings, shared by students and companies — the credentials are on
 * the user account, not on either profile, so one page serves both roles.
 *
 * Both forms ask for the current password. That is the server's rule, restated
 * here so the reason is visible: an access token proves the session, not the
 * person, and neither of these changes should be reachable from a stolen one.
 */
@Component({
  selector: 'app-account-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    LinkButtonComponent,
    EmptyStateComponent,
    PasswordStrengthComponent,
  ],
  animations: [fadeSlideIn],
  template: `
    <div class="container page narrow">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your account</span>
          <h1>Security settings</h1>
          <p class="page-sub">The email you sign in with, and the password that protects it.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card" role="status" aria-label="Loading">
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 44px; width: 70%;"></div>
        </div>
      } @else if (loadError()) {
        <app-empty-state
          variant="inbox"
          title="Couldn't load your account"
          message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
        />
      } @else if (account(); as acc) {
        <section class="card summary">
          <div class="summary-row">
            <div>
              <span class="summary-label">Signed in as</span>
              <span class="summary-value">{{ acc.email }}</span>
            </div>
            @if (acc.emailVerified) {
              <span class="pill ok"><app-icon name="check" [size]="12" /> Verified</span>
            } @else {
              <span class="pill warn"><app-icon name="mail" [size]="12" /> Unverified</span>
            }
          </div>
          <div class="summary-row">
            <div>
              <span class="summary-label">Member since</span>
              <span class="summary-value">{{ formatDate(acc.createdAtUtc) }}</span>
            </div>
          </div>

          @if (acc.pendingEmail) {
            <div class="pending" role="status">
              <app-icon name="mail" [size]="15" />
              <span>
                Waiting on confirmation for <strong>{{ acc.pendingEmail }}</strong
                >. Until you use the link we sent there, you keep signing in with
                {{ acc.email }}.
              </span>
            </div>
          }
        </section>

        <section class="card">
          <h2>Change password</h2>
          <p class="section-sub">
            Changing your password signs you out everywhere else, so a device you've lost
            can't stay signed in.
          </p>

          <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" novalidate>
            <div class="field">
              <label class="label" for="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                class="field-input"
                autocomplete="current-password"
                formControlName="currentPassword"
                [class.invalid]="invalid(passwordForm, 'currentPassword')"
              />
              @if (invalid(passwordForm, 'currentPassword')) {
                <div class="field-error" @fadeSlideIn>Enter your current password.</div>
              }
            </div>

            <div class="field">
              <label class="label" for="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                class="field-input"
                autocomplete="new-password"
                formControlName="newPassword"
                [class.invalid]="invalid(passwordForm, 'newPassword')"
              />
              <app-password-strength [password]="passwordForm.controls.newPassword.value" />
              @if (invalid(passwordForm, 'newPassword')) {
                <div class="field-error" @fadeSlideIn>{{ passwordError() }}</div>
              }
            </div>

            <app-link-button type="submit" [disabled]="savingPassword()">
              {{ savingPassword() ? 'Saving…' : 'Change password' }}
            </app-link-button>
          </form>
        </section>

        <section class="card">
          <h2>Change email</h2>
          <p class="section-sub">
            We'll send a confirmation link to the new address. Your current one keeps working
            until you use it.
          </p>

          <form [formGroup]="emailForm" (ngSubmit)="saveEmail()" novalidate>
            <div class="field">
              <label class="label" for="newEmail">New email address</label>
              <input
                id="newEmail"
                type="email"
                class="field-input"
                autocomplete="email"
                formControlName="newEmail"
                [class.invalid]="invalid(emailForm, 'newEmail')"
              />
              @if (invalid(emailForm, 'newEmail')) {
                <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
              }
            </div>

            <div class="field">
              <label class="label" for="emailPassword">Current password</label>
              <input
                id="emailPassword"
                type="password"
                class="field-input"
                autocomplete="current-password"
                formControlName="currentPassword"
                [class.invalid]="invalid(emailForm, 'currentPassword')"
              />
              @if (invalid(emailForm, 'currentPassword')) {
                <div class="field-error" @fadeSlideIn>Enter your current password.</div>
              }
            </div>

            <app-link-button type="submit" [disabled]="savingEmail()">
              {{ savingEmail() ? 'Sending…' : 'Send confirmation link' }}
            </app-link-button>
          </form>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 660px; }

      .card + .card { margin-top: var(--space-lg); }

      .card h2 { margin: 0; font-size: 1.0625rem; }

      .section-sub {
        margin: 6px 0 var(--space-lg);
        color: var(--color-text-soft);
        font-size: 0.875rem;
      }

      .summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: 10px 0;
      }

      .summary-row + .summary-row { border-top: 1px solid var(--color-border); }

      .summary-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-soft);
      }

      .summary-value { font-weight: 600; }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .pill.ok { background: #dcfce7; color: #15803d; }
      .pill.warn { background: #fef3c7; color: #92400e; }

      .pending {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        margin-top: var(--space-md);
        border-radius: var(--radius-md);
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 10px 12px;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class AccountSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly account = signal<Account | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly savingEmail = signal(false);

  protected readonly formatDate = formatDate;

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: [
      '',
      // The email getter feeds the "don't put your address in your password"
      // rule, which the server applies too.
      [Validators.required, strongPasswordValidator(() => this.account()?.email ?? null)],
    ],
  });

  protected readonly emailForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.accountService.me().subscribe({
      next: (account) => {
        this.account.set(account);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected invalid(form: { get(name: string): unknown }, control: string): boolean {
    const c = form.get(control) as { invalid: boolean; touched: boolean; dirty: boolean } | null;
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  /** Surfaces the specific policy failure rather than a generic "invalid". */
  protected passwordError(): string {
    const errors = this.passwordForm.controls.newPassword.errors;
    if (errors?.['strongPassword']) return errors['strongPassword'] as string;
    return 'Choose a new password.';
  }

  protected savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.accountService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        // The server revoked every refresh token, this session's included, so
        // staying on the page would just fail at the next refresh.
        this.toast.success('Password changed. Please sign in again.');
        this.auth.logout();
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not change your password.'));
      },
    });
  }

  protected saveEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const { newEmail, currentPassword } = this.emailForm.getRawValue();
    this.savingEmail.set(true);
    this.accountService.changeEmail(newEmail, currentPassword).subscribe({
      next: () => {
        this.savingEmail.set(false);
        this.emailForm.reset();
        this.toast.success(`Confirmation link sent to ${newEmail}.`);
        this.load();
      },
      error: (err) => {
        this.savingEmail.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not change your email.'));
      },
    });
  }
}
