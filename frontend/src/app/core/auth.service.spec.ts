import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthResponse } from './models';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'linker_session';
const BASE = `${environment.apiBaseUrl}/auth`;

const authResponse: AuthResponse = {
  userId: 7,
  email: 'stefan@example.com',
  role: 'Student',
  token: 'jwt-token',
  refreshToken: 'refresh-token',
  emailVerified: true,
} as AuthResponse;

describe('AuthService', () => {
  let service: AuthService;
  let controller: HttpTestingController;
  let router: Router;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => controller.verify());

  it('starts anonymous with empty storage', () => {
    setup();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.role()).toBeNull();
    expect(service.token).toBeNull();
  });

  it('restores a stored session on startup', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authResponse));
    setup();
    expect(service.isLoggedIn()).toBe(true);
    expect(service.email()).toBe('stefan@example.com');
    expect(service.isStudent()).toBe(true);
  });

  it('ignores corrupt stored sessions', () => {
    localStorage.setItem(STORAGE_KEY, 'not json {');
    setup();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('stores the session after login', () => {
    setup();
    service.login('stefan@example.com', 'pw').subscribe();

    const req = controller.expectOne(`${BASE}/login`);
    expect(req.request.body).toEqual({ email: 'stefan@example.com', password: 'pw' });
    req.flush(authResponse);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.token).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).refreshToken).toBe('refresh-token');
  });

  it('shares one refresh request across concurrent callers', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authResponse));
    setup();

    service.refreshSession().subscribe();
    service.refreshSession().subscribe();

    const req = controller.expectOne(`${BASE}/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-token' });
    req.flush({ ...authResponse, token: 'jwt-2', refreshToken: 'refresh-2' });

    expect(service.token).toBe('jwt-2');

    // The shared in-flight request is cleared: a later refresh hits the wire
    // again with the rotated token.
    service.refreshSession().subscribe();
    controller.expectOne(`${BASE}/refresh`).flush(authResponse);
  });

  it('fails the refresh without a stored session', () => {
    setup();
    let error: unknown;
    service.refreshSession().subscribe({ error: (e) => (error = e) });
    expect(error).toBeInstanceOf(Error);
  });

  it('clears the session, revokes the refresh token, and navigates home on logout', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authResponse));
    setup();

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    const revoke = controller.expectOne(`${BASE}/logout`);
    expect(revoke.request.body).toEqual({ refreshToken: 'refresh-token' });
    revoke.flush(null);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('marks the local session verified', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...authResponse, emailVerified: false }));
    setup();
    expect(service.emailVerified()).toBe(false);

    service.markEmailVerified();

    expect(service.emailVerified()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).emailVerified).toBe(true);
  });
});
