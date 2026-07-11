import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/api/admin.service';
import { AdminInternship, AdminStats, AdminUser } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { formatDate } from '../../shared/dates';

type AdminTab = 'users' | 'internships' | 'skills';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, EmptyStateComponent, IconComponent, LinkButtonComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">Administration</span>
          <h1>Admin</h1>
          <p class="page-sub">Users, listings and skills across the platform.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="stat-grid">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="card"><div class="skeleton" style="height: 48px;"></div></div>
          }
        </div>
      } @else if (loadError()) {
        <app-empty-state
          variant="inbox"
          title="Couldn't load admin data"
          message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
        />
      } @else {
        @if (stats(); as s) {
          <div class="stat-grid">
            <div class="card stat"><span class="stat-value">{{ s.totalUsers }}</span><span class="stat-label">Users</span></div>
            <div class="card stat"><span class="stat-value">{{ s.students }}</span><span class="stat-label">Students</span></div>
            <div class="card stat"><span class="stat-value">{{ s.companies }}</span><span class="stat-label">Companies</span></div>
            <div class="card stat"><span class="stat-value">{{ s.activeInternships }}</span><span class="stat-label">Open roles</span></div>
            <div class="card stat"><span class="stat-value">{{ s.totalInternships }}</span><span class="stat-label">All listings</span></div>
          </div>
        }

        <div class="tabs" role="tablist" aria-label="Admin sections">
          @for (t of tabs; track t) {
            <button
              type="button"
              role="tab"
              class="tab"
              [class.active]="tab() === t"
              [attr.aria-selected]="tab() === t"
              (click)="tab.set(t)"
            >
              {{ t === 'users' ? 'Users' : t === 'internships' ? 'Listings' : 'Skills' }}
            </button>
          }
        </div>

        @switch (tab()) {
          @case ('users') {
            <div class="card table-card">
              <div class="t-scroll">
                <table>
                  <thead>
                    <tr><th>Email</th><th>Role</th><th>Status</th><th>Verified</th><th>Joined</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (u of users(); track u.id) {
                      <tr>
                        <td class="mono">{{ u.email }}</td>
                        <td>{{ u.role }}</td>
                        <td>
                          <span class="badge" [class.badge-open]="u.isActive" [class.badge-closed]="!u.isActive">
                            {{ u.isActive ? 'Active' : 'Disabled' }}
                          </span>
                        </td>
                        <td>
                          @if (u.emailVerified) {
                            <app-icon name="check" [size]="15" class="ok" />
                          } @else {
                            <span class="soft">—</span>
                          }
                        </td>
                        <td class="soft">{{ formatDate(u.createdAtUtc) }}</td>
                        <td class="right">
                          @if (u.role !== 'Admin') {
                            <app-link-button
                              size="sm"
                              [variant]="u.isActive ? 'standard-secondary' : 'standard'"
                              [disabled]="busyId() === u.id"
                              (pressed)="toggleActive(u)"
                            >
                              {{ u.isActive ? 'Disable' : 'Enable' }}
                            </app-link-button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (users().length < usersTotal()) {
                <div class="load-more">
                  <app-link-button size="sm" variant="standard-secondary" (pressed)="loadMoreUsers()">
                    Load more ({{ users().length }} of {{ usersTotal() }})
                  </app-link-button>
                </div>
              }
            </div>
          }
          @case ('internships') {
            <div class="card table-card">
              <div class="t-scroll">
                <table>
                  <thead>
                    <tr><th>Title</th><th>Company</th><th>Status</th><th>Posted</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (l of listings(); track l.id) {
                      <tr>
                        <td>{{ l.title }}</td>
                        <td>{{ l.companyName }}</td>
                        <td>
                          <span class="badge" [class.badge-open]="l.isActive" [class.badge-closed]="!l.isActive">
                            {{ l.isActive ? 'Open' : 'Closed' }}
                          </span>
                        </td>
                        <td class="soft">{{ formatDate(l.createdAtUtc) }}</td>
                        <td class="right">
                          @if (l.isActive) {
                            <app-link-button
                              size="sm"
                              variant="standard-secondary"
                              [disabled]="busyId() === l.id"
                              (pressed)="closeListing(l)"
                            >
                              <app-icon name="x" [size]="14" />
                              Close
                            </app-link-button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (listings().length < listingsTotal()) {
                <div class="load-more">
                  <app-link-button size="sm" variant="standard-secondary" (pressed)="loadMoreListings()">
                    Load more ({{ listings().length }} of {{ listingsTotal() }})
                  </app-link-button>
                </div>
              }
            </div>
          }
          @case ('skills') {
            <div class="card skills-card">
              <h2>Add a skill</h2>
              <p class="page-sub">New skills become available to students and listings immediately.</p>
              <div class="skill-row">
                <input
                  class="field-input"
                  placeholder="e.g. Kubernetes"
                  [(ngModel)]="newSkill"
                  (keydown.enter)="addSkill()"
                  aria-label="New skill name"
                />
                <app-link-button size="sm" [disabled]="!newSkill.trim() || busyId() === -1" (pressed)="addSkill()">
                  <app-icon name="plus" [size]="15" />
                  Add
                </app-link-button>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 560px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }

      .stat { text-align: center; padding: var(--space-md); }
      .stat-value { display: block; font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; }
      .stat-label { color: var(--color-text-soft); font-size: 0.8125rem; font-weight: 600; }

      .tabs { display: flex; gap: var(--space-sm); margin-bottom: var(--space-md); flex-wrap: wrap; }

      .tab {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-soft);
        border-radius: 999px;
        padding: 7px 16px;
        font-family: var(--font-sans);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease;
      }

      .tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
      .tab.active { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }

      .table-card { padding: 0; overflow: hidden; }
      .t-scroll { overflow-x: auto; }
      .load-more {
        display: flex;
        justify-content: center;
        padding: var(--space-sm) 0 var(--space-md);
        border-top: 1px solid var(--color-border);
      }

      table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      th {
        text-align: left;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-soft);
        padding: 12px var(--space-md);
        border-bottom: 1px solid var(--color-border);
        white-space: nowrap;
      }
      td { padding: 10px var(--space-md); border-bottom: 1px solid var(--color-muted); vertical-align: middle; }
      tr:last-child td { border-bottom: none; }
      .mono { font-weight: 600; }
      .soft { color: var(--color-text-soft); }
      .right { text-align: right; }
      .ok { color: #166534; }

      .skills-card h2 { font-size: 1.1rem; margin-bottom: var(--space-xs); }
      .skill-row { display: flex; gap: var(--space-sm); align-items: center; max-width: 420px; }
    `,
  ],
})
export class AdminComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly formatDate = formatDate;

  protected readonly tabs: AdminTab[] = ['users', 'internships', 'skills'];
  protected readonly tab = signal<AdminTab>('users');

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly usersTotal = signal(0);
  protected readonly listings = signal<AdminInternship[]>([]);
  protected readonly listingsTotal = signal(0);
  private usersPage = 1;
  private listingsPage = 1;
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected newSkill = '';

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.admin.getStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
    this.usersPage = 1;
    this.listingsPage = 1;
    this.admin.getUsers(1).subscribe({
      next: (page) => {
        this.users.set(page.items);
        this.usersTotal.set(page.total);
      },
      error: () => {},
    });
    this.admin.getInternships(1).subscribe({
      next: (page) => {
        this.listings.set(page.items);
        this.listingsTotal.set(page.total);
      },
      error: () => {},
    });
  }

  protected loadMoreUsers(): void {
    this.admin.getUsers(this.usersPage + 1).subscribe({
      next: (page) => {
        this.usersPage = page.page;
        this.users.update((list) => [...list, ...page.items]);
        this.usersTotal.set(page.total);
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not load more users.')),
    });
  }

  protected loadMoreListings(): void {
    this.admin.getInternships(this.listingsPage + 1).subscribe({
      next: (page) => {
        this.listingsPage = page.page;
        this.listings.update((list) => [...list, ...page.items]);
        this.listingsTotal.set(page.total);
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not load more listings.')),
    });
  }

  protected toggleActive(user: AdminUser): void {
    const next = !user.isActive;
    this.busyId.set(user.id);
    this.admin.setUserActive(user.id, next).subscribe({
      next: () => {
        this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)));
        this.busyId.set(null);
        this.toast.success(next ? `${user.email} enabled` : `${user.email} disabled`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiErrorMessage(err, 'Could not update the account.'));
      },
    });
  }

  protected closeListing(listing: AdminInternship): void {
    this.busyId.set(listing.id);
    this.admin.closeInternship(listing.id).subscribe({
      next: () => {
        this.listings.update((list) =>
          list.map((l) => (l.id === listing.id ? { ...l, isActive: false } : l)),
        );
        this.busyId.set(null);
        this.toast.success(`"${listing.title}" closed`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiErrorMessage(err, 'Could not close the listing.'));
      },
    });
  }

  protected addSkill(): void {
    const name = this.newSkill.trim();
    if (!name) return;
    this.busyId.set(-1);
    this.admin.createSkill(name).subscribe({
      next: (skill) => {
        this.busyId.set(null);
        this.newSkill = '';
        this.toast.success(`Skill "${skill.name}" added`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiErrorMessage(err, 'Could not add the skill.'));
      },
    });
  }
}
