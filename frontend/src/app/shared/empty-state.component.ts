import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type EmptyStateVariant = 'search' | 'inbox' | 'rocket';

/**
 * Empty state with an illustration, encouraging copy and a clear CTA —
 * used anywhere a list can be empty so blank screens never appear.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="empty-shell">
      <div class="illustration" aria-hidden="true">
        <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          @switch (variant()) {
            @case ('search') {
              <circle cx="52" cy="44" r="26" stroke="#0369A1" stroke-width="4" />
              <line x1="72" y1="64" x2="88" y2="80" stroke="#0369A1" stroke-width="4" stroke-linecap="round" />
              <path d="M42 44a10 10 0 0 1 10-10" stroke="#0EA5E9" stroke-width="4" stroke-linecap="round" />
              <circle cx="97" cy="22" r="3" fill="#16A34A" />
              <circle cx="18" cy="60" r="4" fill="#BAE6FD" />
              <circle cx="104" cy="52" r="2.5" fill="#0EA5E9" />
            }
            @case ('inbox') {
              <rect x="24" y="26" width="72" height="52" rx="8" stroke="#0369A1" stroke-width="4" />
              <path d="M24 52h20l6 8h20l6-8h20" stroke="#0369A1" stroke-width="4" stroke-linejoin="round" />
              <path d="M48 14l12 8 12-8" stroke="#0EA5E9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="104" cy="30" r="3" fill="#16A34A" />
              <circle cx="14" cy="40" r="4" fill="#BAE6FD" />
            }
            @case ('rocket') {
              <path d="M60 12c10 8 14 22 12 36l-12 12-12-12c-2-14 2-28 12-36Z" stroke="#0369A1" stroke-width="4" stroke-linejoin="round" />
              <circle cx="60" cy="38" r="7" stroke="#0EA5E9" stroke-width="4" />
              <path d="M48 56l-10 6 4-14M72 56l10 6-4-14" stroke="#0369A1" stroke-width="4" stroke-linejoin="round" />
              <path d="M60 66v14" stroke="#16A34A" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 7" />
              <circle cx="94" cy="20" r="3" fill="#16A34A" />
              <circle cx="24" cy="28" r="4" fill="#BAE6FD" />
            }
          }
        </svg>
      </div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      @if (ctaLink(); as link) {
        <a [routerLink]="link" class="btn btn-primary">{{ ctaLabel() }}</a>
      }
    </div>
  `,
  styles: [
    `
      .empty-shell {
        text-align: center;
        padding: var(--space-2xl) var(--space-md);
        max-width: 420px;
        margin: 0 auto;
      }

      .illustration {
        display: inline-flex;
        padding: var(--space-md);
        border-radius: 50%;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        margin-bottom: var(--space-md);
      }

      h3 { margin-bottom: var(--space-xs); }

      p {
        color: var(--color-text-soft);
        margin-bottom: var(--space-lg);
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly variant = input<EmptyStateVariant>('search');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly ctaLink = input<string | null>(null);
  readonly ctaLabel = input('Get started');
}
