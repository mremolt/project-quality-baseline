import { type NextRequest, NextResponse } from 'next/server';

import {
  API_CONTENT_SECURITY_POLICY,
  createNonce,
  isCrossOriginAction,
  pageContentSecurityPolicy,
  SECURITY_HEADERS,
  serverConfig,
} from '@/platform/index.server';

const ROUTE_HANDLER_PATHS = /^\/(api|auth|livez|readyz)(\/|$)/;

function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set('content-security-policy', csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

/** Server-action origin gate, per-request CSP nonce and security headers; no business logic (NEXT-ARCH-11). */
export function proxy(request: NextRequest): NextResponse {
  if (isCrossOriginAction(request, serverConfig().APP_ORIGIN)) {
    return withSecurityHeaders(new NextResponse(null, { status: 403 }), API_CONTENT_SECURITY_POLICY); // NEXT-SEC-05
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-nonce'); // never trust a client-sent nonce
  let csp = API_CONTENT_SECURITY_POLICY;
  if (!ROUTE_HANDLER_PATHS.test(request.nextUrl.pathname)) {
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
