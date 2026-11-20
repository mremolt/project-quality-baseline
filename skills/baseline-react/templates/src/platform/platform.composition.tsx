import type { ReactNode } from 'react';

import { listenForGlobalErrors } from './adapter/in/ui/global-error-listeners';
import { configureHttp } from './adapter/out/http/custom-fetch';
import { HttpErrorReporting } from './adapter/out/http/http-error-reporting';
import { HttpRuntimeConfig } from './adapter/out/http/http-runtime-config';
import { ReportErrorService } from './application/report-error.service';
import { ReportErrorContext, RuntimeConfigContext } from './platform.tokens';
import type { ReportErrorUseCase } from './ports/in/report-error.use-case';
import type { RuntimeConfig } from './ports/out/runtime-config.port';

export interface Platform {
  readonly config: Readonly<RuntimeConfig>;
  readonly reportError: ReportErrorUseCase;
}

/** Loads `/config.json` before the first render (CFG-02); failures are handled by `main.tsx`. */
export function loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>> {
  return new HttpRuntimeConfig().loadRuntimeConfig();
}

/** Wires the platform once per page load: reporting, global error listeners and the HTTP stack. */
export function createPlatform(config: Readonly<RuntimeConfig>, currentRoute: () => string): Platform {
  const reportError = new ReportErrorService(
    new HttpErrorReporting(config.errorReporting.path),
    {
      enabled: config.errorReporting.enabled,
      environment: config.environment,
      release: config.release,
      maxReports: 20,
    },
    currentRoute,
  );
  listenForGlobalErrors(reportError);
  configureHttp({
    timeoutMs: config.requestTimeoutMs,
    onUnauthorized: () => {
      window.location.assign(config.loginPath);
    },
    reportError,
  });
  return { config, reportError };
}

export function PlatformProvider({
  platform,
  children,
}: {
  readonly platform: Platform;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <RuntimeConfigContext value={platform.config}>
      <ReportErrorContext value={platform.reportError}>{children}</ReportErrorContext>
    </RuntimeConfigContext>
  );
}
