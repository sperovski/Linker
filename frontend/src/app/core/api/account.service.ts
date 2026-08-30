import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account } from '../models';

/** Account endpoints: the anonymous verification/reset links, plus the
 *  signed-in settings calls (which the auth interceptor tokens automatically). */
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

  /** The signed-in account, including any email change still awaiting confirmation. */
  me(): Observable<Account> {
    return this.http.get<Account>(`${this.baseUrl}/me`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, { currentPassword, newPassword });
  }

  changeEmail(newEmail: string, currentPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-email`, { newEmail, currentPassword });
  }

  confirmEmailChange(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/confirm-email-change`, { token });
  }
}
