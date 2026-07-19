import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { SkillService } from '../../core/api/skill.service';
import { StudentService } from '../../core/api/student.service';
import {
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  SkillResponse,
  StudentProfile,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { facultyOptions, gradYearOptions } from '../../shared/faculties';
import { IconComponent } from '../../shared/icon.component';
import { EditButtonComponent } from '../../shared/edit-button.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { MaskIconComponent } from '../../shared/mask-icon.component';
import { SelectComponent } from '../../shared/select.component';
import { LoaderComponent } from '../../shared/loader.component';
import { SkillPickerComponent } from './skill-picker.component';

type SectionKind = 'experience' | 'education' | 'project';

@Component({
  selector: 'app-student-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoaderComponent, 
    ReactiveFormsModule,
    EmptyStateComponent,
    IconComponent,
    LinkButtonComponent,
    MaskIconComponent,
    SelectComponent,
    SkillPickerComponent,
    EditButtonComponent,
  ],
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

      <!-- ============ 1. Header ============ -->
      @if (!loading()) {
        <div class="profile-hero card" @fadeSlideIn>
          <div class="hero-cover"></div>
          <div class="hero-body">
            @if (profile()?.profilePhotoUrl) {
              <img class="hero-avatar photo" [src]="profile()!.profilePhotoUrl" alt="Profile photo" />
            } @else {
              <span class="hero-avatar" [attr.aria-hidden]="true">{{ initials() }}</span>
            }
            <div class="hero-info">
              <h1>{{ fullName() || 'Your profile' }}</h1>
              @if (profile()?.headline) {
                <p class="hero-headline">{{ profile()!.headline }}</p>
              }
              <div class="hero-meta">
                @if (profile()?.university) {
                  <span><app-icon name="building" [size]="14" /> {{ profile()!.university }}</span>
                }
                @if (profile()?.graduationYear) {
                  <span><app-icon name="graduation-cap" [size]="14" /> Class of {{ profile()!.graduationYear }}</span>
                }
              </div>
              <div class="hero-links">
                @if (profile()?.linkedInUrl) {
                  <a [href]="profile()!.linkedInUrl" target="_blank" rel="noopener" aria-label="LinkedIn profile" title="LinkedIn">
                    <app-icon name="linkedin" [size]="17" />
                  </a>
                }
                @if (profile()?.githubUrl) {
                  <a [href]="profile()!.githubUrl" target="_blank" rel="noopener" aria-label="GitHub profile" title="GitHub">
                    <app-icon name="github" [size]="17" />
                  </a>
                }
                @if (profile()?.portfolioUrl) {
                  <a [href]="profile()!.portfolioUrl" target="_blank" rel="noopener" aria-label="Portfolio website" title="Portfolio">
                    <app-icon name="globe" [size]="17" />
                  </a>
                }
              </div>
            </div>
            <div class="hero-ring" [attr.aria-label]="completeness() + '% complete'">
              <svg viewBox="0 0 76 76" class="ring">
                <circle class="ring-bg" cx="38" cy="38" r="32" />
                <circle class="ring-fg" cx="38" cy="38" r="32"
                  [style.stroke-dasharray]="ringCirc" [style.stroke-dashoffset]="ringOffset()" />
              </svg>
              <div class="ring-center">
                <span class="ring-pct">{{ completeness() }}%</span>
                <span class="ring-lbl">done</span>
              </div>
            </div>
          </div>
          @if (completeness() < 100) {
            <p class="hero-nudge"><app-icon name="arrow-right" [size]="14" /> {{ nudge() }}</p>
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

        <!-- ============ 2. About / basics ============ -->
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
              <input id="firstName" class="field-input" formControlName="firstName" [class.invalid]="invalid('firstName')" />
              @if (invalid('firstName')) {
                <div class="field-error" @fadeSlideIn>First name is required.</div>
              }
            </div>
            <div class="field">
              <label class="label" for="lastName">Last name</label>
              <input id="lastName" class="field-input" formControlName="lastName" [class.invalid]="invalid('lastName')" />
              @if (invalid('lastName')) {
                <div class="field-error" @fadeSlideIn>Last name is required.</div>
              }
            </div>
          </div>

          <div class="field">
            <label class="label" for="headline">Headline <span class="opt-hint">(a one-line tagline, e.g. “CS student building clean UIs”)</span></label>
            <input id="headline" class="field-input" formControlName="headline" maxlength="150"
              placeholder="What should companies remember about you?" />
          </div>

          <div class="form-row">
            <div class="field">
              <span class="label">Faculty <span class="opt-hint">(Ss. Cyril and Methodius University)</span></span>
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
              <span class="label">Graduation year</span>
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
              placeholder="A few sentences about you and your interests…"></textarea>
          </div>

          <div class="field">
            <label class="label" for="profilePhotoUrl">Profile photo URL <span class="opt-hint">(paste a link to a hosted image)</span></label>
            <input id="profilePhotoUrl" class="field-input" formControlName="profilePhotoUrl" type="url" placeholder="https://…" />
          </div>

          <div class="form-row">
            <div class="field">
              <label class="label" for="linkedInUrl">LinkedIn</label>
              <input id="linkedInUrl" class="field-input" formControlName="linkedInUrl" type="url" placeholder="https://linkedin.com/in/…" />
            </div>
            <div class="field">
              <label class="label" for="githubUrl">GitHub</label>
              <input id="githubUrl" class="field-input" formControlName="githubUrl" type="url" placeholder="https://github.com/…" />
            </div>
          </div>

          <div class="field">
            <label class="label" for="portfolioUrl">Portfolio / website</label>
            <input id="portfolioUrl" class="field-input" formControlName="portfolioUrl" type="url" placeholder="https://…" />
          </div>

          <app-link-button type="submit" [disabled]="saving()">
            @if (saving()) {
              <app-loader mode="inline" label="Saving" /> Saving…
            } @else {
              Save profile
            }
          </app-link-button>
        </form>

        <!-- ============ 3. Experience ============ -->
        <div class="card">
          <div class="section-head">
            <span class="section-ic"><app-icon name="briefcase" [size]="17" /></span>
            <div class="grow">
              <h2>Experience</h2>
              <p class="section-sub">Internships, part-time work, volunteering.</p>
            </div>
            @if (editing() !== 'experience') {
              <app-link-button size="sm" variant="standard-secondary" (pressed)="startAdd('experience')">
                <app-icon name="plus" [size]="15" /> Add
              </app-link-button>
            }
          </div>

          @if (editing() === 'experience') {
            <form class="entry-form" [formGroup]="expForm" (ngSubmit)="saveExperience()" novalidate @fadeSlideIn>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="expTitle">Title</label>
                  <input id="expTitle" class="field-input" formControlName="title" placeholder="e.g. Frontend Intern" />
                </div>
                <div class="field">
                  <label class="label" for="expCompany">Company</label>
                  <input id="expCompany" class="field-input" formControlName="company" placeholder="e.g. Netcetera" />
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="expLocation">Location <span class="opt-hint">(optional)</span></label>
                  <input id="expLocation" class="field-input" formControlName="location" placeholder="e.g. Skopje" />
                </div>
                <div class="field">
                  <label class="label" for="expStart">Start</label>
                  <input id="expStart" class="field-input" formControlName="startMonth" type="month" />
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="expEnd">End</label>
                  <input id="expEnd" class="field-input" formControlName="endMonth" type="month"
                    [attr.disabled]="expForm.controls.current.value ? '' : null" />
                </div>
                <div class="field checkbox-field">
                  <label class="check-label">
                    <input type="checkbox" formControlName="current" (change)="onCurrentToggle(expForm)" />
                    I currently work here
                  </label>
                </div>
              </div>
              <div class="field">
                <label class="label" for="expDesc">Description <span class="opt-hint">(optional)</span></label>
                <textarea id="expDesc" class="textarea short" formControlName="description"
                  placeholder="What did you build or learn?"></textarea>
              </div>
              <div class="entry-actions">
                <app-link-button size="sm" type="submit" [disabled]="sectionSaving() || expForm.invalid">
                  {{ sectionSaving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add experience' }}
                </app-link-button>
                <app-link-button size="sm" variant="standard-secondary" (pressed)="cancelEdit()">Cancel</app-link-button>
              </div>
            </form>
          }

          <div class="entries">
            @for (exp of profile()?.experiences ?? []; track exp.id) {
              <div class="entry" @fadeSlideIn>
                <div class="entry-main">
                  <h3>{{ exp.title }}</h3>
                  <p class="entry-org">
                    {{ exp.company }}
                    @if (exp.location) { <span class="soft">· {{ exp.location }}</span> }
                  </p>
                  <p class="entry-dates">{{ formatRange(exp.startDate, exp.endDate) }}</p>
                  @if (exp.description) { <p class="entry-desc">{{ exp.description }}</p> }
                </div>
                <div class="entry-tools">
                  <app-edit-button [ariaLabel]="'Edit ' + exp.title" (edit)="startEditExperience(exp)" />
                  <button type="button" class="danger" (click)="deleteEntry('experience', exp.id)" [attr.aria-label]="'Delete ' + exp.title">
                    <app-icon name="trash" [size]="15" />
                  </button>
                </div>
              </div>
            } @empty {
              @if (editing() !== 'experience') {
                <p class="soft empty-line">No experience added yet.</p>
              }
            }
          </div>
        </div>

        <!-- ============ 4. Education ============ -->
        <div class="card">
          <div class="section-head">
            <span class="section-ic"><app-icon name="graduation-cap" [size]="17" /></span>
            <div class="grow">
              <h2>Education</h2>
              <p class="section-sub">Degrees, exchanges, courses.</p>
            </div>
            @if (editing() !== 'education') {
              <app-link-button size="sm" variant="standard-secondary" (pressed)="startAdd('education')">
                <app-icon name="plus" [size]="15" /> Add
              </app-link-button>
            }
          </div>

          @if (editing() === 'education') {
            <form class="entry-form" [formGroup]="eduForm" (ngSubmit)="saveEducation()" novalidate @fadeSlideIn>
              <div class="field">
                <label class="label" for="eduInst">Institution</label>
                <input id="eduInst" class="field-input" formControlName="institution" placeholder="e.g. UKIM, FINKI" />
              </div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="eduDegree">Degree <span class="opt-hint">(optional)</span></label>
                  <input id="eduDegree" class="field-input" formControlName="degree" placeholder="e.g. BSc" />
                </div>
                <div class="field">
                  <label class="label" for="eduField">Field of study <span class="opt-hint">(optional)</span></label>
                  <input id="eduField" class="field-input" formControlName="fieldOfStudy" placeholder="e.g. Software Engineering" />
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="eduStart">Start</label>
                  <input id="eduStart" class="field-input" formControlName="startMonth" type="month" />
                </div>
                <div class="field">
                  <label class="label" for="eduEnd">End</label>
                  <input id="eduEnd" class="field-input" formControlName="endMonth" type="month"
                    [attr.disabled]="eduForm.controls.current.value ? '' : null" />
                </div>
              </div>
              <div class="field checkbox-field">
                <label class="check-label">
                  <input type="checkbox" formControlName="current" (change)="onCurrentToggle(eduForm)" />
                  I'm currently studying here
                </label>
              </div>
              <div class="entry-actions">
                <app-link-button size="sm" type="submit" [disabled]="sectionSaving() || eduForm.invalid">
                  {{ sectionSaving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add education' }}
                </app-link-button>
                <app-link-button size="sm" variant="standard-secondary" (pressed)="cancelEdit()">Cancel</app-link-button>
              </div>
            </form>
          }

          <div class="entries">
            @for (edu of profile()?.educations ?? []; track edu.id) {
              <div class="entry" @fadeSlideIn>
                <div class="entry-main">
                  <h3>{{ edu.institution }}</h3>
                  @if (edu.degree || edu.fieldOfStudy) {
                    <p class="entry-org">
                      {{ edu.degree }}@if (edu.degree && edu.fieldOfStudy) {, }{{ edu.fieldOfStudy }}
                    </p>
                  }
                  <p class="entry-dates">{{ formatRange(edu.startDate, edu.endDate) }}</p>
                </div>
                <div class="entry-tools">
                  <app-edit-button [ariaLabel]="'Edit ' + edu.institution" (edit)="startEditEducation(edu)" />
                  <button type="button" class="danger" (click)="deleteEntry('education', edu.id)" [attr.aria-label]="'Delete ' + edu.institution">
                    <app-icon name="trash" [size]="15" />
                  </button>
                </div>
              </div>
            } @empty {
              @if (editing() !== 'education') {
                <p class="soft empty-line">No education added yet.</p>
              }
            }
          </div>
        </div>

        <!-- ============ 5. Projects ============ -->
        <div class="card">
          <div class="section-head">
            <span class="section-ic"><app-mask-icon name="projects" [size]="17" /></span>
            <div class="grow">
              <h2>Projects</h2>
              <p class="section-sub">Side projects, coursework, hackathons.</p>
            </div>
            @if (editing() !== 'project') {
              <app-link-button size="sm" variant="standard-secondary" (pressed)="startAdd('project')">
                <app-icon name="plus" [size]="15" /> Add
              </app-link-button>
            }
          </div>

          @if (editing() === 'project') {
            <form class="entry-form" [formGroup]="projForm" (ngSubmit)="saveProject()" novalidate @fadeSlideIn>
              <div class="form-row">
                <div class="field">
                  <label class="label" for="projTitle">Title</label>
                  <input id="projTitle" class="field-input" formControlName="title" placeholder="e.g. Recipe finder app" />
                </div>
                <div class="field">
                  <label class="label" for="projUrl">Link <span class="opt-hint">(optional)</span></label>
                  <input id="projUrl" class="field-input" formControlName="url" type="url" placeholder="https://github.com/…" />
                </div>
              </div>
              <div class="field">
                <label class="label" for="projStack">Tech stack <span class="opt-hint">(comma-separated, e.g. Angular, .NET, Postgres)</span></label>
                <input id="projStack" class="field-input" formControlName="techStack" placeholder="Angular, .NET, Postgres" />
              </div>
              <div class="field">
                <label class="label" for="projDesc">Description <span class="opt-hint">(optional)</span></label>
                <textarea id="projDesc" class="textarea short" formControlName="description"
                  placeholder="What does it do? What was interesting about building it?"></textarea>
              </div>
              <div class="entry-actions">
                <app-link-button size="sm" type="submit" [disabled]="sectionSaving() || projForm.invalid">
                  {{ sectionSaving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add project' }}
                </app-link-button>
                <app-link-button size="sm" variant="standard-secondary" (pressed)="cancelEdit()">Cancel</app-link-button>
              </div>
            </form>
          }

          <div class="entries">
            @for (proj of profile()?.projects ?? []; track proj.id) {
              <div class="entry" @fadeSlideIn>
                <div class="entry-main">
                  <h3>
                    {{ proj.title }}
                    @if (proj.url) {
                      <a class="proj-link" [href]="proj.url" target="_blank" rel="noopener" [attr.aria-label]="proj.title + ' link'">
                        <app-icon name="external-link" [size]="14" />
                      </a>
                    }
                  </h3>
                  @if (proj.description) { <p class="entry-desc">{{ proj.description }}</p> }
                  @if (proj.techStack) {
                    <div class="stack-tags">
                      @for (tech of splitStack(proj.techStack); track tech) {
                        <span class="stack-tag">{{ tech }}</span>
                      }
                    </div>
                  }
                </div>
                <div class="entry-tools">
                  <app-edit-button [ariaLabel]="'Edit ' + proj.title" (edit)="startEditProject(proj)" />
                  <button type="button" class="danger" (click)="deleteEntry('project', proj.id)" [attr.aria-label]="'Delete ' + proj.title">
                    <app-icon name="trash" [size]="15" />
                  </button>
                </div>
              </div>
            } @empty {
              @if (editing() !== 'project') {
                <p class="soft empty-line">No projects added yet.</p>
              }
            }
          </div>
        </div>

        <!-- ============ 6. Skills ============ -->
        <div class="card">
          <div class="section-head">
            <span class="section-ic green"><app-mask-icon name="skills" [size]="17" /></span>
            <div>
              <h2>Your skills</h2>
              <p class="section-sub">Tag your strengths so companies spot the match.</p>
            </div>
          </div>
          <app-skill-picker
            [allSkills]="allSkills()"
            [selected]="profile()?.skills ?? []"
            (added)="addSkill($event)"
            (removed)="removeSkill($event)"
          />
        </div>

        <!-- ============ 7. Resume / CV ============ -->
        <div class="card resume-card">
          <div class="resume-body">
            <span class="resume-ic"><app-mask-icon name="cv" [size]="24" /></span>
            <div class="grow">
              <h2>Resume</h2>
              @if (profile()?.cvUrl) {
                <p class="section-sub">
                  Your CV is linked.
                  @if (isUploadedCv(profile()!.cvUrl)) {
                    <button type="button" class="resume-link resume-link-btn" (click)="openCv()" [disabled]="cvOpening()">
                      {{ cvOpening() ? 'Opening…' : 'open it' }} <app-icon name="external-link" [size]="12" />
                    </button>
                  } @else {
                    <a class="resume-link" [href]="profile()!.cvUrl" target="_blank" rel="noopener">open it <app-icon name="external-link" [size]="12" /></a>
                  }
                </p>
              } @else {
                <p class="section-sub">Link your CV so companies can read the full story.</p>
              }
            </div>
          </div>
          <div class="resume-row">
            <input class="field-input grow" type="url" placeholder="https://link-to-your-cv.pdf"
              [value]="cvUrlDraft()" (input)="cvUrlDraft.set($any($event.target).value)" />
            <app-link-button size="sm" (pressed)="saveCv()" [disabled]="saving()">
              <app-icon name="link" [size]="15" />
              {{ profile()?.cvUrl ? 'Update link' : 'Add link' }}
            </app-link-button>
          </div>

          <div class="resume-or"><span>or</span></div>

          <div class="resume-row">
            <input #cvFileInput type="file" class="file-input" accept=".pdf,.doc,.docx"
              (change)="onCvFileSelected($event)" [disabled]="cvUploading()" />
            <app-link-button size="sm" variant="standard-secondary"
              [disabled]="cvUploading()" (pressed)="cvFileInput.click()">
              <app-mask-icon name="cv" [size]="15" />
              {{ cvUploading() ? 'Uploading…' : 'Import CV' }}
            </app-link-button>
            <span class="resume-hint">PDF, DOC or DOCX, up to 5&nbsp;MB</span>
          </div>
        </div>
      }
      }
    </div>
  `,
  styles: [
    `
      .narrow { max-width: 720px; }
      .card { margin-bottom: var(--space-lg); }
      .grow { flex: 1; min-width: 0; }
      .soft { color: var(--color-text-soft); }

      /* ---- Hero ---- */
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
        box-shadow: 0 10px 24px -10px rgba(29, 77, 36, 0.6);
      }

      .hero-avatar.photo { object-fit: cover; }

      .hero-info { flex: 1; min-width: 0; padding-top: 48px; }
      .hero-info h1 { font-size: 1.6rem; margin: 0 0 2px; letter-spacing: -0.02em; }

      .hero-headline {
        margin: 0 0 8px;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--color-text-soft);
      }

      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        font-size: 0.85rem;
        color: var(--color-text-soft);
        font-weight: 500;
      }

      .hero-meta span { display: inline-flex; align-items: center; gap: 5px; }

      .hero-links { display: flex; gap: 6px; margin-top: 10px; }

      .hero-links a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 9px;
        color: var(--color-primary);
        background: rgba(29, 77, 36, 0.1);
        transition: background 150ms ease, color 150ms ease;
        cursor: pointer;
      }

      .hero-links a:hover { background: var(--color-primary); color: var(--color-on-primary); }

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
        background: rgba(29, 77, 36, 0.1);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .section-ic.green { background: #dcfce7; color: #166534; }
      .section-head h2 { font-size: 1.15rem; margin: 0; }
      .section-sub { margin: 1px 0 0; font-size: 0.85rem; color: var(--color-text-soft); }
      .card h2 { font-size: 1.125rem; }

      /* ---- Section entries ---- */
      .entries { display: flex; flex-direction: column; }

      .entry {
        display: flex;
        gap: var(--space-md);
        padding: var(--space-md) 0;
        border-top: 1px solid var(--color-border);
      }

      .entry:first-child { border-top: none; padding-top: 0; }

      .entry-main { flex: 1; min-width: 0; }
      .entry-main h3 {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 2px;
        font-size: 1rem;
        font-weight: 700;
      }

      .entry-org { margin: 0 0 2px; font-size: 0.9rem; font-weight: 600; color: var(--color-foreground); }
      .entry-dates { margin: 0; font-size: 0.82rem; color: var(--color-text-soft); font-weight: 500; }
      .entry-desc { margin: 8px 0 0; font-size: 0.9rem; color: var(--color-text-soft); white-space: pre-line; }

      .entry-tools { display: flex; gap: 4px; align-items: flex-start; flex-shrink: 0; }

      .entry-tools button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: none;
        background: transparent;
        border-radius: 8px;
        color: var(--color-text-soft);
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease;
      }

      .entry-tools button:hover { background: var(--color-muted); color: var(--color-primary); }
      /* Resting state is the neutral tool colour above; red only appears on hover. */
      .entry-tools button.danger:hover {
        background: var(--color-destructive-bg);
        color: var(--color-destructive);
      }

      .proj-link { display: inline-flex; color: var(--color-primary); }
      .proj-link:hover { color: var(--color-secondary); }

      .stack-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

      .stack-tag {
        padding: 3px 10px;
        border-radius: 999px;
        background: var(--color-muted);
        color: var(--color-primary);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .empty-line { margin: 0; font-size: 0.9rem; }

      /* ---- Inline entry form ---- */
      .entry-form {
        padding: var(--space-md);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-md, 8px);
        margin-bottom: var(--space-md);
        background: var(--color-background);
      }

      .entry-actions { display: flex; gap: var(--space-sm); margin-top: 4px; }

      .textarea.short { min-height: 74px; }

      .checkbox-field { display: flex; align-items: flex-end; padding-bottom: 10px; }

      .check-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-foreground);
        cursor: pointer;
      }

      .check-label input { width: 16px; height: 16px; accent-color: var(--color-primary); cursor: pointer; }

      /* ---- Resume card ---- */
      .resume-card { border: 1px solid var(--color-border); }

      .resume-body {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        margin-bottom: var(--space-md);
      }

      .resume-ic {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: rgba(29, 77, 36, 0.1);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .resume-link {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--color-primary);
        font-weight: 600;
      }

      .resume-link-btn {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        cursor: pointer;
      }

      .resume-link-btn:disabled { opacity: 0.6; cursor: default; }

      .resume-row { display: flex; gap: var(--space-sm); align-items: center; }

      .resume-or {
        display: flex;
        align-items: center;
        text-align: center;
        color: var(--color-text-soft);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: var(--space-sm) 0;
      }

      .resume-or::before, .resume-or::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
      .resume-or span { padding: 0 var(--space-sm); }

      .file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

      .resume-hint { font-size: 0.8125rem; color: var(--color-text-soft); }

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
        box-shadow: 0 0 0 3px rgba(29, 77, 36, 0.13);
      }

      .opt-hint { font-weight: 400; color: var(--color-text-soft); }

      @media (max-width: 520px) {
        .hero-body { flex-wrap: wrap; }
        .hero-ring { margin-left: auto; }
        .resume-row { flex-wrap: wrap; }
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
  protected readonly sectionSaving = signal(false);

  /** Which section has an open editor, and which entry (null = adding new). */
  protected readonly editing = signal<SectionKind | null>(null);
  protected readonly editingId = signal<number | null>(null);

  protected readonly cvUrlDraft = signal('');
  protected readonly cvUploading = signal(false);
  protected readonly cvOpening = signal(false);

  private static readonly MaxCvUploadBytes = 5 * 1024 * 1024;
  private static readonly AllowedCvExtensions = ['.pdf', '.doc', '.docx'];

  /** Circumference of the completeness ring (r = 32). */
  protected readonly ringCirc = 2 * Math.PI * 32;

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

  /** Share of profile sections filled in — drives the ring + nudge. */
  protected readonly completeness = computed(() => {
    const p = this.profile();
    if (!p) return 0;
    const parts = [
      !!p.firstName && !!p.lastName,
      !!p.university,
      !!(p.headline && p.headline.trim()),
      !!(p.bio && p.bio.trim()),
      (p.skills?.length ?? 0) > 0,
      (p.experiences?.length ?? 0) > 0,
      (p.educations?.length ?? 0) > 0,
      (p.projects?.length ?? 0) > 0,
      !!p.cvUrl,
      !!(p.linkedInUrl || p.githubUrl || p.portfolioUrl),
    ];
    return Math.round((parts.filter(Boolean).length / parts.length) * 100);
  });

  protected readonly ringOffset = computed(() => this.ringCirc * (1 - this.completeness() / 100));

  /** Friendly next-step suggestion based on the biggest gap. */
  protected readonly nudge = computed(() => {
    const p = this.profile();
    if (!p) return '';
    if (!(p.headline && p.headline.trim())) return 'Add a headline, a one-liner that sticks.';
    if (!p.university) return 'Add your faculty so companies know where you study.';
    if (!(p.bio && p.bio.trim())) return 'Write a short bio. It’s your chance to stand out.';
    if ((p.skills?.length ?? 0) === 0) return 'Add a few skills so companies can spot the match.';
    if ((p.experiences?.length ?? 0) === 0) return 'Add an experience entry. Even volunteering counts.';
    if ((p.educations?.length ?? 0) === 0) return 'Add your education so the timeline is complete.';
    if ((p.projects?.length ?? 0) === 0) return 'Show off a project. Code speaks louder than grades.';
    if (!p.cvUrl) return 'Link your CV to finish your profile.';
    return 'Almost there. A fuller profile gets more replies.';
  });

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    university: [''],
    graduationYear: [null as number | null, [Validators.min(1950), Validators.max(2100)]],
    bio: [''],
    headline: [''],
    profilePhotoUrl: [''],
    linkedInUrl: [''],
    githubUrl: [''],
    portfolioUrl: [''],
  });

  protected readonly expForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    company: ['', Validators.required],
    location: [''],
    startMonth: ['', Validators.required],
    endMonth: [''],
    current: [false],
    description: [''],
  });

  protected readonly eduForm = this.fb.nonNullable.group({
    institution: ['', Validators.required],
    degree: [''],
    fieldOfStudy: [''],
    startMonth: ['', Validators.required],
    endMonth: [''],
    current: [false],
  });

  protected readonly projForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    url: [''],
    techStack: [''],
    description: [''],
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
        this.applyProfile(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });

    this.skillService.getAll().subscribe((skills) => this.allSkills.set(skills));
  }

  private applyProfile(profile: StudentProfile): void {
    this.profile.set(profile);
    this.form.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      university: profile.university ?? '',
      graduationYear: profile.graduationYear,
      bio: profile.bio ?? '',
      headline: profile.headline ?? '',
      profilePhotoUrl: profile.profilePhotoUrl ?? '',
      linkedInUrl: profile.linkedInUrl ?? '',
      githubUrl: profile.githubUrl ?? '',
      portfolioUrl: profile.portfolioUrl ?? '',
    });
    this.universitySignal.set(profile.university ?? '');
    this.gradYearSignal.set(profile.graduationYear);
    this.cvUrlDraft.set(profile.cvUrl ?? '');
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  // ---- About form ----

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
        headline: value.headline || null,
        profilePhotoUrl: value.profilePhotoUrl || null,
        linkedInUrl: value.linkedInUrl || null,
        githubUrl: value.githubUrl || null,
        portfolioUrl: value.portfolioUrl || null,
        cvUrl: this.profile()?.cvUrl ?? null,
      })
      .subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.saving.set(false);
          this.toast.success('Profile saved');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(apiErrorMessage(err, 'Could not save your profile.'));
        },
      });
  }

  protected saveCv(): void {
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.studentService
      .updateMe({
        firstName: value.firstName,
        lastName: value.lastName,
        university: value.university || null,
        graduationYear: value.graduationYear,
        bio: value.bio || null,
        headline: value.headline || null,
        profilePhotoUrl: value.profilePhotoUrl || null,
        linkedInUrl: value.linkedInUrl || null,
        githubUrl: value.githubUrl || null,
        portfolioUrl: value.portfolioUrl || null,
        cvUrl: this.cvUrlDraft().trim() || null,
      })
      .subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.saving.set(false);
          this.toast.success(profile.cvUrl ? 'Resume link saved' : 'Resume link removed');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(apiErrorMessage(err, 'Could not save the resume link.'));
        },
      });
  }

  protected onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Allow re-selecting the same file later regardless of outcome.
    input.value = '';
    if (!file) {
      return;
    }

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!StudentProfileComponent.AllowedCvExtensions.includes(extension)) {
      this.toast.error('Your CV must be a PDF, DOC or DOCX file.');
      return;
    }
    if (file.size > StudentProfileComponent.MaxCvUploadBytes) {
      this.toast.error('That file is too large. The limit is 5 MB.');
      return;
    }

    this.cvUploading.set(true);
    this.studentService.uploadCv(file).subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.cvUploading.set(false);
        this.toast.success('CV uploaded');
      },
      error: (err) => {
        this.cvUploading.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not upload your CV.'));
      },
    });
  }

  /** An uploaded CV is stored under /uploads; an externally-pasted link is not. */
  protected isUploadedCv(cvUrl: string | null): boolean {
    return !!cvUrl && cvUrl.startsWith('/uploads/');
  }

  /** Uploaded CVs are behind an authenticated endpoint, so fetch as a blob (the
   *  auth interceptor adds the token) and open the object URL in a new tab. */
  protected openCv(): void {
    const id = this.profile()?.id;
    if (id === undefined) {
      return;
    }
    this.cvOpening.set(true);
    this.studentService.downloadCvFile(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        // Give the new tab time to read the blob before revoking.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.cvOpening.set(false);
      },
      error: (err) => {
        this.cvOpening.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not open your CV.'));
      },
    });
  }

  // ---- Section editors ----

  protected startAdd(kind: SectionKind): void {
    this.editing.set(kind);
    this.editingId.set(null);
    if (kind === 'experience') this.expForm.reset();
    else if (kind === 'education') this.eduForm.reset();
    else this.projForm.reset();
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.editingId.set(null);
  }

  protected onCurrentToggle(form: typeof this.expForm | typeof this.eduForm): void {
    if (form.controls.current.value) {
      form.controls.endMonth.setValue('');
    }
  }

  protected startEditExperience(exp: ExperienceEntry): void {
    this.editing.set('experience');
    this.editingId.set(exp.id);
    this.expForm.setValue({
      title: exp.title,
      company: exp.company,
      location: exp.location ?? '',
      startMonth: exp.startDate.slice(0, 7),
      endMonth: exp.endDate ? exp.endDate.slice(0, 7) : '',
      current: exp.endDate === null,
      description: exp.description ?? '',
    });
  }

  protected startEditEducation(edu: EducationEntry): void {
    this.editing.set('education');
    this.editingId.set(edu.id);
    this.eduForm.setValue({
      institution: edu.institution,
      degree: edu.degree ?? '',
      fieldOfStudy: edu.fieldOfStudy ?? '',
      startMonth: edu.startDate.slice(0, 7),
      endMonth: edu.endDate ? edu.endDate.slice(0, 7) : '',
      current: edu.endDate === null,
    });
  }

  protected startEditProject(proj: ProjectEntry): void {
    this.editing.set('project');
    this.editingId.set(proj.id);
    this.projForm.setValue({
      title: proj.title,
      url: proj.url ?? '',
      techStack: proj.techStack ?? '',
      description: proj.description ?? '',
    });
  }

  protected saveExperience(): void {
    if (this.expForm.invalid) {
      this.expForm.markAllAsTouched();
      return;
    }
    const v = this.expForm.getRawValue();
    const request = {
      title: v.title,
      company: v.company,
      location: v.location || null,
      startDate: `${v.startMonth}-01`,
      endDate: v.current || !v.endMonth ? null : `${v.endMonth}-01`,
      description: v.description || null,
    };
    const id = this.editingId();
    this.runSectionSave(
      id === null
        ? this.studentService.addExperience(request)
        : this.studentService.updateExperience(id, request),
      id === null ? 'Experience added' : 'Experience updated',
    );
  }

  protected saveEducation(): void {
    if (this.eduForm.invalid) {
      this.eduForm.markAllAsTouched();
      return;
    }
    const v = this.eduForm.getRawValue();
    const request = {
      institution: v.institution,
      degree: v.degree || null,
      fieldOfStudy: v.fieldOfStudy || null,
      startDate: `${v.startMonth}-01`,
      endDate: v.current || !v.endMonth ? null : `${v.endMonth}-01`,
    };
    const id = this.editingId();
    this.runSectionSave(
      id === null
        ? this.studentService.addEducation(request)
        : this.studentService.updateEducation(id, request),
      id === null ? 'Education added' : 'Education updated',
    );
  }

  protected saveProject(): void {
    if (this.projForm.invalid) {
      this.projForm.markAllAsTouched();
      return;
    }
    const v = this.projForm.getRawValue();
    const request = {
      title: v.title,
      url: v.url || null,
      techStack: v.techStack || null,
      description: v.description || null,
    };
    const id = this.editingId();
    this.runSectionSave(
      id === null
        ? this.studentService.addProject(request)
        : this.studentService.updateProject(id, request),
      id === null ? 'Project added' : 'Project updated',
    );
  }

  protected deleteEntry(kind: SectionKind, id: number): void {
    const call =
      kind === 'experience'
        ? this.studentService.deleteExperience(id)
        : kind === 'education'
          ? this.studentService.deleteEducation(id)
          : this.studentService.deleteProject(id);
    this.runSectionSave(call, 'Entry removed');
  }

  private runSectionSave(call: ReturnType<StudentService['getMe']>, successMessage: string): void {
    this.sectionSaving.set(true);
    call.subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.sectionSaving.set(false);
        this.cancelEdit();
        this.toast.success(successMessage);
      },
      error: (err) => {
        this.sectionSaving.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not save that entry.'));
      },
    });
  }

  // ---- Skills ----

  protected addSkill(skill: SkillResponse): void {
    this.skillService.assign(skill.id).subscribe({
      next: (profile) => this.applyProfile(profile),
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not add that skill.')),
    });
  }

  protected removeSkill(skill: SkillResponse): void {
    this.skillService.remove(skill.id).subscribe({
      next: (profile) => this.applyProfile(profile),
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not remove that skill.')),
    });
  }

  // ---- Display helpers ----

  protected splitStack(stack: string): string[] {
    return stack.split(',').map((t) => t.trim()).filter(Boolean);
  }

  protected formatRange(start: string, end: string | null): string {
    return `${this.formatMonth(start)} to ${end ? this.formatMonth(end) : 'Present'}`;
  }

  private formatMonth(isoDate: string): string {
    const [year, month] = isoDate.split('-').map(Number);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[(month ?? 1) - 1]} ${year}`;
  }
}
