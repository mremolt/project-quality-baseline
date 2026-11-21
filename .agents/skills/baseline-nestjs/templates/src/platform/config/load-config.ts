import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { Secret } from './secret.js';

export type ConfigSchema = z.ZodObject<z.ZodRawShape>;

/** A secret config value; read from KEY or from the mounted file in KEY_FILE. Pass the minimum length for signing secrets (NEST-CFG-12). */
export const secret = (minLength = 1): z.ZodType<Secret, string> =>
  z
    .string()
    .trim()
    .min(minLength)
    .transform((v) => new Secret(v))
    .meta({ secret: true });

/** Parses one config area; fails fast and names keys only, never values. */
export function parseConfig<S extends ConfigSchema>(
  schema: S,
  env: Readonly<Record<string, string | undefined>>,
): Readonly<z.output<S>> {
  const input: Record<string, string | undefined> = {};
  const bad: string[] = [];
  for (const key of Object.keys(schema.shape)) {
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
  const parsed = schema.safeParse(input);
  if (!parsed.success) bad.push(...parsed.error.issues.map((i) => i.path.join('.')));
  if (bad.length > 0 || !parsed.success) throw new Error(`Invalid configuration: ${[...new Set(bad)].join(', ')}`);
  return Object.freeze(parsed.data);
}

export const loadConfig = <S extends ConfigSchema>(schema: S): Readonly<z.output<S>> =>
  parseConfig(schema, process.env);

export interface KeyDescription {
  readonly key: string;
  readonly required: boolean;
  readonly secret: boolean;
  readonly description: string;
}

/** Keys of a schema for configuration-keys.yaml (CFG-12, TEST-CFG-04). */
export function describeKeys(schema: ConfigSchema): KeyDescription[] {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
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
