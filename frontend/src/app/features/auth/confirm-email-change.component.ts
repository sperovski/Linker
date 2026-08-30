import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountService } from '../../core/api/account.service';
import { apiErrorMessage } from '../../shared/api-error';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

type ConfirmState = 'confirming' | 'success' | 'error';

/**
 * Landing page for the link sent to a requested new address. Confirming moves
 * the login identity, so the server revokes every session — including this
 * one — and the only sensible next step is a fresh sign-in with the new email.
 */
@Component({
  selector: 'app-confirm-email-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LinkButtonComponent],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <div class="auth-card verify-card">
        @switch (state()) {
          @case ('confirming') {
            <span class="v-icon pending"><span class="spinner" aria-hidden="true"></span></span>
            <h1>Confirming your new email…</h1>
            <p class="auth-sub">One moment while we check your link.</p>
          }
          @case ('success') {
            <span class="v-icon ok"><app-icon name="check" [size]="30" /></span>
            <h1>Email updated</h1>
            <p class="auth-sub">
              This is now the address you sign in with. For safety, every device was signed
              out — sign back in with your new email.
            </p>
            <app-link-button routerLink="/login" block>Go to login</app-link-button>
          }
          @case ('error') {
            <span class="v-icon bad"><app-icon name="x" [size]="30" /></span>
            <h1>Link expired or invalid</h1>
            <p class="auth-sub">{{ errorMessage() }}</p>
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
export class ConfirmEmailChangeComponent implements OnInit {
  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);

  /** ?token=… from the emailed link (bound via withComponentInputBinding). */
  readonly token = input<string>();

  protected readonly state = signal<ConfirmState>('confirming');
  protected readonly errorMessage = signal(
    'This confirmation link is no longer valid. Request the change again from your settings.',
  );

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('error');
      return;
    }

    this.account.confirmEmailChange(token).subscribe({
      next: () => {
        // Sessions are already dead server-side; clear the local one so the app
        // doesn't act signed-in with an identity that no longer exists.
        if (this.auth.isLoggedIn()) {
          this.auth.clearSession();
        }
        this.state.set('success');
      },
      error: (err) => {
        this.errorMessage.set(
          apiErrorMessage(
            err,
            'This confirmation link is no longer valid. Request the change again from your settings.',
          ),
        );
        this.state.set('error');
      },
    });
  }
}
