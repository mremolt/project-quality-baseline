/** Every backend path the BFF calls lives below this prefix (the spec's paths, `/api/v1/…`). */
const API_PREFIX = '/api/';
/** `.` and `..` segments, also percent-encoded (`%2e`), which `new URL()` would resolve. */
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;
/** Encoded or alternative separators that a backend might decode into a new segment. */
const SEPARATOR = /%2f|%5c|\\/i;

/**
 * Resolves a backend path against the configured base origin, or `undefined` when it would leave the API: no dot
 * segments, no encoded separators, the same origin as the base and still below `/api/` after resolution. Guards the
 * server mutator and the API proxy against path steering (an id like `..` in a generated URL).
 */
export function backendUrl(pathAndQuery: string, apiBaseUrl: string): URL | undefined {
  const path = pathAndQuery.split(/[?#]/, 1)[0] ?? '';
  if (!path.startsWith(API_PREFIX)) return undefined;
  if (path.split('/').some((segment) => DOT_SEGMENT.test(segment) || SEPARATOR.test(segment))) return undefined;
  const base = new URL(apiBaseUrl);
  const url = new URL(pathAndQuery, base);
  return url.origin === base.origin && url.pathname.startsWith(API_PREFIX) ? url : undefined;
}
