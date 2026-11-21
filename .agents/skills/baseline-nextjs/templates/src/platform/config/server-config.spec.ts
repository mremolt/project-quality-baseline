import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { describeKeys, parseServerConfig, publicConfig } from './server-config';

const valid = {
  APP_ORIGIN: 'https://shop.test',
  API_BASE_URL: 'http://orders-backend:8080',
  OIDC_ISSUER_URL: 'https://idp.test/realms/shop',
  OIDC_CLIENT_ID: 'shop',
  OIDC_CLIENT_SECRET: 'client-secret-0123456789',
  REDIS_URL: 'redis://:password@redis:6379',
  ENVIRONMENT_NAME: 'prod',
  APP_ENVIRONMENT_KIND: 'deployed',
};

describe('server configuration (TEST-CFG-01)', () => {
  it('binds valid values with defaults on the timeout ladder (NEXT-RES-03)', () => {
    const config = parseServerConfig(valid);

    expect(config.API_TIMEOUT_MS).toBe(12_000);
    expect(config.BROWSER_REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(config.SESSION_IDLE_MINUTES).toBe(30);
    expect(config.RELEASE_VERSION).toBe('unreleased');
    expect(config.APP_TEST_STUBS).toBe(false);
  });

  it('never prints a secret (TEST-CFG-03)', () => {
    const config = parseServerConfig(valid);

    expect(JSON.stringify(config)).not.toContain('client-secret');
    expect(inspect(config)).not.toContain('password');
    expect(config.OIDC_CLIENT_SECRET.reveal()).toBe('client-secret-0123456789');
  });

  it.each([
    ['a missing required key', { ...valid, OIDC_CLIENT_ID: undefined }, 'OIDC_CLIENT_ID'],
    ['a missing environment kind', { ...valid, APP_ENVIRONMENT_KIND: undefined }, 'APP_ENVIRONMENT_KIND'],
    ['a plain-HTTP issuer', { ...valid, OIDC_ISSUER_URL: 'http://idp.test' }, 'OIDC_ISSUER_URL'],
    ['a time-out out of range', { ...valid, API_TIMEOUT_MS: '0' }, 'API_TIMEOUT_MS'],
    ['a backend URL with a path', { ...valid, API_BASE_URL: 'http://gateway:8080/orders' }, 'API_BASE_URL'],
  ])('rejects %s and names the key', (_, env, key) => {
    expect(() => parseServerConfig(env)).toThrow(key);
  });

  it('never puts a value into the error message (CFG-07)', () => {
    expect(() => parseServerConfig({ ...valid, OIDC_CLIENT_SECRET: 'too-short' })).toThrow(
      'Invalid configuration: OIDC_CLIENT_SECRET',
    );
    expect(() => parseServerConfig({ ...valid, OIDC_CLIENT_SECRET: 'too-short' })).not.toThrow('too-short');
  });

  it('maps the public subset field by field, without secrets (NEXT-CFG-05)', () => {
    const config = parseServerConfig({ ...valid, RELEASE_VERSION: '1.4.0', GIT_COMMIT: 'abc123' });

    expect(publicConfig(config)).toEqual({
      environmentLabel: '',
      environmentName: 'prod',
      release: '1.4.0',
      commit: 'abc123',
      requestTimeoutMs: 20_000,
      clientErrorPath: '/client-errors',
    });
  });
});

describe('secrets from mounted files (NEXT-CFG-06)', () => {
  const secretFile = (content: string): string => {
    const file = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'secret');
    writeFileSync(file, content);
    return file;
  };

  it('reads KEY_FILE and trims the trailing newline', () => {
    const env = {
      ...valid,
      OIDC_CLIENT_SECRET: undefined,
      OIDC_CLIENT_SECRET_FILE: secretFile('from-file-0123456789\n'),
    };

    expect(parseServerConfig(env).OIDC_CLIENT_SECRET.reveal()).toBe('from-file-0123456789');
  });

  it('refuses KEY and KEY_FILE together', () => {
    const env = { ...valid, OIDC_CLIENT_SECRET_FILE: secretFile('from-file-0123456789') };

    expect(() => parseServerConfig(env)).toThrow('set both OIDC_CLIENT_SECRET and OIDC_CLIENT_SECRET_FILE');
  });

  it('refuses an unreadable file', () => {
    const env = { ...valid, OIDC_CLIENT_SECRET: undefined, OIDC_CLIENT_SECRET_FILE: '/nonexistent/secret' };

    expect(() => parseServerConfig(env)).toThrow('OIDC_CLIENT_SECRET_FILE (unreadable)');
  });

  it('builds every key that names a secret with secret() (NEXT-CFG-06)', () => {
    const named = describeKeys().filter((k) => /SECRET|PASSWORD|TOKEN|API_KEY|CREDENTIAL/.test(k.key));

    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((k) => !k.secret).map((k) => k.key)).toEqual([]);
  });
});

describe('test-stub guard (NEXT-CFG-07, NEXT-TEST-11)', () => {
  it('refuses the stubs in a deployed environment', () => {
    expect(() => parseServerConfig({ ...valid, APP_TEST_STUBS: '1' })).toThrow('APP_TEST_STUBS');
  });

  it.each(['test', 'local'])('accepts the stubs in a %s environment', (kind) => {
    expect(parseServerConfig({ ...valid, APP_ENVIRONMENT_KIND: kind, APP_TEST_STUBS: '1' }).APP_TEST_STUBS).toBe(true);
  });

  it.each(['test', 'local', 'deployed'])('keeps the stubs off by default in a %s environment', (kind) => {
    expect(parseServerConfig({ ...valid, APP_ENVIRONMENT_KIND: kind }).APP_TEST_STUBS).toBe(false);
  });
});
