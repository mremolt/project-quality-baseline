# NestJS: Libraries

Which libraries a NestJS service uses for which job, and which it does not. Usage rules are in the topic docs listed in [stacks/nestjs.md](../stacks/nestjs.md).

## Rules

- **NEST-LIB-01: All `@nestjs/*` packages are on the same major (12), and versions are pinned exactly** (TS-TOOL-13). `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify` and `@nestjs/testing` always have the same version; they are updated together in one change.
- **NEST-LIB-02: TypeScript is pinned to 6.0.x.** `@nestjs/swagger` 12 declares `typescript ^5.5 || ^6` as a peer; TypeScript 7 (the native compiler) is not supported yet. Move to 7 as a reviewed change once the peer range allows it.
- **NEST-LIB-03: The HTTP platform is Fastify** (`@nestjs/platform-fastify`). Request and reply types come from `fastify`; HTTP features come from `@fastify/*` plugins registered in `create-app.ts`. `@nestjs/platform-express`, Express types and Express middleware are not used.
  *Why:* one HTTP stack, and Fastify's built-in limits, schema-free JSON parser and prototype-poisoning protection are the secure defaults the hardening rules build on.
- **NEST-LIB-04: zod 4 is the only schema library.** Request, response, command, configuration and message schemas are zod; Nest validates them through its Standard Schema support and `@nestjs/swagger` turns them into the spec. class-validator, class-transformer and `nestjs-zod` are not used.
- **NEST-LIB-05: `reflect-metadata` is imported once, first thing in `main.ts`** (and in the Vitest setup). Nest's DI reads constructor metadata emitted by `emitDecoratorMetadata`.
- **NEST-LIB-06: Mapping is hand-written** (ARCH-MAP-08). No mapping libraries (`class-transformer`, AutoMapper).
- **NEST-LIB-07: Outgoing HTTP calls use `fetch` and `Agent` imported from the `undici` package** with explicit timeouts and an `AbortSignal` deadline per call ([resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md)); the global `fetch` is banned by lint (NODE-TOOL-05). When the provider has an OpenAPI spec, the client and its zod schemas are generated with Orval (`client: 'fetch'` with an injected fetch function, plus `client: 'zod'`) into `adapter/out/http/generated` ([api/nestjs-openapi.md](../08-crosscutting-concepts/api/nestjs-openapi.md)), the same generator the TypeScript frontends use; `axios` and `@nestjs/axios` are not used.
- **NEST-LIB-08: Resilience policies use cockatiel**, only in outgoing adapters.
- **NEST-LIB-09: Database access uses Kysely with `pg`**; no ORM.
- **NEST-LIB-10: Kafka uses `@platformatic/kafka`** (pure JavaScript, no native build) in own messaging adapters. `@confluentinc/kafka-javascript` is not used: it has no prebuilt binary for Node 26, so it needs a librdkafka source build with a compiler toolchain.
- **NEST-LIB-11: The service ships as a minimal, non-root OCI image with an SBOM** (REL-IMG-01/02): the base image is pinned by digest, and the image contains no build tools, sources or secrets. It is built with the multi-stage Dockerfile of [nestjs-delivery.md](../07-deployment-view/nestjs-delivery.md) (NEST-REL-07/08), not with Buildpacks.

## Library map

| Job | Library | Rules |
|---|---|---|
| Framework, DI, HTTP | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify` | [05-building-block-view/nestjs.md](../05-building-block-view/nestjs.md) |
| Schemas | `zod` | [api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md) |
| OpenAPI | `@nestjs/swagger`, `yaml` (spec file), Orval (outbound clients) | [api/nestjs-openapi.md](../08-crosscutting-concepts/api/nestjs-openapi.md) |
| JWT validation | `jose` | [security/nestjs.md](../08-crosscutting-concepts/security/nestjs.md) |
| Security headers, limits | `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors` | [security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md) |
| BFF login and session | `openid-client`, `@fastify/session`, `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/static` (added with the BFF; none of them is in the service skeleton) | [security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md) |
| Database, migrations | `kysely`, `pg` | [persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md) |
| Messaging | `@platformatic/kafka` | [messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md) |
| Resilience, CPU work, caching | `cockatiel`, `undici`, `piscina`, `lru-cache` | [resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md) |
| Scheduling | `@nestjs/schedule` | [resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md) |
| Health | `@nestjs/terminus` | [observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md) |
| Telemetry | `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/instrumentation`, `import-in-the-middle` (ESM hook), `@opentelemetry/api`, `@fastify/otel`; `@opentelemetry/sdk-metrics` in tests | [observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md) |
| Logging | `nestjs-pino`, `pino`, `pino-http`; `pino-pretty` (dev, CLI only) | [logging/nestjs.md](../08-crosscutting-concepts/logging/nestjs.md) |
| Tests | `vitest`, `vitest-mock-extended`, `unplugin-swc`, `@swc/core`, `@nestjs/testing`, `@testcontainers/*` | [testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md) |
| Architecture tests | `dependency-cruiser` | [05-building-block-view/nestjs.md](../05-building-block-view/nestjs.md) |

## Not used

| Library | Reason |
|---|---|
| `@nestjs/platform-express`, Express middleware | NEST-LIB-03 |
| class-validator, class-transformer, `nestjs-zod` | NEST-LIB-04; `nestjs-zod` 5.6 does not support Nest 12 |
| TypeORM, Prisma, MikroORM, Sequelize, Drizzle | Kysely keeps queries explicit and rows in the adapter (NEST-LIB-09) |
| `@nestjs/microservices` Kafka transport, `kafkajs`, `@confluentinc/kafka-javascript` | kafkajs development has stalled; the Confluent client needs a native build on Node 26; NEST-LIB-10 |
| `@nestjs/passport`, `passport-jwt` | `jose` in one guard is smaller and explicit ([security/nestjs.md](../08-crosscutting-concepts/security/nestjs.md)) |
| `axios`, `@nestjs/axios`, `got`, `node-fetch`, global `fetch` | `undici` with explicit timeouts (NEST-LIB-07) |
| `@nestjs/config` | A zod loader per config area covers it ([configuration/nestjs.md](../08-crosscutting-concepts/configuration/nestjs.md)) |
| `@opentelemetry/instrumentation-nestjs-core` | Supports only `@nestjs/core` below 12; disabled ([observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md)) |
| `eslint-plugin-n` `no-process-env` | Misses imported `env`; core ESLint rules cover it (NODE-TOOL-05) |
| Jest, `ts-jest`, `ts-node`, `tsx` in production | Vitest (NODE-D7); compiled output only (NODE-D2) |
| Winston, `console.*` | pino (NEST-D11) |
| Embedded or in-memory Postgres (`pg-mem`) | TEST-ARCH-04 |

## Versions of the reference build

Pinned in the template `package.json` of `baseline-nestjs` (validated on 2026-11-20 with Node 26.13, npm 11.13), which is the source for this table; packages that are not in the skeleton (Kafka, piscina, lru-cache) come from the scratch builds of their topic docs. Newer patch versions are expected:

| Component | Version |
|---|---|
| `@nestjs/core`, `common`, `platform-fastify`, `testing` | 12.5.0 |
| `@nestjs/swagger` / `terminus` / `schedule` / `cli` (dev) | 12.1.2 / 12.1.0 / 12.0.4 / 12.0.15 |
| TypeScript | 6.0.3 |
| zod | 4.6.7 |
| Kysely / pg | 0.29.9 / 8.23.1 |
| nestjs-pino / pino | 5.3.1 / 10.4.0 |
| jose | 6.2.17 |
| `@fastify/helmet` | 13.2.0 |
| cockatiel | 4.0.0 |
| `@platformatic/kafka` | 2.15.0 |
| undici | 8.12.4 |
| `@fastify/otel` | 1.0.1 |
| piscina / lru-cache | 5.3.2 / 11.5.3 |
| pino-pretty / yaml (dev) | 13.2.0 / 2.9.1 |
| Vitest / unplugin-swc / `@swc/core` | 5.1.0 / 2.0.0 / 1.16.22 |
| `@testcontainers/postgresql` | 12.2.1 |
| dependency-cruiser | 18.7.2 |

*Agent checklist in [checklists/nestjs.md](../checklists/nestjs.md) and sources in [sources.md](../sources.md), section "NestJS: Libraries".*
