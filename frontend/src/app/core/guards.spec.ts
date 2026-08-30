import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './models';
import { authGuard, guestGuard, roleGuard, unsavedChangesGuard } from './guards';

describe('route guards', () => {
  let loggedIn: boolean;
  let role: UserRole | null;
  let mustChangePassword: boolean;

  const fakeAuth = {
    isLoggedIn: () => loggedIn,
    role: () => role,
    mustChangePassword: () => mustChangePassword,
    homePath: () =>
      mustChangePassword
        ? '/settings'
        : role === 'Student'
          ? '/internships'
          : role === 'Company'
            ? '/company/dashboard'
            : '/',
  };

  // The guards ignore the route argument; state.url decides only whether a
  // confined session is already on the page it is being sent to.
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function run(guard: typeof authGuard, url = '/somewhere') {
    return TestBed.runInInjectionContext(() => guard(route, { url } as RouterStateSnapshot));
  }

  function path(result: unknown): string {
    expect(result).toBeInstanceOf(UrlTree);
    return (result as UrlTree).toString();
  }

  beforeEach(() => {
    loggedIn = false;
    role = null;
    mustChangePassword = false;
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

  describe('forced password rotation', () => {
    it('sends a confined session to /settings', () => {
      loggedIn = true;
      role = 'Student';
      mustChangePassword = true;
      expect(path(run(authGuard))).toBe('/settings');
      expect(path(run(roleGuard('Student')))).toBe('/settings');
    });

    it('lets a confined session reach /settings itself', () => {
      loggedIn = true;
      role = 'Student';
      mustChangePassword = true;
      // Otherwise the redirect would loop on the one page that can fix it.
      expect(run(authGuard, '/settings')).toBe(true);
    });

    it('takes precedence over the wrong-role redirect', () => {
      loggedIn = true;
      role = 'Company';
      mustChangePassword = true;
      expect(path(run(roleGuard('Student')))).toBe('/settings');
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

  describe('unsavedChangesGuard', () => {
    // The guard takes the component plus route/state args it ignores.
    function leave(hasUnsavedChanges: boolean) {
      const component = { hasUnsavedChanges: () => hasUnsavedChanges };
      return TestBed.runInInjectionContext(() =>
        unsavedChangesGuard(component, route, state, state),
      );
    }

    afterEach(() => vi.restoreAllMocks());

    it('leaves without asking when nothing is pending', () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      expect(leave(false)).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('leaves when the user confirms', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(leave(true)).toBe(true);
    });

    it('stays put when the user cancels', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      expect(leave(true)).toBe(false);
    });
  });
});
