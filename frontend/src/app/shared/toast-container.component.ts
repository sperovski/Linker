import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { toastAnim } from './animations';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  animations: [toastAnim],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class.toast-error]="toast.kind === 'error'" @toastAnim>
          <app-icon [name]="toast.kind === 'success' ? 'check' : 'x'" [size]="16" />
          <span>{{ toast.message }}</span>
          <button
            type="button"
            class="toast-close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        bottom: var(--space-lg);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        z-index: 100;
        width: min(420px, calc(100vw - 32px));
      }

      .toast {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        background: var(--color-foreground);
        color: #fff;
        padding: 12px 16px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        font-size: 0.9rem;
        font-weight: 500;
      }

      .toast-error {
        background: var(--color-destructive);
      }

      .toast-close {
        margin-left: auto;
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        display: inline-flex;
        padding: 2px;
        opacity: 0.8;
      }

      .toast-close:hover {
        opacity: 1;
      }
    `,
  ],
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
