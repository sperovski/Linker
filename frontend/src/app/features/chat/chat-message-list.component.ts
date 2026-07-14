import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ChatMessageResponse } from '../../core/models';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IconComponent } from '../../shared/icon.component';
import { relativeTime } from '../../shared/dates';

/**
 * Scrollable message pane. Sticks to the bottom while the user is near it,
 * offers a "New messages" chip when they've scrolled up, and loads older pages
 * when they near the top — preserving the scroll position across the prepend.
 */
@Component({
  selector: 'app-chat-message-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CompanyLogoComponent, EmptyStateComponent, IconComponent],
  template: `
    <div class="scroll" #scroll (scroll)="onScroll()">
      @if (hasMore()) {
        <div class="load-older">
          <button type="button" (click)="loadOlder.emit()" [disabled]="loadingOlder()">
            {{ loadingOlder() ? 'Loading…' : 'Load earlier messages' }}
          </button>
        </div>
      }

      @if (messages().length === 0 && !loading()) {
        <app-empty-state
          variant="inbox"
          title="No messages yet"
          message="Be the first to say hello. Messages appear here in real time."
        />
      }

      @for (message of messages(); track message.id) {
        <div class="row" [class.own]="message.senderId === currentUserId()">
          @if (message.senderId !== currentUserId()) {
            <app-company-logo [name]="message.senderName" [size]="32" />
          }
          <div class="bubble-wrap">
            <div class="meta">
              <span class="sender">{{ message.senderId === currentUserId() ? 'You' : message.senderName }}</span>
              <span class="time">{{ stamp(message.createdAt) }}</span>
            </div>
            <div class="bubble">{{ message.body }}</div>
          </div>
          <div class="actions">
            @if (message.senderId !== currentUserId()) {
              <button type="button" class="action" title="Report message" (click)="report.emit(message)">
                <app-icon name="flag" [size]="14" />
              </button>
            }
            @if (canDelete()) {
              <button type="button" class="action danger" title="Delete message" (click)="remove.emit(message)">
                <app-icon name="trash" [size]="14" />
              </button>
            }
          </div>
        </div>
      }
    </div>

    @if (showNewChip()) {
      <button type="button" class="new-chip" (click)="scrollToBottom()">
        New messages
        <app-icon name="chevron-down" [size]="14" />
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        min-height: 0;
        flex: 1;
      }

      .scroll {
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-md);
      }

      .load-older {
        text-align: center;
      }

      .load-older button {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-soft);
        border-radius: 999px;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 6px 14px;
        cursor: pointer;
      }

      .load-older button:hover:not(:disabled) {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }

      .row {
        display: flex;
        align-items: flex-end;
        gap: var(--space-sm);
        max-width: 78%;
      }

      .row.own {
        margin-left: auto;
        flex-direction: row-reverse;
      }

      .bubble-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .row.own .bubble-wrap { align-items: flex-end; }

      .meta {
        display: flex;
        gap: var(--space-sm);
        align-items: baseline;
        padding: 0 4px;
      }

      .sender {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-foreground);
      }

      .time {
        font-size: 0.6875rem;
        color: var(--color-text-soft);
      }

      .bubble {
        background: var(--color-muted);
        color: var(--color-foreground);
        border-radius: var(--radius-lg);
        border-bottom-left-radius: 4px;
        padding: var(--space-sm) var(--space-md);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 0.9375rem;
        line-height: 1.5;
      }

      .row.own .bubble {
        background: var(--color-primary);
        color: #ffffff;
        border-bottom-left-radius: var(--radius-lg);
        border-bottom-right-radius: 4px;
      }

      .actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 150ms ease;
        padding-bottom: 6px;
      }

      .row:hover .actions { opacity: 1; }

      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: var(--color-surface);
        color: var(--color-text-soft);
        cursor: pointer;
      }

      .action:hover { color: var(--color-primary); border-color: var(--color-primary); }
      .action.danger:hover { color: var(--color-destructive); border-color: var(--color-destructive); }

      .new-chip {
        position: absolute;
        bottom: var(--space-md);
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        border-radius: 999px;
        background: var(--color-primary);
        color: #ffffff;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 8px 16px;
        cursor: pointer;
        box-shadow: var(--shadow-lg);
      }
    `,
  ],
})
export class ChatMessageListComponent {
  readonly messages = input.required<ChatMessageResponse[]>();
  readonly currentUserId = input.required<number | null>();
  readonly canDelete = input(false);
  readonly hasMore = input(false);
  readonly loading = input(false);
  readonly loadingOlder = input(false);

  readonly loadOlder = output<void>();
  readonly report = output<ChatMessageResponse>();
  readonly remove = output<ChatMessageResponse>();

  private readonly scrollRef = viewChild.required<ElementRef<HTMLElement>>('scroll');

  protected readonly showNewChip = signal(false);

  private lastCount = 0;
  private lastFirstId: number | null = null;
  private prependScrollHeight = 0;

  constructor() {
    // Runs after each render where `messages` changed: keeps the view pinned
    // to the bottom for appends, or restores the offset after a prepend.
    afterRenderEffect(() => {
      const messages = this.messages();
      const el = this.scrollRef().nativeElement;

      const firstId = messages.length > 0 ? messages[0].id : null;
      const prepended = this.lastFirstId !== null && firstId !== this.lastFirstId && messages.length > this.lastCount;
      const appended = messages.length > this.lastCount && !prepended;
      const reset = messages.length <= this.lastCount || this.lastCount === 0;

      if (prepended) {
        el.scrollTop = el.scrollHeight - this.prependScrollHeight;
      } else if (reset || (appended && this.nearBottom(el))) {
        el.scrollTop = el.scrollHeight;
        this.showNewChip.set(false);
      } else if (appended) {
        this.showNewChip.set(true);
      }

      this.lastCount = messages.length;
      this.lastFirstId = firstId;
    });
  }

  /** Parent calls this right before prepending an older page. */
  markPrepend(): void {
    this.prependScrollHeight = this.scrollRef().nativeElement.scrollHeight;
  }

  scrollToBottom(): void {
    const el = this.scrollRef().nativeElement;
    el.scrollTop = el.scrollHeight;
    this.showNewChip.set(false);
  }

  protected onScroll(): void {
    const el = this.scrollRef().nativeElement;
    if (this.nearBottom(el)) {
      this.showNewChip.set(false);
    }
    if (el.scrollTop <= 100 && this.hasMore() && !this.loadingOlder()) {
      this.markPrepend();
      this.loadOlder.emit();
    }
  }

  protected stamp(dateIso: string): string {
    return relativeTime(ensureUtc(dateIso));
  }

  private nearBottom(el: HTMLElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }
}

/** The API serialises UTC timestamps; append Z when the offset is missing. */
function ensureUtc(dateIso: string): string {
  return /Z|[+-]\d\d:\d\d$/.test(dateIso) ? dateIso : `${dateIso}Z`;
}
