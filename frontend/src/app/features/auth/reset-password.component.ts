import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../core/toast.service';
import { AccountService } from '../../core/api/account.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { BgDecorComponent } from '../../shared/bg-decor.component';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LinkButtonComponent, IconComponent, BgDecorComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <app-bg-decor />
      <div class="auth-card">
        <h1>Choose a new password</h1>
        <p class="auth-sub">Enter a new password for your account.</p>

        @if (serverError()) {
          <div class="form-error-banner" @fadeSlideIn role="alert">{{ serverError() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="password">New password</label>
            <div class="group">
              <app-icon class="icon" name="lock" [size]="18" />
              <input id="password" type="password" class="input" formControlName="password"
              autocomplete="new-password" [class.invalid]="showError('password')" />
            </div>
            @if (showError('password')) {
              <div class="field-error" @fadeSlideIn>At least 8 characters.</div>
            }
          </div>

          <div class="field">
            <label class="label" for="confirm">Confirm password</label>
            <div class="group">
              <app-icon class="icon" name="lock" [size]="18" />
              <input id="confirm" type="password" class="input" formControlName="confirm"
              autocomplete="new-password" [class.invalid]="mismatch()" />
            </div>
            @if (mismatch()) {
              <div class="field-error" @fadeSlideIn>Passwords don't match.</div>
            }
          </div>

          <app-link-button type="submit" block [disabled]="submitting()">
            {{ submitting() ? 'Saving…' : 'Reset password' }}
          </app-link-button>
        </form>

        <p class="auth-footer">
          <a routerLink="/login">Back to login</a>
        </p>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly token = input<string>();

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  ngOnInit(): void {
    if (!this.token()) {
      this.serverError.set('This reset link is missing its token. Request a new one.');
    }
  }

  protected showError(control: 'password' | 'confirm'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  protected mismatch(): boolean {
    const { password, confirm } = this.form.controls;
    return confirm.dirty && confirm.value !== password.value;
  }

  protected submit(): void {
    this.serverError.set(null);
    const token = this.token();
    if (this.form.invalid || this.mismatch() || !token) {
      this.form.markAllAsTouched();
      if (!token) this.serverError.set('This reset link is missing its token. Request a new one.');
      return;
    }

    this.submitting.set(true);
    this.account.resetPassword(token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.toast.success('Password reset — please log in.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.serverError.set(apiErrorMessage(err, 'Could not reset your password. The link may have expired.'));
      },
    });
  }
}
