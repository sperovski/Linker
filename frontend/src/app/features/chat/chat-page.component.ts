import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatService } from '../../core/api/chat.service';
import { CompanyService } from '../../core/api/company.service';
import { ChatHubService } from '../../core/chat-hub.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { ChatMessageResponse, ChatRoomResponse } from '../../core/models';
import { ChatMessageListComponent } from './chat-message-list.component';
import { ChatComposerComponent } from './chat-composer.component';
import { ReportMessageDialogComponent } from './report-message-dialog.component';
import { IconComponent } from '../../shared/icon.component';
import { LoaderComponent } from '../../shared/loader.component';
import { apiErrorMessage } from '../../shared/api-error';
import { firstValueFrom } from 'rxjs';

const ROOMS_STORAGE_KEY = 'linker_chat_rooms';
const MAX_REMEMBERED_ROOMS = 10;
const PAGE_SIZE = 50;

/**
 * Chat page: room switcher on the left, live message pane on the right.
 * There is no "list my rooms" API — the switcher is General plus contextual
 * rooms the user has opened (deep links from internship pages), remembered in
 * localStorage. Companies additionally always get their own room.
 */
@Component({
  selector: 'app-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChatMessageListComponent,
    ChatComposerComponent,
    ReportMessageDialogComponent,
    IconComponent,
    LoaderComponent,
  ],
  template: `
    <div class="container page">
      <div class="page-header">
        <h1 class="display">Community</h1>
      </div>

      <div class="chat-shell">
        <aside class="rooms">
          @for (room of rooms(); track room.id) {
            <button
              type="button"
              class="room"
              [class.active]="room.id === activeRoom()?.id"
              (click)="selectRoom(room)"
            >
              <app-icon
                [name]="room.type === 'General' ? 'message-circle' : room.type === 'Company' ? 'building' : 'briefcase'"
                [size]="16"
              />
              <span class="room-title">{{ room.title }}</span>
            </button>
          }
        </aside>

        <section class="pane">
          @if (hub.status() === 'reconnecting') {
            <div class="banner warn">Reconnecting to chat…</div>
          } @else if (hub.status() === 'disconnected' || hub.status() === 'connecting') {
            <div class="banner down">
              {{ hub.status() === 'connecting' ? 'Connecting to chat…' : 'Chat is disconnected.' }}
              @if (hub.status() === 'disconnected') {
                <button type="button" (click)="retryConnect()">Retry</button>
              }
            </div>
          }

          @if (loading()) {
            <div class="pane-loader"><app-loader mode="inline" /></div>
          } @else {
            <app-chat-message-list
              #list
              [messages]="messages()"
              [currentUserId]="currentUserId()"
              [canDelete]="auth.isAdmin()"
              [hasMore]="messages().length < total()"
              [loading]="loading()"
              [loadingOlder]="loadingOlder()"
              (loadOlder)="loadOlder()"
              (report)="reporting.set($event)"
              (remove)="deleteMessage($event)"
            />
          }

          <app-chat-composer
            #composer
            [canPost]="canPost()"
            [disabled]="hub.status() !== 'connected' || sending()"
            (send)="sendMessage($event)"
          />
        </section>
      </div>
    </div>

    @if (reporting(); as message) {
      <app-report-message-dialog [message]="message" (closed)="reporting.set(null)" />
    }
  `,
  styles: [
    `
      .chat-shell {
        display: grid;
        grid-template-columns: 240px 1fr;
        gap: var(--space-lg);
        min-height: 0;
      }

      .rooms {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        align-content: start;
      }

      .room {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: none;
        padding: 10px 12px;
        cursor: pointer;
        color: var(--color-text-soft);
        font: inherit;
        font-weight: 600;
        font-size: 0.9375rem;
        text-align: left;
        transition: background 150ms ease, color 150ms ease;
      }

      .room:hover { background: var(--color-muted); color: var(--color-foreground); }

      .room.active {
        background: var(--color-muted);
        color: var(--color-primary);
        border-color: var(--color-border);
      }

      .room-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pane {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        padding: var(--space-sm);
        height: min(680px, calc(100vh - 220px));
        min-height: 420px;
      }

      .pane-loader {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .banner {
        text-align: center;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: var(--radius-sm);
        padding: 6px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
      }

      .banner.warn {
        background: #fef3c7;
        color: #92400e;
      }

      .banner.down {
        background: #fee2e2;
        color: #991b1b;
      }

      .banner.down button {
        border: 1px solid currentColor;
        background: none;
        color: inherit;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 2px 10px;
        cursor: pointer;
      }

      @media (max-width: 767px) {
        .chat-shell { grid-template-columns: 1fr; }

        .rooms {
          flex-direction: row;
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class ChatPageComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly hub = inject(ChatHubService);
  private readonly chat = inject(ChatService);
  private readonly company = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly list = viewChild<ChatMessageListComponent>('list');
  private readonly composer = viewChild<ChatComposerComponent>('composer');

  protected readonly rooms = signal<ChatRoomResponse[]>([]);
  protected readonly activeRoom = signal<ChatRoomResponse | null>(null);
  /** Oldest-first for rendering; the API returns newest-first pages. */
  protected readonly messages = signal<ChatMessageResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  protected readonly sending = signal(false);
  protected readonly reporting = signal<ChatMessageResponse | null>(null);

  protected readonly currentUserId = computed(() => this.auth.session()?.userId ?? null);
  protected readonly canPost = computed(() => this.auth.isStudent());

  private page = 1;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => void this.hub.disconnect());

    this.hub.messageReceived
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => this.onIncoming(message));

    this.hub.reconnected
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.mergeLatest());

    void this.hub.connect().catch(() => {});
    void this.initRooms();
  }

  protected async selectRoom(room: ChatRoomResponse): Promise<void> {
    if (this.activeRoom()?.id === room.id) {
      return;
    }
    this.activeRoom.set(room);
    this.messages.set([]);
    this.total.set(0);
    this.page = 1;
    this.loading.set(true);
    try {
      await this.hub.joinRoom(room.id);
    } catch {
      // History still loads over REST; realtime resumes on reconnect.
    }
    this.chat.getMessages(room.id, 1, PAGE_SIZE).subscribe({
      next: (result) => {
        if (this.activeRoom()?.id !== room.id) {
          return; // The user switched rooms while this page was loading.
        }
        this.messages.set([...result.items].reverse());
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not load this chat room.'));
        this.forgetRoom(room);
      },
    });
  }

  protected loadOlder(): void {
    const room = this.activeRoom();
    if (!room || this.loadingOlder() || this.messages().length >= this.total()) {
      return;
    }
    this.loadingOlder.set(true);
    this.list()?.markPrepend();
    this.chat.getMessages(room.id, this.page + 1, PAGE_SIZE).subscribe({
      next: (result) => {
        this.loadingOlder.set(false);
        if (this.activeRoom()?.id !== room.id) {
          return;
        }
        this.page += 1;
        const existing = new Set(this.messages().map((m) => m.id));
        const older = [...result.items].reverse().filter((m) => !existing.has(m.id));
        this.messages.update((current) => [...older, ...current]);
        this.total.set(result.total);
      },
      error: () => {
        this.loadingOlder.set(false);
        this.toast.error('Could not load earlier messages.');
      },
    });
  }

  protected async sendMessage(body: string): Promise<void> {
    const room = this.activeRoom();
    if (!room || this.sending()) {
      return;
    }
    this.sending.set(true);
    try {
      await this.hub.sendMessage(room.id, body);
      this.composer()?.clear();
      this.list()?.scrollToBottom();
    } catch (error) {
      // Keep the draft so the user can retry (rate limit, validation, …).
      this.toast.error(error instanceof Error ? error.message : 'Could not send the message.');
    } finally {
      this.sending.set(false);
    }
  }

  protected deleteMessage(message: ChatMessageResponse): void {
    this.chat.deleteMessage(message.id).subscribe({
      next: () => {
        this.messages.update((current) => current.filter((m) => m.id !== message.id));
        this.total.update((t) => Math.max(0, t - 1));
        this.toast.success('Message deleted.');
      },
      error: (error: unknown) =>
        this.toast.error(apiErrorMessage(error, 'Could not delete the message.')),
    });
  }

  protected retryConnect(): void {
    void this.hub.connect().catch(() => {});
  }

  private onIncoming(message: ChatMessageResponse): void {
    if (message.roomId !== this.activeRoom()?.id) {
      return;
    }
    if (this.messages().some((m) => m.id === message.id)) {
      // Already have it (a reconnect refetch can race the live push). Counting it
      // again would inflate `total`, and hasMore (length < total) would then stay
      // true forever — leaving a "Load earlier messages" button that fetches nothing.
      return;
    }
    this.messages.update((current) => [...current, message]);
    this.total.update((t) => t + 1);
  }

  /** After a reconnect: pull page 1 again and merge anything we missed. */
  private mergeLatest(): void {
    const room = this.activeRoom();
    if (!room) {
      return;
    }
    this.chat.getMessages(room.id, 1, PAGE_SIZE).subscribe({
      next: (result) => {
        if (this.activeRoom()?.id !== room.id) {
          return;
        }
        const existing = new Set(this.messages().map((m) => m.id));
        const missed = [...result.items].reverse().filter((m) => !existing.has(m.id));
        if (missed.length > 0) {
          this.messages.update((current) =>
            [...current, ...missed].sort((a, b) => a.id - b.id),
          );
        }
        this.total.set(result.total);
      },
      error: () => {},
    });
  }

  private async initRooms(): Promise<void> {
    const rooms: ChatRoomResponse[] = [];

    try {
      rooms.push(await firstValueFrom(this.chat.getGeneralRoom()));
    } catch {
      this.toast.error('Could not load the General chat room.');
    }

    if (this.auth.isCompany()) {
      try {
        const profile = await firstValueFrom(this.company.getMe());
        const own = await firstValueFrom(this.chat.getCompanyRoom(profile.id));
        pushUnique(rooms, own);
      } catch {
        // The company room is a nice-to-have; General (or deep links) still work.
      }
    }

    for (const remembered of readRememberedRooms()) {
      pushUnique(rooms, remembered);
    }

    this.rooms.set(rooms);

    const deepLinked = await this.resolveDeepLink();
    if (deepLinked) {
      this.rooms.update((current) => {
        const next = [...current];
        pushUnique(next, deepLinked);
        return next;
      });
      this.rememberRoom(deepLinked);
    }

    const initial = deepLinked ?? this.rooms()[0] ?? null;
    if (initial) {
      void this.selectRoom(initial);
    } else {
      this.loading.set(false);
    }
  }

  private async resolveDeepLink(): Promise<ChatRoomResponse | null> {
    const params = this.route.snapshot.queryParamMap;
    const internshipId = Number(params.get('internship'));
    const companyId = Number(params.get('company'));
    try {
      if (internshipId > 0) {
        return await firstValueFrom(this.chat.getInternshipRoom(internshipId));
      }
      if (companyId > 0) {
        return await firstValueFrom(this.chat.getCompanyRoom(companyId));
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 403)) {
        this.toast.error("That chat room isn't available.");
      } else {
        this.toast.error(apiErrorMessage(error, 'Could not open that chat room.'));
      }
    }
    return null;
  }

  /** Contextual rooms survive reloads via localStorage (General never stored). */
  private rememberRoom(room: ChatRoomResponse): void {
    if (room.type === 'General') {
      return;
    }
    const rooms = readRememberedRooms().filter((r) => r.id !== room.id);
    rooms.unshift(room);
    writeRememberedRooms(rooms.slice(0, MAX_REMEMBERED_ROOMS));
  }

  /** Drops a room that turned out to be unavailable (deleted, revoked access). */
  private forgetRoom(room: ChatRoomResponse): void {
    if (room.type === 'General') {
      return;
    }
    this.rooms.update((current) => current.filter((r) => r.id !== room.id));
    writeRememberedRooms(readRememberedRooms().filter((r) => r.id !== room.id));
    const fallback = this.rooms()[0];
    if (fallback && this.activeRoom()?.id === room.id) {
      void this.selectRoom(fallback);
    }
  }
}

function pushUnique(rooms: ChatRoomResponse[], room: ChatRoomResponse): void {
  if (!rooms.some((r) => r.id === room.id)) {
    rooms.push(room);
  }
}

function readRememberedRooms(): ChatRoomResponse[] {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ChatRoomResponse[];
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === 'number') : [];
  } catch {
    return [];
  }
}

function writeRememberedRooms(rooms: ChatRoomResponse[]): void {
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Storage may be unavailable (private mode); the room list just won't persist.
  }
}
