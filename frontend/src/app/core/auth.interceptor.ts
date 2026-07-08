import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const withToken = (request: HttpRequest<unknown>) => {
    const token = auth.token;
    return token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;
  };

  // Never try to refresh a failing auth call itself (login, refresh, logout).
  const isAuthEndpoint = req.url.includes('/auth/');

  return next(withToken(req)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.isLoggedIn() && !isAuthEndpoint) {
        // Access token likely expired: refresh once (shared across concurrent
        // 401s) and replay the original request with the new token.
        return auth.refreshSession().pipe(
          switchMap(() => next(withToken(req))),
          catchError((refreshError) => {
            auth.logout();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
