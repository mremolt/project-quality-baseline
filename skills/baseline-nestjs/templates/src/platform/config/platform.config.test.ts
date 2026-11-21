import { describe, expect, it } from 'vitest';

import { parseConfig } from './load-config.js';
import {
  AuthConfig,
  DatabaseConfig,
  HttpConfig,
  LoggingConfig,
  ReleaseConfig,
  ResilienceConfig,
} from './platform.config.js';

const auth = {
  AUTH_ISSUER: 'https://idp.test/realms/test',
  AUTH_AUDIENCE: 'orders-api',
  AUTH_JWKS_URI: 'https://idp.test/realms/test/certs',
};
const database = {
  DATABASE_HOST: 'db.test',
  DATABASE_NAME: 'orders',
  DATABASE_USER: 'orders_app',
  DATABASE_PASSWORD: 'pw',
};

/** Binding tests of the platform schemas (TEST-CFG-01): valid values bind, constraints reject, required keys fail. */
describe('platform configuration (TEST-CFG-01)', () => {
  it('binds the deployed defaults', () => {
    expect(parseConfig(HttpConfig, {})).toMatchObject({
      HTTP_PORT: 8080,
      HTTP_HANDLER_TIMEOUT_MS: 10_000,
      HTTP_TRUSTED_PROXIES: [],
      CORS_ALLOWED_ORIGINS: [],
    });
    expect(parseConfig(LoggingConfig, {}).LOG_LEVEL).toBe('info');
    expect(parseConfig(AuthConfig, auth)).toMatchObject({
      AUTH_CLOCK_TOLERANCE_SECONDS: 30,
      AUTH_JWKS_TIMEOUT_MS: 5000,
    });
    expect(parseConfig(DatabaseConfig, database)).toMatchObject({
      DATABASE_PORT: 5432,
      DATABASE_POOL_MAX: 10,
      DATABASE_CONNECTION_TIMEOUT_MS: 2000,
      DATABASE_STATEMENT_TIMEOUT_MS: 3000,
      DATABASE_TRANSACTION_TIMEOUT_MS: 5000,
      DATABASE_MIGRATION_LOCK_TIMEOUT_MS: 5000,
      DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS: 120_000,
    });
    expect(parseConfig(ReleaseConfig, {}).RELEASE_VERSION).toBe('unreleased');
    expect(parseConfig(ResilienceConfig, {}).RESILIENCE_TRANSACTION_GUARD).toBe('warn');
  });

  it('binds valid values', () => {
    expect(
      parseConfig(HttpConfig, {
        HTTP_PORT: '9090',
        HTTP_TRUSTED_PROXIES: 'proxy-a.internal, proxy-b.internal',
        CORS_ALLOWED_ORIGINS: '',
      }),
    ).toMatchObject({
      HTTP_PORT: 9090,
      HTTP_TRUSTED_PROXIES: ['proxy-a.internal', 'proxy-b.internal'],
      CORS_ALLOWED_ORIGINS: [],
    });
    expect(
      parseConfig(DatabaseConfig, {
        ...database,
        DATABASE_CONNECTION_TIMEOUT_MS: '1000',
        DATABASE_STATEMENT_TIMEOUT_MS: '2000',
        DATABASE_TRANSACTION_TIMEOUT_MS: '4000',
        DATABASE_MIGRATION_USER: 'orders_owner',
        DATABASE_MIGRATION_PASSWORD: 'pw2',
      }),
    ).toMatchObject({ DATABASE_STATEMENT_TIMEOUT_MS: 2000, DATABASE_MIGRATION_USER: 'orders_owner' });
    expect(parseConfig(ReleaseConfig, { RELEASE_VERSION: '2026.11.3' }).RELEASE_VERSION).toBe('2026.11.3');
    expect(parseConfig(ResilienceConfig, { RESILIENCE_TRANSACTION_GUARD: 'fail' }).RESILIENCE_TRANSACTION_GUARD).toBe(
      'fail',
    );
  });

  it.each([
    ['HTTP_PORT', HttpConfig, { HTTP_PORT: '70000' }],
    ['HTTP_HANDLER_TIMEOUT_MS', HttpConfig, { HTTP_HANDLER_TIMEOUT_MS: '0' }],
    ['LOG_LEVEL', LoggingConfig, { LOG_LEVEL: 'verbose' }],
    ['AUTH_ISSUER', AuthConfig, { ...auth, AUTH_ISSUER: 'idp' }],
    ['AUTH_JWKS_URI', AuthConfig, { ...auth, AUTH_JWKS_URI: 'ftp://idp.test/certs' }],
    ['AUTH_CLOCK_TOLERANCE_SECONDS', AuthConfig, { ...auth, AUTH_CLOCK_TOLERANCE_SECONDS: '600' }],
    ['DATABASE_POOL_MAX', DatabaseConfig, { ...database, DATABASE_POOL_MAX: '0' }],
    ['DATABASE_CONNECTION_TIMEOUT_MS', DatabaseConfig, { ...database, DATABASE_CONNECTION_TIMEOUT_MS: 'soon' }],
    ['DATABASE_STATEMENT_TIMEOUT_MS', DatabaseConfig, { ...database, DATABASE_STATEMENT_TIMEOUT_MS: '6000' }],
    ['RELEASE_VERSION', ReleaseConfig, { RELEASE_VERSION: ' ' }],
    ['RESILIENCE_TRANSACTION_GUARD', ResilienceConfig, { RESILIENCE_TRANSACTION_GUARD: 'off' }],
  ] as const)('rejects an invalid %s', (key, schema, env) => {
    expect(() => parseConfig(schema, env)).toThrow(key);
  });

  it.each([
    ['AUTH_ISSUER', AuthConfig, auth],
    ['AUTH_AUDIENCE', AuthConfig, auth],
    ['AUTH_JWKS_URI', AuthConfig, auth],
    ['DATABASE_HOST', DatabaseConfig, database],
    ['DATABASE_NAME', DatabaseConfig, database],
    ['DATABASE_USER', DatabaseConfig, database],
    ['DATABASE_PASSWORD', DatabaseConfig, database],
  ] as const)('fails without the required %s', (key, schema, env) => {
    const rest = Object.fromEntries(Object.entries(env).filter(([name]) => name !== key));
    expect(() => parseConfig(schema, rest)).toThrow(key);
  });
});
