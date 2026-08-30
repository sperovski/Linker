import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon.component';

const MAX_LENGTH = 2000;

/**
 * Message input: Enter sends, Shift+Enter inserts a newline. The parent owns
 * sending; on failure it leaves the draft intact so the user can retry.
 */
@Component({
  selector: 'app-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    @if (canPost()) {
      <form class="composer" (submit)="submit($event)">
        <textarea
          [(ngModel)]="draftValue"
          name="message"
          rows="1"
          placeholder="Write a message…"
          [maxlength]="maxLength"
          [disabled]="disabled()"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <div class="composer-side">
          @if (remaining() <= 200) {
            <span class="counter" [class.warn]="remaining() <= 50">{{ remaining() }}</span>
          }
          <button
            type="submit"
            class="send"
            [disabled]="disabled() || !draftValue.trim()"
            aria-label="Send message"
          >
            <app-icon name="send" [size]="18" />
          </button>
        </div>
      </form>
    } @else {
      <div class="readonly-bar">{{ readOnlyReason() }}</div>
    }
  `,
  styles: [
    `
      .composer {
        display: flex;
        align-items: flex-end;
        gap: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        padding: var(--space-sm) var(--space-md);
      }

      .composer:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(29, 77, 36, 0.12);
      }

      textarea {
        flex: 1;
        border: none;
        outline: none;
        resize: none;
        font: inherit;
        color: var(--color-foreground);
        background: transparent;
        max-height: 120px;
        min-height: 24px;
        line-height: 1.5;
      }

      textarea:disabled { color: var(--color-text-soft); }

      .composer-side {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .counter {
        font-size: 0.75rem;
        color: var(--color-text-soft);
        font-variant-numeric: tabular-nums;
      }

      .counter.warn { color: var(--color-destructive); }

      .send {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 999px;
        background: var(--color-primary);
        color: #ffffff;
        cursor: pointer;
        transition: background 150ms ease, opacity 150ms ease;
      }

      .send:hover:not(:disabled) { background: var(--color-secondary); }
      .send:disabled { opacity: 0.45; cursor: default; }

      .readonly-bar {
        text-align: center;
        color: var(--color-text-soft);
        font-size: 0.875rem;
        background: var(--color-muted);
        border-radius: var(--radius-lg);
        padding: var(--space-sm) var(--space-md);
      }
    `,
  ],
})
export class ChatComposerComponent {
  readonly canPost = input.required<boolean>();
  /** Why the composer is hidden — an accurate reason beats a generic one the reader can't act on. */
  readonly readOnlyReason = input('You have read-only access to this room.');
  readonly disabled = input(false);
  readonly send = output<string>();

  protected readonly maxLength = MAX_LENGTH;
  protected draftValue = '';

  protected remaining(): number {
    return MAX_LENGTH - this.draftValue.length;
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) {
      return; // Shift+Enter keeps the default newline behaviour.
    }
    event.preventDefault();
    this.emitSend();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.emitSend();
  }

  /** Called by the parent after a successful send. */
  clear(): void {
    this.draftValue = '';
  }

  private emitSend(): void {
    const body = this.draftValue.trim();
    if (!body || this.disabled()) {
      return;
    }
    this.send.emit(body);
  }
}
