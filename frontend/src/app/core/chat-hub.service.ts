import { Injectable, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { ChatMessageResponse } from './models';
import { AuthService } from './auth.service';

export type ChatHubStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Owns the SignalR connection to /hubs/chat. The socket only lives while the
 * chat page is open: the page calls connect() on init and disconnect() on
 * destroy. The server closes the socket when the JWT expires, so every
 * (re)connect goes through freshToken(), which refreshes the session first
 * when the stored token is expired or about to be.
 */
@Injectable({ providedIn: 'root' })
export class ChatHubService {
  private readonly auth = inject(AuthService);

  private connection: HubConnection | null = null;
  private currentRoomId: number | null = null;
  /** Set while disconnect() is intended, so onclose doesn't retry. */
  private stopping = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly statusSignal = signal<ChatHubStatus>('disconnected');
  readonly status = this.statusSignal.asReadonly();

  /** Every message the server pushes, across rooms the user has joined. */
  readonly messageReceived = new Subject<ChatMessageResponse>();
  /** Fires after an automatic reconnect once the current room is re-joined. */
  readonly reconnected = new Subject<void>();

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      return;
    }
    this.stopping = false;

    if (!this.connection) {
      this.connection = new HubConnectionBuilder()
        .withUrl(`${environment.hubBaseUrl}/chat`, {
          accessTokenFactory: () => this.freshToken(),
          // Auth travels in access_token, not cookies; credentialed requests
          // would require AllowCredentials on the API's CORS policy.
          withCredentials: false,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .build();

      this.connection.on('ReceiveMessage', (message: ChatMessageResponse) =>
        this.messageReceived.next(message),
      );

      this.connection.onreconnecting(() => this.statusSignal.set('reconnecting'));

      this.connection.onreconnected(async () => {
        this.statusSignal.set('connected');
        // SignalR groups don't survive a new connection id — re-join.
        if (this.currentRoomId !== null) {
          try {
            await this.connection!.invoke('JoinRoom', this.currentRoomId);
          } catch {
            // The room may have become unavailable; the page handles refetch errors.
          }
        }
        this.reconnected.next();
      });

      this.connection.onclose(() => {
        this.statusSignal.set('disconnected');
        // Automatic reconnect gives up after its schedule; keep trying slowly
        // unless the page deliberately stopped the connection.
        if (!this.stopping) {
          this.scheduleRetry();
        }
      });
    }

    this.statusSignal.set('connecting');
    try {
      await this.connection.start();
      this.statusSignal.set('connected');
      if (this.currentRoomId !== null) {
        await this.connection.invoke('JoinRoom', this.currentRoomId);
        this.reconnected.next();
      }
    } catch (error) {
      this.statusSignal.set('disconnected');
      if (!this.stopping) {
        this.scheduleRetry();
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopping = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.currentRoomId = null;
    if (this.connection) {
      await this.connection.stop();
    }
    this.statusSignal.set('disconnected');
  }

  async joinRoom(roomId: number): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      // Remember the target so (re)connect joins it once the socket is up.
      this.currentRoomId = roomId;
      return;
    }
    if (this.currentRoomId !== null && this.currentRoomId !== roomId) {
      try {
        await this.connection.invoke('LeaveRoom', this.currentRoomId);
      } catch {
        // Leaving a dead group is harmless; joining the new room is what matters.
      }
    }
    await this.connection.invoke('JoinRoom', roomId);
    this.currentRoomId = roomId;
  }

  async sendMessage(roomId: number, body: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Not connected to chat.');
    }
    try {
      await this.connection.invoke('SendMessage', roomId, body);
    } catch (error) {
      throw new Error(hubErrorMessage(error), { cause: error });
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopping) {
        this.connect().catch(() => {});
      }
    }, 15000);
  }

  /**
   * Returns a token the hub handshake can use, refreshing the session first if
   * the stored JWT is expired or within 30s of expiry (the server closes the
   * socket on expiry, so reconnects routinely land here with a stale token).
   */
  private async freshToken(): Promise<string> {
    const token = this.auth.token;
    if (!token) {
      throw new Error('Not logged in.');
    }
    if (tokenExpiresWithin(token, 30)) {
      await firstValueFrom(this.auth.refreshSession());
      return this.auth.token ?? '';
    }
    return token;
  }
}

function tokenExpiresWithin(token: string, seconds: number): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) {
      return false;
    }
    return payload.exp * 1000 - Date.now() < seconds * 1000;
  } catch {
    return false;
  }
}

/** HubException messages arrive as "An unexpected error occurred... HubException: <msg>". */
function hubErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const marker = 'HubException: ';
  const index = raw.lastIndexOf(marker);
  return index >= 0 ? raw.slice(index + marker.length) : 'Could not send the message.';
}
