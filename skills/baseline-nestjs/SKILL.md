---
name: baseline-nestjs
description: Entry point for any Node.js / NestJS backend work in a project that uses the quality baseline - creating or editing use cases, ports, NestJS modules and controllers, zod request schemas, problem details, JWT guard and Caller, BFF login and session, Kysely persistence adapters and migrations, Kafka adapters, configuration, logging, health and shutdown, OpenAPI spec, dependency-cruiser and Vitest tests, and creating a new NestJS service. Loads the right skills (baseline-tdd, vitest, baseline-security) and applies the baseline's rules, which override the NestJS docs and generic habits. Use it before writing or changing any NestJS backend code.
---

# NestJS in the quality baseline

The baseline docs are the rules; skills and the NestJS documentation supply framework know-how. **Where they disagree with the docs, the docs win** (TOOL-SKL-01). Paths are relative to the project root; stack commands run from the component folder, usually `backend/` (REPO-TOOL-03). Read only the docs below: a NestJS project never needs the Spring, Java or frontend stack docs.

## 1. Read the rules for the task

Never read every doc of the stack up front (TOOL-SKL-10). At the start: the rule index in `docs/baseline/rule-index/` (`shared.md`, `node.md`, `nestjs.md`), one line per rule ID, and `docs/baseline/05-building-block-view/node.md`, `docs/baseline/05-building-block-view/nestjs.md`. Then only the docs of the rows below that match the task; for a rule from a doc you have not read, search the doc for its ID and read that bullet.

| Task | Also read |
|---|---|
| Use case, port, command, domain type, error | `docs/baseline/05-building-block-view/use-cases.md`, `docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md` |
| Controller, request/response schema, errors, paging | `docs/baseline/08-crosscutting-concepts/api/rest-conventions.md`, `api/nestjs-rest.md`, `api/nestjs-openapi.md`, `api/openapi-contracts.md` |
| Anything that loads data | `docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md`, `persistence/nestjs.md` |
| Authentication, authorization, CORS | `docs/baseline/08-crosscutting-concepts/security/nestjs.md` |
| Headers, limits, injection, prototype pollution, audit events | `docs/baseline/08-crosscutting-concepts/security/nestjs-hardening.md`, `security/security-review.md` |
| BFF login, session, CSRF, logout, serving the SPA | `docs/baseline/08-crosscutting-concepts/security/node-bff.md`, `security/nestjs-hardening.md` (NEST-SEC-44..52) |
| Database adapter, transaction, migration | `docs/baseline/08-crosscutting-concepts/persistence/nestjs.md`, `docs/baseline/07-deployment-view/nestjs-delivery.md` |
| Library choice | `docs/baseline/04-solution-strategy/nestjs-libraries.md` |
| Kafka consumer, producer, outbox, dead letters | `docs/baseline/08-crosscutting-concepts/messaging/nestjs.md` (shared: `messaging/messaging.md`) |
| Outbound HTTP, timeouts, retries, idempotency, scheduled jobs, worker threads, caching | `docs/baseline/08-crosscutting-concepts/resilience/nestjs.md` (shared: `resilience/resilience.md`) |
| Configuration, environment variables, secrets | `docs/baseline/08-crosscutting-concepts/configuration/nestjs.md` (shared: `configuration/configuration.md`) |
| Health, probes, shutdown, metrics, tracing | `docs/baseline/08-crosscutting-concepts/observability/nestjs.md` (shared: `observability/observability.md`) |
| Logging | `docs/baseline/08-crosscutting-concepts/logging/nestjs.md` |
| Personal data, retention, erasure | `docs/baseline/08-crosscutting-concepts/data-protection/nestjs.md` (shared: `data-protection/data-protection.md`) |
| Localized errors or emails (only if the project ADR says i18n is in scope, I18N-01) | `docs/baseline/08-crosscutting-concepts/i18n/i18n.md`, `i18n/nestjs.md` |
| Tests | `docs/baseline/08-crosscutting-concepts/testing/tdd.md`, `testing/nestjs.md` |
| tsconfig, ESLint, npm scripts, dependencies | `docs/baseline/08-crosscutting-concepts/development/node-tooling.md`, `development/typescript-tooling.md` (TS-TOOL-03..16 only) |
| Local services, running the app | `docs/baseline/07-deployment-view/nestjs-local-development.md` |
| Image, migrations at deploy time, frontend bundle in the BFF | `docs/baseline/07-deployment-view/nestjs-delivery.md` |
| New service | `docs/baseline/05-building-block-view/nestjs.md#new-service`, `docs/baseline/07-deployment-view/repository-layout.md` |

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Tests | `baseline-tdd`, `vitest` |
| Security configuration, BFF, security tests | `baseline-security` |
| Multilingual product | `baseline-i18n` |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

Full table: `docs/baseline/stacks/nestjs.md#skill-overrides`.

| Habit | Baseline rule |
|---|---|
| `nest new`, Express, Jest, CommonJS | Templates below: Fastify, Vitest with SWC, ESM (NEST-ARCH new service) |
| `@Injectable()` service with business logic | Plain use-case class in `application`, created with `useFactory`, injected by `Symbol` token (NEST-ARCH-01..03) |
| DTO classes with class-validator | zod schema on `@Body({ schema })`, global `StandardSchemaValidationPipe` (NEST-D3) |
| `throw new NotFoundException()` in a service | Category errors from `src/platform/domain` (NODE-ARCH-07), mapped by the global filter |
| TypeORM/Prisma entity as model | Kysely in `adapter/out/persistence`, rows mapped two-way (NEST-LIB-09) |
| `@Inject(KYSELY)` in a context repository | Inject `KyselyTransactionAdapter` and use `executor()`; `KYSELY` only in platform persistence, scheduling (cluster lock) and health (NEST-DB-04) |
| `@nestjs/passport`, `@Roles` as the authorization | `jose` guard builds the `Caller`; the use case authorizes (ARCH-UC-15) |
| `ConfigService.get('X')`, `process.env.X` | Typed config from `src/platform/config` (NODE-ARCH-12) |
| `Scope.REQUEST`, `forwardRef` | Singletons, arguments, no cycles (NEST-ARCH-04/05) |
| `axios`/`HttpModule`, call without timeout | `fetch` with explicit timeouts, cockatiel in the adapter (NEST-LIB-07, RES-TMO-01) |
| `@nestjs/microservices` Kafka, `@nestjs/event-emitter` | Own Kafka adapters; domain events through the outbox (NEST-D9, NEST-ARCH-09) |
| `console.log` | pino (NEST-D11) |

## 4. Workflow

1. **Place it.** Ring and folder for every new file (NODE-ARCH-01); core files import only their rings, `src/platform/domain/index.ts`, zod and (in `ports` and `application`) `src/platform/ports/index.ts` (NODE-ARCH-04); wiring only in the context module (NEST-ARCH-01). The use case authorizes with the `Caller` (ARCH-UC-15) and raises errors by category (NODE-ARCH-07).
2. **N+1 check** for anything that loads data (API-N1-01): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: Chicago for domain, London for use cases and adapters; test type per element from `testing/nestjs.md`.
4. **Security and data**: new endpoint → 401/403/success tests and a cross-user test if it takes an id; answer the security checklist (SEC-REV-01); new table or column → expand/contract migration; new personal-data field → inventory and deletion concept (DP-INV-03).
5. **Integration**: new outbound call → explicit timeouts (RES-TMO-01); no remote call inside `runInTransaction`; new consumer → idempotent (MSG-IDM-01), dead-letter topic named.
6. **Contract**: changed controller or schema → `npm run openapi` and commit the spec with the change.
7. **Shortcuts**: propose and draft an ADR; never take one silently (ARCH-SC-06).
8. **Finish** with `cd backend && npm run verify` green, and no dependency-cruiser rule, compiler check, lint rule or security check loosened.
9. **Self-review** against the agent checklist sections of the docs you used (`docs/baseline/checklists/`, TOOL-SKL-13).

## 5. New service

Follow `docs/baseline/05-building-block-view/nestjs.md#new-service`. The templates are in this skill's `templates/` folder (`.agents/skills/baseline-nestjs/templates/` in a project); `templates/README.md` says where each file goes. Template file names have no leading dot (`npmrc` → `backend/.npmrc`, `nvmrc` → `backend/.nvmrc`, `dependency-cruiser.cjs` → `backend/.dependency-cruiser.cjs`, `prettierrc.json` → `backend/.prettierrc.json`, `prettierignore` → `backend/.prettierignore`). Check that the repository layout decision was made first (REPO-LAY-02). Install with `npm ci` after the first `npm install` created the lockfile, then `npm run verify` must be green before the first feature.
