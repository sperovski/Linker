import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { NotificationItem } from '../models';
import { NotificationService } from './notification.service';

const BASE = `${environment.apiBaseUrl}/notifications`;

function item(id: number, isRead: boolean): NotificationItem {
  return { id, message: `n${id}`, link: null, isRead, createdAtUtc: '2026-07-20T00:00:00Z' };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let controller: HttpTestingController;

  /** Seeds the service via its own refresh() so state matches real usage. */
  function seed(items: NotificationItem[]) {
    service.refresh();
    controller
      .expectOne(BASE)
      .flush({ items, unreadCount: items.filter((n) => !n.isRead).length });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  describe('markRead', () => {
    it('flips the item and drops the count immediately', () => {
      seed([item(1, false), item(2, false)]);

      service.markRead(1);

      expect(service.items().find((n) => n.id === 1)!.isRead).toBe(true);
      expect(service.unreadCount()).toBe(1);
      controller.expectOne(`${BASE}/1/read`).flush({});
    });

    it('rolls the item and count back when the server rejects it', () => {
      seed([item(1, false), item(2, false)]);

      service.markRead(1);
      controller
        .expectOne(`${BASE}/1/read`)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(service.items().find((n) => n.id === 1)!.isRead).toBe(false);
      expect(service.unreadCount()).toBe(2);
    });

    it('ignores an already-read notification', () => {
      seed([item(1, true)]);

      service.markRead(1);

      expect(service.unreadCount()).toBe(0);
      controller.expectNone(`${BASE}/1/read`);
    });
  });

  describe('markAllRead', () => {
    it('clears everything immediately', () => {
      seed([item(1, false), item(2, false)]);

      service.markAllRead();

      expect(service.items().every((n) => n.isRead)).toBe(true);
      expect(service.unreadCount()).toBe(0);
      controller.expectOne(`${BASE}/read-all`).flush({});
    });

    it('restores the previous state when the server rejects it', () => {
      seed([item(1, false), item(2, true), item(3, false)]);

      service.markAllRead();
      controller
        .expectOne(`${BASE}/read-all`)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(service.items().map((n) => n.isRead)).toEqual([false, true, false]);
      expect(service.unreadCount()).toBe(2);
    });

    it('does nothing when there is nothing unread', () => {
      seed([item(1, true)]);

      service.markAllRead();

      controller.expectNone(`${BASE}/read-all`);
    });
  });
});
