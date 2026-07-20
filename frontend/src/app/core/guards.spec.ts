import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './models';
import { authGuard, guestGuard, roleGuard } from './guards';

describe('route guards', () => {
  let loggedIn: boolean;
  let role: UserRole | null;

  const fakeAuth = {
    isLoggedIn: () => loggedIn,
    role: () => role,
    homePath: () =>
      role === 'Student' ? '/internships' : role === 'Company' ? '/company/dashboard' : '/',
  };

  // The guards ignore their route/state arguments.
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function run(guard: typeof authGuard) {
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  function path(result: unknown): string {
    expect(result).toBeInstanceOf(UrlTree);
    return (result as UrlTree).toString();
  }

  beforeEach(() => {
    loggedIn = false;
    role = null;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
    });
  });

  describe('authGuard', () => {
    it('allows a logged-in user', () => {
      loggedIn = true;
      expect(run(authGuard)).toBe(true);
    });

    it('redirects an anonymous user to /login', () => {
      expect(path(run(authGuard))).toBe('/login');
    });
  });

  describe('roleGuard', () => {
    it('allows a user with the required role', () => {
      loggedIn = true;
      role = 'Student';
      expect(run(roleGuard('Student'))).toBe(true);
    });

    it('redirects an anonymous user to /login', () => {
      expect(path(run(roleGuard('Student')))).toBe('/login');
    });

    it('redirects the wrong role to its own home', () => {
      loggedIn = true;
      role = 'Company';
      expect(path(run(roleGuard('Student')))).toBe('/company/dashboard');
    });
  });

  describe('guestGuard', () => {
    it('allows an anonymous user', () => {
      expect(run(guestGuard)).toBe(true);
    });

    it('redirects a logged-in user to their home', () => {
      loggedIn = true;
      role = 'Student';
      expect(path(run(guestGuard))).toBe('/internships');
    });
  });
});
