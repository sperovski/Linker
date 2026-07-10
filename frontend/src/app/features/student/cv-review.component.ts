import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CvService } from '../../core/api/cv.service';
import { InternshipService } from '../../core/api/internship.service';
import { CvReviewResponse } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { IconComponent } from '../../shared/icon.component';
import { MaskIconComponent } from '../../shared/mask-icon.component';
import { SelectComponent, SelectOption } from '../../shared/select.component';
import { LinkButtonComponent } from '../../shared/link-button.component';

@Component({
  selector: 'app-cv-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, MaskIconComponent, SelectComponent, LinkButtonComponent],
  template: `
    <div class="container page">
      <div class="page-header">
        <div>
          <span class="eyebrow">AI CV review</span>
          <h1>Rate my CV</h1>
          <p class="page-sub">Upload your CV — we scan it and give an instant score with specific, honest feedback.</p>
        </div>
      </div>

      <div class="review-grid">
        <div class="card input-card">
          <label
            class="dropzone"
            [class.dragging]="dragOver()"
            (dragover)="onDragOver($event)"
            (dragleave)="dragOver.set(false)"
            (drop)="onDrop($event)"
          >
            <input
              type="file"
              class="file-input"
              accept=".pdf,.docx,.txt"
              (change)="onFileInput($event)"
              [disabled]="loading()"
            />
            <span class="dz-icon"><app-mask-icon name="cv" [size]="26" /></span>
            @if (fileName()) {
              <span class="dz-title">{{ fileName() }}</span>
              <span class="dz-sub">Scanned — click or drop another to replace</span>
            } @else {
              <span class="dz-title">Import your CV</span>
              <span class="dz-sub">Drag &amp; drop or click — PDF, DOCX or TXT, up to 5&nbsp;MB</span>
            }
          </label>

          <div class="or"><span>or paste it below</span></div>

          <label class="label" for="cv">Your CV</label>
          <textarea
            id="cv"
            class="textarea cv-text"
            [ngModel]="cvText()"
            (ngModelChange)="cvText.set($event)"
            placeholder="Paste the full text of your CV here — experience, education, projects, skills…"
          ></textarea>
          <div class="wc" [class.warn]="wordCount() > 0 && wordCount() < 50">{{ wordCount() }} words</div>

          <label class="label" for="target">Tailor to a role <span class="opt">(optional)</span></label>
          <div class="field-select">
            <app-select
              [options]="targetOptions()"
              [value]="targetId()"
              maskIcon="generate-review"
              ariaLabel="Target role"
              (valueChange)="targetId.set($event)"
            />
          </div>

          <app-link-button
            block
            [disabled]="loading() || wordCount() < 50"
            (pressed)="rate()"
          >
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span> Analysing…
            } @else {
              <app-icon name="target" [size]="16" /> Rate my CV
            }
          </app-link-button>
          @if (wordCount() > 0 && wordCount() < 50) {
            <p class="hint">Add a bit more — at least 50 words — for a meaningful review.</p>
          }
        </div>

        <div class="card result-card">
          @if (!result() && !loading()) {
            <div class="placeholder">
              <span class="ph-icon"><app-mask-icon name="cv" [size]="28" /></span>
              <h3>Your score appears here</h3>
              <p>The analyser looks at structure, skill coverage, quantified impact and clarity.</p>
            </div>
          } @else if (loading()) {
            <div class="placeholder">
              <span class="ring-skeleton"></span>
              <p>Reading your CV…</p>
            </div>
          } @else if (result(); as r) {
            <div class="result">
              <div class="ring-wrap">
                <svg viewBox="0 0 120 120" class="ring">
                  <circle class="ring-bg" cx="60" cy="60" r="52" />
                  <circle
                    class="ring-fg"
                    [class]="band()"
                    cx="60"
                    cy="60"
                    r="52"
                    [style.stroke-dasharray]="circumference"
                    [style.stroke-dashoffset]="dashOffset()"
                  />
                </svg>
                <div class="ring-center">
                  <span class="ring-score">{{ displayScore() }}</span>
                  <span class="ring-out">/ 100</span>
                </div>
              </div>

              <div class="result-head">
                <span class="source" [class.ai]="r.source === 'ai'">
                  <app-icon [name]="r.source === 'ai' ? 'target' : 'bar-chart'" [size]="12" />
                  {{ r.source === 'ai' ? 'AI review' : 'Instant analysis' }}
                </span>
                @if (r.targetRole) {
                  <span class="target-chip">for {{ r.targetRole }}</span>
                }
              </div>

              @if (r.roleFit !== null && r.targetRole) {
                <div class="rolefit" [class]="fitBand()">
                  <div class="rolefit-head">
                    <span class="rolefit-label">Fit for {{ r.targetRole }}</span>
                    <span class="rolefit-pct">{{ r.roleFit }}%</span>
                  </div>
                  <div class="rolefit-track">
                    <div class="rolefit-bar" [style.width.%]="r.roleFit"></div>
                  </div>
                </div>
              }

              <p class="summary">{{ r.summary }}</p>

              @if (r.matchedSkills.length || r.missingSkills.length) {
                <div class="skills-block">
                  @if (r.matchedSkills.length) {
                    <div class="skills-row">
                      <span class="skills-label">Skills found</span>
                      <div class="chips">
                        @for (s of r.matchedSkills; track s) {
                          <span class="chip have"><app-icon name="check" [size]="12" /> {{ s }}</span>
                        }
                      </div>
                    </div>
                  }
                  @if (r.missingSkills.length) {
                    <div class="skills-row">
                      <span class="skills-label">Worth adding</span>
                      <div class="chips">
                        @for (s of r.missingSkills; track s) {
                          <span class="chip miss">{{ s }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="feedback">
                <div class="fb-col">
                  <h4><app-icon name="check" [size]="15" /> Strengths</h4>
                  <ul>
                    @for (s of r.strengths; track s) {
                      <li>{{ s }}</li>
                    }
                  </ul>
                </div>
                <div class="fb-col">
                  <h4><app-icon name="arrow-right" [size]="15" /> Improve</h4>
                  <ul>
                    @for (s of r.improvements; track s) {
                      <li>{{ s }}</li>
                    }
                  </ul>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .review-grid {
        display: grid;
        grid-template-columns: 1fr 1.1fr;
        gap: var(--space-lg);
        align-items: start;
      }

      @media (max-width: 900px) { .review-grid { grid-template-columns: 1fr; } }

      .dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 4px;
        padding: var(--space-lg);
        border: 1.5px dashed var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-background);
        cursor: pointer;
        transition: border-color 160ms ease, background-color 160ms ease, transform 120ms ease;
      }

      .dropzone:hover { border-color: var(--color-primary); background: rgba(79, 70, 229, 0.03); }
      .dropzone.dragging { border-color: var(--color-primary); background: rgba(79, 70, 229, 0.07); transform: scale(1.01); }

      .file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

      .dz-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 48px; height: 48px; border-radius: var(--radius-md);
        background: rgba(79, 70, 229, 0.1); color: var(--color-primary); margin-bottom: 4px;
      }
      .dz-title { font-weight: 700; color: var(--color-foreground); word-break: break-word; }
      .dz-sub { font-size: 0.8125rem; color: var(--color-text-soft); }

      .or {
        display: flex; align-items: center; text-align: center;
        color: var(--color-text-soft); font-size: 0.78rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.05em;
        margin: var(--space-md) 0;
      }
      .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
      .or span { padding: 0 var(--space-sm); }

      .cv-text { min-height: 260px; resize: vertical; font-size: 0.9rem; line-height: 1.5; }

      .wc { text-align: right; font-size: 0.75rem; color: var(--color-text-soft); margin: 4px 0 var(--space-md); }
      .wc.warn { color: #b45309; }

      .opt { font-weight: 400; color: var(--color-text-soft); }

      .field-select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: 0 12px;
        margin-bottom: var(--space-md);
      }
      .field-select:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); }

      .hint { font-size: 0.8125rem; color: var(--color-text-soft); margin: var(--space-sm) 0 0; text-align: center; }

      .spinner {
        width: 15px; height: 15px; border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff;
        display: inline-block; animation: spin 700ms linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .result-card { min-height: 420px; }

      .placeholder { text-align: center; padding: var(--space-2xl) var(--space-md); color: var(--color-text-soft); }
      .placeholder h3 { color: var(--color-foreground); margin-bottom: var(--space-xs); }
      .ph-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 56px; height: 56px; border-radius: var(--radius-lg);
        background: var(--color-muted); color: var(--color-text-soft); margin-bottom: var(--space-md);
      }
      .ring-skeleton {
        display: inline-block; width: 120px; height: 120px; border-radius: 50%;
        border: 10px solid var(--color-muted); border-top-color: var(--color-primary);
        animation: spin 900ms linear infinite; margin-bottom: var(--space-md);
      }

      .ring-wrap { position: relative; width: 160px; height: 160px; margin: 0 auto var(--space-md); }
      .ring { width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-bg { fill: none; stroke: var(--color-muted); stroke-width: 10; }
      .ring-fg {
        fill: none; stroke-width: 10; stroke-linecap: round;
        transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ring-fg.strong { stroke: #16a34a; }
      .ring-fg.medium { stroke: #d97706; }
      .ring-fg.low { stroke: #dc2626; }

      .ring-center {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
      }
      .ring-score { font-size: 2.6rem; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
      .ring-out { font-size: 0.8rem; color: var(--color-text-soft); font-weight: 600; }

      .result-head { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); margin-bottom: var(--space-sm); flex-wrap: wrap; }
      .source {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 999px;
        background: var(--color-muted); color: var(--color-text-soft);
      }
      .source.ai { background: rgba(124, 58, 237, 0.12); color: #6d28d9; }
      .target-chip { font-size: 0.8rem; color: var(--color-text-soft); font-weight: 600; }

      .rolefit { margin: 0 auto var(--space-md); max-width: 380px; }
      .rolefit-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
      .rolefit-label { font-size: 0.8125rem; font-weight: 600; color: var(--color-text-soft); }
      .rolefit-pct { font-size: 1.05rem; font-weight: 800; }
      .rolefit-track { height: 8px; border-radius: 999px; background: var(--color-muted); overflow: hidden; }
      .rolefit-bar { height: 100%; border-radius: 999px; transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1); }
      .rolefit.strong .rolefit-pct { color: #16a34a; }
      .rolefit.strong .rolefit-bar { background: #16a34a; }
      .rolefit.medium .rolefit-pct { color: #d97706; }
      .rolefit.medium .rolefit-bar { background: #d97706; }
      .rolefit.low .rolefit-pct { color: #dc2626; }
      .rolefit.low .rolefit-bar { background: #dc2626; }
      @media (prefers-reduced-motion: reduce) { .rolefit-bar { transition: none; } }

      .summary { text-align: center; color: var(--color-foreground); margin-bottom: var(--space-md); }

      .skills-block { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
      .skills-row { display: flex; gap: var(--space-sm); align-items: baseline; flex-wrap: wrap; }
      .skills-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-soft); min-width: 92px; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--color-border); }
      .chip.have { color: #166534; background: #dcfce7; border-color: #bbf7d0; }
      .chip.miss { color: var(--color-text-soft); background: var(--color-muted); }

      .feedback { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
      @media (max-width: 560px) { .feedback { grid-template-columns: 1fr; } }
      .fb-col h4 { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; margin-bottom: var(--space-sm); }
      .fb-col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
      .fb-col li { font-size: 0.875rem; color: var(--color-foreground); line-height: 1.45; padding-left: 14px; position: relative; }
      .fb-col li::before { content: ''; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--color-border); }

      @media (prefers-reduced-motion: reduce) {
        .ring-fg { transition: none; }
        .spinner, .ring-skeleton { animation: none; }
      }
    `,
  ],
})
export class CvReviewComponent implements OnInit {
  private readonly cvService = inject(CvService);
  private readonly internshipService = inject(InternshipService);
  private readonly toast = inject(ToastService);

  protected readonly circumference = 2 * Math.PI * 52;

  protected readonly cvText = signal('');
  protected readonly targetId = signal('');
  protected readonly targetOptions = signal<SelectOption[]>([
    { value: '', label: 'General review (no specific role)' },
  ]);

  protected readonly result = signal<CvReviewResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly displayScore = signal(0);
  protected readonly fileName = signal('');
  protected readonly dragOver = signal(false);

  protected readonly wordCount = computed(() => {
    const t = this.cvText().trim();
    return t ? t.split(/\s+/).length : 0;
  });

  protected readonly band = computed(() => {
    const s = this.result()?.score ?? 0;
    if (s >= 67) return 'strong';
    if (s >= 34) return 'medium';
    return 'low';
  });

  protected readonly fitBand = computed(() => {
    const f = this.result()?.roleFit ?? 0;
    if (f >= 67) return 'strong';
    if (f >= 34) return 'medium';
    return 'low';
  });

  protected readonly dashOffset = computed(
    () => this.circumference * (1 - this.displayScore() / 100),
  );

  ngOnInit(): void {
    // 50 is the server's max page size. The target-role picker therefore shows the
    // 50 best-matching open roles rather than every one; a searchable picker would
    // be the fix if the catalogue ever outgrows that.
    this.internshipService.search({ pageSize: 50 }).subscribe({
      next: (result) =>
        this.targetOptions.set([
          { value: '', label: 'General review (no specific role)' },
          ...result.items.map((i) => ({ value: String(i.id), label: `${i.title} — ${i.companyName}` })),
        ]),
      error: () => {},
    });
  }

  protected rate(): void {
    this.loading.set(true);
    this.result.set(null);
    this.displayScore.set(0);

    const internshipId = this.targetId() ? Number(this.targetId()) : null;
    this.cvService.review({ cvText: this.cvText(), internshipId }).subscribe({
      next: (res) => this.applyResult(res),
      error: (err) => {
        this.loading.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not analyse your CV.'));
      },
    });
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.uploadFile(file);
    }
    // Allow re-selecting the same file later.
    input.value = '';
  }

  private uploadFile(file: File): void {
    this.loading.set(true);
    this.result.set(null);
    this.displayScore.set(0);

    const internshipId = this.targetId() ? Number(this.targetId()) : null;
    this.cvService.reviewFile(file, internshipId).subscribe({
      next: (res) => {
        this.fileName.set(res.fileName);
        this.cvText.set(res.extractedText);
        this.applyResult(res.review);
        this.toast.success('CV scanned');
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(apiErrorMessage(err, 'Could not read that file.'));
      },
    });
  }

  private applyResult(res: CvReviewResponse): void {
    this.loading.set(false);
    this.result.set(res);
    this.animateScore(res.score);
  }

  private animateScore(target: number): void {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.displayScore.set(target);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayScore.set(Math.round(target * eased));
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }
}
