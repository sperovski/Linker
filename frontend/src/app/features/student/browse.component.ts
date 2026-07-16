import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { InternshipService } from '../../core/api/internship.service';
import { InternshipListItem, InternshipType } from '../../core/models';
import { listStagger } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { SkeletonCardsComponent } from '../../shared/skeleton-cards.component';
import { SaveButtonComponent } from '../../shared/save-button.component';
import { MatchBadgeComponent } from '../../shared/match-badge.component';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { CompanyFilterComponent, CompanyOption } from '../../shared/company-filter.component';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { InternshipStripComponent } from '../../shared/internship-strip.component';
import { TrendingCarouselComponent } from '../../shared/trending-carousel.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { BgDecorComponent } from '../../shared/bg-decor.component';
import { TYPE_LABELS, startCountdown, daysUntil, deadlineCountdown } from '../../shared/dates';
import { matchExplanation } from '../../shared/match';

/** Matches the API default; the server clamps anything above 50. */
const PAGE_SIZE = 12;

@Component({
  selector: 'app-browse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgDecorComponent, 
    FormsModule,
    RouterLink,
    IconComponent,
    SkeletonCardsComponent,
    EmptyStateComponent,
    SaveButtonComponent,
    MatchBadgeComponent,
    CompanyLogoComponent,
    CompanyFilterComponent,
    SelectComponent,
    InternshipStripComponent,
    TrendingCarouselComponent,
    LinkButtonComponent,
  ],
  animations: [listStagger],
  template: `
    <div class="container browse-container page">
      <app-bg-decor variant="subtle" />
      <div class="page-header">
        <div>
          <span class="eyebrow">Open roles</span>
          <!-- The count belongs to the heading, not floating off on the far right. -->
          <h1>
            Browse internships
            @if (!loading()) {
              <span class="result-count">{{ total() }} open role{{ total() === 1 ? '' : 's' }}</span>
            }
          </h1>
          <p class="page-sub">Real roles from Netcetera to Alkaloid, companies you already know.</p>
        </div>
      </div>

      @if (showStrips()) {
        @if (recommended().length) {
          <app-internship-strip
            heading="Recommended for you"
            subheading="Ranked by how well they match your skills"
            icon="gear"
            [items]="recommended()"
          />
        }
        @if (popular().length) {
          <app-trending-carousel
            heading="Trending now"
            subheading="The roles students are applying to most"
            icon="trending"
            [items]="popular()"
          />
        }
      }

      <div class="filter-bar">
        <div class="filter-cell grow">
          <app-icon name="search" [size]="16" />
          <input
            id="search"
            class="filter-input"
            type="search"
            placeholder="Search by title or keyword…"
            aria-label="Search by title or keyword"
            [ngModel]="searchText()"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
        <div class="filter-divider" aria-hidden="true"></div>
        <div class="filter-cell">
          <app-icon name="map-pin" [size]="16" />
          <input
            id="location"
            class="filter-input"
            type="search"
            placeholder="Any location"
            aria-label="Filter by location"
            [ngModel]="location()"
            (ngModelChange)="onLocationChange($event)"
          />
        </div>
        <div class="filter-divider" aria-hidden="true"></div>
        <div class="filter-cell">
          <app-company-filter
            [companies]="companies()"
            [selected]="company()"
            (selectedChange)="onCompanyChange($event)"
          />
        </div>
        <div class="filter-divider" aria-hidden="true"></div>
        <div class="filter-cell">
          <app-select
            [options]="typeOptions"
            [value]="type()"
            [icon]="'briefcase'"
            ariaLabel="Filter by type"
            (valueChange)="onTypeChange($any($event))"
          />
        </div>
      </div>

      @if (loading()) {
        <app-skeleton-cards [count]="6" />
      } @else {
        <div [@listStagger]="animState()">
          @if (loadError()) {
            <app-empty-state
              variant="inbox"
              title="Couldn't load internships"
              message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
            />
          } @else if (internships().length === 0) {
            <app-empty-state
              variant="search"
              title="No internships found"
              message="Try clearing a filter or searching for something broader. New roles are posted all the time."
            />
          } @else {
            <div class="grid-cards">
              @for (internship of internships(); track internship.id) {
                <div class="card-wrap stagger-item">
                  <div class="card-overlay">
                    <app-save-button
                      [internshipId]="internship.id"
                      [initialSaved]="internship.isSaved"
                      [compact]="true"
                    />
                  </div>
                  <a
                    class="internship-card"
                    [routerLink]="['/internships', internship.id]"
                  >
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
                        @if (internship.requiredSkills.length > 4) {
                          <span class="skill-chip more">+{{ internship.requiredSkills.length - 4 }}</span>
                        }
                      </div>
                    }
                    <div class="badges">
                      @if (internship.hasApplied) {
                        <span class="badge badge-applied">
                          <app-icon name="check" [size]="12" />
                          Applied
                        </span>
                      } @else {
                        <app-match-badge
                          [score]="internship.matchScore"
                          [matchedSkillCount]="internship.matchedSkillCount"
                          [requiredSkillCount]="internship.requiredSkillCount"
                        />
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
                      } @else if (countdown(internship); as label) {
                        <span class="badge badge-deadline">
                          <app-icon name="calendar" [size]="12" />
                          {{ label }}
                        </span>
                      }
                    </div>
                    @if (explain(internship); as line) {
                      <p class="match-explain">{{ line }}</p>
                    }
                    <span class="card-cta">
                      View role
                      <app-icon name="arrow-right" [size]="14" />
                    </span>
                  </a>
                </div>
              }
            </div>

            @if (totalPages() > 1) {
              <nav class="pager" aria-label="Search results pages">
                <app-link-button
                  size="sm"
                  [disabled]="page() === 1"
                  (pressed)="goToPage(page() - 1)"
                >
                  <app-icon name="arrow-right" [size]="14" class="flip" />
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
                  <app-icon name="arrow-right" [size]="14" />
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
      /* Wider than the global 1120px container: the grid needs the room, but it
         still stops well short of stretching three cards across a huge display. */
      .browse-container {
        max-width: 1280px;
      }

      /* Sits with the heading as a quiet counter, not a competing headline. */
      .result-count {
        margin-left: var(--space-sm);
        color: var(--color-text-soft);
        font-size: 0.9375rem;
        font-weight: 600;
        vertical-align: middle;
      }

      .match-explain {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--color-text-soft);
        font-weight: 600;
      }

      .badge-applied {
        color: var(--color-primary);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
      }

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

      /* Reuse the arrow glyph for "Previous" rather than shipping a second icon. */
      .flip {
        transform: rotate(180deg);
      }

      /* Premium single-bar filter row with internal dividers */
      .filter-bar {
        display: flex;
        align-items: stretch;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        margin-bottom: var(--space-xl);
        transition: box-shadow 200ms ease, border-color 200ms ease;
      }

      /* Round the outer corners of the first/last cells since the bar no longer
         clips them (the company dropdown must be able to overflow the bar). */
      .filter-cell:first-child { border-top-left-radius: var(--radius-lg); border-bottom-left-radius: var(--radius-lg); }
      .filter-cell:last-child { border-top-right-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg); }

      .filter-bar:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(29, 77, 36, 0.12), var(--shadow-md);
      }

      .filter-cell {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: 4px var(--space-md);
        color: var(--color-text-soft);
        min-width: 0;
      }

      .filter-cell.grow { flex: 1.6; }
      .filter-cell:not(.grow) { flex: 1; }

      .filter-divider {
        width: 1px;
        background: var(--color-border);
        margin: var(--space-sm) 0;
      }

      .filter-input {
        border: none;
        outline: none;
        background: transparent;
        font-family: var(--font-sans);
        font-size: 0.95rem;
        color: var(--color-foreground);
        width: 100%;
        padding: 12px 0;
      }

      .filter-input::placeholder { color: var(--color-text-soft); }

      @media (max-width: 767px) {
        .filter-bar { flex-direction: column; }
        .filter-divider { width: auto; height: 1px; margin: 0 var(--space-md); }
      }

    `,
  ],
})
export class BrowseComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly search$ = new Subject<void>();

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: 'All types' },
    { value: 'Internship', label: 'Internship' },
    { value: 'PartTime', label: 'Part-time' },
    { value: 'FullTime', label: 'Full-time' },
  ];

  protected readonly recommended = signal<InternshipListItem[]>([]);
  protected readonly popular = signal<InternshipListItem[]>([]);

  /** Rails only make sense on the unfiltered landing view. */
  protected readonly showStrips = computed(
    () => !this.searchText() && !this.location() && !this.type() && !this.company(),
  );

  /** The current page of results. Every filter, including company, is applied server-side. */
  protected readonly internships = signal<InternshipListItem[]>([]);
  /** Companies across the whole result set — the server computes this ignoring the company filter. */
  protected readonly companies = signal<CompanyOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  /** flips loading -> loaded exactly once so filtering doesn't re-stagger */
  protected readonly animState = signal<'loading' | 'loaded'>('loading');

  protected readonly searchText = signal('');
  protected readonly location = signal('');
  protected readonly type = signal<InternshipType | ''>('');
  protected readonly company = signal('');

  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.fetch());
  }

  ngOnInit(): void {
    // Hydrate filters from the URL so a refresh or a shared link lands on the
    // same result set. Read once: every later change is written by syncUrl().
    const params = this.route.snapshot.queryParamMap;
    this.searchText.set(params.get('q') ?? '');
    this.location.set(params.get('location') ?? '');
    this.company.set(params.get('company') ?? '');
    const type = params.get('type');
    if (type && this.typeOptions.some((o) => o.value === type)) {
      this.type.set(type as InternshipType);
    }
    const page = Number(params.get('page'));
    this.page.set(Number.isInteger(page) && page > 0 ? page : 1);

    this.fetch();
    this.loadStrips();
  }

  /**
   * Mirrors the filter state into the query string. replaceUrl keeps the back
   * button meaning "the page before Browse", not a walk back through keystrokes.
   */
  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchText() || null,
        location: this.location() || null,
        company: this.company() || null,
        type: this.type() || null,
        page: this.page() > 1 ? this.page() : null,
      },
      replaceUrl: true,
    });
  }

  private loadStrips(): void {
    this.internshipService.getPopular(8).subscribe({
      next: (items) => this.popular.set(items),
      error: () => {},
    });
    if (this.auth.isStudent()) {
      this.internshipService.getRecommended(8).subscribe({
        next: (items) => this.recommended.set(items),
        error: () => {},
      });
    }
  }

  // Every filter change resets to page 1: narrowing a search while on page 4
  // would otherwise strand the user on a page that no longer exists.
  protected onSearchChange(value: string): void {
    this.searchText.set(value);
    this.page.set(1);
    this.syncUrl();
    this.search$.next();
  }

  protected onLocationChange(value: string): void {
    this.location.set(value);
    this.page.set(1);
    this.syncUrl();
    this.search$.next();
  }

  protected onTypeChange(value: InternshipType | ''): void {
    this.type.set(value);
    this.page.set(1);
    this.syncUrl();
    this.fetch();
  }

  protected onCompanyChange(value: string): void {
    this.company.set(value);
    this.page.set(1);
    this.syncUrl();
    this.fetch();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.syncUrl();
    this.fetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected countdown(internship: InternshipListItem): string | null {
    return startCountdown(internship.startDate);
  }

  protected deadline(internship: InternshipListItem): string | null {
    return deadlineCountdown(internship.applicationDeadline);
  }

  protected deadlineSoon(internship: InternshipListItem): boolean {
    const days = daysUntil(internship.applicationDeadline);
    return days !== null && days <= 7;
  }

  protected explain(internship: InternshipListItem): string | null {
    if (internship.hasApplied) {
      return null; // The "Applied" badge already says what matters.
    }
    return matchExplanation(internship.matchedSkillCount, internship.requiredSkillCount);
  }

  private fetch(): void {
    this.internshipService
      .search({
        searchText: this.searchText() || undefined,
        location: this.location() || undefined,
        type: this.type() || undefined,
        company: this.company() || undefined,
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: (result) => {
          this.loadError.set(false);
          this.internships.set(result.items);
          this.companies.set(result.companies);
          this.total.set(result.total);
          this.page.set(result.page);
          this.pageSize.set(result.pageSize);
          this.loading.set(false);
          // defer so the DOM renders before the stagger trigger fires
          setTimeout(() => this.animState.set('loaded'));

          // The facet ignores the company filter, so a selected company missing
          // from it has no roles under the other filters. Clear it and refetch
          // rather than leaving the user staring at an empty page.
          if (this.company() && !result.companies.some((c) => c.name === this.company())) {
            this.company.set('');
            this.page.set(1);
            this.syncUrl();
            this.fetch();
          }
        },
        error: () => {
          this.loadError.set(true);
          this.internships.set([]);
          this.companies.set([]);
          this.total.set(0);
          this.company.set('');
          this.loading.set(false);
          this.animState.set('loaded');
        },
      });
  }
}
