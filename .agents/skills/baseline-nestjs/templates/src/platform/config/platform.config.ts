import { z } from 'zod';

import { secret } from './load-config.js';

export const HttpConfig = z.object({
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8080).describe('Port of the API and the probes'),
  HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576).describe('Maximum request body size'),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30_000)
    .describe('Request budget (RES-TMO ladder)'),
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
});
export type AuthConfig = Readonly<z.output<typeof AuthConfig>>;
export const AUTH_CONFIG = Symbol('AuthConfig');

export const DatabaseConfig = z.object({
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
  DATABASE_MIGRATION_USER: z.string().min(1).optional().describe('DDL user for migrations; only in the migration job'),
  DATABASE_MIGRATION_PASSWORD: secret().optional().describe('Password of the DDL user; only in the migration job'),
});
export type DatabaseConfig = Readonly<z.output<typeof DatabaseConfig>>;
export const DATABASE_CONFIG = Symbol('DatabaseConfig');
