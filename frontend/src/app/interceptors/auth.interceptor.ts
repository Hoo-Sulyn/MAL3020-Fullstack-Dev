import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * If the API says the token is no longer valid (for example it expired while the page was
 * open), end the session and return to the right sign-in page. A 401 from the sign-in and
 * registration requests themselves just means the details were wrong, so those are ignored.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.url.includes('/api/auth/')
      ) {
        const role = auth.getCurrentUser()?.role;
        auth.logout();
        void router.navigateByUrl(role === 'admin' ? '/adminLogin' : '/');
      }
      return throwError(() => error);
    }),
  );
};
