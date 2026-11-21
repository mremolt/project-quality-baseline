/** Trusted Types policies: only the `default` policy of src/instrumentation-client.ts (Next 16.4 creates none in production). */
const TRUSTED_TYPES_POLICIES = ['default'];

/** The page policy of NODE-BFF-09 with the Trusted Types directives of NEXT-SEC-10 (NEXT-SEC-03). */
export function pageContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`,
    "require-trusted-types-for 'script'",
  ].join('; ');
}

/** Route handlers (API proxy, auth, probes) answer JSON or redirects: nothing may load (NEXT-SEC-03). */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

/** Headers on every response besides the CSP (NEXT-SEC-08, NODE-BFF-09). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

export function createNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
}

/** Paths served by route handlers; each checks its own requests (XSRF token, origin, NEXT-SEC-02, NEXT-OBS-18). */
const ROUTE_HANDLER_PATHS = /^\/(api|auth|client-errors|livez|readyz)(\/|$)/;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isRouteHandlerPath(pathname: string): boolean {
  return ROUTE_HANDLER_PATHS.test(pathname);
}

/** What the page write gate reads from a request. */
export interface PageRequest {
  readonly method: string;
  readonly pathname: string;
  readonly headers: Pick<Headers, 'get'>;
}

/**
 * NEXT-SEC-05: every non-GET/HEAD/OPTIONS request to a page path is a server action or something Next.js may treat as
 * one (a no-JS form post carries the action id as a `$ACTION_ID_…` form field, without a `Next-Action` header). It
 * passes only when `Sec-Fetch-Site: same-origin` or `Origin` equal to `APP_ORIGIN` proves the origin; Next.js itself
 * runs an action that comes without `Origin`.
 */
export function isCrossOriginPageWrite(request: PageRequest, appOrigin: string): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase()) || isRouteHandlerPath(request.pathname)) return false;
  return !isSameOriginRequest(request.headers, appOrigin);
}

/** `Sec-Fetch-Site: same-origin`, or an `Origin` equal to `APP_ORIGIN`; a missing or `null` Origin proves nothing. */
export function isSameOriginRequest(headers: Pick<Headers, 'get'>, appOrigin: string): boolean {
  if (headers.get('sec-fetch-site') === 'same-origin') return true;
  return headers.get('origin') === new URL(appOrigin).origin;
}
