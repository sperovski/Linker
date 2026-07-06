import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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
}

const STORAGE_KEY = 'linker_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly sessionSignal = signal<StoredSession | null>(readSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.sessionSignal() !== null);
  readonly role = computed<UserRole | null>(() => this.sessionSignal()?.role ?? null);
  readonly isStudent = computed(() => this.role() === 'Student');
  readonly isCompany = computed(() => this.role() === 'Company');
  readonly email = computed(() => this.sessionSignal()?.email ?? null);

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

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
    this.router.navigate(['/']);
  }

  homePath(): string {
    switch (this.role()) {
      case 'Student':
        return '/internships';
      case 'Company':
        return '/company/dashboard';
      default:
        return '/';
    }
  }

  private storeSession(response: AuthResponse): void {
    const session: StoredSession = {
      userId: response.userId,
      email: response.email,
      role: response.role,
      token: response.token,
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
