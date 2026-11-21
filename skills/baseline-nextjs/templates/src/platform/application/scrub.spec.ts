import { describe, expect, it } from 'vitest';

import { scrub } from './scrub';

describe('scrub', () => {
  it('removes query strings and fragments from URLs', () => {
    expect(scrub('GET https://shop.example/api/v1/orders?customer=42#top failed')).toBe(
      'GET https://shop.example/api/v1/orders failed',
    );
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
