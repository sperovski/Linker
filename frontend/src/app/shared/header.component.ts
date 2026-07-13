import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NotificationService } from '../core/api/notification.service';
import { IconComponent } from './icon.component';
import { LinkButtonComponent } from './link-button.component';
import { NotificationBellComponent } from './notification-bell.component';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, LinkButtonComponent, NotificationBellComponent],
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    <header class="header" [class.elevated]="scrolled()">
      <div class="container header-inner">
        <a [routerLink]="auth.isLoggedIn() ? auth.homePath() : '/'" class="brand">
          <img src="/linker-logo-v2.png" alt="Linker" class="brand-logo" />
        </a>

        <button
          type="button"
          class="menu-toggle"
          (click)="menuOpen.set(!menuOpen())"
          [attr.aria-expanded]="menuOpen()"
          aria-label="Toggle navigation"
        >
          <app-icon name="chevron-down" [size]="20" />
        </button>

        <nav class="nav" [class.open]="menuOpen()" (click)="menuOpen.set(false)">
          @if (auth.isStudent()) {
            <a routerLink="/internships" routerLinkActive="active">Browse</a>
            <a routerLink="/saved" routerLinkActive="active">Saved</a>
            <a routerLink="/applications" routerLinkActive="active">My Applications</a>
            <a routerLink="/cv-review" routerLinkActive="active">Rate my CV</a>
            <a routerLink="/community" routerLinkActive="active">Community</a>
            <a routerLink="/profile" routerLinkActive="active">Profile</a>
          } @else if (auth.isCompany()) {
            <a routerLink="/company/dashboard" routerLinkActive="active">Dashboard</a>
            <a routerLink="/company/listings" routerLinkActive="active">My Listings</a>
            <a routerLink="/community" routerLinkActive="active">Community</a>
            <a routerLink="/company/profile" routerLinkActive="active">Profile</a>
          } @else if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
            <a routerLink="/community" routerLinkActive="active">Community</a>
          } @else {
            <a routerLink="/internships" routerLinkActive="active">Browse internships</a>
          }

          @if (auth.isLoggedIn()) {
            @if (!auth.isAdmin()) {
              <app-notification-bell />
            }
            <span class="user-chip" [title]="auth.email()">
              <app-icon [name]="auth.isCompany() ? 'building' : 'user'" [size]="15" />
              {{ auth.email() }}
            </span>
            <app-link-button size="sm" (pressed)="logout()">
              <app-icon name="log-out" [size]="15" />
              Log out
            </app-link-button>
          } @else {
            <app-link-button routerLink="/login" size="sm">Log in</app-link-button>
            <app-link-button routerLink="/register" size="sm">Sign up</app-link-button>
          }
        </nav>
      </div>
    </header>
  `,
  styles: [
    `
      .header {
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        position: sticky;
        top: 0;
        z-index: 50;
        transition: box-shadow 200ms ease;
      }

      .header.elevated { box-shadow: var(--shadow-md); }

      .header-inner {
        display: flex;
        align-items: center;
        gap: var(--space-lg);
        min-height: 64px;
        flex-wrap: wrap;
        padding-top: var(--space-sm);
        padding-bottom: var(--space-sm);
      }

      .brand {
        display: inline-flex;
        align-items: center;
      }

      .brand:hover { text-decoration: none; }

      .brand-logo {
        display: block;
        height: 36px;
        width: auto;
      }

      .nav {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        margin-left: auto;
        flex-wrap: wrap;
      }

      .nav a:not(.btn) {
        color: var(--color-text-soft);
        font-weight: 600;
        font-size: 0.9375rem;
        padding: 6px 4px;
        border-bottom: 2px solid transparent;
        transition: color 200ms ease, border-color 200ms ease;
      }

      .nav a:not(.btn):hover {
        color: var(--color-primary);
        text-decoration: none;
      }

      .nav a.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }

      .user-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 500;
        background: var(--color-muted);
        border-radius: 999px;
        padding: 6px 12px;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .menu-toggle { display: none; }

      @media (max-width: 767px) {
        .menu-toggle {
          display: inline-flex;
          margin-left: auto;
          background: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 6px;
          cursor: pointer;
          color: var(--color-foreground);
        }

        .nav {
          display: none;
          width: 100%;
          flex-direction: column;
          align-items: flex-start;
          padding-bottom: var(--space-sm);
        }

        .nav.open { display: flex; }
      }
    `,
  ],
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  protected logout(): void {
    // Clear the local notification feed so a new login starts clean.
    this.notifications.clear();
    this.auth.logout();
  }
}
