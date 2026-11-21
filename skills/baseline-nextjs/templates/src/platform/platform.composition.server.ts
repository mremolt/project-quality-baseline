import 'server-only';

import { cookies } from 'next/headers';
import * as oidc from 'openid-client';
import { createClient } from 'redis';

import { createApiProxy } from './adapter/in/next/api-proxy';
import type { AuthRouteHandlers, RouteHandler } from './adapter/in/next/auth-route-handlers';
import { createAuthRouteHandlers } from './adapter/in/next/auth-route-handlers';
import { createClientErrorRouteHandler } from './adapter/in/next/client-error-route-handler';
import { SESSION_COOKIE } from './adapter/in/next/cookies';
import { createReadinessHandler, livenessHandler } from './adapter/in/next/health-route-handlers';
import { createRequestErrorLog } from './adapter/in/next/request-error-log';
import { FetchBackendRelay } from './adapter/out/http/fetch-backend-relay';
import { configureServerFetch } from './adapter/out/http/server-fetch';
import { LogReportError } from './adapter/out/logging/log-report-error';
import { logger } from './adapter/out/logging/logger';
import { PinoClientErrorLog } from './adapter/out/logging/pino-client-error-log';
import { OpenIdClientIdentityProvider } from './adapter/out/oidc/openid-client-identity-provider';
import { RedisSessionStore } from './adapter/out/session/redis-session-store';
import { ApiRelayService } from './application/api-relay.service';
import { ClientErrorIntakeService } from './application/client-error-intake.service';
import { SessionService } from './application/session.service';
import type { PublicConfig } from './config/public-config';
import type { ServerConfig } from './config/server-config';
import { publicConfig, serverConfig } from './config/server-config';
import type { Caller } from './domain';
import type { ReportErrorUseCase } from './ports/in/report-error.use-case';
import type { SessionUseCase } from './ports/in/session.use-case';

const now = (): number => Date.now();

function discoverer(config: ServerConfig): () => Promise<oidc.Configuration> {
  let discovered: Promise<oidc.Configuration> | undefined;
  return () => {
    discovered ??= oidc
      .discovery(
        new URL(config.OIDC_ISSUER_URL),
        config.OIDC_CLIENT_ID,
        undefined,
        oidc.ClientSecretBasic(config.OIDC_CLIENT_SECRET.reveal()),
        { timeout: config.OIDC_TIMEOUT_S }, // applies to every later IdP request of this configuration
      )
      .catch((error: unknown) => {
        discovered = undefined; // retry on the next login
        throw error;
      });
    return discovered;
  };
}

function createPlatform() {
  const config = serverConfig();
  const redis = createClient({
    url: config.REDIS_URL.reveal(),
    socket: { connectTimeout: 2_000 },
    commandOptions: { timeout: 1_000 }, // RES-TMO-01
  });
  // node-redis ends the process on an 'error' event without a listener; it reconnects by itself (NEXT-OBS-10)
  redis.on('error', (error: unknown) => {
    logger.warn({ err: error }, 'session store connection failed');
  });
  redis.connect().catch((error: unknown) => {
    logger.error({ err: error }, 'session store connect failed'); // handled: readiness stays DOWN
  });
  const sessions: SessionUseCase = new SessionService(
    new RedisSessionStore(redis),
    new OpenIdClientIdentityProvider(
      discoverer(config),
      {
        redirectUri: new URL('/auth/callback', config.APP_ORIGIN).href,
        postLogoutRedirectUri: new URL('/', config.APP_ORIGIN).href,
        scope: 'openid profile',
      },
      now,
    ),
    {
      idleMs: config.SESSION_IDLE_MINUTES * 60_000,
      absoluteMs: config.SESSION_ABSOLUTE_HOURS * 3_600_000,
      refreshSkewMs: 30_000,
      refreshLockMs: config.OIDC_TIMEOUT_S * 1_000 + 1_000, // outlives one IdP refresh call
      refreshPollMs: 100,
      returnToPattern: /^\/(?!\/)[\w\-/?=&.]{0,200}$/,
    },
    now,
  );
  let shuttingDown = false;
  process.once('SIGTERM', () => {
    shuttingDown = true; // readiness goes down first (OBS-04)
  });
  return {
    config,
    sessions,
    auth: createAuthRouteHandlers(sessions, config.APP_ORIGIN),
    apiProxy: createApiProxy(
      sessions,
      new ApiRelayService(sessions, new FetchBackendRelay(config.API_BASE_URL)),
      config.API_TIMEOUT_MS, // one deadline for session lookup, refresh and backend call (NEXT-RES-03)
    ),
    clientErrors: createClientErrorRouteHandler(new ClientErrorIntakeService(new PinoClientErrorLog()), {
      appOrigin: config.APP_ORIGIN,
      maxBodyBytes: 16_384,
      maxReportsPerMinute: 120,
      now,
    }),
    readyz: createReadinessHandler({
      isReady: async () => {
        if (shuttingDown || !redis.isReady) return false; // never waits for a connection that does not come
        return (await redis.ping()) === 'PONG';
      },
    }),
  };
}

let instance: ReturnType<typeof createPlatform> | undefined;

/** Created at first use, not at import: `next build` evaluates route modules without the runtime environment. */
function platform(): ReturnType<typeof createPlatform> {
  instance ??= createPlatform();
  return instance;
}

/** The server's reporter: the creator of a technical error logs it once and marks it (TS-ARCH-18, NEXT-OBS-09). */
export const serverReportError: ReportErrorUseCase = new LogReportError(logger);

/** The body of `onRequestError` in `instrumentation.ts`: skips what `serverReportError` logged (NEXT-OBS-09). */
export const logRequestError = createRequestErrorLog(logger);

async function currentSessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

configureServerFetch(() => ({
  apiBaseUrl: platform().config.API_BASE_URL,
  timeoutMs: platform().config.API_TIMEOUT_MS,
  accessToken: async (deadline) => platform().sessions.accessToken(await currentSessionId(), deadline),
  reportError: serverReportError,
}));

export const authRouteHandlers: AuthRouteHandlers = {
  login: (request) => platform().auth.login(request),
  callback: (request) => platform().auth.callback(request),
  logout: (request) => platform().auth.logout(request),
};

export const apiProxy: RouteHandler = (request) => platform().apiProxy(request);

export const clientErrorRouteHandler: RouteHandler = (request) => platform().clientErrors(request);

export const healthRouteHandlers: { livez: RouteHandler; readyz: RouteHandler } = {
  livez: livenessHandler, // the process only, independent of configuration and dependencies (OBS-02)
  readyz: (request) => platform().readyz(request),
};

/** The caller of the current request, from the session cookie (server components and server actions). */
export async function currentCaller(): Promise<Caller | undefined> {
  return (await platform().sessions.resolve(await currentSessionId()))?.caller;
}

export function publicRuntimeConfig(): PublicConfig {
  return publicConfig(platform().config);
}
