# NestJS: Configuration

How a NestJS backend binds, validates and receives its configuration and secrets. Shared rules: [configuration.md](configuration.md) (`CFG-*`). Paths are relative to `backend/`.

## Rules

### Binding and validation

- **NEST-CFG-01: Each configuration area is one zod object schema, parsed once at start-up into a frozen, typed object** (CFG-08). The schema lives next to what it configures: an outgoing adapter's schema in its adapter folder (`adapter/out/http/payment-client.config.ts`), shared areas (HTTP server, logging, database) in `src/platform/config`. Every key has a constraint (`z.url({ protocol: /^https$/ })`, `z.coerce.number().int().min(…).max(…)`, `z.enum([…])`) and a `.describe()` text with meaning and unit (CFG-10). Numbers carry their unit in the key name (`_MS`, `_BYTES`); environment variables are strings, so numbers use `z.coerce`. A default only where the value is right for every deployed environment (CFG-03).

```ts
// features/payments/adapter/out/http/payment-client.config.ts
import { z } from 'zod';
import { secret } from '../../../../../platform/config/load-config.js';

export const PaymentClientConfig = z.object({
  PAYMENT_BASE_URL: z.url({ protocol: /^https$/ }).describe('Base URL of the payment provider'),
  PAYMENT_READ_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(2000).describe('Deadline per call, ms (RES-TMO-04)'),
  PAYMENT_API_KEY: secret().describe('API key for the payment provider'),
});
export type PaymentClientConfig = Readonly<z.output<typeof PaymentClientConfig>>;
export const PAYMENT_CLIENT_CONFIG = Symbol('PaymentClientConfig');
```

- **NEST-CFG-02: `src/platform/config/load-config.ts` is the only code that reads `process.env`** (NODE-ARCH-12, CFG-09). It offers `loadConfig(schema)` (reads the environment), `parseConfig(schema, env)` (pure, for tests), the `secret()` schema helper and `describeKeys(schema)` (for the key-list test). A failure throws one error that lists every bad key **by name only**, never a value: a value may be a secret (CFG-07). ESLint enforces the boundary with `no-restricted-properties` on `process.env` **and** `no-restricted-imports` for `process` and `node:process`, both off only in `src/platform/config/**`; the first rule alone misses `import { env } from 'node:process'`.

```ts
// src/platform/config/load-config.ts
export const secret = (minLength = 1) => z.string().trim().min(minLength).transform((v) => new Secret(v)).meta({ secret: true });

export function parseConfig<S extends z.ZodObject<z.ZodRawShape>>(schema: S, env: Readonly<Record<string, string | undefined>>): Readonly<z.output<S>> {
  const input: Record<string, string | undefined> = {};
  const bad: string[] = [];
  for (const key of Object.keys(schema.shape)) {
    const file = env[`${key}_FILE`];                                   // mounted secret file (NEST-CFG-07)
    if (file !== undefined && env[key] !== undefined) bad.push(`${key} (set both ${key} and ${key}_FILE)`);
    else if (file !== undefined) {
      try { input[key] = readFileSync(file, 'utf8'); } catch { bad.push(`${key}_FILE (unreadable)`); }
    } else input[key] = env[key];
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) bad.push(...parsed.error.issues.map((i) => i.path.join('.')));
  if (bad.length > 0 || !parsed.success) throw new Error(`Invalid configuration: ${[...new Set(bad)].join(', ')}`);
  return Object.freeze(parsed.data);
}

export const loadConfig = <S extends z.ZodObject<z.ZodRawShape>>(schema: S) => parseConfig(schema, process.env);
```

- **NEST-CFG-03: A configuration object reaches its adapter through a token, provided by the context module:** `{ provide: PAYMENT_CLIENT_CONFIG, useFactory: () => loadConfig(PaymentClientConfig) }`, injected with `@Inject(PAYMENT_CLIENT_CONFIG)`. Nest runs the factories inside `NestFactory.create`, so an invalid value stops the process before it listens (CFG-08). Settings a use case needs (limits, business time windows) are read the same way and passed as plain values into the use case's constructor in its `useFactory`; `domain`, `ports` and `application` never import a schema, the loader or `process` (the dependency-cruiser allow-list of NODE-ARCH-04 already forbids it). Tests build the object with `parseConfig(schema, { … })` or as a literal.
- **NEST-CFG-04: `@nestjs/config` is not used.** Its `ConfigService.get('KEY')` is a string lookup at the point of use (CFG-08 forbids that), and its `.env` loading duplicates Node's `--env-file`. The loader above plus one provider per area does the same job with typed objects and no extra dependency.
- **NEST-CFG-05: Keys are the environment variable names:** `UPPER_SNAKE_CASE` with the area as prefix (`PAYMENT_*`, `DATABASE_*`, `HTTP_*`, `LOG_*`). Own keys never start with a prefix that a library reads (`NODE_`, `OTEL_`, `PG`, `UV_`). Keys read by libraries themselves (`OTEL_*` of the telemetry SDK, [../observability/nestjs.md](../observability/nestjs.md)) are not parsed by own schemas, but a deployment sets them, so they are in the key list (NEST-CFG-10).

### Environments

- **NEST-CFG-06: Deployed environments differ only in injected values** (CFG-02/04). No `.env.<environment>` files, no configuration directory in the image, no code that branches on an environment name. `NODE_ENV` is `production` in the image for every deployed environment (libraries read it) and own code never reads it. Local values live in a committed `.env.local` with throwaway values only (SEC-INC-03), loaded only by the local start script with `node --env-file=.env.local` ([../../07-deployment-view/nestjs-local-development.md](../../07-deployment-view/nestjs-local-development.md)); the image never contains it. Tests pass values to `parseConfig` or set them in the test setup, never through a shared file.

### Secrets

- **NEST-CFG-07: Secrets come from files mounted by the platform** (CFG-05): for a secret key `KEY` the deployment sets `KEY_FILE=/run/secrets/<name>` and the loader reads the file (trailing whitespace is trimmed by the schema). Where the platform cannot mount files, `KEY` itself is set; the product records that fallback in chapter 7. Setting both, or pointing `KEY_FILE` at an unreadable file, fails the start. The running service's database user is not the migration user ([../persistence/nestjs.md](../persistence/nestjs.md)); every credential rotates by updating the secret and doing a rolling restart (CFG-06). No live reload of secrets.
- **NEST-CFG-08: Every secret value has the type `Secret`** (CFG-07), produced by the `secret()` schema helper. The class in `src/platform/config/secret.ts` keeps the value in a private field and masks every printing path: `String()`, template literals, `JSON.stringify` (pino uses it), `util.inspect` (`console`, Node error output) and object spread all yield `***` or nothing. Adapters call `reveal()` only where the value is handed to a client library. A unit test fails when a key whose name contains `PASSWORD`, `SECRET`, `TOKEN`, `API_KEY` or `CREDENTIAL` is not built with `secret()` (it checks `describeKeys(schema)[…].secret` for every schema of NEST-CFG-10).

```ts
// src/platform/config/secret.ts
import { inspect } from 'node:util';

export class Secret {
  readonly #value: string;
  constructor(value: string) {
    if (value.trim() === '') throw new Error('secret must not be blank');
    this.#value = value;
  }
  reveal(): string { return this.#value; }
  toString(): string { return '***'; }
  toJSON(): string { return '***'; }
  [inspect.custom](): string { return '***'; }
}
```

- **NEST-CFG-09: Configuration is never dumped:** no log line with a configuration object or `process.env`, no endpoint that returns configuration, no stack trace that includes it.

- **NEST-CFG-12: `secret(minLength)` states the strength of a secret, and keys with a format state it in the schema.** The helper takes the minimum length (`secret(32)` for a session or cookie signing secret, `secret()` only where the length is the provider's choice); a key with a fixed format (a base64 encryption key that must decode to exactly 32 bytes, a PEM) is refined in the schema, so a weak or malformed value fails at config load with the key name, never later in a constructor or on first use. A description that says "32 characters or more" without the check is a defect.
  *Why:* `z.string().min(1)` starts a production instance with a one-character signing secret.
- **NEST-CFG-13: Switches that only make sense locally are refused in a deployed environment.** `APP_ENVIRONMENT_KIND` (`local`, `test` or `deployed`) is a required key without a default (like `NEXT-CFG-07`): every deployment states `deployed`, the committed `.env.local` states `local`, the test setup `test`. The schema refuses `OIDC_ALLOW_INSECURE_HTTP`, test stubs, development certificates and similar keys unless the kind is `local` or `test`, and the start refuses a secret that equals the throwaway value of the committed `.env.local` when the kind is `deployed`. The template defines no such switch; the product adds the key together with the first one.
  *Why:* the throwaway values in the committed `.env.local` (NEST-DEV-06) are public; a deployment that copies the file or keeps an insecure-transport switch has forged sessions or a downgraded login.

### Key list

- **NEST-CFG-10: `configuration-keys.yaml` in `backend/` lists every key a deployment sets** (CFG-12): the keys of all own schemas plus library keys such as `OTEL_SERVICE_NAME` and `OTEL_EXPORTER_OTLP_ENDPOINT`. A secret key is listed under its own name with `secret: true`; the `_FILE` variant is how it is delivered, not a second key. `src/config-schemas.ts` (a composition-root file next to `app.module.ts`) exports the array of all schemas; the key-list test reads it.

```ts
// src/configuration-keys.test.ts (TEST-CFG-04): yaml is a dev dependency
const own = configSchemas.flatMap(describeKeys);
const listed = parse(readFileSync('configuration-keys.yaml', 'utf8')) as { key: string; required: boolean; secret: boolean }[];
const libraryKey = (key: string) => /^(OTEL_|NODE_)/.test(key);
const pick = ({ key, required, secret }: { key: string; required: boolean; secret: boolean }) => ({ key, required, secret });
const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);

expect(listed.filter((k) => !libraryKey(k.key)).map(pick).sort(byKey)).toEqual(own.map(pick).sort(byKey));
```

`describeKeys` builds the entries from `z.toJSONSchema(schema, { io: 'input' })`: a key with a default is not required, and the `secret` flag comes from the metadata that `secret()` sets.

### BFF: serving the frontend configuration

- **NEST-CFG-11: A NestJS BFF serves `GET /config.json`** (CFG-11) from a validated `FRONTEND_*` schema, mapped to an explicit response schema (never a dump of the environment or of a configuration object). The controller lives in the BFF's `adapter/in/rest`, is `@Public()` with the stated reason "public bootstrap data" ([../security/nestjs.md](../security/nestjs.md)), sets `Cache-Control: no-store`, and contains public values only, including the release version (`RELEASE_VERSION`, injected at deploy time, `unreleased` before a release, REL-VER-05) for error reports and the chunk-reload guard of the frontend.

## Tests

| What | How |
|---|---|
| Binding and validation (TEST-CFG-01) | Unit test per schema with `parseConfig(schema, { … })`: valid values bind; each violated constraint and each missing required key throws with the key name and without the value; `KEY_FILE` is read; `KEY` plus `KEY_FILE` fails (template: `load-config.test.ts` for the loader, `platform.config.test.ts` for the platform schemas) |
| Secret masking (TEST-CFG-03) | Unit test of `Secret`: `String`, template literal, `JSON.stringify`, `util.inspect` and a pino line of an object that holds it do not contain the value (template: `secret.test.ts`); plus the secret-name test of NEST-CFG-08 (template: `configuration-keys.test.ts`, over the schemas and the YAML) |
| Key list (TEST-CFG-04) | `configuration-keys.test.ts` (NEST-CFG-10), compares key, `required` and `secret` in both directions |
| Use-case settings | Unit test passes the values to the constructor |
| `/config.json` | Controller test: 200 without authentication, exact JSON keys, `Cache-Control: no-store` |
| Deployed defaults (TEST-CFG-02) | The smoke start of the image ([../../07-deployment-view/nestjs-delivery.md](../../07-deployment-view/nestjs-delivery.md)) sets only the required keys of `configuration-keys.yaml` and no `.env.local` |

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Configuration".*
