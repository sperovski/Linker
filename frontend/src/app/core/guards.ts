import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './models';

/**
 * Keeps a session whose password is below the policy on the settings page.
 * The API refuses everything else anyway — this just turns a wall of 403s into
 * a page the user can act on. Returns null when there is nothing to redirect.
 */
function rotationRedirect(auth: AuthService, router: Router, target: string) {
  return auth.mustChangePassword() && target !== '/settings'
    ? router.createUrlTree(['/settings'])
    : null;
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  return rotationRedirect(auth, router, state.url) ?? true;
};

export function roleGuard(role: UserRole): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/login']);
    }
    const rotation = rotationRedirect(auth, router, state.url);
    if (rotation) {
      return rotation;
    }
    return auth.role() === role ? true : router.createUrlTree([auth.homePath()]);
  };
}

/** Keeps logged-in users out of login/register. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree([auth.homePath()]) : true;
};

/** Implemented by form pages that can hold unsaved edits. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Confirms before leaving a page with unsaved edits. Only in-app navigation
 * goes through the router — a tab close or reload needs the component's own
 * beforeunload listener.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  confirm('You have unsaved changes. Leave this page and lose them?');
