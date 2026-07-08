import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../core/api/account.service';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LinkButtonComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <div class="auth-card">
        @if (sent()) {
          <div class="sent-block">
            <span class="v-icon"><app-icon name="mail" [size]="26" /></span>
            <h1>Check your email</h1>
            <p class="auth-sub">
              If an account exists for that address, we've sent a link to reset your password.
              The link expires in a couple of hours.
            </p>
            <app-link-button routerLink="/login" block>Back to login</app-link-button>
          </div>
        } @else {
          <h1>Reset your password</h1>
          <p class="auth-sub">Enter your email and we'll send you a reset link.</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="email">Email</label>
              <input id="email" type="email" class="input" formControlName="email"
                autocomplete="email" [class.invalid]="showError()" />
              @if (showError()) {
                <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
              }
            </div>

            <app-link-button type="submit" block [disabled]="submitting()">
              {{ submitting() ? 'Sending…' : 'Send reset link' }}
            </app-link-button>
          </form>

          <p class="auth-footer">
            Remembered it? <a routerLink="/login">Back to login</a>
          </p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .sent-block { text-align: center; }
      .v-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 60px; height: 60px; border-radius: 50%;
        background: var(--color-muted); color: var(--color-primary);
        margin: 0 auto var(--space-md);
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected showError(): boolean {
    const c = this.form.controls.email;
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.account.forgotPassword(this.form.getRawValue().email).subscribe({
      // Always show the same confirmation — never reveal whether the email exists.
      next: () => this.sent.set(true),
      error: () => this.sent.set(true),
    });
  }
}
