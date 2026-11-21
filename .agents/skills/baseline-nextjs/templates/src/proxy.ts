import { type NextRequest, NextResponse } from 'next/server';

import {
  API_CONTENT_SECURITY_POLICY,
  createNonce,
  isCrossOriginPageWrite,
  isRouteHandlerPath,
  pageContentSecurityPolicy,
  problemResponse,
  SECURITY_HEADERS,
  serverConfig,
} from '@/platform/index.server';

function withSecurityHeaders<R extends Response>(response: R, csp: string): R {
  response.headers.set('content-security-policy', csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

/** Origin gate for page writes, per-request CSP nonce and security headers; no business logic (NEXT-ARCH-11). */
export function proxy(request: NextRequest): Response {
  const { pathname } = request.nextUrl;
  if (
    isCrossOriginPageWrite({ method: request.method, pathname, headers: request.headers }, serverConfig().APP_ORIGIN)
  ) {
    return withSecurityHeaders(problemResponse(403), API_CONTENT_SECURITY_POLICY); // NEXT-SEC-05
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-nonce'); // never trust a client-sent nonce
  let csp = API_CONTENT_SECURITY_POLICY;
  if (!isRouteHandlerPath(pathname)) {
    const nonce = createNonce();
    csp = pageContentSecurityPolicy(nonce);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('content-security-policy', csp); // Next reads the nonce from this request header (NEXT-SEC-03)
  }
  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)' }],
};
