import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountService } from '../../core/api/account.service';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

type VerifyState = 'verifying' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LinkButtonComponent],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <div class="auth-card verify-card">
        @switch (state()) {
          @case ('verifying') {
            <span class="v-icon pending"><span class="spinner" aria-hidden="true"></span></span>
            <h1>Verifying your email…</h1>
            <p class="auth-sub">One moment while we confirm your link.</p>
          }
          @case ('success') {
            <span class="v-icon ok"><app-icon name="check" [size]="30" /></span>
            <h1>Email verified</h1>
            <p class="auth-sub">Your account is all set. Thanks for confirming.</p>
            <app-link-button [routerLink]="homeLink()" block>Continue</app-link-button>
          }
          @case ('error') {
            <span class="v-icon bad"><app-icon name="x" [size]="30" /></span>
            <h1>Link expired or invalid</h1>
            <p class="auth-sub">This verification link is no longer valid. Log in and request a fresh one from the banner.</p>
            <app-link-button routerLink="/login" block>Go to login</app-link-button>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .verify-card { text-align: center; }
      .v-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        margin: 0 auto var(--space-md);
      }
      .v-icon.ok { background: #dcfce7; color: #166534; }
      .v-icon.bad { background: #fee2e2; color: #991b1b; }
      .v-icon.pending { background: var(--color-muted); }
      .spinner {
        width: 26px; height: 26px; border-radius: 50%;
        border: 3px solid var(--color-border); border-top-color: var(--color-primary);
        animation: spin 800ms linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    `,
  ],
})
export class VerifyEmailComponent implements OnInit {
  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);

  /** ?token=… from the emailed link (bound via withComponentInputBinding). */
  readonly token = input<string>();

  protected readonly state = signal<VerifyState>('verifying');

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('error');
      return;
    }
    this.account.verifyEmail(token).subscribe({
      next: () => {
        this.auth.markEmailVerified();
        // Rotate the token pair so the access token carries the verified claim
        // (the apply/post endpoints check it when the gate is enabled).
        if (this.auth.isLoggedIn()) {
          this.auth.refreshSession().subscribe({ error: () => {} });
        }
        this.state.set('success');
      },
      error: () => this.state.set('error'),
    });
  }

  protected homeLink(): string {
    return this.auth.isLoggedIn() ? this.auth.homePath() : '/login';
  }
}
