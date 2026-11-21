import { describe, expect, it } from 'vitest';

import { backendUrl } from './backend-url';

const BASE = 'http://backend.test';

describe('backendUrl (path steering)', () => {
  it('resolves an API path and keeps the query', () => {
    expect(backendUrl('/api/v1/orders?page=0', BASE)?.href).toBe('http://backend.test/api/v1/orders?page=0');
  });

  it.each([
    ['a dot-dot segment', '/api/v1/orders/../cancel'],
    ['a dot segment', '/api/v1/./orders'],
    ['an encoded dot-dot segment', '/api/v1/orders/%2e%2E/cancel'],
    ['a mixed dot segment', '/api/v1/orders/.%2e/cancel'],
    ['an encoded slash', '/api/v1/orders/..%2Fadmin/cancel'],
    ['an encoded backslash', '/api/v1/orders/x%5c..%5cadmin'],
    ['a backslash', '/api/v1/orders/..\\admin'],
    ['a path outside the API', '/actuator/env'],
    ['an absolute URL', 'http://elsewhere.test/api/v1/orders'],
    ['a protocol-relative URL', '//elsewhere.test/api/v1/orders'],
  ])('refuses %s', (_, path) => {
    expect(backendUrl(path, BASE)).toBeUndefined();
  });

  it('allows dots inside a segment', () => {
    expect(backendUrl('/api/v1/files/report.v2.pdf', BASE)?.pathname).toBe('/api/v1/files/report.v2.pdf');
  });
});
