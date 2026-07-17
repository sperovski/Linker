import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { InternshipService } from '../../core/api/internship.service';
import { InternshipListItem } from '../../core/models';
import { listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { InternshipCardComponent } from '../../shared/internship-card.component';

@Component({
  selector: 'app-saved',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonCardsComponent,
    EmptyStateComponent,
    InternshipCardComponent,
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
                <app-internship-card
                  class="stagger-item"
                  [internship]="internship"
                  [initialSaved]="true"
                  variant="compact"
                  (savedChange)="onSavedChange(internship.id, $event)"
                />
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

  protected onSavedChange(id: number, saved: boolean): void {
    if (!saved) {
      // Drop the card from the shortlist as soon as it's un-saved.
      this.internships.update((list) => list.filter((i) => i.id !== id));
    }
  }
}
