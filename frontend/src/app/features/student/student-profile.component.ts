import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { SkillService } from '../../core/api/skill.service';
import { StudentService } from '../../core/api/student.service';
import { SkillResponse, StudentProfile } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { facultyOptions, gradYearOptions } from '../../shared/faculties';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { SelectComponent } from '../../shared/select.component';

@Component({
  selector: 'app-student-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, EmptyStateComponent, IconComponent, LinkButtonComponent, SelectComponent],
  animations: [fadeSlideIn],
  template: `
    <div class="container page narrow">
      @if (loadError()) {
        <app-empty-state
          variant="inbox"
          title="Couldn't load your profile"
          message="Something went wrong on our end or your connection dropped. Refresh the page to try again."
        />
      } @else {
      @if (!loading()) {
        <div class="profile-hero card" @fadeSlideIn>
          <div class="hero-cover"></div>
          <div class="hero-body">
            <span class="hero-avatar" [attr.aria-hidden]="true">{{ initials() }}</span>
            <div class="hero-info">
              <span class="hero-greeting">Welcome back{{ profile()?.firstName ? ', ' + profile()!.firstName : '' }}</span>
              <h1>{{ fullName() || 'Your profile' }}</h1>
              <div class="hero-meta">
                @if (profile()?.university) {
                  <span><app-icon name="building" [size]="14" /> {{ profile()!.university }}</span>
                }
                @if (profile()?.graduationYear) {
                  <span><app-icon name="calendar" [size]="14" /> Class of {{ profile()!.graduationYear }}</span>
                }
                @if (auth.email()) {
                  <span><app-icon name="user" [size]="14" /> {{ auth.email() }}</span>
                }
              </div>
            </div>
            <div class="hero-ring" [attr.aria-label]="completeness() + '% complete'">
              <svg viewBox="0 0 76 76" class="ring">
                <circle class="ring-bg" cx="38" cy="38" r="32" />
                <circle
                  class="ring-fg"
                  cx="38"
                  cy="38"
                  r="32"
                  [style.stroke-dasharray]="ringCirc"
                  [style.stroke-dashoffset]="ringOffset()"
                />
              </svg>
              <div class="ring-center">
                <span class="ring-pct">{{ completeness() }}%</span>
                <span class="ring-lbl">done</span>
              </div>
            </div>
          </div>
          @if (completeness() < 100) {
            <p class="hero-nudge">
              <app-icon name="arrow-right" [size]="14" />
              {{ nudge() }}
            </p>
          }
        </div>
      }

      @if (loading()) {
        <div class="card" role="status" aria-label="Loading">
          <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 90px; width: 100%;"></div>
        </div>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="section-head">
            <span class="section-ic"><app-icon name="user" [size]="17" /></span>
            <div>
              <h2>About you</h2>
              <p class="section-sub">The basics companies see first.</p>
            </div>
          </div>
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
              <label class="label">Faculty <span class="opt-hint">(Ss. Cyril and Methodius University)</span></label>
              <div class="field-select">
                <app-select
                  [options]="facultyOpts()"
                  [value]="universityValue()"
                  icon="building"
                  ariaLabel="Faculty"
                  placeholder="Choose your faculty… (optional)"
                  (valueChange)="setUniversity($event)"
                />
              </div>
            </div>
            <div class="field">
              <label class="label">Graduation year</label>
              <div class="field-select">
                <app-select
                  [options]="gradYearOpts()"
                  [value]="yearValue()"
                  icon="calendar"
                  ariaLabel="Graduation year"
                  placeholder="Choose a year… (optional)"
                  (valueChange)="setYear($event)"
                />
              </div>
            </div>
          </div>

          <div class="field">
            <label class="label" for="bio">Bio</label>
            <textarea id="bio" class="textarea" formControlName="bio"
              placeholder="A few sentences about you, your interests, and links to your CV or portfolio…"></textarea>
          </div>

          <app-link-button type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save profile' }}
          </app-link-button>
        </form>

        <div class="card skills-card">
          <div class="section-head">
            <span class="section-ic green"><app-icon name="check" [size]="17" /></span>
            <div>
              <h2>Your skills</h2>
              <p class="section-sub">Tag your strengths so companies spot the match.</p>
            </div>
          </div>

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
                <app-link-button size="sm" (pressed)="addSkill()"
                  [disabled]="selectedSkillId === null">
                  <app-icon name="plus" [size]="15" />
                  Add
                </app-link-button>
              </div>
            </div>
          }
        </div>
      }
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 720px; }

      .card { margin-bottom: var(--space-lg); }

      /* ---- Homey profile hero ---- */
      .profile-hero { padding: 0; overflow: hidden; }

      .hero-cover {
        height: 96px;
        background:
          radial-gradient(120% 180% at 0% 0%, rgba(245, 158, 11, 0.35), transparent 55%),
          linear-gradient(120deg, var(--color-primary), var(--color-secondary));
      }

      .hero-body {
        display: flex;
        align-items: flex-end;
        gap: var(--space-md);
        padding: 0 var(--space-xl) var(--space-lg);
        margin-top: -42px;
      }

      .hero-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 84px;
        height: 84px;
        border-radius: 24px;
        flex-shrink: 0;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        color: var(--color-on-primary);
        font-size: 1.9rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        border: 4px solid var(--color-surface);
        box-shadow: 0 10px 24px -10px rgba(79, 70, 229, 0.6);
      }

      .hero-info { flex: 1; min-width: 0; padding-bottom: 4px; }

      .hero-greeting {
        display: block;
        font-size: 0.8rem;
        font-weight: 700;
        /* Sits on the coloured cover — keep it light for contrast. */
        color: rgba(255, 255, 255, 0.95);
        text-shadow: 0 1px 3px rgba(15, 23, 42, 0.35);
        margin-bottom: 4px;
      }

      .hero-info h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -0.02em; }

      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        font-size: 0.85rem;
        color: var(--color-text-soft);
        font-weight: 500;
      }

      .hero-meta span { display: inline-flex; align-items: center; gap: 5px; }

      /* completeness ring */
      .hero-ring { position: relative; width: 76px; height: 76px; flex-shrink: 0; }
      .hero-ring .ring { width: 76px; height: 76px; transform: rotate(-90deg); }
      .ring-bg { fill: none; stroke: var(--color-muted); stroke-width: 7; }
      .ring-fg {
        fill: none;
        stroke: var(--color-accent);
        stroke-width: 7;
        stroke-linecap: round;
        transition: stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ring-center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .ring-pct { font-size: 1.05rem; font-weight: 800; color: var(--color-foreground); }
      .ring-lbl { font-size: 0.6rem; font-weight: 700; color: var(--color-text-soft); text-transform: uppercase; letter-spacing: 0.04em; }

      .hero-nudge {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 10px var(--space-xl);
        background: #fffbeb;
        border-top: 1px solid var(--color-border);
        color: #92400e;
        font-size: 0.85rem;
        font-weight: 600;
      }

      /* ---- Section headers ---- */
      .section-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-lg);
      }

      .section-ic {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: var(--radius-md);
        background: rgba(79, 70, 229, 0.1);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .section-ic.green { background: #dcfce7; color: #166534; }

      .section-head h2 { font-size: 1.15rem; margin: 0; }
      .section-sub { margin: 1px 0 0; font-size: 0.85rem; color: var(--color-text-soft); }

      .card h2 { font-size: 1.125rem; }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .add-skill {
        border-top: 1px dashed var(--color-border);
        padding-top: var(--space-md);
      }

      .add-skill-row {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .add-skill-row .select { max-width: 280px; }

      /* Same chrome as .input for the borderless app-select */
      .field-select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: 0 12px;
        transition: border-color 200ms ease, box-shadow 200ms ease;
      }

      .field-select:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.13);
      }

      .opt-hint { font-weight: 400; color: var(--color-text-soft); }

      @media (max-width: 520px) {
        .hero-body { flex-wrap: wrap; }
        .hero-ring { margin-left: auto; }
      }
    `,
  ],
})
export class StudentProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly skillService = inject(SkillService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly profile = signal<StudentProfile | null>(null);
  protected readonly allSkills = signal<SkillResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected selectedSkillId: number | null = null;

  /** Circumference of the completeness ring (r = 32). */
  protected readonly ringCirc = 2 * Math.PI * 32;

  protected readonly availableToAdd = computed(() => {
    const owned = new Set((this.profile()?.skills ?? []).map((s) => s.id));
    return this.allSkills().filter((s) => !owned.has(s.id));
  });

  protected readonly fullName = computed(() => {
    const p = this.profile();
    return p ? `${p.firstName} ${p.lastName}`.trim() : '';
  });

  protected readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '?';
    const a = (p.firstName?.[0] ?? '').toUpperCase();
    const b = (p.lastName?.[0] ?? '').toUpperCase();
    return (a + b) || '?';
  });

  /** Share of profile fields that are filled in — drives the ring + nudge. */
  protected readonly completeness = computed(() => {
    const p = this.profile();
    if (!p) return 0;
    const parts = [
      !!p.firstName,
      !!p.lastName,
      !!p.university,
      !!p.graduationYear,
      !!(p.bio && p.bio.trim().length > 0),
      (p.skills?.length ?? 0) > 0,
    ];
    return Math.round((parts.filter(Boolean).length / parts.length) * 100);
  });

  protected readonly ringOffset = computed(() => this.ringCirc * (1 - this.completeness() / 100));

  /** Friendly next-step suggestion based on the biggest gap. */
  protected readonly nudge = computed(() => {
    const p = this.profile();
    if (!p) return '';
    if (!p.university) return 'Add your university so companies know where you study.';
    if (!p.graduationYear) return 'Add your graduation year to round out the basics.';
    if (!(p.bio && p.bio.trim())) return 'Write a short bio — it’s your chance to stand out.';
    if ((p.skills?.length ?? 0) === 0) return 'Add a few skills so companies can spot the match.';
    return 'Almost there — a fuller profile gets more replies.';
  });

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    university: [''],
    graduationYear: [null as number | null, [Validators.min(1950), Validators.max(2100)]],
    bio: [''],
  });

  // Signal mirrors of the two select-backed controls so [value] stays reactive.
  private readonly universitySignal = signal('');
  private readonly gradYearSignal = signal<number | null>(null);

  protected readonly universityValue = this.universitySignal.asReadonly();
  protected readonly yearValue = computed(() => {
    const year = this.gradYearSignal();
    return year === null ? '' : String(year);
  });

  /** UKIM faculties, plus any legacy free-text value so older profiles still display. */
  protected readonly facultyOpts = computed(() => {
    const options = facultyOptions();
    const stored = this.universitySignal();
    if (stored && !options.some((o) => o.value === stored)) {
      options.splice(1, 0, { value: stored, label: stored });
    }
    return options;
  });

  /** Current year onward, plus the stored year if it predates the rule. */
  protected readonly gradYearOpts = computed(() => gradYearOptions(8, this.gradYearSignal()));

  protected setUniversity(value: string): void {
    this.form.controls.university.setValue(value);
    this.universitySignal.set(value);
  }

  protected setYear(value: string): void {
    const year = value ? Number(value) : null;
    this.form.controls.graduationYear.setValue(year);
    this.gradYearSignal.set(year);
  }

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
        this.universitySignal.set(profile.university ?? '');
        this.gradYearSignal.set(profile.graduationYear);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
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
