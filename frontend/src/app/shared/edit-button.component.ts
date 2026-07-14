import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Animated edit button. A green pill showing a label and a pencil that rests at
 * the right; on hover the label fades out and the pencil slides to the centre.
 * A hard offset shadow gives it a physical raise, and pressing it nudges the
 * button down-right while the shadow shrinks.
 *
 * Colours come from the design tokens (brand green, never the reference purple).
 * The icon is centred with a transform rather than the reference's width-tuned
 * `right: 43%`, so the label can be any length without the pencil drifting.
 */
@Component({
  selector: 'app-edit-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="edit-btn"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() ?? label()"
      (click)="onClick()"
    >
      <span class="edit-label">{{ label() }}</span>
      <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  `,
  styles: [
    `
      .edit-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        /* Sized to sit alongside the app's small (sm) buttons. */
        min-width: 74px;
        height: 34px;
        border: none;
        padding: 0 14px;
        background-color: var(--brand);
        color: var(--color-on-primary);
        font-family: var(--font-sans);
        font-weight: 600;
        font-size: 0.82rem;
        cursor: pointer;
        border-radius: 8px;
        box-shadow: 3px 3px 0 var(--brand-deep);
        transition: color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease,
          background-color 0.3s ease;
      }

      .edit-label {
        transition: color 0.3s ease;
      }

      .edit-icon {
        width: 13px;
        height: 13px;
        position: absolute;
        right: 14px;
        transition: right 0.3s ease, transform 0.3s ease;
      }

      /* Hover: label disappears, pencil glides to the centre. */
      .edit-btn:hover:not(:disabled) {
        color: transparent;
      }

      .edit-btn:hover:not(:disabled) .edit-icon {
        right: 50%;
        transform: translateX(50%);
      }

      /* Press: settle down-right, shadow shrinks to match. */
      .edit-btn:active:not(:disabled) {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 var(--brand-deep);
      }

      .edit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (prefers-reduced-motion: reduce) {
        .edit-btn,
        .edit-label,
        .edit-icon {
          transition: none;
        }
        /* Keep colour + press feedback, drop the slide and the label fade. */
        .edit-btn:hover:not(:disabled) {
          color: var(--color-on-primary);
        }
        .edit-btn:hover:not(:disabled) .edit-icon {
          right: 20px;
          transform: none;
        }
      }
    `,
  ],
})
export class EditButtonComponent {
  readonly label = input('Edit');
  /** Overrides the button's aria-label; defaults to the visible label. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly edit = output<void>();

  protected onClick(): void {
    if (!this.disabled()) {
      this.edit.emit();
    }
  }
}
