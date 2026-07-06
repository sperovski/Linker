import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { TYPE_LABELS, startCountdown, daysUntil, deadlineCountdown } from '../../shared/dates';

@Component({
  selector: 'app-browse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  ],
  animations: [listStagger],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Open roles</span>
          <h1>Browse internships</h1>
          <p class="page-sub">Real roles from Netcetera to Alkaloid — companies you already know.</p>
        </div>
        @if (!loading()) {
          <span class="result-count">{{ internships().length }} open role{{ internships().length === 1 ? '' : 's' }}</span>
        }
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
          <app-internship-strip
            heading="Trending now"
            subheading="The roles students are applying to most"
            icon="trending"
            accent="amber"
            [items]="popular()"
            [rank]="true"
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
            (selectedChange)="company.set($event)"
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
          @if (internships().length === 0) {
            <app-empty-state
              variant="search"
              title="No internships found"
              message="Try clearing a filter or searching for something broader — new roles are posted all the time."
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
                    class="card card-hover internship-card"
                    [routerLink]="['/internships', internship.id]"
                  >
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
                        @if (internship.requiredSkills.length > 4) {
                          <span class="skill-chip more">+{{ internship.requiredSkills.length - 4 }}</span>
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
                      } @else if (countdown(internship); as label) {
                        <span class="badge badge-deadline">
                          <app-icon name="calendar" [size]="12" />
                          {{ label }}
                        </span>
                      }
                    </div>
                    <span class="card-cta">
                      View role
                      <app-icon name="arrow-right" [size]="14" />
                    </span>
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
      .result-count {
        color: var(--color-text-soft);
        font-size: 0.875rem;
        font-weight: 600;
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
        box-shadow: 0 0 0 3px rgba(3, 105, 161, 0.12), var(--shadow-md);
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

      .filter-input,
      .filter-select {
        border: none;
        outline: none;
        background: transparent;
        font-family: var(--font-sans);
        font-size: 0.95rem;
        color: var(--color-foreground);
        width: 100%;
        padding: 12px 0;
      }

      .filter-select { cursor: pointer; }

      .type-select {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        color: var(--color-text-soft);
      }

      .type-select select {
        appearance: none;
        -webkit-appearance: none;
        padding-right: 4px;
      }

      .type-select app-icon { pointer-events: none; flex-shrink: 0; }

      .filter-input::placeholder { color: var(--color-text-soft); }

      @media (max-width: 767px) {
        .filter-bar { flex-direction: column; }
        .filter-divider { width: auto; height: 1px; margin: 0 var(--space-md); }
      }

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

      .skill-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .skill-chip {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-soft);
        background: var(--color-muted);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 3px 8px;
      }

      .skill-chip.more { color: var(--color-primary); }

      .internship-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        color: inherit;
        height: 100%;
      }

      .internship-card:hover { text-decoration: none; }

      .card-top {
        display: flex;
        gap: var(--space-sm);
        align-items: flex-start;
        padding-right: 40px;
      }

      .card-top-text { min-width: 0; }

      .company {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .internship-card h3 { margin: 2px 0 0; }

      .company {
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-top: auto;
      }

      .card-cta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-primary);
        font-size: 0.875rem;
        font-weight: 700;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity 200ms ease, transform 200ms ease;
      }

      .internship-card:hover .card-cta,
      .internship-card:focus-visible .card-cta {
        opacity: 1;
        transform: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .card-cta { opacity: 1; transform: none; }
      }
    `,
  ],
})
export class BrowseComponent implements OnInit {
  private readonly internshipService = inject(InternshipService);
  private readonly auth = inject(AuthService);
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

  /** Raw results from the server (text/location/type filters applied there). */
  protected readonly serverResults = signal<InternshipListItem[]>([]);
  protected readonly loading = signal(true);
  /** flips loading -> loaded exactly once so filtering doesn't re-stagger */
  protected readonly animState = signal<'loading' | 'loaded'>('loading');

  protected readonly searchText = signal('');
  protected readonly location = signal('');
  protected readonly type = signal<InternshipType | ''>('');
  /** Company filter is applied client-side on top of the server results. */
  protected readonly company = signal('');

  /** Displayed list = server results narrowed by the selected company. */
  protected readonly internships = computed(() => {
    const selected = this.company();
    const all = this.serverResults();
    return selected ? all.filter((i) => i.companyName === selected) : all;
  });

  /** Distinct companies in the current server results, with open-role counts. */
  protected readonly companies = computed<CompanyOption[]>(() => {
    const counts = new Map<string, number>();
    for (const item of this.serverResults()) {
      counts.set(item.companyName, (counts.get(item.companyName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.fetch());
  }

  ngOnInit(): void {
    this.fetch();
    this.loadStrips();
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

  protected onSearchChange(value: string): void {
    this.searchText.set(value);
    this.search$.next();
  }

  protected onLocationChange(value: string): void {
    this.location.set(value);
    this.search$.next();
  }

  protected onTypeChange(value: InternshipType | ''): void {
    this.type.set(value);
    this.fetch();
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

  private fetch(): void {
    this.internshipService
      .search({
        searchText: this.searchText() || undefined,
        location: this.location() || undefined,
        type: this.type() || undefined,
      })
      .subscribe({
        next: (internships) => {
          this.serverResults.set(internships);
          // Drop the company filter if that company is no longer in the results.
          if (this.company() && !internships.some((i) => i.companyName === this.company())) {
            this.company.set('');
          }
          this.loading.set(false);
          // defer so the DOM renders before the stagger trigger fires
          setTimeout(() => this.animState.set('loaded'));
        },
        error: () => {
          this.serverResults.set([]);
          this.company.set('');
          this.loading.set(false);
          this.animState.set('loaded');
        },
      });
  }
}
