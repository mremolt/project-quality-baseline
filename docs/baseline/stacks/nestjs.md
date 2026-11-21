# NestJS

Rules for NestJS services. They implement the shared docs and the Node docs ([stacks/node.md](node.md)) and may tighten them, never contradict them. Stack at a glance and defaults (`NEST-D*`): [04-solution-strategy/nestjs.md](../04-solution-strategy/nestjs.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [node](../rule-index/node.md), [nestjs](../rule-index/nestjs.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

A NestJS project reads the shared docs, [stacks/node.md](node.md) and the docs below. It never needs the Spring, Java or frontend stack docs.

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/nestjs.md](../05-building-block-view/nestjs.md) | Modules as composition roots, tokens, `useFactory`, scopes, transactions, dependency-cruiser template, new service | `NEST-ARCH-*` |
| [04-solution-strategy/nestjs-libraries.md](../04-solution-strategy/nestjs-libraries.md) | Approved and rejected libraries, version pins, reference versions | `NEST-LIB-*` |
| [08-crosscutting-concepts/api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md) | Controllers, zod request and response schemas, problem details, paging, versioning (shared: [rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md)) | `NEST-REST-*`, `API-REST-*` |
| [08-crosscutting-concepts/api/nestjs-openapi.md](../08-crosscutting-concepts/api/nestjs-openapi.md) | Producing, committing and checking the spec; generated outbound clients | `NEST-API-*` |
| [08-crosscutting-concepts/security/nestjs.md](../08-crosscutting-concepts/security/nestjs.md) | JWT resource server with `jose`, `Caller`, CORS, security tests | `NEST-SEC-01..15` |
| [08-crosscutting-concepts/security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md) | Headers, limits, prototype pollution, ReDoS, injection, audit events, process hardening, Fastify wiring of the BFF | `NEST-SEC-20..52` (BFF: 44..52) |
| [08-crosscutting-concepts/security/node-bff.md](../08-crosscutting-concepts/security/node-bff.md) | Framework-neutral Node BFF: OIDC login, session store, cookie, CSRF, lifetimes, logout, nonce CSP, adoption gate | `NODE-BFF-*` |
| [08-crosscutting-concepts/persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md) | PostgreSQL, Kysely, transactions, migrations, statement counts | `NEST-DB-*` |
| [08-crosscutting-concepts/configuration/nestjs.md](../08-crosscutting-concepts/configuration/nestjs.md) | zod config schemas, `Secret`, key list (shared: [configuration.md](../08-crosscutting-concepts/configuration/configuration.md)) | `NEST-CFG-*`, `CFG-*` |
| [08-crosscutting-concepts/observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md) | Probes, graceful shutdown, OpenTelemetry, business and runtime metrics (shared: [observability.md](../08-crosscutting-concepts/observability/observability.md)) | `NEST-OBS-*`, `OBS-*` |
| [08-crosscutting-concepts/logging/nestjs.md](../08-crosscutting-concepts/logging/nestjs.md) | pino, structured logs, redaction | `NEST-LOG-*` |
| [08-crosscutting-concepts/resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md) | Timeouts, cockatiel, `Idempotency-Key`, scheduled jobs with a cluster lock, worker threads, caching (shared: [resilience.md](../08-crosscutting-concepts/resilience/resilience.md)) | `NEST-RES-*`, `RES-*` |
| [08-crosscutting-concepts/messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md) | Kafka client, envelope, errors and dead letters, outbox, inbox, AsyncAPI, tests (shared: [messaging.md](../08-crosscutting-concepts/messaging/messaging.md)) | `NEST-MSG-*`, `MSG-*` |
| [08-crosscutting-concepts/data-protection/nestjs.md](../08-crosscutting-concepts/data-protection/nestjs.md) | Retention jobs, erasure, personal-data tests (shared: [data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md)) | `NEST-DP-*`, `DP-*` |
| [08-crosscutting-concepts/i18n/nestjs.md](../08-crosscutting-concepts/i18n/nestjs.md) | Error codes, localized texts and emails (shared: [i18n.md](../08-crosscutting-concepts/i18n/i18n.md)) | `NEST-I18N-*`, `I18N-*` |
| [08-crosscutting-concepts/testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md) | Vitest with SWC, test type per element, Testcontainers | `NEST-TEST-*` |
| [07-deployment-view/nestjs-local-development.md](../07-deployment-view/nestjs-local-development.md) | Docker Compose, watch mode, debugging | `NEST-DEV-*` |
| [07-deployment-view/nestjs-delivery.md](../07-deployment-view/nestjs-delivery.md) | Migrations at deploy time, release version, image build, frontend bundle in the BFF image (shared: [delivery-and-release.md](../07-deployment-view/delivery-and-release.md), [container-runtime.md](../07-deployment-view/container-runtime.md)) | `NEST-REL-*`, `REL-*` |

## Skills for NestJS work

Load these when creating or editing NestJS code (the `baseline-nestjs` skill does this for you):

| Skill | For |
|---|---|
| `baseline-nestjs` (own) | Entry point: docs to read, skills to load, overrides, workflow, templates |
| `baseline-tdd` (own) | Test-first workflow |
| `vitest` | Vitest APIs |
| `baseline-security` (own) | Security rules by task, review checklist |
| `baseline-i18n` (own) | Multilingual products |

No third-party NestJS skill is adopted yet; candidates are pinned and reviewed first (TOOL-SKL-*).

**Where a skill or the NestJS documentation and these docs disagree, the docs win** (TOOL-SKL-01).

## Skill overrides

Habits from the NestJS docs, `nest new` and generic skills that conflict with the baseline:

| Habit | Baseline rule |
|---|---|
| `nest new` scaffold (Express, Jest, CommonJS, `src/app.service.ts`) | Templates from `baseline-nestjs`: Fastify, Vitest, ESM, ring layout (NEST-ARCH new service) |
| `@Injectable()` services with business logic, injected into controllers | Use cases are plain classes in `application`, created with `useFactory`, injected by token (NEST-ARCH-01/02) |
| `controller/service/repository` or `users/users.service.ts` layout | Ring layout per context (NODE-ARCH-01) |
| DTO classes with class-validator decorators, global `ValidationPipe` | zod schemas on `@Body({ schema })`, global `StandardSchemaValidationPipe` (NEST-D3, NEST-LIB-04) |
| `HttpException`/`NotFoundException` thrown from services | Category errors from `platform/domain`, mapped by the global filter (NODE-ARCH-07, NEST-ARCH-12) |
| TypeORM or Prisma entities as the model | Kysely in the persistence adapter, rows mapped two-way (NEST-LIB-09) |
| `@Inject(KYSELY)` in a context repository | `KyselyTransactionAdapter.executor()`; the instance only in platform persistence, scheduling (cluster lock) and health (NEST-DB-04) |
| `@nestjs/passport` with `JwtStrategy` | One `jose` guard building a `Caller`; authorization in the use case (NEST-D6) |
| `@nestjs/config` `ConfigService.get('KEY')` | Typed config from zod schemas, injected by token; `process.env` only in `platform/config` (NODE-ARCH-12) |
| `@nestjs/microservices` Kafka transport | Own adapters on `@platformatic/kafka` (NEST-D9) |
| `@nestjs/event-emitter` between services | Domain events through an outgoing port and the outbox (NEST-ARCH-09) |
| `Scope.REQUEST` providers for the current user | `Caller` passed as an argument (NEST-ARCH-04) |
| `HttpModule` / axios | Platform `fetch` with explicit timeouts (NEST-LIB-07) |
| Jest, `supertest(app.getHttpServer())` | Vitest with SWC, `app.inject()` on the Fastify adapter ([testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md)) |
| `console.log`, Nest's default logger in production | pino through `nestjs-pino` (NEST-D11) |
| `ts-node`/`tsx` to run the app | Compiled `dist/` (NODE-TOOL-03) |
| Swagger UI served in production | [api/nestjs-openapi.md](../08-crosscutting-concepts/api/nestjs-openapi.md) |
