import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/api/company.service';
import { CompanyProfile } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { CompanyBadgeComponent } from '../../shared/company-badge.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

@Component({
  selector: 'app-company-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
    IconComponent,
    CompanyLogoComponent,
    CompanyBadgeComponent,
    LinkButtonComponent,
  ],
  animations: [fadeSlideIn],
  template: `
    <div class="container page narrow">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your presence</span>
          <h1>Company profile</h1>
          <p class="page-sub">What students see on your listings.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card" role="status" aria-label="Loading">
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 90px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 44px; width: 60%;"></div>
        </div>
      } @else if (loadError()) {
        <app-empty-state
          variant="inbox"
          title="Couldn't load your profile"
          message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
        />
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="profile-head">
            <app-company-logo [name]="profile()?.name ?? '?'" [size]="56" />
            <div>
              <div class="name-row">
                <h2>{{ profile()?.name }}</h2>
                @if (profile(); as p) {
                  <app-company-badge [verified]="p.isVerified" [companyName]="p.name" />
                }
              </div>
              @if (profile()?.website; as website) {
                <a [href]="website" target="_blank" rel="noopener" class="website-link">
                  <app-icon name="external-link" [size]="13" />
                  {{ website }}
                </a>
              }
            </div>
          </div>

          @if (profile(); as p) {
            @if (p.isVerified) {
              <div class="verify-note ok">
                <app-icon name="check" [size]="15" />
                <span>
                  Your company is verified. Students see a verified badge next to your name in
                  the community chat and on your listings.
                </span>
              </div>
            } @else {
              <div class="verify-note pending">
                <app-icon name="clock" [size]="15" />
                <span>
                  Not verified yet. You can still post listings and chat, but your messages show
                  as an unverified company until a Linker admin confirms this account. Confirm
                  your email address first &mdash; verification can't be granted without it.
                </span>
              </div>
            }
          }

          <div class="field">
            <label class="label" for="name">Company name</label>
            <input id="name" class="field-input" formControlName="name" [class.invalid]="invalid('name')" />
            @if (invalid('name')) {
              <div class="field-error" @fadeSlideIn>Company name is required.</div>
            }
          </div>

          <div class="field">
            <label class="label" for="description">Description</label>
            <textarea id="description" class="textarea" formControlName="description"
              placeholder="What does your company do? What's it like to intern with you?"></textarea>
          </div>

          <div class="field">
            <label class="label" for="website">Website</label>
            <input id="website" type="url" class="field-input" formControlName="website" placeholder="https://…" />
          </div>

          <app-link-button type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save profile' }}
          </app-link-button>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 720px; }

      .profile-head {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 1px solid var(--color-border);
      }

      .profile-head h2 { margin: 0; font-size: 1.25rem; }

      .name-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .verify-note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        border-radius: var(--radius-md);
        padding: 10px 12px;
        margin-bottom: var(--space-lg);
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      .verify-note.ok {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
      }

      .verify-note.pending {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
      }

      .website-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.875rem;
        font-weight: 500;
      }
    `,
  ],
})
export class CompanyProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);

  protected readonly profile = signal<CompanyProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    website: [''],
  });

  ngOnInit(): void {
    this.companyService.getMe().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue({
          name: profile.name,
          description: profile.description ?? '',
          website: profile.website ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected initial(): string {
    return (this.profile()?.name ?? '?').charAt(0).toUpperCase();
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.companyService
      .updateMe({
        name: value.name,
        description: value.description || null,
        website: value.website || null,
      })
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.saving.set(false);
          this.toast.success('Profile saved');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(apiErrorMessage(err, 'Could not save the profile.'));
        },
      });
  }
}
