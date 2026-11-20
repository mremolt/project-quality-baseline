# NestJS service templates

A complete, minimal NestJS 12 service skeleton: platform rings, configuration, auth guard, problem details, probes, telemetry, logging, database with transactions and migrations, tests and tooling. It was validated as a whole on 2026-11-20: `npm run verify` green (format, lint, typecheck, dependency-cruiser, unit and Testcontainers tests, build), the built app and the Docker image started against PostgreSQL 18 (read-only, non-root, clean SIGTERM). Versions in `package.json` were at least 7 days old then (`min-release-age`, TS-TOOL-11).

Copy everything into `backend/` (REPO-LAY-03), then rename the service: `name` in `package.json`, `name`, database and user in `compose.yaml` and `env.local`, `AUTH_AUDIENCE`. There are no context modules yet: add the first one under `src/features/<context>/` and import it in `src/app.module.ts`.

| Template | Goes to | Notes |
|---|---|---|
| `package.json` | `backend/package.json` | Scripts per NODE-TOOL-07; run `npm install` once to create the lockfile, then always `npm ci` |
| `npmrc`, `nvmrc`, `gitignore`, `dockerignore`, `prettierrc.json`, `prettierignore`, `dependency-cruiser.cjs`, `env.local` | `backend/.<name>` (renamed with a leading dot) | `.env.local` holds only throwaway local values and is committed (NEST-DEV-06) |
| `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.ts`, `nest-cli.json` | `backend/` | NODE-TOOL-02/04/05, NEST-TEST |
| `compose.yaml` | `backend/compose.yaml` | Local services only (NEST-DEV) |
| `configuration-keys.yaml` | `backend/configuration-keys.yaml` | Checked against the schemas by `src/configuration-keys.test.ts` (CFG-12) |
| `Dockerfile` | `backend/Dockerfile` | Base images pinned by digest; update automation bumps them (NEST-REL-07/08) |
| `src/`, `test/` | `backend/src/`, `backend/test/` | `test/fixtures/arch-violation` is the "checks nothing" canary (NODE-ARCH-14) |
| `openapi/` | `backend/openapi/` | The first API adds its spec test and the OpenAPI helpers of `api/nestjs-openapi.md` |

The Kafka adapters, the outbox and the BFF parts are not in the skeleton: add them from `messaging/nestjs.md` and `security/nestjs-hardening.md` when the product needs them.
