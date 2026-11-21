const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | undefined {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${name}=`));
  if (entry === undefined) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined; // a malformed cookie counts as absent: no header, the BFF rejects the call with 403
  }
}

/** Adds the BFF's XSRF header to same-origin mutating requests only (REACT-SEC-06). */
export function withXsrfHeader(headers: Headers, method: string, target: URL): Headers {
  if (!MUTATING.has(method.toUpperCase()) || target.origin !== globalThis.location.origin) return headers;
  const token = readCookie('XSRF-TOKEN');
  if (token !== undefined) headers.set('X-XSRF-TOKEN', token);
  return headers;
}
