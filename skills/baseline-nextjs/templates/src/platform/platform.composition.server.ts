import 'server-only';

import { cookies } from 'next/headers';
import * as oidc from 'openid-client';
import { createClient } from 'redis';

import { createApiProxy } from './adapter/in/next/api-proxy';
import type { AuthRouteHandlers, RouteHandler } from './adapter/in/next/auth-route-handlers';
import { createAuthRouteHandlers } from './adapter/in/next/auth-route-handlers';
import { SESSION_COOKIE } from './adapter/in/next/cookies';
import { createReadinessHandler, livenessHandler } from './adapter/in/next/health-route-handlers';
import { FetchBackendRelay } from './adapter/out/http/fetch-backend-relay';
import { configureServerFetch } from './adapter/out/http/server-fetch';
import { OpenIdClientIdentityProvider } from './adapter/out/oidc/openid-client-identity-provider';
import { RedisSessionStore } from './adapter/out/session/redis-session-store';
import { ApiRelayService } from './application/api-relay.service';
import { SessionService } from './application/session.service';
import type { PublicConfig } from './config/public-config';
import type { ServerConfig } from './config/server-config';
import { publicConfig, serverConfig } from './config/server-config';
import type { Caller } from './domain';
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
  const connected = redis.connect();
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
      new ApiRelayService(sessions, new FetchBackendRelay(config.API_BASE_URL, config.API_TIMEOUT_MS)),
    ),
    readyz: createReadinessHandler({
      isReady: async () => {
        if (shuttingDown) return false;
        await connected;
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

async function currentSessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

configureServerFetch(() => ({
  apiBaseUrl: platform().config.API_BASE_URL,
  timeoutMs: platform().config.API_TIMEOUT_MS,
  accessToken: async () => platform().sessions.accessToken(await currentSessionId()),
}));

export const authRouteHandlers: AuthRouteHandlers = {
  login: (request) => platform().auth.login(request),
  callback: (request) => platform().auth.callback(request),
  logout: (request) => platform().auth.logout(request),
};

export const apiProxy: RouteHandler = (request) => platform().apiProxy(request);

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
