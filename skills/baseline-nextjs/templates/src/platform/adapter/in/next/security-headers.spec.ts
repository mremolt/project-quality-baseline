import { describe, expect, it } from 'vitest';

import { createNonce, isCrossOriginAction, pageContentSecurityPolicy } from './security-headers';

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

describe('server-action origin check (NEXT-SEC-05, NEXT-TEST-07)', () => {
  const origin = 'https://shop.test';
  const action = (headers: Record<string, string>, method = 'POST') => ({
    method,
    headers: new Headers({ 'next-action': '40abc', ...headers }),
  });

  it.each([
    ['Sec-Fetch-Site same-origin', { 'sec-fetch-site': 'same-origin' }],
    ['the configured Origin', { origin }],
  ])('lets an action with %s through', (_, headers) => {
    expect(isCrossOriginAction(action(headers), origin)).toBe(false);
  });

  it.each([
    ['no Origin', {}],
    ['a foreign Origin', { origin: 'https://evil.example' }],
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }],
    ['Sec-Fetch-Site same-site', { 'sec-fetch-site': 'same-site' }],
  ])('rejects an action with %s', (_, headers) => {
    expect(isCrossOriginAction(action(headers), origin)).toBe(true);
  });

  it('ignores requests that are not server actions', () => {
    expect(isCrossOriginAction({ method: 'POST', headers: new Headers() }, origin)).toBe(false);
    expect(isCrossOriginAction(action({}, 'GET'), origin)).toBe(false);
  });
});
