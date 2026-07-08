import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Email verification and password-reset calls (no auth token required). */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/verify-email`, { token });
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, { token, newPassword });
  }
}
