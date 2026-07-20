import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ApplicationService } from '../../core/api/application.service';
import { CompanyService } from '../../core/api/company.service';
import { InternshipService } from '../../core/api/internship.service';
import { StudentService } from '../../core/api/student.service';
import { CompanyProfile, InternshipDetail, InternshipListItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn, fadeSwap } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { SaveButtonComponent } from '../../shared/save-button.component';
import { MatchBadgeComponent } from '../../shared/match-badge.component';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { TYPE_LABELS, formatDate, startCountdown, deadlineCountdown, daysUntil } from '../../shared/dates';
import { MATCH_BADGE_MIN_SCORE } from '../../shared/match';

@Component({
  selector: 'app-internship-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, SaveButtonComponent, MatchBadgeComponent, CompanyLogoComponent, LinkButtonComponent],
  animations: [fadeSlideIn, fadeSwap],
  template: `
    <div class="container page detail-page">
      <a routerLink="/internships" class="back-link">
        <app-icon name="arrow-right" [size]="14" style="transform: rotate(180deg)" />
        Back to browse
      </a>

      @if (loading()) {
        <div class="card" aria-label="Loading" role="status">
          <div class="skeleton" style="height: 14px; width: 30%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 28px; width: 70%; margin-bottom: 20px;"></div>
          <div class="skeleton" style="height: 12px; width: 100%; margin-bottom: 8px;"></div>
          <div class="skeleton" style="height: 12px; width: 100%; margin-bottom: 8px;"></div>
          <div class="skeleton" style="height: 12px; width: 55%;"></div>
        </div>
      } @else if (internship(); as job) {
        <div class="detail-grid">
          <article class="card main">
            <div class="job-head">
              <app-company-logo [name]="job.companyName" [size]="56" />
              <div class="job-head-text">
                <span class="company">{{ job.companyName }}</span>
                <h1>{{ job.title }}</h1>
              </div>
              @if (job.matchScore !== null) {
                <app-match-badge [score]="job.matchScore" />
              }
            </div>
            <div class="badges">
              <span class="badge" [class.badge-open]="job.isActive" [class.badge-closed]="!job.isActive">
                {{ job.isActive ? 'Open' : 'Closed' }}
              </span>
              <span class="badge badge-type">{{ typeLabel(job.type) }}</span>
              @if (job.location) {
                <span class="badge badge-location">
                  <app-icon name="map-pin" [size]="12" />
                  {{ job.location }}
                </span>
              }
              @if (deadline(job); as label) {
                <span
                  class="badge"
                  [class.badge-deadline]="!deadlineSoon(job)"
                  [class.badge-deadline-soon]="deadlineSoon(job)"
                >
                  <app-icon name="clock" [size]="12" />
                  {{ label }}
                </span>
              }
            </div>

            <h2>About the role</h2>
            <p class="description">{{ job.description }}</p>

            @if (job.requiredSkills.length) {
              <h2>Skills</h2>
              <div class="skill-list">
                @for (skill of job.requiredSkills; track skill.id) {
                  <span class="skill-tag" [class.have]="hasSkill(skill.id)">
                    @if (hasSkill(skill.id)) {
                      <app-icon name="check" [size]="13" />
                    }
                    {{ skill.name }}
                  </span>
                }
              </div>
              @if (auth.isStudent() && job.matchScore !== null) {
                <p class="skill-note">
                  <!-- The detail view is where the raw figure belongs — but a 0% is
                       never quoted back at a student, so that case gets words. -->
                  @if (job.matchScore >= minBadgeScore) {
                    You match <strong>{{ job.matchScore }}%</strong> of the skills this role lists.
                  } @else {
                    You don't match the skills this role lists yet.
                  }
                  @if (job.matchScore < 100) {
                    Add the greyed-out skills to your <a routerLink="/profile">profile</a> if they fit you.
                  }
                </p>
              }
            }

            <dl class="meta">
              <div>
                <dt>Start date</dt>
                <dd>{{ formatDate(job.startDate) }}</dd>
              </div>
              <div>
                <dt>End date</dt>
                <dd>{{ formatDate(job.endDate) }}</dd>
              </div>
              @if (job.applicationDeadline) {
                <div>
                  <dt>Apply by</dt>
                  <dd>{{ formatDate(job.applicationDeadline) }}</dd>
                </div>
              }
              <div>
                <dt>Posted</dt>
                <dd>{{ formatDate(job.createdAtUtc) }}</dd>
              </div>
            </dl>
          </article>

          <aside class="side-col">
          @if (auth.isStudent()) {
            <app-save-button [internshipId]="job.id" [initialSaved]="job.isSaved" />
          }
          <div class="card apply-panel">
            @if (applied()) {
              <div class="applied-confirm" @fadeSwap>
                <span class="check-circle" aria-hidden="true">
                  <app-icon name="check" [size]="26" />
                </span>
                <h3>Application submitted</h3>
                <p>{{ job.companyName }} will review it soon. Redirecting…</p>
              </div>
            } @else if (!auth.isLoggedIn()) {
              <h3>Interested?</h3>
              <p>Log in as a student to apply for this internship.</p>
              <app-link-button routerLink="/login" block>Log in to apply</app-link-button>
              <p class="hint">
                No account? <a routerLink="/register">Sign up free</a>
              </p>
            } @else if (auth.isCompany()) {
              <h3>Company account</h3>
              <p>Only student accounts can apply to internships.</p>
            } @else if (!job.isActive) {
              <h3>Applications closed</h3>
              <p>This internship is no longer accepting applications.</p>
            } @else if (deadlinePassed(job)) {
              <h3>Deadline passed</h3>
              <p>The application deadline for this role has passed.</p>
            } @else {
              <h3>Apply now</h3>
              @if (applyError()) {
                <div class="apply-error" @fadeSlideIn role="alert">{{ applyError() }}</div>
              }
              <label class="label" for="coverNote">Cover note <span class="hint-inline">(optional)</span></label>
              <textarea
                id="coverNote"
                maxlength="1000"
                class="textarea"
                [(ngModel)]="coverNote"
                placeholder="Tell {{ job.companyName }} why you're a great fit…"
              ></textarea>
              <app-link-button
                block
                style="margin-top: var(--space-md)"
                [disabled]="submitting()"
                (pressed)="apply(job)"
              >
                {{ submitting() ? 'Submitting…' : 'Submit application' }}
              </app-link-button>
            }

            @if (auth.isStudent()) {
              <p class="chat-cta">
                Questions about this role?
                <a [routerLink]="['/community']" [queryParams]="{ internship: job.id }">Chat about this internship</a>
              </p>
            }
          </div>

          @if (company(); as about) {
            <div class="card about-card">
              <div class="about-head">
                <app-company-logo [name]="about.name" [size]="40" />
                <div>
                  <h3>About {{ about.name }}</h3>
                  @if (about.website) {
                    <a [href]="about.website" target="_blank" rel="noopener" class="about-link">
                      <app-icon name="external-link" [size]="12" />
                      {{ hostOf(about.website) }}
                    </a>
                  }
                </div>
              </div>
              @if (about.description) {
                <p class="about-desc">{{ about.description }}</p>
              }
            </div>
          }
          </aside>
        </div>

        @if (similar().length > 0) {
          <section class="similar">
            <h2>More roles like this</h2>
            <div class="similar-grid">
              @for (role of similar(); track role.id) {
                <a class="card card-hover similar-card" [routerLink]="['/internships', role.id]">
                  <span class="similar-company">
                    <app-company-logo [name]="role.companyName" [size]="28" />
                    {{ role.companyName }}
                  </span>
                  <h3>{{ role.title }}</h3>
                  <div class="badges">
                    <span class="badge badge-type">{{ typeLabel(role.type) }}</span>
                    @if (role.location) {
                      <span class="badge badge-location">{{ role.location }}</span>
                    }
                  </div>
                </a>
              }
            </div>
          </section>
        }
      } @else {
        <div class="empty-state">
          <h3>Internship not found</h3>
          <p>It may have been removed. <a routerLink="/internships">Back to browse</a></p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.875rem;
        font-weight: 600;
        margin-bottom: var(--space-md);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: var(--space-lg);
        align-items: start;
      }

      @media (max-width: 1023px) {
        .detail-grid { grid-template-columns: 1fr; }
      }

      .job-head {
        display: flex;
        gap: var(--space-md);
        align-items: center;
        margin-bottom: var(--space-md);
      }

      .job-head-text { flex: 1; min-width: 0; }

      .skill-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-top: var(--space-sm);
      }

      .skill-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-soft);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        padding: 5px 12px;
      }

      .skill-tag.have {
        color: #166534;
        background: #dcfce7;
        border-color: #bbf7d0;
      }

      .skill-note {
        font-size: 0.875rem;
        color: var(--color-text-soft);
        margin-top: var(--space-sm);
      }

      .company {
        color: var(--color-text-soft);
        font-weight: 600;
        font-size: 0.9rem;
      }

      .main h1 { font-size: 1.75rem; margin: 2px 0 0; }
      .main h2 { font-size: 1.125rem; margin-top: var(--space-lg); }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }

      .description { white-space: pre-line; color: var(--color-foreground); }

      .meta {
        display: flex;
        gap: var(--space-xl);
        flex-wrap: wrap;
        margin: var(--space-lg) 0 0;
        padding-top: var(--space-md);
        border-top: 1px solid var(--color-border);
      }

      .meta dt {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-soft);
      }

      .meta dd { margin: 2px 0 0; font-weight: 600; }

      .side-col {
        position: sticky;
        top: 84px;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .about-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-sm);
      }

      .about-head h3 { margin: 0; font-size: 1rem; }

      .about-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .about-desc {
        color: var(--color-text-soft);
        font-size: 0.875rem;
        margin: 0;
      }

      .similar { margin-top: var(--space-2xl); }

      .similar h2 { font-size: 1.25rem; margin-bottom: var(--space-md); }

      .similar-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-md);
      }

      @media (max-width: 900px) {
        .similar-grid { grid-template-columns: 1fr; }
      }

      .similar-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        color: inherit;
      }

      .similar-card:hover { text-decoration: none; }

      .similar-card h3 { margin: 0; font-size: 1rem; }

      .similar-company {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .similar-card .badges { margin-top: auto; }

      .apply-panel h3 { margin-bottom: var(--space-sm); }

      .apply-panel p { color: var(--color-text-soft); font-size: 0.9375rem; }

      .hint { font-size: 0.8125rem; margin: var(--space-sm) 0 0; text-align: center; }

      .chat-cta {
        font-size: 0.8125rem;
        margin: var(--space-md) 0 0;
        text-align: center;
        color: var(--color-text-soft);
      }
      .hint-inline { font-weight: 400; color: var(--color-text-soft); }

      .apply-error {
        background: #FEE2E2;
        color: #991B1B;
        border-radius: var(--radius-md);
        padding: 8px 12px;
        font-size: 0.8125rem;
        font-weight: 500;
        margin-bottom: var(--space-sm);
      }

      .applied-confirm { text-align: center; padding: var(--space-md) 0; }

      .check-circle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #DCFCE7;
        color: #166534;
        margin-bottom: var(--space-sm);
      }
    `,
  ],
})
export class InternshipDetailComponent implements OnInit {
  protected readonly minBadgeScore = MATCH_BADGE_MIN_SCORE;
  protected readonly auth = inject(AuthService);
  private readonly internshipService = inject(InternshipService);
  private readonly applicationService = inject(ApplicationService);
  private readonly companyService = inject(CompanyService);
  private readonly studentService = inject(StudentService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly internship = signal<InternshipDetail | null>(null);
  protected readonly company = signal<CompanyProfile | null>(null);
  protected readonly similar = signal<InternshipListItem[]>([]);
  protected readonly studentSkillIds = signal<Set<number>>(new Set());
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly applied = signal(false);
  protected readonly applyError = signal<string | null>(null);
  protected coverNote = '';

  protected readonly formatDate = formatDate;

  ngOnInit(): void {
    if (this.auth.isStudent()) {
      this.studentService.getMe().subscribe({
        next: (profile) => this.studentSkillIds.set(new Set(profile.skills.map((s) => s.id))),
        error: () => {},
      });
    }

    this.internshipService.getDetail(this.id()).subscribe({
      next: (internship) => {
        this.internship.set(internship);
        this.loading.set(false);
        this.companyService.getById(internship.companyId).subscribe({
          next: (company) => this.company.set(company),
          error: () => {},
        });
        // One page is ample to rank three suggestions out of.
        this.internshipService.search({ pageSize: 24 }).subscribe((all) => {
          const others = all.items.filter((role) => role.id !== internship.id);
          // prefer same type, then same location, then anything open
          const ranked = [
            ...others.filter((r) => r.type === internship.type),
            ...others.filter((r) => r.type !== internship.type),
          ];
          this.similar.set(ranked.slice(0, 3));
        });
      },
      error: () => this.loading.set(false),
    });
  }

  protected hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected countdown(job: InternshipDetail): string | null {
    return startCountdown(job.startDate);
  }

  protected deadline(job: InternshipDetail): string | null {
    return deadlineCountdown(job.applicationDeadline);
  }

  protected deadlineSoon(job: InternshipDetail): boolean {
    const days = daysUntil(job.applicationDeadline);
    return days !== null && days <= 7;
  }

  protected deadlinePassed(job: InternshipDetail): boolean {
    const days = daysUntil(job.applicationDeadline);
    return days !== null && days < 0;
  }

  protected hasSkill(skillId: number): boolean {
    return this.studentSkillIds().has(skillId);
  }

  protected apply(job: InternshipDetail): void {
    this.applyError.set(null);
    this.submitting.set(true);
    this.applicationService
      .apply({ internshipId: job.id, coverNote: this.coverNote.trim() || null })
      .subscribe({
        next: () => {
          this.applied.set(true);
          this.toast.success('Application submitted');
          // Let the confirmation animation land before navigating away.
          setTimeout(() => this.router.navigate(['/applications']), 1400);
        },
        error: (err) => {
          this.submitting.set(false);
          this.applyError.set(apiErrorMessage(err, 'Could not submit your application.'));
        },
      });
  }
}
