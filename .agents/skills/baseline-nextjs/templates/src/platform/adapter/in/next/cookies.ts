export const SESSION_COOKIE = '__Host-session';
export const LOGIN_COOKIE = '__Host-login';
export const XSRF_COOKIE = 'XSRF-TOKEN';

/** `__Host-session; Path=/; HttpOnly; Secure; SameSite=Lax`, no Domain (NODE-BFF-04). */
export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/** Cleared with the same attributes; browsers ignore a `__Host-` cookie without `Secure`. */
export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * The pre-login record's id between `/auth/login` and `/auth/callback` (NODE-BFF-02): same attributes as the session
 * cookie, short-lived. `SameSite=Lax` lets the IdP's top-level redirect to the callback carry it.
 */
export function loginCookie(value: string, maxAgeSeconds: number): string {
  return `${LOGIN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${String(maxAgeSeconds)}`;
}

export function clearedLoginCookie(): string {
  return `${LOGIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Readable by the frontend, which sends it back as `X-XSRF-TOKEN` (NODE-BFF-06). */
export function xsrfCookie(value: string): string {
  return `${XSRF_COOKIE}=${value}; Path=/; Secure; SameSite=Strict`;
}

export function clearedXsrfCookie(): string {
  return `${XSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}
