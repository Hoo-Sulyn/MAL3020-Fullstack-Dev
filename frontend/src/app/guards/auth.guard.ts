import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthRole, AuthService } from '../services/auth.service';

/**
 * Lets a signed-in user of the given role open the page. Everyone else is sent to the
 * matching sign-in page, so a page that needs data never loads without a valid session.
 */
export function authGuard(role: AuthRole): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasValidSession(role)) {
      return true;
    }
    return router.createUrlTree([role === 'admin' ? '/adminLogin' : '/']);
  };
}
