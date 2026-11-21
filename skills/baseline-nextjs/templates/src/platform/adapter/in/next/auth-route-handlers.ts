import { LoginFailedError, type SessionUseCase } from '../../../ports/in/session.use-case';
import { problemResponse } from '../../problem-response';
import {
  clearedLoginCookie,
  clearedSessionCookie,
  clearedXsrfCookie,
  LOGIN_COOKIE,
  loginCookie,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  xsrfCookie,
} from './cookies';
import { hasValidXsrfHeader } from './csrf';

export type RouteHandler = (request: Request) => Promise<Response>;

export interface AuthRouteHandlers {
  readonly login: RouteHandler;
  readonly callback: RouteHandler;
  readonly logout: RouteHandler;
}

function redirect(location: URL, status: 302 | 303, cookies: readonly string[]): Response {
  const headers = new Headers({ location: location.href, 'cache-control': 'no-store' });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status, headers });
}

/**
 * Login, callback and logout of the BFF (NODE-BFF-02..08).
 * `appOrigin` comes from configuration: the callback URL is rebuilt from it, never from the Host header.
 */
export function createAuthRouteHandlers(sessions: SessionUseCase, appOrigin: string): AuthRouteHandlers {
  return {
    // a live session stays untouched until the callback succeeds: a forced login request cannot end it (NODE-BFF-07)
    login: async (request) => {
      const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
      const { loginId, redirectTo, ttlSeconds } = await sessions.startLogin(returnTo);
      return redirect(redirectTo, 302, [loginCookie(loginId, ttlSeconds)]);
    },

    callback: async (request) => {
      const { pathname, search } = new URL(request.url);
      try {
        const result = await sessions.completeLogin(
          readCookie(request, LOGIN_COOKIE),
          new URL(pathname + search, appOrigin),
          readCookie(request, SESSION_COOKIE),
        );
        return redirect(new URL(result.returnTo, appOrigin), 302, [
          sessionCookie(result.sessionId),
          xsrfCookie(result.xsrfToken),
          clearedLoginCookie(),
        ]);
      } catch (error) {
        if (error instanceof LoginFailedError) return problemResponse(400, { 'set-cookie': clearedLoginCookie() });
        throw error; // session store or IdP outage: 500, logged once by onRequestError (NEXT-OBS-09)
      }
    },

    logout: async (request) => {
      const sessionId = readCookie(request, SESSION_COOKIE);
      const session = await sessions.resolve(sessionId);
      if (session && !hasValidXsrfHeader(request, session.xsrfToken)) return problemResponse(403);
      const endSession = (await sessions.logout(sessionId)) ?? new URL('/', appOrigin); // IdP unreachable: home
      return redirect(endSession, 303, [clearedSessionCookie(), clearedXsrfCookie()]);
    },
  };
}
