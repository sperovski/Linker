import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InternshipService } from '../../core/api/internship.service';
import { SkillService } from '../../core/api/skill.service';
import { InternshipType, SkillResponse } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

@Component({
  selector: 'app-internship-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, SelectComponent, LinkButtonComponent],
  animations: [fadeSlideIn],
  template: `
    <div class="container page narrow">
      <a routerLink="/company/listings" class="back-link">
        <app-icon name="arrow-right" [size]="14" style="transform: rotate(180deg)" />
        Back to listings
      </a>

      <div class="page-header">
        <div>
          <h1>{{ isEdit() ? 'Edit internship' : 'Post an internship' }}</h1>
          <p class="page-sub">
            {{ isEdit() ? 'Update the details of your listing.' : 'Describe the role to reach the right students.' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="card" role="status" aria-label="Loading">
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 140px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 44px; width: 50%;"></div>
        </div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (serverError()) {
            <div class="form-error-banner" @fadeSlideIn role="alert">{{ serverError() }}</div>
          }

          <div class="step">
            <div class="step-head">
              <span class="step-num">1</span>
              <div>
                <h2>The basics</h2>
                <p class="step-sub">What is the role and what will they do?</p>
              </div>
            </div>
            <div class="step-body">
              <div class="field">
                <label class="label" for="title">Title</label>
                <input id="title" class="field-input" formControlName="title"
                  placeholder="e.g. Backend Engineering Intern" [class.invalid]="invalid('title')" />
                @if (invalid('title')) {
                  <div class="field-error" @fadeSlideIn>Title is required.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="description">Description</label>
                <textarea id="description" class="textarea" formControlName="description"
                  placeholder="What will the intern work on? What are you looking for?"
                  [class.invalid]="invalid('description')"></textarea>
                @if (invalid('description')) {
                  <div class="field-error" @fadeSlideIn>Description is required.</div>
                }
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-head">
              <span class="step-num">2</span>
              <div>
                <h2>Where and how</h2>
                <p class="step-sub">Location and the kind of engagement.</p>
              </div>
            </div>
            <div class="step-body">
              <div class="form-row">
                <div class="field">
                  <label class="label" for="location">Location</label>
                  <input id="location" class="field-input" formControlName="location" placeholder="e.g. Skopje / Remote" />
                </div>
                <div class="field">
                  <label class="label" for="type">Type</label>
                  <div class="field-select">
                    <app-select
                      [options]="typeOptions"
                      [value]="form.controls.type.value"
                      ariaLabel="Internship type"
                      (valueChange)="form.controls.type.setValue($any($event))"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-head">
              <span class="step-num">3</span>
              <div>
                <h2>Timeline</h2>
                <p class="step-sub">When does it start and end? Both optional.</p>
              </div>
            </div>
            <div class="step-body">
              <div class="form-row">
                <div class="field">
                  <label class="label" for="startDate">Start date</label>
                  <input id="startDate" type="date" class="field-input" formControlName="startDate" />
                </div>
                <div class="field">
                  <label class="label" for="endDate">End date</label>
                  <input id="endDate" type="date" class="field-input" formControlName="endDate"
                    [class.invalid]="form.hasError('dateOrder')" />
                </div>
              </div>
              @if (form.hasError('dateOrder')) {
                <div class="field-error" @fadeSlideIn style="margin-top: calc(-1 * var(--space-sm)); margin-bottom: var(--space-md)">
                  End date must be after the start date.
                </div>
              }
              <div class="field">
                <label class="label" for="applicationDeadline">Application deadline <span class="opt">(optional)</span></label>
                <input id="applicationDeadline" type="date" class="field-input" formControlName="applicationDeadline" />
                <p class="field-hint">After this date the role stops accepting applications automatically.</p>
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-head">
              <span class="step-num">4</span>
              <div>
                <h2>Required skills</h2>
                <p class="step-sub">Pick the skills that matter — students see how well they match.</p>
              </div>
            </div>
            <div class="step-body">
              @if (allSkills().length === 0) {
                <p class="field-hint">No skills available yet.</p>
              } @else {
                <div class="skill-picker">
                  @for (skill of allSkills(); track skill.id) {
                    <button
                      type="button"
                      class="skill-toggle"
                      [class.selected]="isSkillSelected(skill.id)"
                      (click)="toggleSkill(skill.id)"
                      [attr.aria-pressed]="isSkillSelected(skill.id)"
                    >
                      @if (isSkillSelected(skill.id)) {
                        <app-icon name="check" [size]="13" />
                      }
                      {{ skill.name }}
                    </button>
                  }
                </div>
                <p class="field-hint">{{ selectedSkillIds().size }} selected</p>
              }
            </div>
          </div>

          <app-link-button type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Saving…' : isEdit() ? 'Save changes' : 'Publish internship' }}
          </app-link-button>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 720px; }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.875rem;
        font-weight: 600;
        margin-bottom: var(--space-md);
      }

      .form-error-banner {
        background: #FEE2E2;
        color: #991B1B;
        border-radius: var(--radius-md);
        padding: 10px 14px;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: var(--space-md);
      }

      /* Numbered step groups with a connecting rail — progress, not a wall */
      .step {
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 0 var(--space-md);
        position: relative;
        padding-bottom: var(--space-lg);
      }

      .step:not(:last-of-type)::before {
        content: '';
        position: absolute;
        left: 15px;
        top: 36px;
        bottom: 0;
        width: 2px;
        background: var(--color-muted);
      }

      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-primary);
        color: var(--color-on-primary);
        font-weight: 700;
        font-size: 0.9rem;
        z-index: 1;
      }

      .step-head {
        display: contents;
      }

      .step-head h2 {
        font-size: 1.05rem;
        margin: 4px 0 2px;
      }

      .step-sub {
        color: var(--color-text-soft);
        font-size: 0.875rem;
        margin-bottom: var(--space-md);
      }

      .step-body {
        grid-column: 2;
      }

      .field-select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: 0 12px;
      }

      .field-select:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); }

      .opt { font-weight: 400; color: var(--color-text-soft); }

      .field-hint {
        color: var(--color-text-soft);
        font-size: 0.8125rem;
        margin: var(--space-xs) 0 0;
      }

      .skill-picker {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }

      .skill-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-soft);
        border-radius: 999px;
        padding: 6px 14px;
        font-family: var(--font-sans);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 160ms ease;
      }

      .skill-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }

      .skill-toggle.selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: var(--color-on-primary);
      }

      @media (max-width: 640px) {
        .step { grid-template-columns: 36px 1fr; }
        .step:not(:last-of-type)::before { left: 13px; }
        .step-num { width: 28px; height: 28px; font-size: 0.8125rem; }
      }
    `,
  ],
})
export class InternshipFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly internshipService = inject(InternshipService);
  private readonly skillService = inject(SkillService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly allSkills = signal<SkillResponse[]>([]);
  protected readonly selectedSkillIds = signal<Set<number>>(new Set());

  protected readonly typeOptions: SelectOption[] = [
    { value: 'Internship', label: 'Internship' },
    { value: 'PartTime', label: 'Part-time' },
    { value: 'FullTime', label: 'Full-time' },
  ];

  /** Route param — present only on /company/internships/:id/edit. */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      title: ['', Validators.required],
      description: ['', Validators.required],
      location: [''],
      type: ['Internship' as InternshipType, Validators.required],
      startDate: [''],
      endDate: [''],
      applicationDeadline: [''],
    },
    {
      validators: (group) => {
        const start = group.get('startDate')?.value;
        const end = group.get('endDate')?.value;
        return start && end && end < start ? { dateOrder: true } : null;
      },
    },
  );

  ngOnInit(): void {
    this.skillService.getAll().subscribe({
      next: (skills) => this.allSkills.set(skills),
      error: () => {},
    });

    const id = this.id();
    if (id === undefined) {
      return;
    }

    this.loading.set(true);
    this.internshipService.getDetail(Number(id)).subscribe({
      next: (internship) => {
        this.form.patchValue({
          title: internship.title,
          description: internship.description,
          location: internship.location ?? '',
          type: internship.type,
          startDate: internship.startDate ?? '',
          endDate: internship.endDate ?? '',
          applicationDeadline: internship.applicationDeadline ?? '',
        });
        this.selectedSkillIds.set(new Set(internship.requiredSkills.map((s) => s.id)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load the internship.');
        this.router.navigate(['/company/listings']);
      },
    });
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected isSkillSelected(id: number): boolean {
    return this.selectedSkillIds().has(id);
  }

  protected toggleSkill(id: number): void {
    this.selectedSkillIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      title: value.title,
      description: value.description,
      location: value.location || null,
      type: value.type,
      startDate: value.startDate || null,
      endDate: value.endDate || null,
      applicationDeadline: value.applicationDeadline || null,
      skillIds: [...this.selectedSkillIds()],
    };

    this.submitting.set(true);
    const id = this.id();
    const save$ =
      id === undefined
        ? this.internshipService.create(request)
        : this.internshipService.update(Number(id), request);

    save$.subscribe({
      next: () => {
        this.toast.success(id === undefined ? 'Internship published' : 'Changes saved');
        this.router.navigate(['/company/listings']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.serverError.set(apiErrorMessage(err, 'Could not save the internship.'));
      },
    });
  }
}
