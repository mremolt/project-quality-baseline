import type { ApiRelayUseCase } from '../../../ports/in/api-relay.use-case';
import type { SessionUseCase } from '../../../ports/in/session.use-case';
import { problemResponse } from '../../problem-response';
import type { RouteHandler } from './auth-route-handlers';
import { readCookie, SESSION_COOKIE } from './cookies';
import { hasValidXsrfHeader, isUnsafeMethod } from './csrf';

const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-language'];

/**
 * Same-origin API for the browser: `/api/...` goes to the backend with the session's access token
 * (token relay). Unsafe methods need the XSRF header (NODE-BFF-06). No business logic here.
 * `timeoutMs` is the total deadline of one call: session lookup, token refresh and backend call share it (NEXT-RES-03).
 */
export function createApiProxy(sessions: SessionUseCase, apiRelay: ApiRelayUseCase, timeoutMs: number): RouteHandler {
  return async (request) => {
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
    try {
      return await relay(request, deadline);
    } catch (error) {
      if (deadline.aborted) return problemResponse(504); // session store or IdP slower than the deadline
      throw error;
    }
  };

  async function relay(request: Request, deadline: AbortSignal): Promise<Response> {
    const sessionId = readCookie(request, SESSION_COOKIE);
    const session = await sessions.resolve(sessionId, deadline);
    if (!session?.caller) return problemResponse(401);
    if (isUnsafeMethod(request.method) && !hasValidXsrfHeader(request, session.xsrfToken)) return problemResponse(403);

    const { pathname, search } = new URL(request.url);
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await apiRelay.relay(sessionId, {
      method: request.method,
      pathAndQuery: pathname + search,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: deadline,
    });
    if (!upstream) return problemResponse(401);
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }
}
