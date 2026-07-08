import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, share, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  RegisterCompanyRequest,
  RegisterStudentRequest,
  UserRole,
} from './models';

interface StoredSession {
  userId: number;
  email: string;
  role: UserRole;
  token: string;
  refreshToken: string;
  emailVerified: boolean;
}

const STORAGE_KEY = 'linker_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly sessionSignal = signal<StoredSession | null>(readSession());

  /** In-flight refresh, shared so concurrent 401s trigger a single request. */
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.sessionSignal() !== null);
  readonly role = computed<UserRole | null>(() => this.sessionSignal()?.role ?? null);
  readonly isStudent = computed(() => this.role() === 'Student');
  readonly isCompany = computed(() => this.role() === 'Company');
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly email = computed(() => this.sessionSignal()?.email ?? null);
  readonly emailVerified = computed(() => this.sessionSignal()?.emailVerified ?? true);

  get token(): string | null {
    return this.sessionSignal()?.token ?? null;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, { email, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  registerStudent(request: RegisterStudentRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register/student`, request)
      .pipe(tap((response) => this.storeSession(response)));
  }

  registerCompany(request: RegisterCompanyRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register/company`, request)
      .pipe(tap((response) => this.storeSession(response)));
  }

  /** Exchange the stored refresh token for a fresh token pair (rotation). */
  refreshSession(): Observable<AuthResponse> {
    const refreshToken = this.sessionSignal()?.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    this.refreshInFlight$ ??= this.http
      .post<AuthResponse>(`${this.baseUrl}/refresh`, { refreshToken })
      .pipe(
        tap((response) => this.storeSession(response)),
        finalize(() => (this.refreshInFlight$ = null)),
        share(),
      );
    return this.refreshInFlight$;
  }

  logout(): void {
    const refreshToken = this.sessionSignal()?.refreshToken;
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
    if (refreshToken) {
      // Best-effort server-side revocation; the local session is already gone.
      this.http.post(`${this.baseUrl}/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    this.router.navigate(['/']);
  }

  homePath(): string {
    switch (this.role()) {
      case 'Student':
        return '/internships';
      case 'Company':
        return '/company/dashboard';
      case 'Admin':
        return '/admin';
      default:
        return '/';
    }
  }

  /** Flip the local session to verified after the verify-email call succeeds. */
  markEmailVerified(): void {
    const current = this.sessionSignal();
    if (current && !current.emailVerified) {
      const updated = { ...current, emailVerified: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.sessionSignal.set(updated);
    }
  }

  private storeSession(response: AuthResponse): void {
    const session: StoredSession = {
      userId: response.userId,
      email: response.email,
      role: response.role,
      token: response.token,
      refreshToken: response.refreshToken,
      emailVerified: response.emailVerified,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as StoredSession;
    return session.token ? session : null;
  } catch {
    return null;
  }
}
