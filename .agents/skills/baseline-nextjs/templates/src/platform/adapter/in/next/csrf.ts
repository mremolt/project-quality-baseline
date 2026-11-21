import { timingSafeEqual } from 'node:crypto';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/** The `X-XSRF-TOKEN` header must equal the token kept in the session (and sent as the `XSRF-TOKEN` cookie). */
export function hasValidXsrfHeader(request: Request, expected: string): boolean {
  const sent = request.headers.get('x-xsrf-token');
  if (!sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
