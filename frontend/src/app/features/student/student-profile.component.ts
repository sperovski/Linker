import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { SkillService } from '../../core/api/skill.service';
import { StudentService } from '../../core/api/student.service';
import { SkillResponse, StudentProfile } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-student-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, IconComponent],
  animations: [fadeSlideIn],
  template: `
    <div class="container page narrow">
      <div class="page-header">
        <div>
          <span class="eyebrow">Your story</span>
          <h1>My profile</h1>
          <p class="page-sub">What companies see when you apply.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card" role="status" aria-label="Loading">
          <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 90px; width: 100%;"></div>
        </div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Details</h2>
          <div class="form-row">
            <div class="field">
              <label class="label" for="firstName">First name</label>
              <input id="firstName" class="input" formControlName="firstName"
                [class.invalid]="invalid('firstName')" />
              @if (invalid('firstName')) {
                <div class="field-error" @fadeSlideIn>First name is required.</div>
              }
            </div>
            <div class="field">
              <label class="label" for="lastName">Last name</label>
              <input id="lastName" class="input" formControlName="lastName"
                [class.invalid]="invalid('lastName')" />
              @if (invalid('lastName')) {
                <div class="field-error" @fadeSlideIn>Last name is required.</div>
              }
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label class="label" for="university">University / faculty</label>
              <input id="university" class="input" formControlName="university" />
            </div>
            <div class="field">
              <label class="label" for="graduationYear">Graduation year</label>
              <input id="graduationYear" type="number" class="input" formControlName="graduationYear"
                [class.invalid]="invalid('graduationYear')" />
              @if (invalid('graduationYear')) {
                <div class="field-error" @fadeSlideIn>Enter a year between 1950 and 2100.</div>
              }
            </div>
          </div>

          <div class="field">
            <label class="label" for="bio">Bio</label>
            <textarea id="bio" class="textarea" formControlName="bio"
              placeholder="A few sentences about you, your interests, and links to your CV or portfolio…"></textarea>
          </div>

          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save profile' }}
          </button>
        </form>

        <div class="card skills-card">
          <h2>Skills</h2>
          <p class="page-sub" style="margin-bottom: var(--space-md)">
            Tag your skills so companies can see your strengths at a glance.
          </p>

          <div class="tags">
            @for (skill of profile()?.skills ?? []; track skill.id) {
              <span class="tag" @fadeSlideIn>
                {{ skill.name }}
                <button type="button" (click)="removeSkill(skill)" [attr.aria-label]="'Remove ' + skill.name">
                  <app-icon name="x" [size]="13" />
                </button>
              </span>
            } @empty {
              <span class="page-sub">No skills added yet.</span>
            }
          </div>

          @if (availableToAdd().length > 0) {
            <div class="add-skill">
              <label class="label" for="skillSelect">Add a skill</label>
              <div class="add-skill-row">
                <select id="skillSelect" class="select" [(ngModel)]="selectedSkillId">
                  <option [ngValue]="null">Choose a skill…</option>
                  @for (skill of availableToAdd(); track skill.id) {
                    <option [ngValue]="skill.id">{{ skill.name }}</option>
                  }
                </select>
                <button type="button" class="btn btn-secondary btn-sm" (click)="addSkill()"
                  [disabled]="selectedSkillId === null">
                  <app-icon name="plus" [size]="15" />
                  Add
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 720px; }

      .card { margin-bottom: var(--space-lg); }

      .card h2 { font-size: 1.125rem; margin-bottom: var(--space-md); }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .add-skill-row {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .add-skill-row .select { max-width: 280px; }
    `,
  ],
})
export class StudentProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly skillService = inject(SkillService);
  private readonly toast = inject(ToastService);

  protected readonly profile = signal<StudentProfile | null>(null);
  protected readonly allSkills = signal<SkillResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected selectedSkillId: number | null = null;

  protected readonly availableToAdd = computed(() => {
    const owned = new Set((this.profile()?.skills ?? []).map((s) => s.id));
    return this.allSkills().filter((s) => !owned.has(s.id));
  });

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    university: [''],
    graduationYear: [null as number | null, [Validators.min(1950), Validators.max(2100)]],
    bio: [''],
  });

  ngOnInit(): void {
    this.studentService.getMe().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          university: profile.university ?? '',
          graduationYear: profile.graduationYear,
          bio: profile.bio ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.skillService.getAll().subscribe((skills) => this.allSkills.set(skills));
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
    this.studentService
      .updateMe({
        firstName: value.firstName,
        lastName: value.lastName,
        university: value.university || null,
        graduationYear: value.graduationYear,
        bio: value.bio || null,
      })
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.saving.set(false);
          this.toast.success('Profile saved');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(apiErrorMessage(err, 'Could not save your profile.'));
        },
      });
  }

  protected addSkill(): void {
    if (this.selectedSkillId === null) {
      return;
    }
    this.skillService.assign(this.selectedSkillId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.selectedSkillId = null;
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not add that skill.')),
    });
  }

  protected removeSkill(skill: SkillResponse): void {
    this.skillService.remove(skill.id).subscribe({
      next: (profile) => this.profile.set(profile),
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not remove that skill.')),
    });
  }
}
