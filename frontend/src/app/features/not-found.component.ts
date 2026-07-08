import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../shared/icon.component';
import { LinkButtonComponent } from '../shared/link-button.component';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LinkButtonComponent],
  template: `
    <div class="container page nf">
      <p class="nf-code" aria-hidden="true">404</p>
      <h1>This page took a different internship.</h1>
      <p class="nf-sub">The link is broken or the page has moved — but the roles are still here.</p>
      <div class="nf-actions">
        <app-link-button routerLink="/internships">
          Browse internships
          <app-icon name="arrow-right" [size]="16" />
        </app-link-button>
        <app-link-button variant="standard-secondary" [routerLink]="auth.isLoggedIn() ? auth.homePath() : '/'">
          Go home
        </app-link-button>
      </div>
    </div>
  `,
  styles: [
    `
      .nf {
        text-align: center;
        padding-top: var(--space-3xl);
        padding-bottom: var(--space-3xl);
        max-width: 560px;
      }

      .nf-code {
        font-size: clamp(4rem, 12vw, 7rem);
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1;
        color: var(--color-border);
        margin-bottom: var(--space-sm);
      }

      .nf h1 { font-size: 1.5rem; }

      .nf-sub { color: var(--color-text-soft); margin-bottom: var(--space-lg); }

      .nf-actions {
        display: flex;
        gap: var(--space-md);
        justify-content: center;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class NotFoundComponent {
  protected readonly auth = inject(AuthService);
}
