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

/** The request headers the server-action origin check reads. */
export interface ActionRequest {
  readonly method: string;
  readonly headers: Pick<Headers, 'get' | 'has'>;
}

/**
 * NEXT-SEC-05: a server action (`POST` with `Next-Action`) runs only for same-origin requests. Next.js itself runs
 * an action that comes without `Origin`, so `proxy.ts` rejects it unless `Sec-Fetch-Site` or `Origin` proves the origin.
 */
export function isCrossOriginAction(request: ActionRequest, appOrigin: string): boolean {
  if (request.method !== 'POST' || !request.headers.has('next-action')) return false;
  if (request.headers.get('sec-fetch-site') === 'same-origin') return false;
  return request.headers.get('origin') !== new URL(appOrigin).origin;
}
