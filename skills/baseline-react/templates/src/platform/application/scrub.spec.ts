import { describe, expect, it } from 'vitest';

import { scrub } from './scrub';

describe('scrub', () => {
  it('removes query strings and fragments from URLs', () => {
    expect(scrub('GET https://shop.example/api/v1/orders?customer=42#top failed')).toBe(
      'GET https://shop.example/api/v1/orders failed',
    );
  });

  it('replaces numeric and UUID path segments with :id', () => {
    expect(scrub('POST /api/v1/orders/12345/cancel failed')).toBe('POST /api/v1/orders/:id/cancel failed');
    expect(scrub('GET https://shop.example/api/v1/customers/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b')).toBe(
      'GET https://shop.example/api/v1/customers/:id',
    );
  });

  it('keeps path segments that are not ids', () => {
    expect(scrub('GET /api/v1/orders failed with 503')).toBe('GET /api/v1/orders failed with 503');
  });

  it('removes e-mail addresses', () => {
    expect(scrub('no account for jane.doe@example.com')).toBe('no account for [email]');
  });

  it('removes token-like values', () => {
    expect(scrub('bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl rejected')).toBe('bearer [token] rejected');
  });

  it('keeps ordinary text', () => {
    expect(scrub('Cannot read properties of undefined')).toBe('Cannot read properties of undefined');
  });
});
