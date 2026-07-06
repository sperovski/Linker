import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="container page nf">
      <p class="nf-code" aria-hidden="true">404</p>
      <h1>This page took a different internship.</h1>
      <p class="nf-sub">The link is broken or the page has moved — but the roles are still here.</p>
      <div class="nf-actions">
        <a routerLink="/internships" class="btn btn-primary">
          Browse internships
          <app-icon name="arrow-right" [size]="16" />
        </a>
        <a [routerLink]="auth.isLoggedIn() ? auth.homePath() : '/'" class="btn btn-secondary">
          Go home
        </a>
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
