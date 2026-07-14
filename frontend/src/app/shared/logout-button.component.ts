import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Animated logout button. A round red icon at rest that expands into a pill on
 * hover: the door-exit icon shifts left and a "Logout" label slides in. Pressing
 * it nudges down-right.
 *
 * Red is kept on purpose — logout is destructive — mapped to the danger token
 * rather than the reference's bright #FF4141. The icon is a proper door-exit,
 * not the plus sign the reference comment mentions.
 */
@Component({
  selector: 'app-logout-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="logout-btn"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() ?? label()"
      (click)="onClick()"
    >
      <span class="logout-sign">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
      </span>
      <span class="logout-text">{{ label() }}</span>
    </button>
  `,
  styles: [
    `
      .logout-btn {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 45px;
        height: 45px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        background-color: var(--color-destructive);
        color: #ffffff;
        box-shadow: var(--shadow-md);
        transition: width 0.3s ease, border-radius 0.3s ease, transform 0.3s ease;
      }

      .logout-sign {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: width 0.3s ease, padding 0.3s ease;
      }

      .logout-sign svg {
        width: 17px;
        height: 17px;
      }

      .logout-text {
        position: absolute;
        right: 0;
        width: 0;
        opacity: 0;
        color: #ffffff;
        font-family: var(--font-sans);
        font-size: 1rem;
        font-weight: 600;
        white-space: nowrap;
        transition: opacity 0.3s ease, width 0.3s ease, padding 0.3s ease;
      }

      /* Hover: grow into a pill, icon moves left, label fades in on the right. */
      .logout-btn:hover:not(:disabled) {
        width: 125px;
        border-radius: 40px;
      }

      .logout-btn:hover:not(:disabled) .logout-sign {
        width: 30%;
        padding-left: 20px;
      }

      .logout-btn:hover:not(:disabled) .logout-text {
        opacity: 1;
        width: 70%;
        padding-right: 10px;
      }

      .logout-btn:active:not(:disabled) {
        transform: translate(2px, 2px);
      }

      .logout-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (prefers-reduced-motion: reduce) {
        .logout-btn,
        .logout-sign,
        .logout-text {
          transition: none;
        }
        /* Stay circular; keep colour + press, drop the expand and slide. */
        .logout-btn:hover:not(:disabled) {
          width: 45px;
          border-radius: 50%;
        }
        .logout-btn:hover:not(:disabled) .logout-sign {
          width: 100%;
          padding-left: 0;
        }
        .logout-btn:hover:not(:disabled) .logout-text {
          opacity: 0;
          width: 0;
        }
      }
    `,
  ],
})
export class LogoutButtonComponent {
  readonly label = input('Logout');
  /** Overrides the button's aria-label; defaults to the visible label. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loggedOut = output<void>();

  protected onClick(): void {
    if (!this.disabled()) {
      this.loggedOut.emit();
    }
  }
}
