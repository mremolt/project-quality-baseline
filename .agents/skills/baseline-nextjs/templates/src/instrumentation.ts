import type { Instrumentation } from 'next';

/** Runs once per server instance before the first request (NEXT-CFG-03, NEXT-OBS-01, NEXT-TEST-10). */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { serverConfig } = await import('./platform/config/server-config');
  let config;
  try {
    config = serverConfig(); // parsed before anything else; nothing parses or connects at import
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid configuration'); // key names only (CFG-07)
    process.exit(1); // without it Next.js keeps running and answers every request with 500
  }
  const { logger } = await import('@/platform/index.server');
  logger.level = config.LOG_LEVEL;
  logger.info({ release: config.RELEASE_VERSION, commit: config.GIT_COMMIT }, 'server starting'); // NEXT-REL-15
  const { startTelemetry } = await import('./telemetry');
  startTelemetry();
  if (config.APP_TEST_STUBS) {
    // refused by the schema unless APP_ENVIRONMENT_KIND is test or local (NEXT-CFG-07, NEXT-SEC-13)
    const { startBackendStubs } = await import('./backend-stubs');
    startBackendStubs();
  }
}

/** Server errors Next.js caught (render, route handler, server action, proxy): one log line (NEXT-OBS-09). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { logger } = await import('@/platform/index.server');
  logger.error(
    {
      err: error,
      method: request.method,
      path: request.path.split('?')[0],
      routePath: context.routePath,
      routeType: context.routeType,
    },
    'request failed',
  );
};
