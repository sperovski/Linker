import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InternshipService } from '../../core/api/internship.service';
import { InternshipListItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { TYPE_LABELS } from '../../shared/dates';

@Component({
  selector: 'app-my-listings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SkeletonCardsComponent, EmptyStateComponent, LinkButtonComponent],
  animations: [listStagger],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your postings</span>
          <h1>My listings</h1>
          <p class="page-sub">Manage your internship postings and applicants.</p>
        </div>
        <app-link-button routerLink="/company/internships/new">
          <app-icon name="plus" [size]="16" />
          Post New Internship
        </app-link-button>
      </div>

      @if (loading()) {
        <app-skeleton-cards [count]="3" />
      } @else {
        <div [@listStagger]="animState()">
          @if (loadError()) {
            <app-empty-state
              variant="inbox"
              title="Couldn't load your listings"
              message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
            />
          } @else if (listings().length === 0) {
            <app-empty-state
              variant="rocket"
              title="Post your first internship"
              message="It takes about two minutes. As soon as it's live, students can find it and start applying."
              ctaLink="/company/internships/new"
              ctaLabel="Post New Internship"
            />
          } @else {
            <div class="listing-list">
              @for (listing of listings(); track listing.id) {
                <div class="card stagger-item listing-card">
                  <span
                    class="status-dot"
                    [class.dot-open]="listing.isActive"
                    [class.dot-closed]="!listing.isActive"
                    aria-hidden="true"
                  ></span>
                  <div class="listing-main">
                    <h3>{{ listing.title }}</h3>
                    <div class="listing-badges">
                      <span
                        class="badge"
                        [class.badge-open]="listing.isActive"
                        [class.badge-closed]="!listing.isActive"
                      >
                        {{ listing.isActive ? 'Open' : 'Closed' }}
                      </span>
                      <span class="badge badge-type">{{ typeLabel(listing.type) }}</span>
                      @if (listing.location) {
                        <span class="badge badge-location">
                          <app-icon name="map-pin" [size]="12" />
                          {{ listing.location }}
                        </span>
                      }
                    </div>
                  </div>
                  <div class="listing-actions">
                    <app-link-button
                      size="sm"
                      [routerLink]="['/company/internships', listing.id, 'applicants']"
                    >
                      <app-icon name="file-text" [size]="15" />
                      Applicants
                    </app-link-button>
                    <app-link-button
                      size="sm"
                      [routerLink]="['/company/internships', listing.id, 'edit']"
                    >
                      <app-icon name="pencil" [size]="15" />
                      Edit
                    </app-link-button>
                    @if (listing.isActive) {
                      <app-link-button
                        size="sm"
                        [disabled]="closingId() === listing.id"
                        (pressed)="close(listing)"
                      >
                        <app-icon name="x" [size]="15" />
                        {{ closingId() === listing.id ? 'Closing…' : 'Close' }}
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
      .listing-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .listing-card {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-lg);
        flex-wrap: wrap;
      }

      .listing-card:nth-child(even) { background: var(--color-background); }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .dot-open { background: var(--color-accent); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.15); }
      .dot-closed { background: #94A3B8; box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.15); }

      .listing-main { flex: 1; min-width: 200px; }

      .listing-main h3 { margin: 0 0 var(--space-xs); }

      .listing-badges {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .listing-actions {
        display: flex;
        gap: var(--space-xs);
        flex-wrap: wrap;
      }
    `,
  ],
})
export class MyListingsComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);
  private readonly toast = inject(ToastService);

  protected readonly listings = signal<InternshipListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly animState = signal<'loading' | 'loaded'>('loading');
  protected readonly closingId = signal<number | null>(null);

  ngOnInit(): void {
    this.internshipService.getMine().subscribe({
      next: (listings) => {
        this.listings.set(listings);
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

  protected close(listing: InternshipListItem): void {
    this.closingId.set(listing.id);
    this.internshipService.close(listing.id).subscribe({
      next: () => {
        this.listings.update((items) =>
          items.map((item) => (item.id === listing.id ? { ...item, isActive: false } : item)),
        );
        this.closingId.set(null);
        this.toast.success(`"${listing.title}" is now closed`);
      },
      error: (err) => {
        this.closingId.set(null);
        this.toast.error(apiErrorMessage(err, 'Could not close the listing.'));
      },
    });
  }
}
