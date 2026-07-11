import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationService } from '../../core/api/application.service';
import { ApplicationResponse, ApplicationStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { formatDate } from '../../shared/dates';
import { statusLabel } from '../../shared/application-status';

const STATUS_FILTERS: (ApplicationStatus | 'All')[] = [
  'All',
  'Submitted',
  'UnderReview',
  'Accepted',
  'Rejected',
  'Withdrawn',
];

@Component({
  selector: 'app-my-applications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SkeletonCardsComponent, EmptyStateComponent, CompanyLogoComponent, LinkButtonComponent],
  animations: [listStagger],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your pipeline</span>
          <h1>My applications</h1>
          <p class="page-sub">Track where you've applied and how it's going.</p>
        </div>
      </div>

      <div class="status-filters" role="group" aria-label="Filter by status">
        @for (status of statusFilters; track status) {
          <button
            type="button"
            class="status-filter"
            [class.active]="filter() === status"
            (click)="filter.set(status)"
          >
            {{ statusLabel(status) }}
            @if (status !== 'All') {
              <span class="count">{{ countByStatus(status) }}</span>
            }
          </button>
        }
      </div>

      @if (loading()) {
        <app-skeleton-cards [count]="3" />
      } @else {
        <div [@listStagger]="animState()">
          @if (loadError()) {
            <app-empty-state
              variant="inbox"
              title="Couldn't load your applications"
              message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
            />
          } @else if (filtered().length === 0) {
            @if (filter() === 'All') {
              <app-empty-state
                variant="rocket"
                title="Nothing here yet — your move"
                message="Every application you send will show up here so you always know where you stand. Find a role you like and go for it."
                ctaLink="/internships"
                ctaLabel="Browse internships"
              />
            } @else {
              <app-empty-state
                variant="inbox"
                title="No {{ filter().toLowerCase() }} applications"
                message="Nothing with this status right now — switch to another filter to see the rest of your pipeline."
              />
            }
          } @else {
            <div class="app-list">
              @for (app of filtered(); track app.id) {
                <div class="card stagger-item app-card">
                  <app-company-logo [name]="app.companyName" [size]="42" />
                  <div class="app-main">
                    <a [routerLink]="['/internships', app.internshipId]" class="app-title">
                      {{ app.internshipTitle }}
                    </a>
                    <div class="app-meta">
                      <span class="app-company">
                        <app-icon name="building" [size]="13" />
                        {{ app.companyName }}
                      </span>
                      <span class="app-date">
                        <app-icon name="calendar" [size]="13" />
                        Applied {{ formatDate(app.createdAt) }}
                      </span>
                    </div>
                  </div>
                  <div class="app-actions">
                    <span class="badge" [class]="'badge badge-' + app.status.toLowerCase()">
                      {{ statusLabel(app.status) }}
                    </span>
                    @if (app.updatedAt !== app.createdAt) {
                      <span class="status-updated">Updated {{ formatDate(app.updatedAt) }}</span>
                    }
                    @if (canWithdraw(app)) {
                      <app-link-button
                        size="sm"
                        [disabled]="withdrawing().has(app.id)"
                        (pressed)="withdraw(app)"
                      >
                        <app-icon name="trash" [size]="13" />
                        Withdraw
                      </app-link-button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .status-filters {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
        margin-bottom: var(--space-lg);
      }

      .status-filter {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-soft);
        border-radius: 999px;
        padding: 6px 14px;
        font-family: var(--font-sans);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 200ms ease;
      }

      .status-filter:hover { border-color: var(--color-primary); color: var(--color-primary); }

      .status-filter.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: var(--color-on-primary);
      }

      .status-filter .count {
        background: rgba(255, 255, 255, 0.25);
        border-radius: 999px;
        font-size: 0.75rem;
        padding: 0 7px;
      }

      .status-filter:not(.active) .count {
        background: var(--color-muted);
      }

      .app-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .app-card {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-lg);
      }

      /* alternating tint keeps long lists readable without feeling striped */
      .app-card:nth-child(even) { background: var(--color-background); }

      .app-main { flex: 1; min-width: 0; }

      .app-title { font-weight: 700; color: var(--color-foreground); font-size: 1rem; }
      .app-title:hover { color: var(--color-primary); }

      .app-meta {
        display: flex;
        gap: var(--space-md);
        flex-wrap: wrap;
        margin-top: 2px;
      }

      .app-company,
      .app-date {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-text-soft);
        font-size: 0.8438rem;
        font-weight: 500;
      }

      .status-updated {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--color-text-soft);
      }

      .app-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-xs);
      }

      @media (max-width: 640px) {
        .app-card { align-items: flex-start; }
        .app-meta { flex-direction: column; gap: var(--space-xs); }
      }
    `,
  ],
})
export class MyApplicationsComponent implements OnInit {
  private readonly applicationService = inject(ApplicationService);
  private readonly toast = inject(ToastService);

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly statusLabel = statusLabel;
  protected readonly formatDate = formatDate;

  protected readonly applications = signal<ApplicationResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly animState = signal<'loading' | 'loaded'>('loading');
  protected readonly filter = signal<ApplicationStatus | 'All'>('All');
  protected readonly withdrawing = signal<Set<number>>(new Set());

  protected readonly filtered = computed(() => {
    const status = this.filter();
    const apps = this.applications();
    return status === 'All' ? apps : apps.filter((a) => a.status === status);
  });

  ngOnInit(): void {
    this.applicationService.getMine().subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.loading.set(false);
        setTimeout(() => this.animState.set('loaded'));
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
        this.animState.set('loaded');
      },
    });
  }

  protected countByStatus(status: ApplicationStatus): number {
    return this.applications().filter((a) => a.status === status).length;
  }

  protected canWithdraw(app: ApplicationResponse): boolean {
    return app.status === 'Submitted' || app.status === 'UnderReview' || app.status === 'Accepted';
  }

  protected withdraw(app: ApplicationResponse): void {
    if (!confirm(`Withdraw your application to ${app.internshipTitle}? You can re-apply later while the role is open.`)) {
      return;
    }

    this.withdrawing.update((set) => new Set(set).add(app.id));
    this.applicationService.withdraw(app.id).subscribe({
      next: (updated) => {
        this.applications.update((apps) => apps.map((a) => (a.id === updated.id ? updated : a)));
        this.clearWithdrawing(app.id);
        this.toast.success('Application withdrawn');
      },
      error: () => {
        this.clearWithdrawing(app.id);
        this.toast.error('Could not withdraw the application');
      },
    });
  }

  private clearWithdrawing(id: number): void {
    this.withdrawing.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }
}
