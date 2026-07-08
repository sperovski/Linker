import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { LinkButtonComponent } from '../../shared/link-button.component';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LinkButtonComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Welcome back</h1>
        <p class="auth-sub">Log in to your Linker account.</p>

        @if (serverError()) {
          <div class="form-error-banner" @fadeSlideIn role="alert">{{ serverError() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="email">Email</label>
            <input
              id="email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="email"
              [class.invalid]="showError('email')"
            />
            @if (showError('email')) {
              <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
            }
          </div>

          <div class="field">
            <div class="label-row">
              <label class="label" for="password">Password</label>
              <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>
            </div>
            <input
              id="password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
              [class.invalid]="showError('password')"
            />
            @if (showError('password')) {
              <div class="field-error" @fadeSlideIn>Password is required.</div>
            }
          </div>

          <app-link-button type="submit" block [disabled]="submitting()">
            {{ submitting() ? 'Logging in…' : 'Log in' }}
          </app-link-button>
        </form>

        <p class="auth-footer">
          No account yet? <a routerLink="/register">Create one</a>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .label-row { display: flex; align-items: baseline; justify-content: space-between; }
      .forgot-link { font-size: 0.8125rem; font-weight: 600; }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected showError(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate([this.auth.homePath()]),
      error: (err) => {
        this.submitting.set(false);
        this.serverError.set(apiErrorMessage(err, 'Login failed. Please try again.'));
      },
    });
  }
}
