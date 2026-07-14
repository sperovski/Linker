import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/api/chat.service';
import { ToastService } from '../../core/toast.service';
import { apiErrorMessage } from '../../shared/api-error';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { ChatMessageResponse } from '../../core/models';
import { HttpErrorResponse } from '@angular/common/http';

const MAX_REASON_LENGTH = 300;

/** Fixed-overlay panel for reporting a chat message with a reason. */
@Component({
  selector: 'app-report-message-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LinkButtonComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="panel" role="dialog" aria-modal="true" aria-label="Report message" (click)="$event.stopPropagation()">
        <h3>Report message</h3>
        <blockquote>{{ message().body }}</blockquote>
        <label for="report-reason">Why are you reporting this?</label>
        <textarea
          id="report-reason"
          [(ngModel)]="reason"
          name="reason"
          rows="3"
          [maxlength]="maxLength"
          placeholder="Tell us what's wrong with this message…"
        ></textarea>
        <div class="actions">
          <app-link-button size="sm" (pressed)="closed.emit()">Cancel</app-link-button>
          <app-link-button
            size="sm"
            variant="primary"
            [disabled]="submitting() || !reason.trim()"
            (pressed)="submit()"
          >
            {{ submitting() ? 'Reporting…' : 'Report' }}
          </app-link-button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(30, 27, 75, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: var(--space-md);
      }

      .panel {
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        padding: var(--space-lg);
        width: 100%;
        max-width: 440px;
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      h3 { margin: 0; }

      blockquote {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-muted);
        border-left: 3px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-soft);
        font-size: 0.875rem;
        max-height: 90px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-foreground);
      }

      textarea {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--space-sm);
        font: inherit;
        resize: vertical;
      }

      textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(29, 77, 36, 0.12);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-sm);
        margin-top: var(--space-xs);
      }
    `,
  ],
})
export class ReportMessageDialogComponent {
  private readonly chat = inject(ChatService);
  private readonly toast = inject(ToastService);

  readonly message = input.required<ChatMessageResponse>();
  readonly closed = output<void>();

  protected readonly maxLength = MAX_REASON_LENGTH;
  protected readonly submitting = signal(false);
  protected reason = '';

  protected submit(): void {
    const reason = this.reason.trim();
    if (!reason || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.chat.reportMessage(this.message().id, reason).subscribe({
      next: () => {
        this.toast.success('Message reported. Thanks for keeping chat safe.');
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.toast.error('You already reported this message.');
          this.closed.emit();
          return;
        }
        this.toast.error(apiErrorMessage(error, 'Could not report the message.'));
      },
    });
  }
}
