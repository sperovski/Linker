import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

function httpError(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status });
}

describe('apiErrorMessage', () => {
  it('prefers the problem-details detail field', () => {
    const error = httpError({ detail: 'Email already taken.', title: 'Conflict' });
    expect(apiErrorMessage(error, 'fallback')).toBe('Email already taken.');
  });

  it('falls back to the first model-validation message', () => {
    const error = httpError({
      errors: { Email: ['Email is required.', 'Email is invalid.'], Name: ['Too short.'] },
    });
    expect(apiErrorMessage(error, 'fallback')).toBe('Email is required.');
  });

  it('falls back to the title when detail and errors are missing', () => {
    const error = httpError({ title: 'Bad Request' });
    expect(apiErrorMessage(error, 'fallback')).toBe('Bad Request');
  });

  it('reports an unreachable server for status 0', () => {
    const error = httpError(null, 0);
    expect(apiErrorMessage(error, 'fallback')).toBe('Cannot reach the server. Is the API running?');
  });

  it('uses the fallback for non-HTTP errors', () => {
    expect(apiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('uses the fallback when the body has no usable message', () => {
    expect(apiErrorMessage(httpError({ detail: '' }), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(httpError('plain text'), 'fallback')).toBe('fallback');
  });
});
