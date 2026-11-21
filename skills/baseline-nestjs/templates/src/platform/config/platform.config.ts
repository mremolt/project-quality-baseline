import { z } from 'zod';

import { secret } from './load-config.js';

export const HttpConfig = z.object({
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8080).describe('Port of the API and the probes'),
  HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576).describe('Maximum request body size'),
  HTTP_MAX_HEADER_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(16_384)
    .describe('Maximum size of the request headers; larger get 431 (NEST-SEC-22)'),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30_000)
    .describe('Time to receive a whole request, slow-client guard (NEST-SEC-22)'),
  HTTP_HANDLER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000)
    .describe('Request budget: a handler running longer gets 503 (RES-TMO-04, NEST-SEC-22)'),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(72_000)
    .describe('Idle keep-alive time; longer than the idle timeout of the proxy in front (NEST-SEC-22)'),
  HTTP_TRUSTED_PROXIES: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    )
    .describe('Comma-separated addresses or CIDRs of the proxies in front; empty: none (NEST-SEC-11)'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .describe('Comma-separated browser origins allowed to call the API'),
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).default(5000).describe('Readiness drain before the server closes'),
});
export type HttpConfig = Readonly<z.output<typeof HttpConfig>>;
export const HTTP_CONFIG = Symbol('HttpConfig');

export const LoggingConfig = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info').describe('Log level'),
});
export type LoggingConfig = Readonly<z.output<typeof LoggingConfig>>;

export const AuthConfig = z.object({
  AUTH_ISSUER: z.url().describe('Expected iss of access tokens'),
  AUTH_AUDIENCE: z.string().min(1).describe('Expected aud of access tokens'),
  AUTH_JWKS_URI: z.url({ protocol: /^https?$/ }).describe('Key set of the identity provider'),
  AUTH_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).max(120).default(30).describe('Clock skew allowed'),
  AUTH_JWKS_TIMEOUT_MS: z.coerce.number().int().positive().default(5000).describe('Timeout of a key set fetch'),
  AUTH_JWKS_COOLDOWN_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30_000)
    .describe('Minimum time between key set fetches for an unknown kid (NEST-SEC-03)'),
  AUTH_JWKS_CACHE_MAX_AGE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(600_000)
    .describe('Maximum age of the cached key set (NEST-SEC-03)'),
});
export type AuthConfig = Readonly<z.output<typeof AuthConfig>>;
export const AUTH_CONFIG = Symbol('AuthConfig');

export const DatabaseConfig = z
  .object({
    DATABASE_HOST: z.string().min(1).describe('PostgreSQL host'),
    DATABASE_PORT: z.coerce.number().int().default(5432).describe('PostgreSQL port'),
    DATABASE_NAME: z.string().min(1).describe('Database name'),
    DATABASE_USER: z.string().min(1).describe('Runtime user (DML only)'),
    DATABASE_PASSWORD: secret().describe('Password of the runtime user'),
    DATABASE_POOL_MAX: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Pool size per instance (RES-CAP-02)'),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30_000)
      .default(2000)
      .describe('Wait for a pool slot plus connecting, ms; then 503 (NEST-RES-01/04)'),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .default(3000)
      .describe('statement_timeout of the application pool, ms; below the transaction timeout (NEST-RES-01)'),
    DATABASE_TRANSACTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .default(5000)
      .describe(
        'transaction_timeout and idle_in_transaction_session_timeout of the application pool, ms; below the request budget (NEST-DB-04, RES-TX-02)',
      ),
    DATABASE_MIGRATION_USER: z
      .string()
      .min(1)
      .optional()
      .describe('DDL user; set only where the service migrates at start-up, and in the migration job (NEST-REL-01/03)'),
    DATABASE_MIGRATION_PASSWORD: secret()
      .optional()
      .describe('Password of the DDL user; set together with the DDL user'),
    DATABASE_MIGRATION_LOCK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5000)
      .describe('lock_timeout of migration DDL (NEST-DB-16, REL-DB-03)'),
    DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(120_000)
      .describe('statement_timeout of the migration connection, the migration budget (NEST-DB-16, REL-DB-04)'),
  })
  .refine((c) => c.DATABASE_STATEMENT_TIMEOUT_MS < c.DATABASE_TRANSACTION_TIMEOUT_MS, {
    path: ['DATABASE_STATEMENT_TIMEOUT_MS'], // timeout ladder: statement < transaction (RES-TMO-04)
  });
export type DatabaseConfig = Readonly<z.output<typeof DatabaseConfig>>;
export const DATABASE_CONFIG = Symbol('DatabaseConfig');

export const ReleaseConfig = z.object({
  RELEASE_VERSION: z
    .string()
    .trim()
    .min(1)
    .default('unreleased')
    .describe('Release version, injected at deploy time; logged at start (NEST-REL-06, REL-VER-05)'),
});
export type ReleaseConfig = Readonly<z.output<typeof ReleaseConfig>>;

export const ResilienceConfig = z.object({
  RESILIENCE_TRANSACTION_GUARD: z
    .enum(['fail', 'warn'])
    .default('warn')
    .describe('A remote call inside a transaction: fail (integration tests) or log a warning (NEST-RES-03)'),
});
export type ResilienceConfig = Readonly<z.output<typeof ResilienceConfig>>;
export const RESILIENCE_CONFIG = Symbol('ResilienceConfig');
