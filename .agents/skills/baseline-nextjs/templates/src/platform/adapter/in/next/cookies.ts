export const SESSION_COOKIE = '__Host-session';
export const XSRF_COOKIE = 'XSRF-TOKEN';

/** `__Host-session; Path=/; HttpOnly; Secure; SameSite=Lax`, no Domain (NEST-SEC-47). */
export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/** Cleared with the same attributes; browsers ignore a `__Host-` cookie without `Secure`. */
export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Readable by the frontend, which sends it back as `X-XSRF-TOKEN` (NEST-SEC-48). */
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
