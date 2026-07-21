import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../core/api/notification.service';
import { IconComponent } from './icon.component';
import { dropdownExpand } from './animations';
import { relativeTime } from './dates';

/**
 * Header bell: shows an unread badge and a dropdown of recent notifications.
 * Polls the feed on an interval and refreshes when opened.
 */
@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  animations: [dropdownExpand],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="bell-wrap">
      <button
        type="button"
        class="bell-btn"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="notifications.unreadCount() + ' unread notifications'"
      >
        <app-icon name="bell" [size]="19" />
        @if (notifications.hasUnread()) {
          <span class="badge">{{ notifications.unreadCount() > 9 ? '9+' : notifications.unreadCount() }}</span>
        }
      </button>

      @if (open()) {
        <div class="panel" @dropdownExpand role="menu">
          <div class="panel-head">
            <span>Notifications</span>
            @if (notifications.hasUnread()) {
              <button type="button" class="link-btn" (click)="markAllRead()">Mark all read</button>
            }
          </div>
          @if (notifications.items().length === 0) {
            <p class="empty">You're all caught up.</p>
          } @else {
            <ul class="list">
              @for (n of notifications.items(); track n.id) {
                <li
                  class="item"
                  [class.unread]="!n.isRead"
                  tabindex="0"
                  (click)="go(n.id, n.link)"
                  (keydown.enter)="go(n.id, n.link)"
                >
                  @if (!n.isRead) {
                    <span class="dot" aria-hidden="true"></span>
                  }
                  <div class="body">
                    <span class="msg">{{ n.message }}</span>
                    <span class="time">{{ relativeTime(n.createdAtUtc) }}</span>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bell-wrap { position: relative; display: inline-flex; }

      .bell-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-foreground);
        cursor: pointer;
        transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
      }

      .bell-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

      .badge {
        position: absolute;
        top: -3px;
        right: -3px;
        min-width: 17px;
        height: 17px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--color-destructive);
        color: #fff;
        font-size: 0.65rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--color-surface);
      }

      .panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        /* Grows out of the bell in the top-right corner it hangs from. */
        transform-origin: top right;
        width: 320px;
        max-width: 90vw;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        z-index: 60;
        overflow: hidden;
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        font-weight: 700;
        font-size: 0.9rem;
        border-bottom: 1px solid var(--color-border);
      }

      .link-btn {
        background: none;
        border: none;
        color: var(--color-primary);
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }

      .empty { padding: var(--space-lg); text-align: center; color: var(--color-text-soft); font-size: 0.875rem; margin: 0; }

      .list {
        list-style: none;
        margin: 0;
        padding: 6px;
        max-height: 360px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
        /* Thin scrollbar whose thumb only appears while hovering the list. */
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
      }

      .list:hover { scrollbar-color: var(--color-border) transparent; }
      .list::-webkit-scrollbar { width: 8px; }
      .list::-webkit-scrollbar-track { background: transparent; }
      .list::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; }
      .list:hover::-webkit-scrollbar-thumb { background: var(--color-border); }

      .item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        padding: 10px 12px;
        cursor: pointer;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        transition: background-color 140ms ease, border-color 140ms ease;
      }

      .item:hover { background: var(--color-muted); }
      .item.unread { background: var(--brand-wash); border-color: var(--brand-border); }

      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-primary); margin-top: 6px; flex-shrink: 0; }
      .item:not(.unread) .body { padding-left: 15px; }

      .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .msg { font-size: 0.8438rem; line-height: 1.35; color: var(--color-foreground); }
      .time { font-size: 0.72rem; color: var(--color-text-soft); font-weight: 500; }
    `,
  ],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  protected readonly notifications = inject(NotificationService);
  protected readonly relativeTime = relativeTime;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.notifications.refresh();
    // Light polling so the badge stays roughly live without a socket.
    this.timer = setInterval(() => this.notifications.refresh(), 60000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    const next = !this.open();
    this.open.set(next);
    if (next) this.notifications.refresh();
  }

  protected go(id: number, link: string | null): void {
    this.notifications.markRead(id);
    this.open.set(false);
    if (link) this.router.navigateByUrl(link);
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
