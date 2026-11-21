import { describe, expect, it } from 'vitest';

import { createNonce, isCrossOriginPageWrite, isRouteHandlerPath, pageContentSecurityPolicy } from './security-headers';

describe('page content security policy', () => {
  it('allows scripts only by nonce and enforces Trusted Types', () => {
    const csp = pageContentSecurityPolicy('abc');

    expect(csp).toContain("script-src 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).not.toContain('unsafe-');
  });

  it('creates a fresh 128-bit nonce each time', () => {
    const nonce = createNonce();

    expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
    expect(createNonce()).not.toBe(nonce);
  });
});

describe('page write origin gate (NEXT-SEC-05, NEXT-TEST-07)', () => {
  const origin = 'https://shop.test';
  const write = (headers: Record<string, string>, method = 'POST', pathname = '/orders') => ({
    method,
    pathname,
    headers: new Headers(headers),
  });

  it.each([
    ['Sec-Fetch-Site same-origin', { 'next-action': '40abc', 'sec-fetch-site': 'same-origin' }],
    ['the configured Origin', { 'next-action': '40abc', origin }],
  ])('lets a server action with %s through', (_, headers) => {
    expect(isCrossOriginPageWrite(write(headers), origin)).toBe(false);
  });

  it.each([
    ['no Origin', { 'next-action': '40abc' }],
    ['a foreign Origin', { 'next-action': '40abc', origin: 'https://evil.example' }],
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }],
    ['Sec-Fetch-Site same-site', { 'next-action': '40abc', 'sec-fetch-site': 'same-site' }],
    ['Origin null', { 'next-action': '40abc', origin: 'null' }],
  ])('rejects a page POST with %s', (_, headers) => {
    expect(isCrossOriginPageWrite(write(headers), origin)).toBe(true);
  });

  it('rejects a no-JS form post (multipart, $ACTION_ID_ field, no Next-Action header) with Origin null', () => {
    const form = new FormData();
    form.set('$ACTION_ID_40abc', '');
    form.set('reason', 'changed my mind');
    const request = new Request('https://shop.test/orders', {
      method: 'POST',
      body: form,
      headers: { origin: 'null' },
    });

    expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data/);
    expect(request.headers.has('next-action')).toBe(false);
    expect(
      isCrossOriginPageWrite({ method: request.method, pathname: '/orders', headers: request.headers }, origin),
    ).toBe(true);
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('rejects a cross-origin %s to a page path', (method) => {
    expect(isCrossOriginPageWrite(write({ origin: 'https://evil.example' }, method), origin)).toBe(true);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('lets a %s without Origin through', (method) => {
    expect(isCrossOriginPageWrite(write({}, method), origin)).toBe(false);
  });

  it.each(['/api/v1/orders', '/auth/logout', '/client-errors', '/livez', '/readyz'])(
    'leaves %s to its route handler, which checks the request itself',
    (pathname) => {
      expect(isCrossOriginPageWrite(write({}, 'POST', pathname), origin)).toBe(false);
    },
  );

  it('treats look-alike page paths as pages', () => {
    expect(isRouteHandlerPath('/apix')).toBe(false);
    expect(isRouteHandlerPath('/orders/api')).toBe(false);
    expect(isCrossOriginPageWrite(write({}, 'POST', '/apix'), origin)).toBe(true);
  });
});
