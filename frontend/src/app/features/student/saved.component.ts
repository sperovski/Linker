import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InternshipService } from '../../core/api/internship.service';
import { InternshipListItem } from '../../core/models';
import { listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { SaveButtonComponent } from '../../shared/save-button.component';
import { MatchBadgeComponent } from '../../shared/match-badge.component';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { TYPE_LABELS, deadlineCountdown, daysUntil } from '../../shared/dates';

@Component({
  selector: 'app-saved',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonCardsComponent,
    EmptyStateComponent,
    SaveButtonComponent,
    MatchBadgeComponent,
    CompanyLogoComponent,
  ],
  animations: [listStagger],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your shortlist</span>
          <h1>Saved internships</h1>
          <p class="page-sub">Roles you've bookmarked to come back to.</p>
        </div>
        @if (!loading()) {
          <span class="result-count">{{ internships().length }} saved</span>
        }
      </div>

      @if (loading()) {
        <app-skeleton-cards [count]="3" />
      } @else {
        <div [@listStagger]="animState()">
          @if (internships().length === 0) {
            <app-empty-state
              variant="inbox"
              title="No saved roles yet"
              message="Tap the bookmark on any internship to keep it here — a quiet shortlist you can act on when you're ready."
              ctaLink="/internships"
              ctaLabel="Browse internships"
            />
          } @else {
            <div class="grid-cards">
              @for (internship of internships(); track internship.id) {
                <div class="card-wrap stagger-item">
                  <div class="card-overlay">
                    <app-save-button
                      [internshipId]="internship.id"
                      [initialSaved]="true"
                      [compact]="true"
                      (savedChange)="onSavedChange(internship.id, $event)"
                    />
                  </div>
                  <a class="card card-hover internship-card" [routerLink]="['/internships', internship.id]">
                    <div class="card-top">
                      <app-company-logo [name]="internship.companyName" [size]="44" />
                      <div class="card-top-text">
                        <span class="company">{{ internship.companyName }}</span>
                        <h3>{{ internship.title }}</h3>
                      </div>
                    </div>
                    @if (internship.requiredSkills.length) {
                      <div class="skill-chips">
                        @for (skill of internship.requiredSkills.slice(0, 4); track skill.id) {
                          <span class="skill-chip">{{ skill.name }}</span>
                        }
                      </div>
                    }
                    <div class="badges">
                      @if (internship.matchScore !== null) {
                        <app-match-badge [score]="internship.matchScore" />
                      }
                      <span class="badge badge-type">{{ typeLabel(internship.type) }}</span>
                      @if (internship.location) {
                        <span class="badge badge-location">
                          <app-icon name="map-pin" [size]="12" />
                          {{ internship.location }}
                        </span>
                      }
                      @if (deadline(internship); as label) {
                        <span
                          class="badge"
                          [class.badge-deadline]="!deadlineSoon(internship)"
                          [class.badge-deadline-soon]="deadlineSoon(internship)"
                        >
                          <app-icon name="clock" [size]="12" />
                          {{ label }}
                        </span>
                      }
                    </div>
                  </a>
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
      .result-count { color: var(--color-text-soft); font-size: 0.875rem; font-weight: 600; }

      .card-wrap { position: relative; }

      .card-overlay {
        position: absolute;
        top: var(--space-md);
        right: var(--space-md);
        z-index: 2;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .internship-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        color: inherit;
        height: 100%;
      }

      .internship-card:hover { text-decoration: none; }

      .card-top { display: flex; gap: var(--space-sm); align-items: flex-start; padding-right: 40px; }
      .card-top-text { min-width: 0; }
      .internship-card h3 { margin: 2px 0 0; }
      .company {
        display: block;
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .skill-chips { display: flex; flex-wrap: wrap; gap: 6px; }

      .skill-chip {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-soft);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 3px 8px;
      }

      .badges { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: auto; }
    `,
  ],
})
export class SavedComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);

  protected readonly internships = signal<InternshipListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly animState = signal<'loading' | 'loaded'>('loading');

  ngOnInit(): void {
    this.internshipService.getSaved().subscribe({
      next: (internships) => {
        this.internships.set(internships);
        this.loading.set(false);
        setTimeout(() => this.animState.set('loaded'));
      },
      error: () => {
        this.loading.set(false);
        this.animState.set('loaded');
      },
    });
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected deadline(internship: InternshipListItem): string | null {
    return deadlineCountdown(internship.applicationDeadline);
  }

  protected deadlineSoon(internship: InternshipListItem): boolean {
    const days = daysUntil(internship.applicationDeadline);
    return days !== null && days <= 7;
  }

  protected onSavedChange(id: number, saved: boolean): void {
    if (!saved) {
      // Drop the card from the shortlist as soon as it's un-saved.
      this.internships.update((list) => list.filter((i) => i.id !== id));
    }
  }
}
