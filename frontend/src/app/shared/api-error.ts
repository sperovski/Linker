import { HttpErrorResponse } from '@angular/common/http';

/** Extracts a human-readable message from an API problem-details response. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (body && typeof body === 'object') {
      if (typeof body.detail === 'string' && body.detail) {
        return body.detail;
      }
      // ASP.NET model validation: { errors: { Field: ["msg", ...] } }
      if (body.errors && typeof body.errors === 'object') {
        const first = Object.values(body.errors as Record<string, string[]>)[0];
        if (Array.isArray(first) && first.length > 0) {
          return first[0];
        }
      }
      if (typeof body.title === 'string' && body.title) {
        return body.title;
      }
    }
    if (error.status === 0) {
      return 'Cannot reach the server. Is the API running?';
    }
  }
  return fallback;
}
