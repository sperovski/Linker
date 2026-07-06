import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompanyService } from '../../core/api/company.service';
import { CompanyDashboard } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { formatDate, deadlineCountdown } from '../../shared/dates';

@Component({
  selector: 'app-company-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, EmptyStateComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Overview</span>
          <h1>Dashboard</h1>
          <p class="page-sub">Your hiring at a glance.</p>
        </div>
        <a routerLink="/company/internships/new" class="btn btn-primary">
          <app-icon name="plus" [size]="16" />
          Post an internship
        </a>
      </div>

      @if (loading()) {
        <div class="stat-grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card"><div class="skeleton" style="height: 56px;"></div></div>
          }
        </div>
      } @else if (data(); as d) {
        <div class="stat-grid">
          <div class="card stat">
            <span class="stat-icon"><app-icon name="briefcase" [size]="18" /></span>
            <span class="stat-value">{{ d.activeListings }}</span>
            <span class="stat-label">Active listings</span>
            <span class="stat-sub">{{ d.totalListings }} total</span>
          </div>
          <div class="card stat">
            <span class="stat-icon"><app-icon name="users" [size]="18" /></span>
            <span class="stat-value">{{ d.totalApplicants }}</span>
            <span class="stat-label">Applicants</span>
            <span class="stat-sub">across all roles</span>
          </div>
          <div class="card stat">
            <span class="stat-icon accent-amber"><app-icon name="clock" [size]="18" /></span>
            <span class="stat-value">{{ d.pendingApplicants }}</span>
            <span class="stat-label">Awaiting review</span>
            <span class="stat-sub">need a decision</span>
          </div>
          <div class="card stat">
            <span class="stat-icon accent-green"><app-icon name="check" [size]="18" /></span>
            <span class="stat-value">{{ d.acceptedApplicants }}</span>
            <span class="stat-label">Accepted</span>
            <span class="stat-sub">offers extended</span>
          </div>
        </div>

        <div class="dash-grid">
          <section class="card">
            <div class="section-head">
              <h2>Your listings</h2>
              <a routerLink="/company/listings" class="section-link">Manage all</a>
            </div>
            @if (d.listings.length === 0) {
              <app-empty-state
                variant="rocket"
                title="No listings yet"
                message="Post your first internship to start receiving applications."
                ctaLink="/company/internships/new"
                ctaLabel="Post an internship"
              />
            } @else {
              <div class="listing-list">
                @for (listing of d.listings; track listing.id) {
                  <div class="listing-row">
                    <div class="listing-main">
                      <a [routerLink]="['/internships', listing.id]" class="listing-title">{{ listing.title }}</a>
                      <div class="listing-meta">
                        <span class="badge" [class.badge-open]="listing.isActive" [class.badge-closed]="!listing.isActive">
                          {{ listing.isActive ? 'Open' : 'Closed' }}
                        </span>
                        @if (deadline(listing.applicationDeadline); as label) {
                          <span class="listing-deadline">{{ label }}</span>
                        }
                      </div>
                    </div>
                    <a [routerLink]="['/company/internships', listing.id, 'applicants']" class="listing-applicants">
                      <span class="applicant-count">{{ listing.applicantCount }}</span>
                      <span class="applicant-label">applicant{{ listing.applicantCount === 1 ? '' : 's' }}</span>
                      @if (listing.pendingCount > 0) {
                        <span class="pending-pill">{{ listing.pendingCount }} new</span>
                      }
                    </a>
                  </div>
                }
              </div>
            }
          </section>

          <section class="card">
            <div class="section-head">
              <h2>Recent applicants</h2>
            </div>
            @if (d.recentApplicants.length === 0) {
              <p class="muted">No applications yet.</p>
            } @else {
              <div class="applicant-list">
                @for (app of d.recentApplicants; track app.applicationId) {
                  <a
                    class="applicant-row"
                    [routerLink]="['/company/internships', app.internshipId, 'applicants']"
                  >
                    <span class="avatar">{{ app.studentName.charAt(0) }}</span>
                    <div class="applicant-info">
                      <span class="applicant-name">{{ app.studentName }}</span>
                      <span class="applicant-role">{{ app.internshipTitle }}</span>
                    </div>
                    <div class="applicant-side">
                      <span class="badge" [class]="'badge badge-' + app.status.toLowerCase()">{{ app.status }}</span>
                      <span class="applicant-date">{{ formatDate(app.appliedAtUtc) }}</span>
                    </div>
                  </a>
                }
              </div>
            }
          </section>
        </div>
      } @else {
        <app-empty-state variant="inbox" title="Could not load your dashboard" message="Please try again in a moment." />
      }
    </div>
  `,
  styles: [
    `
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .stat-grid { grid-template-columns: 1fr; } }

      .stat { display: flex; flex-direction: column; gap: 2px; }

      .stat-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
        background: rgba(3, 105, 161, 0.1);
        color: var(--color-primary);
        margin-bottom: var(--space-sm);
      }

      .stat-icon.accent-amber { background: #fef3c7; color: #92400e; }
      .stat-icon.accent-green { background: #dcfce7; color: #166534; }

      .stat-value { font-size: 2rem; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
      .stat-label { font-weight: 600; margin-top: 4px; }
      .stat-sub { color: var(--color-text-soft); font-size: 0.8125rem; }

      .dash-grid {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: var(--space-lg);
        align-items: start;
      }

      @media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-md);
      }

      .section-head h2 { font-size: 1.125rem; margin: 0; }
      .section-link { font-size: 0.875rem; font-weight: 600; }
      .muted { color: var(--color-text-soft); }

      .listing-list, .applicant-list { display: flex; flex-direction: column; }

      .listing-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: var(--space-md) 0;
        border-top: 1px solid var(--color-border);
      }

      .listing-row:first-child { border-top: none; }

      .listing-title { font-weight: 700; color: var(--color-foreground); }
      .listing-title:hover { color: var(--color-primary); }

      .listing-meta { display: flex; align-items: center; gap: var(--space-sm); margin-top: 4px; }
      .listing-deadline { font-size: 0.8125rem; color: var(--color-text-soft); font-weight: 500; }

      .listing-applicants {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        text-align: right;
        color: inherit;
        min-width: 90px;
      }

      .listing-applicants:hover { text-decoration: none; }
      .listing-applicants:hover .applicant-count { color: var(--color-primary); }

      .applicant-count { font-size: 1.5rem; font-weight: 700; line-height: 1; }
      .applicant-label { font-size: 0.75rem; color: var(--color-text-soft); }

      .pending-pill {
        margin-top: 4px;
        font-size: 0.6875rem;
        font-weight: 700;
        color: #92400e;
        background: #fef3c7;
        border-radius: 999px;
        padding: 2px 8px;
      }

      .applicant-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) 0;
        border-top: 1px solid var(--color-border);
        color: inherit;
      }

      .applicant-row:first-child { border-top: none; }
      .applicant-row:hover { text-decoration: none; }

      .applicant-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .applicant-name { font-weight: 600; }
      .applicant-role {
        font-size: 0.8125rem;
        color: var(--color-text-soft);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .applicant-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
      .applicant-date { font-size: 0.75rem; color: var(--color-text-soft); }
    `,
  ],
})
export class CompanyDashboardComponent implements OnInit {
  private readonly companyService = inject(CompanyService);

  protected readonly data = signal<CompanyDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly formatDate = formatDate;

  ngOnInit(): void {
    this.companyService.getDashboard().subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected deadline(value: string | null): string | null {
    return deadlineCountdown(value);
  }
}
