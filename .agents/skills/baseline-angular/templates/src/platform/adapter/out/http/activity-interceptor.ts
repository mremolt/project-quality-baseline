import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { SessionActivity } from '../../in/ui/session-activity';

/**
 * Every answer from the backend renews the server's idle timer, so it renews the SPA's picture of it too: the warning
 * of the shell's session-timeout dialog is based on the last answer, not on mouse movement (the server cannot see
 * that). NG-SEC-13, A11Y-29. Register with `withInterceptors([..., activityInterceptor])`.
 */
export const activityInterceptor: HttpInterceptorFn = (request, next) => {
  const activity = inject(SessionActivity);
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          activity.touch();
        }
      },
      error: (error: unknown) => {
        // an error answer renews the session too; status 0 (network) and 401 (session gone) do not
        if (error instanceof HttpErrorResponse && error.status !== 0 && error.status !== 401) {
          activity.touch();
        }
      },
    }),
  );
};
