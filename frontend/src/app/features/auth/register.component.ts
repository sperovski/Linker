import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { facultyOptions, gradYearOptions } from '../../shared/faculties';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { SelectComponent } from '../../shared/select.component';
import { ConstellationBgComponent } from '../../shared/constellation-bg.component';

type RegisterRole = 'student' | 'company';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LinkButtonComponent, SelectComponent, ConstellationBgComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <app-constellation-bg />
      <div class="auth-card">
        <h1>Create your account</h1>
        <p class="auth-sub">Join Linker as a student or a company.</p>

        <div class="role-tabs" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            class="role-tab"
            [class.active]="mode() === 'student'"
            [attr.aria-selected]="mode() === 'student'"
            (click)="mode.set('student')"
          >
            <app-icon name="user" [size]="16" />
            Student
          </button>
          <button
            type="button"
            role="tab"
            class="role-tab"
            [class.active]="mode() === 'company'"
            [attr.aria-selected]="mode() === 'company'"
            (click)="mode.set('company')"
          >
            <app-icon name="building" [size]="16" />
            Company
          </button>
        </div>

        @if (serverError()) {
          <div class="form-error-banner" @fadeSlideIn role="alert">{{ serverError() }}</div>
        }

        @if (mode() === 'student') {
          <form [formGroup]="studentForm" (ngSubmit)="submitStudent()" novalidate>
            <div class="form-section">
              <div class="form-section-title">About you</div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="firstName">First name</label>
                  <div class="group">
                  <app-icon class="icon" name="user" [size]="18" />
                  <input id="firstName" class="input" formControlName="firstName"
                    [class.invalid]="invalid(studentForm, 'firstName')" />
                </div>
                  @if (invalid(studentForm, 'firstName')) {
                    <div class="field-error" @fadeSlideIn>First name is required.</div>
                  }
                </div>
                <div class="field">
                  <label class="label" for="lastName">Last name</label>
                  <div class="group">
                  <app-icon class="icon" name="user" [size]="18" />
                  <input id="lastName" class="input" formControlName="lastName"
                    [class.invalid]="invalid(studentForm, 'lastName')" />
                </div>
                  @if (invalid(studentForm, 'lastName')) {
                    <div class="field-error" @fadeSlideIn>Last name is required.</div>
                  }
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">Your studies</div>
              <div class="field">
                <label class="label">Faculty <span class="optional">(Ss. Cyril and Methodius University, optional)</span></label>
                <div class="field-select">
                  <app-select
                    [options]="facultyOptions"
                    [value]="studentForm.controls.university.value"
                    icon="building"
                    ariaLabel="Faculty"
                    placeholder="Choose your faculty… (optional)"
                    (valueChange)="studentForm.controls.university.setValue($event)"
                  />
                </div>
              </div>
              <div class="field">
                <label class="label">Graduation year <span class="optional">(optional)</span></label>
                <div class="field-select">
                  <app-select
                    [options]="gradYearOptions"
                    [value]="yearValue()"
                    icon="calendar"
                    ariaLabel="Graduation year"
                    placeholder="Choose a year… (optional)"
                    (valueChange)="setYear($event)"
                  />
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">Your account</div>
              <div class="field">
                <label class="label" for="sEmail">Email</label>
                <div class="group">
                  <app-icon class="icon" name="mail" [size]="18" />
                  <input id="sEmail" type="email" class="input" formControlName="email"
                  autocomplete="email" [class.invalid]="invalid(studentForm, 'email')" />
                </div>
                @if (invalid(studentForm, 'email')) {
                  <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="sPassword">Password</label>
                <div class="group">
                  <app-icon class="icon" name="lock" [size]="18" />
                  <input id="sPassword" type="password" class="input" formControlName="password"
                  autocomplete="new-password" [class.invalid]="invalid(studentForm, 'password')" />
                </div>
                @if (invalid(studentForm, 'password')) {
                  <div class="field-error" @fadeSlideIn>At least 8 characters.</div>
                }
              </div>
            </div>

            <app-link-button type="submit" block [disabled]="submitting()">
              {{ submitting() ? 'Creating account…' : 'Sign up as a student' }}
            </app-link-button>
          </form>
        } @else {
          <form [formGroup]="companyForm" (ngSubmit)="submitCompany()" novalidate>
            <div class="form-section">
              <div class="form-section-title">Your company</div>
              <div class="field">
                <label class="label" for="companyName">Company name</label>
                <div class="group">
                  <app-icon class="icon" name="building" [size]="18" />
                  <input id="companyName" class="input" formControlName="name"
                  [class.invalid]="invalid(companyForm, 'name')" />
                </div>
                @if (invalid(companyForm, 'name')) {
                  <div class="field-error" @fadeSlideIn>Company name is required.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="website">Website <span class="optional">(optional)</span></label>
                <div class="group">
                  <app-icon class="icon" name="link" [size]="18" />
                  <input id="website" type="url" class="input" formControlName="website"
                  placeholder="https://…" />
                </div>
              </div>

              <div class="field">
                <label class="label" for="description">Short description <span class="optional">(optional)</span></label>
                <textarea id="description" class="textarea" formControlName="description"
                  style="min-height: 90px;"></textarea>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">Your account</div>
              <div class="field">
                <label class="label" for="cEmail">Work email</label>
                <div class="group">
                  <app-icon class="icon" name="mail" [size]="18" />
                  <input id="cEmail" type="email" class="input" formControlName="email"
                  autocomplete="email" [class.invalid]="invalid(companyForm, 'email')" />
                </div>
                @if (invalid(companyForm, 'email')) {
                  <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="cPassword">Password</label>
                <div class="group">
                  <app-icon class="icon" name="lock" [size]="18" />
                  <input id="cPassword" type="password" class="input" formControlName="password"
                  autocomplete="new-password" [class.invalid]="invalid(companyForm, 'password')" />
                </div>
                @if (invalid(companyForm, 'password')) {
                  <div class="field-error" @fadeSlideIn>At least 8 characters.</div>
                }
              </div>
            </div>

            <app-link-button type="submit" block [disabled]="submitting()">
              {{ submitting() ? 'Creating account…' : 'Sign up as a company' }}
            </app-link-button>
          </form>
        }

        <p class="auth-footer">
          Already have an account? <a routerLink="/login">Log in</a>
        </p>
      </div>
    </div>
  `,
  styles: ['.optional { font-weight: 400; color: var(--color-text-soft); }'],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Query param ?as=company preselects the company tab (from the landing CTA). */
  readonly as = input<string>();

  protected readonly mode = signal<RegisterRole>('student');
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly currentYear = new Date().getFullYear();

  protected readonly facultyOptions = facultyOptions();
  protected readonly gradYearOptions = gradYearOptions();

  protected readonly studentForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    university: [''],
    // Students can't have already graduated — floor the year at the present.
    graduationYear: [null as number | null, [Validators.min(this.currentYear), Validators.max(2100)]],
  });

  /** Signal mirror of the graduationYear control so the select's [value] stays reactive. */
  private readonly graduationYearSignal = signal<number | null>(null);
  protected readonly yearValue = computed(() => {
    const year = this.graduationYearSignal();
    return year === null ? '' : String(year);
  });

  protected setYear(value: string): void {
    const year = value ? Number(value) : null;
    this.studentForm.controls.graduationYear.setValue(year);
    this.graduationYearSignal.set(year);
  }

  protected readonly companyForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    website: [''],
    description: [''],
  });

  ngOnInit(): void {
    if (this.as() === 'company') {
      this.mode.set('company');
    }
  }

  protected invalid(form: FormGroup, control: string): boolean {
    const c = form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected submitStudent(): void {
    this.serverError.set(null);
    if (this.studentForm.invalid) {
      this.studentForm.markAllAsTouched();
      return;
    }

    const value = this.studentForm.getRawValue();
    this.submitting.set(true);
    this.auth
      .registerStudent({
        email: value.email,
        password: value.password,
        firstName: value.firstName,
        lastName: value.lastName,
        university: value.university || null,
        graduationYear: value.graduationYear,
      })
      .subscribe({
        next: () => {
          this.toast.success('Welcome to Linker!');
          this.router.navigate(['/internships']);
        },
        error: (err) => {
          this.submitting.set(false);
          this.serverError.set(apiErrorMessage(err, 'Registration failed. Please try again.'));
        },
      });
  }

  protected submitCompany(): void {
    this.serverError.set(null);
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const value = this.companyForm.getRawValue();
    this.submitting.set(true);
    this.auth
      .registerCompany({
        email: value.email,
        password: value.password,
        name: value.name,
        website: value.website || null,
        description: value.description || null,
      })
      .subscribe({
        next: () => {
          this.toast.success('Welcome to Linker!');
          this.router.navigate(['/company/listings']);
        },
        error: (err) => {
          this.submitting.set(false);
          this.serverError.set(apiErrorMessage(err, 'Registration failed. Please try again.'));
        },
      });
  }
}
