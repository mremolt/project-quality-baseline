# NestJS: Delivery

How a NestJS backend meets [delivery-and-release.md](delivery-and-release.md) (REL-DB, REL-VER, REL-CD) and [container-runtime.md](container-runtime.md) (REL-IMG, REL-RUN, REL-FE): migrations at start-up or in a pre-deploy job, the release version injected at deploy time, the image, and the frontend bundle in the BFF image. Migration code and database users: [persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md) (NEST-DB-14..21). Shutdown: NEST-OBS-04 in [observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md).

## Rules

### Migrations (REL-DB-01..06)

- **NEST-REL-01: By default the new version migrates at start-up, before it listens; from the second instance or the first production environment the pre-deploy variant (NEST-REL-03) is required.** `main.ts` runs the migration (`migrateToLatest`, NEST-DB-14) with the DDL credentials, then `createApp()` and `listen()`, so an instance is never ready on an old schema and a failed migration fails the start (REL-DB-05: the old version keeps serving). The DDL credentials are their own keys (`DATABASE_MIGRATION_USER`, `DATABASE_MIGRATION_PASSWORD` as a secret file, NEST-CFG-07) and are used only by the one-connection migration pool, which is closed before the app starts; the application pool uses the DML user (NEST-DB-17). The start-up variant suits a single instance and a demo environment. A product with more than one instance, or with a production environment, runs the migration as a pre-deploy job instead and records that in chapter 7: otherwise every instance races for the migrator lock (the losers fail on `lock_timeout` and restart) and the schema owner's password is part of the serving process's environment, reachable after a compromise of the web process.

```ts
// src/main.ts (excerpt)
const db = loadConfig(DatabaseConfig);
if (db.DATABASE_MIGRATION_USER) {
  const ddl = createMigrationDatabase(db);    // start-up variant
  await migrateToLatest(ddl);
  await ddl.destroy();
} else {
  const dml = createDatabase(db);             // pre-deploy variant (NEST-REL-03): refuse to start on a pending migration
  await assertSchemaCurrent(dml);
  await dml.destroy();
}
const app = await createApp();
await app.listen({ port: loadConfig(HttpConfig).HTTP_PORT, host: '0.0.0.0' });
```

- **NEST-REL-02: Parallel instances and the start-up budget.** Kysely's advisory lock serialises instances (NEST-DB-15); the waiting ones find the schema current and start. Their wait is bounded only by the migration connection's `statement_timeout` (default 120 s, NEST-DB-16), so the platform's start-up budget is at least the measured start plus that value (REL-DB-03/04, REL-RUN-04). Every DDL statement waits at most `lock_timeout` (5 s) for a table lock.
- **NEST-REL-03: The pre-deploy variant runs the same image with `node dist/migrate.js`** (REL-DB-01). `src/migrate.ts` loads the database config, requires the DDL credentials, runs `migrateToLatest`, logs the applied names and exits with 0 (1 on failure). The job has an explicit timeout above the migration `statement_timeout` (Kubernetes: `activeDeadlineSeconds`, `backoffLimit: 0` or a small number, since a retried job only waits on the lock and then finds nothing to do). The application instances get no DDL credentials; at start they run `assertSchemaCurrent` as the DML user (NEST-DB-18) and refuse to start when a migration is pending. The product records the variant in chapter 7.
- **NEST-REL-04: A migration needs no other tool in the pipeline:** no separate migration image, no Flyway, no SQL run by hand (REL-DB-01). Migration lint (REL-DB-06) runs on the SQL the migrations produce or on the TypeScript files; the immutability check is NEST-DB-19.

### Shutdown (REL-ZD-02)

- **NEST-REL-05: The process is `node`, started in exec form, never through `npm start` or a shell** (npm does not forward signals): `node --import ./dist/instrumentation.js dist/main.js`. Drain and shutdown phases: NEST-OBS-04; the platform grace period is at least 30 s for HTTP-only services and 60 s with message consumers (REL-RUN-06). Node as PID 1 runs Nest's SIGTERM handler; in the scratch build the distroless container stopped with exit code 0 well within the grace period.

### Version (REL-VER-05)

- **NEST-REL-06: The image does not carry the release version; the deployment injects it** (REL-CD-01). `package.json` `version` stays `0.0.0` (it must exist: npm tooling fails without it; NODE-TOOL-10). The release version is configuration: `RELEASE_VERSION` (default `unreleased`) in the platform config schema, logged once at start, and set as `service.version` in `OTEL_RESOURCE_ATTRIBUTES` (NEST-OBS-06). The commit is built in: the image build writes `dist/build-info.json` (`{ "commit": "<sha>" }`) from the CI variable (`docker build --build-arg GIT_COMMIT=<sha>`), and the start line logs both. In the template, `RELEASE_VERSION` is in `ReleaseConfig`, `readBuildInfo()` (`src/platform/config/build-info.ts`) reads the file and answers `unknown` where no image build ran (watch mode, tests), and `main.ts` logs `{ releaseVersion, commit }` once before `listen()`. A product that offers an info endpoint returns exactly these two values (no configuration, no dependency list).

### Image (REL-IMG, REL-RUN)

- **NEST-REL-07: NestJS services build their image with the Dockerfile of NEST-REL-08, not with Buildpacks.** This is a stack-level exception to REL-IMG-02, decided in the baseline: no product ADR is needed, and the product's chapter 7 names the rule as the reason. Two findings (2026-11-20) make Buildpacks unusable for this stack: Node 26 installed by the Paketo Node.js buildpack (node-engine 8.12.3) does not start on the Paketo run images (`ubuntu-noble-run`, `run-jammy-base`, `run-jammy-full`; `libatomic.so.1` is missing), and Paketo builds in place, so sources and tests end up in the image unless CI passes a staging folder (REL-IMG-01). Chapter 11 tracks the return to Buildpacks. What was verified for that return: the Node version comes from `BP_NODE_VERSION`, then `engines.node`, then `.nvmrc`; `npm ci` honours the project `.npmrc`; the launch layer is pruned to production dependencies; `NODE_ENV=production`; the start process is `scripts.start` (`node --import ./dist/instrumentation.js dist/main.js`) behind a `sh` script that forwards SIGTERM; `BP_NODE_OPTIMIZE_MEMORY=true` sizes the heap; the image runs as a non-root user with per-layer SBOMs.
  *Why:* a default that cannot start the runtime would push every product into its own workaround; one verified Dockerfile keeps all NestJS images alike.
- **NEST-REL-08: The Dockerfile is multi-stage, from lockfile, on distroless, pinned by digest** (template: `.agents/skills/baseline-nestjs/templates/Dockerfile`). Build stage `node:26-trixie-slim@sha256:…` runs `npm ci` and `npm run build`; a second stage runs `npm ci --omit=dev`; the final stage is `gcr.io/distroless/nodejs26-debian13:nonroot@sha256:…` (no shell, no npm) with `NODE_ENV=production`, `USER 65532:65532`, only `node_modules`, `package.json` and `dist/` copied, and the command in exec form. A `.dockerignore` excludes `node_modules`, `dist`, `.env*` and logs. Labels per REL-RUN-07 come from `--label` at build time.

```dockerfile
FROM node:26-trixie-slim@sha256:<digest> AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
# the commit is built in, the release version injected at deploy time (NEST-REL-06)
ARG GIT_COMMIT=unknown
RUN printf '{"commit":"%s"}\n' "$GIT_COMMIT" > dist/build-info.json

FROM node:26-trixie-slim@sha256:<digest> AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:<digest>
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
USER 65532:65532
# the distroless entrypoint is node; node is PID 1
CMD ["--import", "./dist/instrumentation.js", "dist/main.js"]
```

  Without Buildpacks' memory helper, set `NODE_OPTIONS=--max-old-space-size=<75 % of the limit in MiB>` in the deployment, derived from the memory limit and tuned from measurements (REL-RUN-05).
- **NEST-REL-09: The container runs with a read-only root filesystem and a size-limited `/tmp`** (REL-RUN-01/02); the app writes nothing else. Both images were started read-only with all capabilities dropped and `no-new-privileges`. The image smoke test (TEST-CFG-02, REPO-CI-04) starts it that way with only the required keys of `configuration-keys.yaml`.

### Frontend bundle in the BFF (REL-FE-01..05)

- **NEST-REL-10: When the NestJS backend is the BFF, the image build adds the bundle as `frontend/` next to `dist/`.** The bundle is the frontend job's pipeline artifact (REL-FE-02), plus the hashed files of the previous release's bundle (REL-FE-04); it is copied into the Buildpacks staging folder, or into the Dockerfile's final stage from a named build context (`docker buildx build --build-context frontend=<bundle path>`, `COPY --from=frontend . ./frontend/`). The path is configuration with the default `frontend/`. Serving rules (static plugin, nonce, deep links, cache headers, 404): NEST-SEC-51 in [security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md). The BFF's own tests use a fixture bundle, so `npm run verify` never needs the frontend.

- **NEST-REL-12: The bundle folder is checked at start and the image is smoke-tested** (REL-FE-06). The code that registers the SPA routes (NEST-SEC-51) throws in a deployed environment when `index.html` is missing under the configured folder, unless an explicit key (for example `FRONTEND_SERVE=false`, listed in `configuration-keys.yaml`) declares an API-only run. The default folder is `frontend/` relative to the image's working directory (NEST-REL-10), never a path outside the image (such as `../frontend/dist`, which only exists in a development checkout). The image build job runs the image and asserts `GET /` returns `200` with `text/html`. The serving test with the fixture bundle covers the refusal.

### SBOM (SEC-CI-03)

- **NEST-REL-11: The release job publishes a CycloneDX SBOM of the image** (REL-IMG-01), generated from the image by the pipeline's image scanner, and the dependency SBOM of TS-TOOL-16 (`@cyclonedx/cyclonedx-npm --omit dev`). `npm sbom --omit dev` is not used: with npm 11.13 it leaves out production dependencies that are also peers of dev dependencies (`@nestjs/core` among them).

*Agent checklist in [checklists/nestjs.md](../checklists/nestjs.md) and sources in [sources.md](../sources.md), section "NestJS: Delivery".*
