# Next.js: Configuration

How a Next.js app binds, validates and hands out its configuration and secrets. Shared rules: [configuration.md](configuration.md) (`CFG-*`). The Next.js app is its own image and its own BFF (NEXT-D2), so it reads its configuration from the environment at run time on the server and passes a public subset to the browser (NEXT-D7); the (React SPA) rules of [react.md](react.md) (`/config.json`, REACT-CFG-01..06) do not apply. Local values: [NEXT-DEV-03](../../07-deployment-view/nextjs-local-development.md); image and release version: [nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md). Paths are relative to `frontend/`.

Rules marked *verified* were built in the baseline's Next.js reference app (Next.js 16.4, zod 4.6) or a copy of it; *to verify before first use* items are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Rules

### One build, values at run time

- **NEXT-CFG-01: One build serves every environment; per-environment values are read on the server at run time, never inlined at build time.** Replaces REACT-CFG-01 for Next.js (CFG-02/03).
  - `NEXT_PUBLIC_*` variables are banned for per-environment values: Next.js inlines them into client **and** server chunks at `next build` (*verified*: a `NEXT_PUBLIC_PROBE` value set at build time appeared in a client chunk and an SSR chunk). The `env` key of `next.config.ts` inlines the same way and is not used for them either.
  - Build-time values are limited to constants identical in every deployment: the commit (`GIT_COMMIT` build argument, which also sets `deploymentId`, [NEXT-REL-15/17](../../07-deployment-view/nextjs-delivery.md)).
  - No `.env`, `.env.production` or `.env.<environment>` file is committed: Next.js loads `.env` and `.env.production` during `next build`. The committed local file is `.env.development`, which only `next dev` loads ([NEXT-DEV-03](../../07-deployment-view/nextjs-local-development.md)); `.dockerignore` excludes `.env*`, so no such file reaches the image build.
  - `test/one-build.spec.ts` fails when a file in `src/` names a `NEXT_PUBLIC_` variable or when the component folder contains `.env`, `.env.local`, `.env.production` or `.env.production.local` (*verified*: green on the template, red with a probe of each kind).
- **NEXT-CFG-02: The server configuration is one zod schema in `src/platform/config/server-config.ts`, which starts with `import 'server-only'`** (CFG-08, CFG-10). Every key is constrained (`z.url({ protocol })`, `z.coerce.number().int().min().max()`, `z.enum([…])`) and documented with `.describe()` (meaning and unit; the key-list test reads it, NEXT-CFG-09). Keys are the environment variable names in `UPPER_SNAKE_CASE` with an area prefix (`API_*`, `OIDC_*`, `SESSION_*`, `REDIS_*`), units in the name (`_MS`, `_S`, `_MINUTES`); own keys never start with a prefix a library reads (`NEXT_`, `NODE_`, `OTEL_`). A default only where it is right for every deployed environment (CFG-03). Larger features may add their own schema next to their adapter and merge it into the platform schema; one parse covers all.

```ts
// src/platform/config/server-config.ts (excerpt)
import 'server-only';

const flag = z.enum(['0', '1']).default('0').transform((v) => v === '1');
const secret = () => z.string().trim().min(16).transform((v) => new Secret(v)).meta({ secret: true }); // NEXT-CFG-06

export const ServerConfigSchema = z
  .object({
    APP_ORIGIN: z.url({ protocol: /^https?$/ }).describe('Public origin of the app; base of the OIDC redirect URIs (never the Host header)'),
    API_BASE_URL: z
      .url({ protocol: /^https?$/ })
      .refine((v) => new URL(v).pathname === '/' && new URL(v).search === '') // origin only: a path would be dropped silently
      .describe('Origin of the resource server, without a path: the spec paths start with /api/'),
    API_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(12_000).describe('Total deadline of one proxied call or server fetch: session lookup, token refresh, backend; ms (NEXT-RES-03)'),
    OIDC_ISSUER_URL: z.url({ protocol: /^https$/ }).describe('Issuer of the IdP'),
    OIDC_CLIENT_ID: z.string().min(1).describe('Client id of this BFF at the IdP'),
    OIDC_CLIENT_SECRET: secret().describe('Client secret (mounted file, CFG-05)'),
    OIDC_TIMEOUT_S: z.coerce.number().int().min(1).max(60).default(5).describe('Deadline per IdP call, s'),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).transform((v) => new Secret(v)).meta({ secret: true }).describe('Session store URL incl. password'),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).max(240).default(30).describe('Session idle timeout, min (NODE-BFF-07)'),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24).default(12).describe('Absolute session lifetime, h'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info').describe('pino log level'),
    ENVIRONMENT_NAME: z.string().min(1).max(30).describe('Environment name in logs and error reports; never branched on'),
    ENVIRONMENT_LABEL: z.string().max(20).default('').describe('Badge in the app bar outside production; empty in production'),
    RELEASE_VERSION: z.string().min(1).default('unreleased').describe('Release version, injected at deploy time (REL-VER-05)'),
    BROWSER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000).describe('Timeout of the browser HTTP mutator, ms (NEXT-RES-03)'),
    APP_ENVIRONMENT_KIND: z.enum(['local', 'test', 'deployed']).describe('local: developer machine; test: automated test runs; deployed: every platform environment'),
    APP_TEST_STUBS: flag.describe('1: answer every backend and IdP call with stubs (NEXT-D5); never in a deployed environment'),
  })
  .refine((c) => !c.APP_TEST_STUBS || c.APP_ENVIRONMENT_KIND !== 'deployed', {
    path: ['APP_TEST_STUBS'],
    message: 'test stubs only in a test or local environment',
  });
```

- **NEXT-CFG-03: The configuration is parsed once, when the server starts, in `register()` of `src/instrumentation.ts`; an invalid value ends the process with exit code 1 and a message that names the keys, never their values.** `serverConfig()` parses `process.env` on its first call and keeps the frozen result; `register()` calls it before anything else (telemetry, stubs). Nothing parses configuration or connects to a dependency at module import: `next build` evaluates route modules without the runtime environment, so a module-level parse breaks the build (*verified*). `register()` does not run during `next build` (*verified*: a build without any environment succeeds with the call in place).

```ts
// src/instrumentation.ts (excerpt)
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { serverConfig } = await import('./platform/config/server-config');
  let config;
  try {
    config = serverConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid configuration'); // key names only (CFG-07)
    process.exit(1);
  }
  // … telemetry, then test stubs only if config.APP_TEST_STUBS (NEXT-CFG-07)
}
```

  `next build` prints one warning for this file, "A Node.js API is used (process.exit …) which is not supported in the Edge Runtime": Next.js also compiles `instrumentation.ts` for the Edge runtime, where `register()` returns at its first line. The warning is expected and does not fail the build.

  Without the `try`/`exit`, Next.js 16.4 logs "Failed to preload entries", keeps the process running and answers **every** request with `500`, `/livez` included (*verified*); with it the process stops before the first request (*verified*). `parseServerConfig(env)` throws one `Error` listing the invalid keys by name (`Invalid configuration: OIDC_CLIENT_ID, APP_TEST_STUBS`) built from the zod issues' paths, so no value, which may be a secret, reaches the log.
- **NEXT-CFG-04: Only `src/platform/config` reads `process.env`; everything else gets typed values from the composition.** ESLint `no-restricted-properties` on `process.env` is off only in `src/platform/config/**`, `src/instrumentation.ts` (which reads only `NEXT_RUNTIME`), `next.config.ts` (the build-time `GIT_COMMIT`) and the E2E server script (*verified*); `no-restricted-imports` for `process` and `node:process` closes the `import { env } from 'node:process'` gap. Server-side adapters receive their values from `platform.composition.server.ts` or the feature's `<feature>.composition.server.ts`; use cases get single values as constructor arguments; `domain`, `ports` and `application` never import the configuration (CFG-09, dependency-cruiser). `proxy.ts` reads `serverConfig()` through the platform's server entry (it needs `APP_ORIGIN`, NEXT-SEC-05).

### Public configuration for the browser

- **NEXT-CFG-05: The browser gets an explicit public subset, mapped on the server and passed by the root layout to a client provider.** Replaces REACT-CFG-02..04 for Next.js (CFG-11 intent: runtime values from the serving origin, public only).
  - `PublicConfig` (`src/platform/config/public-config.ts`, isomorphic, exported by `src/platform/index.ts`) is a plain interface; `publicConfig(config)` in `server-config.ts` maps it field by field, never by spreading the server configuration.
  - The root layout (a server component) calls `publicRuntimeConfig()` from `@/platform/index.server` and passes the object to the root client providers, which render `PublicConfigProvider` (`'use client'`, `src/platform/adapter/in/ui/public-config.client.tsx`). Client components read it with `usePublicConfig()`, which throws outside the provider (REACT-ARCH-09).
  - Fields: `environmentLabel`, `environmentName`, `release`, `commit` (error reports, REACT-OBS-05; [NEXT-REL-15](../../07-deployment-view/nextjs-delivery.md)) `requestTimeoutMs` (the browser mutator's timeout, REACT-API) and `clientErrorPath` (`/client-errors`, the BFF's error intake, NEXT-OBS-18; a constant fixed by the route file, not a configuration key). The root client providers hand the values to code outside React in their lazy `useState` initializer: `configureHttp()` gets the timeout ([NEXT-API-05](../api/nextjs-openapi-clients.md)), the error-reporting service gets environment and release, `HttpErrorReporting` the intake path (*verified* in the template).
  - The object is serialized into every HTML page and is public (TS-SEC-04, NEXT-SEC-06): no secret, no internal host name, no backend URL. A new field is reviewed like an API change.

```tsx
// src/app/layout.tsx (excerpt)
export default async function RootLayout({ children }: { readonly children: ReactNode }): Promise<ReactNode> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;   // NEXT-SEC-03
  return (
    <html lang={await getLocale()}>
      <body>
        <NextIntlClientProvider>
          <Providers nonce={nonce} publicConfig={publicRuntimeConfig()}>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### Secrets

- **NEXT-CFG-06: Secrets come from the secret manager as mounted files, are held in the `Secret` type and never leave the server** (CFG-05..07). For a secret key `KEY` the deployment sets `KEY_FILE=/run/secrets/<name>`; the parser reads the file, and setting both `KEY` and `KEY_FILE` or an unreadable file fails the start (*verified*: unit tests for file, both set and unreadable file; the image read `OIDC_CLIENT_SECRET_FILE` from a read-only mount). Every secret value is transformed into `Secret` (`src/platform/config/secret.ts`): a private field, `reveal()`, and a fixed mask from `toString()`, `toJSON()` and `util.inspect` (*verified*: `JSON.stringify` and `inspect` of the parsed configuration contain neither the client secret nor the Redis password). Adapters call `reveal()` only where the value goes into a client library (`ClientSecretBasic`, `createClient({ url })`). `secret()` tags the schema with `.meta({ secret: true })`; a unit test fails when a key whose name contains `SECRET`, `PASSWORD`, `TOKEN`, `API_KEY` or `CREDENTIAL` lacks the tag (*verified*). `REDIS_URL` carries its password and is tagged too. The configuration is never logged or returned by an endpoint; `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not set at all (NEXT-SEC-07). Rotation: update the secret, rolling restart (CFG-06); no live reload.

### Test mode

- **NEXT-CFG-07: `APP_TEST_STUBS` starts the stubs only when `APP_ENVIRONMENT_KIND` is `test` or `local`; the schema refuses it in a deployed environment.** `APP_ENVIRONMENT_KIND` is required and has no default, so every deployment states `deployed`; `.env.development` sets `local`, the stubbed E2E server sets `test`. `register()` starts the MSW stubs from `config.APP_TEST_STUBS`, never from `process.env` directly, so the refinement of NEXT-CFG-02 is the guard (NEXT-SEC-13). `APP_ENVIRONMENT_KIND` exists only for this guard: no other code branches on it, and no code branches on `ENVIRONMENT_NAME` (CFG-04). Tests: the schema rejects `APP_TEST_STUBS=1` with `deployed` and accepts it with `test` and `local`. *Verified* in a copy of the reference app: `deployed` with the flag → exit 1 before the first request; `test` → the stubbed E2E suite passes.

### Release version

- **NEXT-CFG-08: The release version is injected at deploy time as `RELEASE_VERSION`; the commit is the only build constant** (CFG-02, REL-VER-05, [NEXT-REL-15](../../07-deployment-view/nextjs-delivery.md)). `RELEASE_VERSION` defaults to `unreleased` for local and test runs; the deployment sets it for every release. Both values go to logs at start, to telemetry (`service.version`, [observability/nextjs.md](../observability/nextjs.md)) and to the public configuration. The server reads the commit from `GIT_COMMIT`, which the Dockerfile sets in the runtime stage from the same build argument (*verified*: the image logged `"commit":"abc1234"` at start).

### Key list

- **NEXT-CFG-09: `frontend/configuration-keys.yaml` lists every key a deployment sets** (CFG-12): all keys of the server schema plus the keys read by Next.js, Node and libraries that a deployment sets (`PORT`, `HOSTNAME`, `NODE_OPTIONS`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_RESOURCE_ATTRIBUTES`). The Next.js app is the BFF, so it has its own list (unlike a frontend served by another BFF). A secret is listed under its own name with `secret: true`; `KEY_FILE` is how it is delivered, not a second key. `src/platform/config/configuration-keys.spec.ts` (TEST-CFG-04) compares the list, without the library keys (`OTEL_*`, `NODE_*`, `PORT`, `HOSTNAME`), with `describeKeys()` of `server-config.ts` in both directions; `describeKeys()` takes `required` from `z.toJSONSchema(ServerConfigSchema, { io: 'input', unrepresentable: 'any' })` (a key with a default is optional) and `secret` from the `secret` tag (*verified*: green on the template, red when a `secret` flag in the list is wrong).

## Tests

| What | How |
|---|---|
| Binding (TEST-CFG-01) | Vitest (`node` project): valid values bind with defaults; each missing required key and each violated constraint throws, and the message names the key without the value (*verified* for missing key, plain-HTTP issuer, timeout out of range) |
| Secret masking (TEST-CFG-03) | `JSON.stringify` and `util.inspect` of the parsed configuration contain no secret; `reveal()` returns it (*verified*); secret-name test (NEXT-CFG-06) |
| Test-mode guard | Schema rejects `APP_TEST_STUBS=1` with `deployed`, accepts it with `test`/`local` (NEXT-CFG-07) |
| No build-time values | `test/one-build.spec.ts`: no `NEXT_PUBLIC_` in `src/`, no `.env` file `next build` loads (NEXT-CFG-01) |
| Public subset | Unit test of `publicConfig()`: exact keys, no value from a secret; component tests render inside `PublicConfigProvider` (`renderWithProviders`) |
| Key list (TEST-CFG-04) | `configuration-keys.spec.ts` (NEXT-CFG-09) |
| Deployed defaults (TEST-CFG-02) | The image smoke start with only the required keys and stubs off ([NEXT-REL-21](../../07-deployment-view/nextjs-delivery.md)) |

*Agent checklist in [checklists/nextjs.md](../../checklists/nextjs.md) and sources in [sources.md](../../sources.md), section "Next.js: Configuration".*

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| Next.js docs and generic habit: `NEXT_PUBLIC_API_URL`, `.env.production`, `.env.staging` | One build; server env at run time, public subset through the root layout (NEXT-CFG-01/05) |
| Next.js docs: `env` in `next.config.ts` | Only for build constants identical everywhere; never per-environment values (NEXT-CFG-01) |
| `vercel-react-best-practices` (implied): `process.env.X` read in shared or client-reachable modules | Only `src/platform/config` reads the environment, behind `server-only` (NEXT-CFG-02/04) |
| `vercel-react-best-practices` `advanced-init-once`: module-level initialisation | Parse in `register()`, never at import (NEXT-CFG-03) |
| Generic habit: `if (process.env.NODE_ENV === 'test')` or an environment-name switch to turn on mocks | `APP_TEST_STUBS` guarded by `APP_ENVIRONMENT_KIND` in the validated schema (NEXT-CFG-07) |
