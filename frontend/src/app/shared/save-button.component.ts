import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { InternshipService } from '../core/api/internship.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

/**
 * Bookmark toggle for an internship. Only renders for logged-in students.
 * Updates optimistically and emits (savedChange) so parent lists can react
 * (e.g. the Saved page removing a card on un-save).
 */
@Component({
  selector: 'app-save-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (auth.isStudent()) {
      <button
        type="button"
        class="save-btn"
        [class.saved]="saved()"
        [class.compact]="compact()"
        [disabled]="pending()"
        (click)="toggle($event)"
        [attr.aria-pressed]="saved()"
        [attr.aria-label]="saved() ? 'Remove from saved' : 'Save internship'"
      >
        <app-icon name="bookmark" [size]="compact() ? 16 : 18" [filled]="saved()" />
        @if (!compact()) {
          <span>{{ saved() ? 'Saved' : 'Save' }}</span>
        }
      </button>
    }
  `,
  styles: [
    `
      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text-soft);
        font-family: var(--font-sans);
        font-weight: 600;
        font-size: 0.9375rem;
        padding: 10px 16px;
        cursor: pointer;
        transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease, transform 120ms ease;
      }

      .save-btn:hover { color: var(--color-primary); border-color: var(--color-primary); }
      .save-btn:active { transform: scale(0.96); }
      .save-btn.saved { color: var(--color-primary); border-color: var(--color-primary); background: rgba(29, 77, 36, 0.06); }
      .save-btn:disabled { opacity: 0.6; cursor: default; }

      .save-btn.compact {
        padding: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(4px);
      }
    `,
  ],
})
export class SaveButtonComponent {
  protected readonly auth = inject(AuthService);
  private readonly internshipService = inject(InternshipService);
  private readonly toast = inject(ToastService);

  readonly internshipId = input.required<number>();
  readonly initialSaved = input(false);
  /** Icon-only pill, for overlaying on cards. */
  readonly compact = input(false);
  readonly savedChange = output<boolean>();

  protected readonly saved = signal(false);
  protected readonly pending = signal(false);

  constructor() {
    effect(() => this.saved.set(this.initialSaved()));
  }

  protected toggle(event: Event): void {
    // Cards are links; keep the click from navigating.
    event.preventDefault();
    event.stopPropagation();
    if (this.pending()) {
      return;
    }

    const next = !this.saved();
    this.saved.set(next);
    this.pending.set(true);

    const request$ = next
      ? this.internshipService.save(this.internshipId())
      : this.internshipService.unsave(this.internshipId());

    request$.subscribe({
      next: () => {
        this.pending.set(false);
        this.savedChange.emit(next);
        this.toast.success(next ? 'Saved to your list' : 'Removed from saved');
      },
      error: () => {
        // Roll back on failure.
        this.saved.set(!next);
        this.pending.set(false);
        this.toast.error('Could not update your saved list');
      },
    });
  }
}
