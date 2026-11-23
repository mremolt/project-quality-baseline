# Agent checklists: nestjs

The agent checklists of the nestjs docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## NestJS: Libraries

[04-solution-strategy/nestjs-libraries.md](../04-solution-strategy/nestjs-libraries.md)

- [ ] All `@nestjs/*` packages on one version; TypeScript 6.0.x (NEST-LIB-01/02)?
- [ ] No Express, class-validator, ORM, axios, kafkajs or Jest added?
- [ ] New outbound REST call: generated client if the provider has a spec (NEST-LIB-07)?
- [ ] New dependency checked for age, maintainers and install scripts (TS-TOOL-13)?

## NestJS: Hexagonal Architecture

[05-building-block-view/nestjs.md](../05-building-block-view/nestjs.md)

- [ ] New provider wired only in its context module; use case created with `useFactory`, no decorator on core classes (NEST-ARCH-01/02)?
- [ ] Tokens in `<context>.tokens.ts`; injection by token, singleton scope, no `forwardRef` (NEST-ARCH-03..05)?
- [ ] Transaction through `TransactionPort`; no remote call inside (NEST-ARCH-08)?
- [ ] Controller only maps; errors by category base class (NEST-ARCH-10/12)?
- [ ] `npm run check:arch` green and the config unchanged (or the change discussed)?
- [ ] Demo data loaded by an `adapter/in/demo` provider behind a default-off flag that calls use cases, never by seed SQL (NEST-ARCH-13)?

## NestJS: Delivery

[07-deployment-view/nestjs-delivery.md](../07-deployment-view/nestjs-delivery.md)

- [ ] Start-up migration before `listen()`, DDL credentials only in the migration pool; or pre-deploy job with `node dist/migrate.js`, instances checking only; required from the second instance or a production environment (NEST-REL-01/03)?
- [ ] Start-up budget ≥ start + migration `statement_timeout` (NEST-REL-02)?
- [ ] Image starts `node --import ./dist/instrumentation.js dist/main.js` in exec form (NEST-REL-05)?
- [ ] `package.json` version `0.0.0`; release version from `RELEASE_VERSION` and `OTEL_RESOURCE_ATTRIBUTES` (NEST-REL-06)?
- [ ] Image: no sources or dev dependencies, non-root, base pinned by digest, read-only root filesystem (NEST-REL-07..09)?
- [ ] BFF: bundle in `frontend/` from the pipeline artifact plus the previous release's hashed files (NEST-REL-10); start fails without it, built image answers `GET /` (NEST-REL-12)?

## NestJS: Local Development

[07-deployment-view/nestjs-local-development.md](../07-deployment-view/nestjs-local-development.md)

- [ ] New infrastructure dependency in `compose.yaml` (core: no profile; extra: profile), pinned, bound to `127.0.0.1`?
- [ ] Local PostgreSQL major equals production; DDL and DML users from `dev/postgres/init.sql`?
- [ ] New key: throwaway value in `.env.local` if needed locally, entry in `configuration-keys.yaml`, no real secret?
- [ ] No new start-up script; inspector only on `127.0.0.1`?
- [ ] A service the app cannot work without (Keycloak for login, Mailpit for mail) starts without a Compose profile (NEST-DEV-02)?

## NestJS: Producing the OpenAPI Contract (code-first)

[08-crosscutting-concepts/api/nestjs-openapi.md](../08-crosscutting-concepts/api/nestjs-openapi.md)

- [ ] Handler named after the use case (= `operationId`); schemas with unique `…VN` ids; tag and security scheme on the controller (NEST-API-01/02/07)?
- [ ] Every error status documented with `ApiProblemResponse` and its codes; new business code added to `errorCodes` (NEST-API-05)?
- [ ] Spec regenerated with `npm run openapi` and committed in the same change (NEST-API-09)?
- [ ] Breaking change? New version folder and spec file, or an explicit decision (NEST-API-10)?
- [ ] No `SwaggerModule.setup()` (NEST-API-11)?
- [ ] N+1 check done for read endpoints (NEST-API-12)?
- [ ] Provider with a spec: client generated with Orval into `adapter/out/http/generated/`, responses parsed with the generated zod schemas, timeouts set (NEST-API-13/14)?
- [ ] Binary download declared with its media type and a binary schema (NEST-API-07)?

## NestJS: REST and JSON Conventions

[08-crosscutting-concepts/api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md)

- [ ] Controller per use case in `adapter/in/rest/vN/`, handler named after the use case, schemas with unique `…VN` ids (NEST-REST-01..04)?
- [ ] Every body, query and path parameter has a schema; request objects not strict; no `@Res()` without passthrough (NEST-REST-05..08)?
- [ ] Decimals as `ApiDecimal`, instants as `z.iso.datetime()`, enums as `z.enum`, no `null` for absent fields (NEST-REST-10..13)?
- [ ] Errors from domain base classes, answered by the global filter as problem+json; no message or stack in the body (NEST-REST-14..16)?
- [ ] Collection paged or bounded; sort and filters allow-listed; update carries a version or `If-Match`; 201 with `Location` (NEST-REST-17..19)?
- [ ] Controller test with mocked use case, real pipe and filter, error cases included (NEST-REST-21)?
- [ ] No `@HttpCode(204)` on `@Put`/`@Patch`; updates answer 200 with the new version (NEST-REST-18)?

## NestJS: Configuration

[08-crosscutting-concepts/configuration/nestjs.md](../08-crosscutting-concepts/configuration/nestjs.md)

- [ ] New setting: key in a zod schema next to its adapter, constrained, `.describe()`d, unit in the name (NEST-CFG-01/05)?
- [ ] Read through `loadConfig` in a provider, injected by token; nothing in the core imports config (NEST-CFG-02/03)?
- [ ] No `process.env`, no `NODE_ENV` branch, no per-environment file (NEST-CFG-02/06)?
- [ ] Secret built with `secret()`, delivered as `KEY_FILE`, `reveal()` only at the client library (NEST-CFG-07/08); minimum length and key format checked in the schema (NEST-CFG-12)?
- [ ] Local-only switch: refused unless `APP_ENVIRONMENT_KIND` is `local` or `test` (NEST-CFG-13)?
- [ ] Key added to `configuration-keys.yaml` and to `src/config-schemas.ts` (NEST-CFG-10)?
- [ ] Binding test for valid, invalid and missing values (TEST-CFG-01)?

## NestJS: Data Protection

[08-crosscutting-concepts/data-protection/nestjs.md](../08-crosscutting-concepts/data-protection/nestjs.md)

- [ ] Retention job: `@Cron` under `withClusterLock`, only calls a use case; clock injected; batched delete, one transaction per batch, stops on the signal (NEST-DP-01/02)?
- [ ] New child table: `ON DELETE CASCADE` or listed as retained (NEST-DP-03)?
- [ ] History, outbox, inbox, idempotency and dead-letter stores covered (NEST-DP-04)?
- [ ] New personal data: exporter and eraser registered for the context (NEST-DP-05); inventory and deletion concept updated (DP-INV-03)?
- [ ] Event payloads with personal data justified; topic retention or tombstone documented (NEST-DP-06)?
- [ ] Deletion `*.it.test.ts` per table; log-absence test with synthetic values (NEST-DP-08/09)?
- [ ] Audit table partitioned by month, partitions dropped by the retention job under a separate role, runtime role still insert-only (NEST-DP-10)?

## NestJS: Internationalization

[08-crosscutting-concepts/i18n/nestjs.md](../08-crosscutting-concepts/i18n/nestjs.md)

- [ ] No `Intl`, `toLocale*`, `localeCompare`, catalog or negotiator import in `domain`, `ports`, `application` (NEST-I18N-05)?
- [ ] New business error: code in the API catalogue and the OpenAPI spec, `error.<CODE>.title|detail` in the source catalog with context (NEST-I18N-02/04)?
- [ ] Locale negotiated in the REST adapter only; `Content-Language` set (NEST-I18N-03/04)?
- [ ] Outgoing mail or document uses the recipient's stored language and time zone (NEST-I18N-06)?
- [ ] Per-locale contract test and catalog parity test updated (TEST-I18N-05/06)?
- [ ] Mail subject is a catalog message with the same arguments as the body (NEST-I18N-06)?

## NestJS: Logging

[08-crosscutting-concepts/logging/nestjs.md](../08-crosscutting-concepts/logging/nestjs.md)

- [ ] Logging through Nest's `Logger` backed by `nestjs-pino`; no `console`, no transport in deployed code (NEST-LOG-01/02)?
- [ ] `traceId`/`spanId` mixin and redaction paths in place; request serializers drop headers, client address and query string (NEST-LOG-03/05)?
- [ ] Values in the object argument, constant message (NEST-LOG-06)?
- [ ] No logging in `domain`/`ports`/`application`; error logged once (NEST-LOG-07/08)?
- [ ] No secret, token, body or personal data in a line; absence tested where personal data is handled (NEST-LOG-09/10)?

## NestJS: Messaging with Kafka

[08-crosscutting-concepts/messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md)

- [ ] `@platformatic/kafka` pinned exactly, no `@nestjs/microservices` Kafka transport, no `kafkajs`, no `@confluentinc/kafka-javascript`, no schema-registry API (NEST-MSG-01)?
- [ ] Plain `npm ci` with `ignore-scripts=true`, no rebuild step, no compiler in the image (NEST-MSG-02)?
- [ ] Client imported only under `adapter/(in|out)/messaging`; consumer dispatches on `type`, skips unknown types, calls one use-case token; no catch-log, no commit in the handler (NEST-MSG-03/04)?
- [ ] Producer `idempotent: true` with `retries` ≥ 2 and explicit connect/request timeouts; consumer `autocommit: false`, `mode: 'committed'`, `fallbackMode: 'earliest'`, read committed, small `highWaterMark`, no topic auto-creation (NEST-MSG-05)?
- [ ] Bytes decoded strictly, JSON parsed and checked by zod; envelope tolerant, decimals as strings (NEST-MSG-06)?
- [ ] Runner uses `for await`, commits after each outcome, classifies by base class, retries bounded with jitter, nothing leaves the loop; failed dead-letter send restarts the consumer; dead-letter topic owned, counted, logged without payload (NEST-MSG-07/08)?
- [ ] Event tied to a DB change goes through the outbox; one relay under `withClusterLock`, parking by `apiId`, gauges, trace context restored; inbox or natural idempotency stated (NEST-MSG-09/10/11)?
- [ ] Shutdown: abort, `stream.close()`, await the loop, `consumer.close()` without force in `onModuleDestroy` within 20 s; producer in `onApplicationShutdown` (NEST-MSG-12)?
- [ ] AsyncAPI regenerated, committed, validated; examples updated (NEST-MSG-13, MSG-CON)?
- [ ] `*.it.test.ts` with the Kafka container covering success, unknown type, validation, invalid JSON, transient retry, stop with a record in progress, outbox commit and rollback, parking, duplicate (NEST-MSG-14)?
- [ ] Mail or other after-commit side effect without a broker: outbox row in the use case's transaction plus a locked sender in the adapter (NEST-MSG-15)?

## NestJS: Observability and Operability

[08-crosscutting-concepts/observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md)

- [ ] `/livez` plain, `/readyz` with the database check only where OBS-03 applies, both on the server port and not routed by the ingress (NEST-OBS-01..03)?
- [ ] Consumers stop in `onModuleDestroy`; pools, agents and telemetry close in `onApplicationShutdown`; drain plus phases fit the grace period (NEST-OBS-04)?
- [ ] Started with `node --import ./dist/instrumentation.js dist/main.js`; noisy and unsupported instrumentations off (NEST-OBS-05)?
- [ ] `OTEL_*` keys set per environment and listed in `configuration-keys.yaml`; sampler explicit (NEST-OBS-06)?
- [ ] New business metric: outgoing port, `Meter` adapter, closed-set attributes, cardinality test (NEST-OBS-08/11)?
- [ ] New outbound call through undici so the trace propagates (NEST-OBS-09)?

## NestJS: Persistence with PostgreSQL

[08-crosscutting-concepts/persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md)

- [ ] New table or column: migration added (name pattern, `up` only, listed in `index.ts`), previous release still works, `generated/db.ts` regenerated?
- [ ] Types per NEST-DB-02/03: `numeric` and `int8` as strings, instants `timestamptz`, constraints in the migration?
- [ ] Adapter uses `executor()` and `$pickTables`, maps rows both ways, never returns a row type through a port?
- [ ] Use case work wrapped in `runInTransaction`; no remote call inside; conflicts thrown as `ConcurrentModificationError`?
- [ ] Driver errors mapped (`UnavailableError`, conflict) in the adapter (NEST-DB-11)?
- [ ] Rule across rows (overlap, "at least one", uniqueness): constraint, advisory or row lock, and a two-transaction `*.it.test.ts` in a controlled order (NEST-DB-23)?
- [ ] No query in a loop; statement count asserted; collection queries limited in SQL (NEST-DB-12/13)?
- [ ] No edit to a migration on `main`; `check-migrations` green (NEST-DB-19)?
- [ ] Check against state that may not exist yet: shared advisory lock in commands, exclusive in the change, both orders tested (NEST-DB-23)?
- [ ] Unique violations mapped by `error.constraint`, SQLSTATE alone only where one constraint can fail (NEST-DB-11)?

## NestJS: Resilience and Idempotency

[08-crosscutting-concepts/resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md)

- [ ] New HTTP client: own undici `Agent` with `connectTimeout`, `AbortSignal.timeout` on every call, values on the ladder; timeout test (NEST-RES-01/02)?
- [ ] Pool timeouts (`connectionTimeoutMillis`, `statement_timeout`, `transaction_timeout`) and both `error` listeners set (NEST-RES-01)?
- [ ] No remote call inside the transaction; guard `fail` in integration tests (NEST-RES-03)?
- [ ] Bulkhead `bulkhead(limit, 0)` per remote dependency; rejection thrown as `UnavailableError` (NODE-ARCH-07, answered with 503) or a fallback (NEST-RES-05)?
- [ ] Retry only for idempotent calls, with `handleWhen`, jittered backoff, total `timeout`; not in a consumer-driven flow (NEST-RES-07/08)?
- [ ] Retryable `POST`: `Idempotency-Key` in the command, conflict-free insert first in the transaction, `57014` mapped (NEST-RES-09)?
- [ ] New job: `@Cron` with `waitForCompletion`, under `withClusterLock` or `SKIP LOCKED`, batches stop on the signal (NEST-RES-11)?
- [ ] Bulk input with a remote call per item: items stored, job makes the calls, request answers within its budget (NEST-RES-15)?
- [ ] CPU-heavy work in a `piscina` pool with bounded queue (NEST-RES-13)? New cache bounded by `max` and `ttl`, caller in the key where needed (NEST-RES-14)?

## NestJS: Hardening

[08-crosscutting-concepts/security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md)

- [ ] Header change: helmet still global, API CSP `useDefaults: false`, `no-store` hook intact, header test updated (NEST-SEC-20)?
- [ ] Limits set on the adapter, schema lengths present, multipart limits explicit (NEST-SEC-22, NEST-SEC-37)?
- [ ] zod schemas that strip unknown keys, no merge or spread of untrusted objects, prototype-poisoning options at `'error'` (NEST-SEC-23)?
- [ ] No user-controlled or backtracking regex; no `eval`-like code, `vm` or `child_process` outside the one adapter (NEST-SEC-24, NEST-SEC-26)?
- [ ] New query: bind parameters only; `sql.raw`/`sql.ref`/`sql.id`/`sql.lit` only from an allow-list (NEST-SEC-25)?
- [ ] New request schema: no owner, tenant, role or audit fields (NEST-SEC-27); tenant from the `Caller` (NEST-SEC-28); 404 for foreign objects (NEST-SEC-29)?
- [ ] Problem details without messages or stack traces; plugin errors mapped to their 4xx status (NEST-SEC-30)?
- [ ] Outbound call to a variable URL: host allow-list, no redirects, address filter incl. IP literals (NEST-SEC-31)?
- [ ] Security-relevant action: audit event and test (NEST-SEC-33)?
- [ ] No handler that keeps the process alive after an uncaught error (NEST-SEC-34)?
- [ ] BFF change: the NODE-BFF checklist in [node-bff.md](../08-crosscutting-concepts/security/node-bff.md) answered, Fastify wiring as in NEST-SEC-44..52?
- [ ] New dependency reviewed (NEST-SEC-43)?
- [ ] Archive limits as ratio or counted caps; hostile files built in memory plus one real-writer fixture per format (NEST-SEC-37)?

## NestJS: Security

[08-crosscutting-concepts/security/nestjs.md](../08-crosscutting-concepts/security/nestjs.md)

- [ ] New endpoint: protected by the global guard, or `@Public()` with a reason in the PR?
- [ ] `Caller` passed into the command; no Nest, Fastify or jose import in `domain`/`ports`/`application`?
- [ ] `jwtVerify` with issuer, audience, algorithms, clock tolerance; JWKS timeouts set; key set outage 503, rejected token 401 with `WWW-Authenticate`; no hand-rolled token code, no passport?
- [ ] 401/403/success tests per endpoint; `cross-user` test for every use case that takes an id?
- [ ] CORS origins from configuration, no wildcard with credentials, preflight test?
- [ ] Nothing sensitive logged; probes public but not routed externally; `trustProxy` explicit?
- [ ] Hardening checklist ([nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md)) answered?
- [ ] Token guard present once a non-browser client exists; IdP named in an ADR (NEST-SEC-03)?
- [ ] Cross-user tag on the block that calls the service (NEST-SEC-08)?
- [ ] Admin-managed users provisioned through an outgoing port to the IdP admin API (NEST-SEC-53)?

## NestJS: Testing

[08-crosscutting-concepts/testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md)

- [ ] Test type per element from the element table, setup from the table above; no Nest for domain and use cases (NEST-TEST-04)?
- [ ] Vitest with `unplugin-swc` and `reflect-metadata`; no Jest, no supertest (NEST-TEST-01/05)?
- [ ] Container tests named `*.it.test.ts`; `npm test` runs without Docker (NEST-TEST-02)?
- [ ] Contracts mocked with `mock<T>()` by token; no `vi.mock` of own modules (NEST-TEST-03)?
- [ ] REST test with the production pipe and filter through `app.inject()` (NEST-TEST-05)?
- [ ] Real PostgreSQL with the real migrations, containers shared through `globalSetup` (NEST-TEST-06/07)?
- [ ] Fixed clock and ids; no sleeps (NEST-TEST-08/09)?
- [ ] Architecture canary still fails; spec test and system tests updated (NEST-TEST-10/11/12)?
- [ ] `cross-user` tag on object-level security tests; metrics tests for new business metrics (NEST-TEST-14)?
- [ ] `npm run verify` green?
