import type { SessionUseCase } from '../../../ports/in/session.use-case';
import { problemResponse } from '../../problem-response';
import {
  clearedSessionCookie,
  clearedXsrfCookie,
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
 * Login, callback and logout of the BFF (NEST-SEC-45..50).
 * `appOrigin` comes from configuration: the callback URL is rebuilt from it, never from the Host header.
 */
export function createAuthRouteHandlers(sessions: SessionUseCase, appOrigin: string): AuthRouteHandlers {
  return {
    login: async (request) => {
      const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
      const { sessionId, redirectTo } = await sessions.startLogin(returnTo);
      return redirect(redirectTo, 302, [sessionCookie(sessionId)]);
    },

    callback: async (request) => {
      const { pathname, search } = new URL(request.url);
      try {
        const result = await sessions.completeLogin(
          readCookie(request, SESSION_COOKIE),
          new URL(pathname + search, appOrigin),
        );
        return redirect(new URL(result.returnTo, appOrigin), 302, [
          sessionCookie(result.sessionId),
          xsrfCookie(result.xsrfToken),
        ]);
      } catch {
        return problemResponse(400);
      }
    },

    logout: async (request) => {
      const sessionId = readCookie(request, SESSION_COOKIE);
      const session = await sessions.resolve(sessionId);
      if (session && !hasValidXsrfHeader(request, session.xsrfToken)) return problemResponse(403);
      const endSession = await sessions.logout(sessionId);
      return redirect(endSession, 303, [clearedSessionCookie(), clearedXsrfCookie()]);
    },
  };
}
