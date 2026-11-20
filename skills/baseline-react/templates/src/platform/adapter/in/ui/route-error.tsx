import type { ErrorComponentProps } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';

import { useReportError } from '../../../platform.tokens';
import { ErrorMessage } from './error-message';

/**
 * Router `errorComponent`: reports and offers a retry. A failed lazy chunk has already been retried
 * with one reload by `lazyRouteComponent` (REL-FE-04); a second failure ends up here.
 */
export function RouteError({ error, reset }: Readonly<ErrorComponentProps>): ReactNode {
  const reportError = useReportError();
  useEffect(() => {
    reportError.report(error);
  }, [error, reportError]);
  return <ErrorMessage onRetry={reset} />;
}
