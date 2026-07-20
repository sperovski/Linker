import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;

  let token: string | null;
  let loggedIn: boolean;
  const refreshSession = vi.fn();
  const logout = vi.fn();

  beforeEach(() => {
    token = null;
    loggedIn = false;
    refreshSession.mockReset();
    logout.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            get token() {
              return token;
            },
            isLoggedIn: () => loggedIn,
            refreshSession,
            logout,
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => controller.verify());

  it('attaches the bearer token when logged in', () => {
    token = 'jwt-1';
    http.get('/api/internships').subscribe();

    const req = controller.expectOne('/api/internships');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    req.flush([]);
  });

  it('sends no Authorization header without a token', () => {
    http.get('/api/internships').subscribe();

    const req = controller.expectOne('/api/internships');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('refreshes once on 401 and replays with the new token', () => {
    token = 'expired';
    loggedIn = true;
    refreshSession.mockImplementation(() => {
      token = 'fresh';
      return of({});
    });

    let result: unknown;
    http.get('/api/internships').subscribe((r) => (result = r));

    controller
      .expectOne((r) => r.headers.get('Authorization') === 'Bearer expired')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    const replay = controller.expectOne('/api/internships');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer fresh');
    replay.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('logs out and redirects to /login when the refresh fails', () => {
    token = 'expired';
    loggedIn = true;
    refreshSession.mockReturnValue(throwError(() => new Error('refresh dead')));

    let failure: unknown;
    http.get('/api/internships').subscribe({ error: (e) => (failure = e) });

    controller.expectOne('/api/internships').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(failure).toBeInstanceOf(Error);
  });

  it('never refreshes for auth endpoints themselves', () => {
    token = 'whatever';
    loggedIn = true;

    let status = 0;
    http.post('/api/auth/login', {}).subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('passes non-401 errors through untouched', () => {
    loggedIn = true;

    let status = 0;
    http.get('/api/internships').subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/internships').flush(null, { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
