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
          @if (loadError()) {
            <app-empty-state
              variant="inbox"
              title="Couldn't load your saved roles"
              message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
            />
          } @else if (internships().length === 0) {
            <app-empty-state
              variant="inbox"
              title="No saved roles yet"
              message="Tap the bookmark on any internship to keep it here, a quiet shortlist you can act on when you're ready."
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
                  <a class="internship-card" [routerLink]="['/internships', internship.id]">
                    <div class="card-top">
                      <span class="logo-layer">
                        <app-company-logo [name]="internship.companyName" [size]="44" />
                      </span>
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
      /* Card look + 3D hover come from the shared .internship-card styles in styles.css. */
      .result-count { color: var(--color-text-soft); font-size: 0.875rem; font-weight: 600; }
    `,
  ],
})
export class SavedComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);

  protected readonly internships = signal<InternshipListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly animState = signal<'loading' | 'loaded'>('loading');

  ngOnInit(): void {
    this.internshipService.getSaved().subscribe({
      next: (internships) => {
        this.internships.set(internships);
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
