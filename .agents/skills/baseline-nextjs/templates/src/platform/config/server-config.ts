import 'server-only';

import { readFileSync } from 'node:fs';

import { z } from 'zod';

import type { PublicConfig } from './public-config';
import { Secret } from './secret';

const flag = z
  .enum(['0', '1'])
  .default('0')
  .transform((v) => v === '1');
const secret = () =>
  z
    .string()
    .trim()
    .min(16)
    .transform((v) => new Secret(v))
    .meta({ secret: true }); // read by the key-list and secret-name tests (NEXT-CFG-06/09)

/** Every key a deployment sets (NEXT-CFG-02, CFG-10); configuration-keys.yaml lists the same keys (NEXT-CFG-09). */
export const ServerConfigSchema = z
  .object({
    APP_ORIGIN: z
      .url({ protocol: /^https?$/ })
      .describe('Public origin of the app; base of the OIDC redirect URIs and the server-action origin check'),
    API_BASE_URL: z.url({ protocol: /^https?$/ }).describe('Base URL of the resource server'),
    API_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(12_000)
      .describe('Deadline per backend call, ms (NEXT-RES-03)'),
    OIDC_ISSUER_URL: z.url({ protocol: /^https$/ }).describe('Issuer of the IdP'),
    OIDC_CLIENT_ID: z.string().min(1).describe('Client id of this BFF at the IdP'),
    OIDC_CLIENT_SECRET: secret().describe('Client secret (mounted file, CFG-05)'),
    OIDC_TIMEOUT_S: z.coerce.number().int().min(1).max(60).default(5).describe('Deadline per IdP call, s'),
    REDIS_URL: z
      .url({ protocol: /^rediss?$/ })
      .transform((v) => new Secret(v))
      .meta({ secret: true })
      .describe('Session store URL incl. password'),
    SESSION_IDLE_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(240)
      .default(30)
      .describe('Session idle timeout, min (NODE-BFF-07)'),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24).default(12).describe('Absolute session lifetime, h'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info').describe('pino log level'),
    ENVIRONMENT_NAME: z
      .string()
      .min(1)
      .max(30)
      .describe('Environment name in logs and error reports; never branched on'),
    ENVIRONMENT_LABEL: z
      .string()
      .max(20)
      .default('')
      .describe('Badge in the app bar outside production; empty in production'),
    RELEASE_VERSION: z
      .string()
      .min(1)
      .default('unreleased')
      .describe('Release version, injected at deploy time (REL-VER-05)'),
    GIT_COMMIT: z
      .string()
      .max(64)
      .default('unknown')
      .describe('Commit the image was built from; set in the image by the Dockerfile (NEXT-REL-15)'),
    BROWSER_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(20_000)
      .describe('Timeout of the browser HTTP mutator, ms (NEXT-RES-03)'),
    APP_ENVIRONMENT_KIND: z
      .enum(['local', 'test', 'deployed'])
      .describe('local: developer machine; test: automated test runs; deployed: every platform environment'),
    APP_TEST_STUBS: flag.describe(
      '1: answer every backend and IdP call with stubs (NEXT-D5); never in a deployed environment',
    ),
  })
  .refine((c) => !c.APP_TEST_STUBS || c.APP_ENVIRONMENT_KIND !== 'deployed', {
    path: ['APP_TEST_STUBS'],
    message: 'test stubs only in a test or local environment',
  });

export type ServerConfig = z.output<typeof ServerConfigSchema>;

/**
 * Parses the environment; the error names the invalid keys, never their values (CFG-07, NEXT-CFG-03).
 * A key may come from the file named in `<KEY>_FILE` instead, the way the secret manager mounts it (NEXT-CFG-06).
 */
export function parseServerConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig {
  const input: Record<string, string | undefined> = {};
  const bad: string[] = [];
  for (const key of Object.keys(ServerConfigSchema.shape)) {
    const file = env[`${key}_FILE`];
    if (file !== undefined && env[key] !== undefined) bad.push(`${key} (set both ${key} and ${key}_FILE)`);
    else if (file !== undefined) {
      try {
        input[key] = readFileSync(file, 'utf8');
      } catch {
        bad.push(`${key}_FILE (unreadable)`);
      }
    } else input[key] = env[key];
  }
  const result = ServerConfigSchema.safeParse(input);
  if (!result.success) bad.push(...result.error.issues.map((issue) => issue.path.join('.')));
  if (bad.length > 0 || !result.success) throw new Error(`Invalid configuration: ${[...new Set(bad)].join(', ')}`);
  return Object.freeze(result.data);
}

export interface KeyDescription {
  readonly key: string;
  readonly required: boolean;
  readonly secret: boolean;
  readonly description: string;
}

/** The schema's keys for configuration-keys.yaml (NEXT-CFG-09, TEST-CFG-04). */
export function describeKeys(): KeyDescription[] {
  const json = z.toJSONSchema(ServerConfigSchema, { io: 'input', unrepresentable: 'any' }) as {
    required?: string[];
    properties?: Record<string, { description?: string; secret?: boolean }>;
  };
  return Object.entries(json.properties ?? {}).map(([key, p]) => ({
    key,
    required: (json.required ?? []).includes(key),
    secret: p.secret === true,
    description: p.description ?? '',
  }));
}

let current: ServerConfig | undefined;

/** Reads and validates the environment once per process; `register()` calls it first (NEXT-CFG-03). */
export function serverConfig(): ServerConfig {
  current ??= parseServerConfig(process.env);
  return current;
}

/** The subset the root layout passes to the client providers, field by field (NEXT-CFG-05). */
export function publicConfig(config: ServerConfig): PublicConfig {
  return {
    environmentLabel: config.ENVIRONMENT_LABEL,
    environmentName: config.ENVIRONMENT_NAME,
    release: config.RELEASE_VERSION,
    commit: config.GIT_COMMIT,
    requestTimeoutMs: config.BROWSER_REQUEST_TIMEOUT_MS,
  };
}
