import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApplicationService } from '../../core/api/application.service';
import { InternshipService } from '../../core/api/internship.service';
import {
  Applicant,
  ApplicationStatus,
  InternshipDetail,
  PagedResponse,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn, listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { formatDate } from '../../shared/dates';

const STATUS_OPTIONS: ApplicationStatus[] = ['Pending', 'Accepted', 'Rejected'];

/** Applicant lists are long-form cards; a smaller page keeps the view scannable. */
const PAGE_SIZE = 10;

@Component({
  selector: 'app-applicants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SkeletonCardsComponent, EmptyStateComponent, LinkButtonComponent],
  animations: [fadeSlideIn, listStagger],
  template: `
    <div class="container page">
      <a routerLink="/company/listings" class="back-link">
        <app-icon name="arrow-right" [size]="14" style="transform: rotate(180deg)" />
        Back to listings
      </a>

      <div class="page-header">
        <div>
          <span class="eyebrow">Pipeline</span>
          <h1>Applicants</h1>
          @if (internship(); as job) {
            <p class="page-sub">
              {{ job.title }} —
              {{ total() }} application{{ total() === 1 ? '' : 's' }}
            </p>
          }
        </div>
      </div>

      @if (loading()) {
        <app-skeleton-cards [count]="2" />
      } @else {
        <div [@listStagger]="animState()">
          @if (loadError()) {
            <app-empty-state
              variant="inbox"
              title="Couldn't load applicants"
              message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
              ctaLink="/company/listings"
              ctaLabel="Back to listings"
            />
          } @else if (applications().length === 0) {
            <app-empty-state
              variant="inbox"
              title="No applications yet"
              message="Students will show up here the moment they apply. Meanwhile, a clear title and honest description bring more of them in."
              ctaLink="/company/listings"
              ctaLabel="Back to listings"
            />
          } @else {
            <div class="applicant-list">
              @for (app of applications(); track app.id) {
                <div class="card stagger-item applicant-card">
                  <div class="applicant-header">
                    <div class="applicant-id">
                      <span class="avatar">{{ app.studentName.charAt(0) }}</span>
                      <div>
                        <h3>{{ app.studentName }}</h3>
                        <span class="applied-at">
                          <app-icon name="calendar" [size]="13" />
                          Applied {{ formatDate(app.appliedAtUtc) }}
                        </span>
                      </div>
                    </div>
                    <div class="status-control">
                      <span class="badge" [class]="'badge badge-' + app.status.toLowerCase()">
                        {{ app.status }}
                      </span>
                      <label class="visually-hidden" [attr.for]="'status-' + app.id">
                        Update status for {{ app.studentName }}
                      </label>
                      <select
                        class="select status-select"
                        [attr.id]="'status-' + app.id"
                        [disabled]="updatingId() === app.id"
                        (change)="updateStatus(app, $event)"
                      >
                        @for (status of statusOptions; track status) {
                          <option [value]="status" [selected]="status === app.status">{{ status }}</option>
                        }
                        @if (app.status === 'Withdrawn') {
                          <option value="Withdrawn" selected>Withdrawn</option>
                        }
                      </select>
                    </div>
                  </div>

                  @if (app.university || app.graduationYear) {
                    <p class="student-meta">
                      {{ app.university ?? 'University not specified' }}
                      @if (app.graduationYear) {
                        · Class of {{ app.graduationYear }}
                      }
                    </p>
                  }
                  @if (app.skills.length > 0) {
                    <div class="tags">
                      @for (skill of app.skills; track skill.id) {
                        <span class="tag">{{ skill.name }}</span>
                      }
                    </div>
                  }
                  @if (app.bio) {
                    <p class="student-bio">{{ app.bio }}</p>
                  }

                  @if (app.coverLetter) {
                    <div class="cover-letter">
                      <h4>
                        <app-icon name="file-text" [size]="14" />
                        Cover letter
                      </h4>
                      <p>{{ app.coverLetter }}</p>
                    </div>
                  }
                </div>
              }
            </div>

            @if (totalPages() > 1) {
              <nav class="pager" aria-label="Applicant pages">
                <app-link-button size="sm" [disabled]="page() === 1" (pressed)="goToPage(page() - 1)">
                  Previous
                </app-link-button>
                <span class="pager-status" aria-live="polite">
                  Page {{ page() }} of {{ totalPages() }}
                </span>
                <app-link-button
                  size="sm"
                  [disabled]="page() === totalPages()"
                  (pressed)="goToPage(page() + 1)"
                >
                  Next
                </app-link-button>
              </nav>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-lg);
        margin-top: var(--space-xl);
      }

      .pager-status {
        color: var(--color-text-soft);
        font-size: 0.875rem;
        font-weight: 600;
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.875rem;
        font-weight: 600;
        margin-bottom: var(--space-md);
      }

      .applicant-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .applicant-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-md);
        flex-wrap: wrap;
      }

      .applicant-header h3 { margin: 0; }

      .applicant-id {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .applicant-card:nth-child(even) { background: var(--color-background); }

      .applied-at {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .status-control {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .status-select {
        width: auto;
        padding: 8px 12px;
        font-size: 0.875rem;
      }

      .student-meta {
        color: var(--color-text-soft);
        font-size: 0.875rem;
        font-weight: 500;
        margin: var(--space-sm) 0 0;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        margin-top: var(--space-sm);
      }

      .student-bio {
        margin: var(--space-sm) 0 0;
        font-size: 0.9rem;
        color: var(--color-foreground);
      }

      .cover-letter {
        margin-top: var(--space-md);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--space-md);
      }

      .cover-letter h4 {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.8125rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-soft);
        margin: 0 0 var(--space-xs);
      }

      .cover-letter p {
        margin: 0;
        white-space: pre-line;
        font-size: 0.9375rem;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `,
  ],
})
export class ApplicantsComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);
  private readonly applicationService = inject(ApplicationService);
  private readonly toast = inject(ToastService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly formatDate = formatDate;

  protected readonly internship = signal<InternshipDetail | null>(null);
  protected readonly applications = signal<Applicant[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly animState = signal<'loading' | 'loaded'>('loading');
  protected readonly updatingId = signal<number | null>(null);

  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  ngOnInit(): void {
    forkJoin({
      internship: this.internshipService.getDetail(this.id()),
      applications: this.internshipService.getApplications(this.id(), this.page(), this.pageSize()),
    }).subscribe({
      next: ({ internship, applications }) => {
        this.internship.set(internship);
        this.applyPage(applications);
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

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }

    this.page.set(page);
    this.internshipService.getApplications(this.id(), page, this.pageSize()).subscribe({
      next: (applications) => {
        this.applyPage(applications);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => this.loadError.set(true),
    });
  }

  private applyPage(result: PagedResponse<Applicant>): void {
    this.applications.set(result.items);
    this.total.set(result.total);
    this.page.set(result.page);
    this.pageSize.set(result.pageSize);
  }

  protected updateStatus(app: Applicant, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as ApplicationStatus;
    if (status === app.status) {
      return;
    }

    this.updatingId.set(app.id);
    this.applicationService.updateStatus(app.id, status).subscribe({
      next: (updated) => {
        // Patch only the status: the response carries no profile fields.
        this.applications.update((apps) =>
          apps.map((a) => (a.id === updated.id ? { ...a, status: updated.status } : a)),
        );
        this.updatingId.set(null);
        this.toast.success(`${app.studentName}: ${updated.status}`);
      },
      error: (err) => {
        this.updatingId.set(null);
        this.toast.error(apiErrorMessage(err, 'Could not update the status.'));
      },
    });
  }

}
