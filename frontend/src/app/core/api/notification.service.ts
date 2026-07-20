import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationItem, NotificationList } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;

  private readonly itemsSignal = signal<NotificationItem[]>([]);
  private readonly unreadSignal = signal(0);

  readonly items = this.itemsSignal.asReadonly();
  readonly unreadCount = this.unreadSignal.asReadonly();
  readonly hasUnread = computed(() => this.unreadSignal() > 0);

  /** Pull the latest feed + unread count into the signals. */
  refresh(): void {
    this.http.get<NotificationList>(this.baseUrl).subscribe({
      next: (list) => {
        this.itemsSignal.set(list.items);
        this.unreadSignal.set(list.unreadCount);
      },
      error: () => {},
    });
  }

  markRead(id: number): void {
    const wasUnread = this.itemsSignal().some((n) => n.id === id && !n.isRead);
    if (!wasUnread) {
      return;
    }

    // Optimistic: drop the unread count and flip the item immediately, then
    // put it back if the server never agreed.
    this.itemsSignal.update((items) =>
      items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    this.unreadSignal.update((c) => Math.max(0, c - 1));

    this.http.post(`${this.baseUrl}/${id}/read`, {}).subscribe({
      error: () => {
        this.itemsSignal.update((items) =>
          items.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
        );
        this.unreadSignal.update((c) => c + 1);
      },
    });
  }

  markAllRead(): void {
    const previousItems = this.itemsSignal();
    const previousUnread = this.unreadSignal();
    if (previousUnread === 0) {
      return;
    }

    this.itemsSignal.update((items) => items.map((n) => ({ ...n, isRead: true })));
    this.unreadSignal.set(0);

    this.http.post(`${this.baseUrl}/read-all`, {}).subscribe({
      error: () => {
        this.itemsSignal.set(previousItems);
        this.unreadSignal.set(previousUnread);
      },
    });
  }

  clear(): void {
    this.itemsSignal.set([]);
    this.unreadSignal.set(0);
  }
}
