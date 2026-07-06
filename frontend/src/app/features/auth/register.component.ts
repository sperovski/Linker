import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';

type RegisterRole = 'student' | 'company';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
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
                  <input id="firstName" class="input" formControlName="firstName"
                    [class.invalid]="invalid(studentForm, 'firstName')" />
                  @if (invalid(studentForm, 'firstName')) {
                    <div class="field-error" @fadeSlideIn>First name is required.</div>
                  }
                </div>
                <div class="field">
                  <label class="label" for="lastName">Last name</label>
                  <input id="lastName" class="input" formControlName="lastName"
                    [class.invalid]="invalid(studentForm, 'lastName')" />
                  @if (invalid(studentForm, 'lastName')) {
                    <div class="field-error" @fadeSlideIn>Last name is required.</div>
                  }
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">Your studies</div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="university">University <span class="optional">(optional)</span></label>
                  <input id="university" class="input" formControlName="university" />
                </div>
                <div class="field">
                  <label class="label" for="gradYear">Graduation year <span class="optional">(optional)</span></label>
                  <input id="gradYear" type="number" class="input" formControlName="graduationYear"
                    [class.invalid]="invalid(studentForm, 'graduationYear')" />
                  @if (invalid(studentForm, 'graduationYear')) {
                    <div class="field-error" @fadeSlideIn>Enter a year between 1950 and 2100.</div>
                  }
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">Your account</div>
              <div class="field">
                <label class="label" for="sEmail">Email</label>
                <input id="sEmail" type="email" class="input" formControlName="email"
                  autocomplete="email" [class.invalid]="invalid(studentForm, 'email')" />
                @if (invalid(studentForm, 'email')) {
                  <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="sPassword">Password</label>
                <input id="sPassword" type="password" class="input" formControlName="password"
                  autocomplete="new-password" [class.invalid]="invalid(studentForm, 'password')" />
                @if (invalid(studentForm, 'password')) {
                  <div class="field-error" @fadeSlideIn>At least 8 characters.</div>
                }
              </div>
            </div>

            <button type="submit" class="btn btn-primary submit-btn" [disabled]="submitting()">
              {{ submitting() ? 'Creating account…' : 'Sign up as a student' }}
            </button>
          </form>
        } @else {
          <form [formGroup]="companyForm" (ngSubmit)="submitCompany()" novalidate>
            <div class="form-section">
              <div class="form-section-title">Your company</div>
              <div class="field">
                <label class="label" for="companyName">Company name</label>
                <input id="companyName" class="input" formControlName="name"
                  [class.invalid]="invalid(companyForm, 'name')" />
                @if (invalid(companyForm, 'name')) {
                  <div class="field-error" @fadeSlideIn>Company name is required.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="website">Website <span class="optional">(optional)</span></label>
                <input id="website" type="url" class="input" formControlName="website"
                  placeholder="https://…" />
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
                <input id="cEmail" type="email" class="input" formControlName="email"
                  autocomplete="email" [class.invalid]="invalid(companyForm, 'email')" />
                @if (invalid(companyForm, 'email')) {
                  <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
                }
              </div>

              <div class="field">
                <label class="label" for="cPassword">Password</label>
                <input id="cPassword" type="password" class="input" formControlName="password"
                  autocomplete="new-password" [class.invalid]="invalid(companyForm, 'password')" />
                @if (invalid(companyForm, 'password')) {
                  <div class="field-error" @fadeSlideIn>At least 8 characters.</div>
                }
              </div>
            </div>

            <button type="submit" class="btn btn-blue submit-btn" [disabled]="submitting()">
              {{ submitting() ? 'Creating account…' : 'Sign up as a company' }}
            </button>
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

  protected readonly studentForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    university: [''],
    graduationYear: [null as number | null, [Validators.min(1950), Validators.max(2100)]],
  });

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
