# Solution Strategy: NestJS

The key technology decisions for NestJS backend components. They tighten the shared strategy in [04-solution-strategy/README.md](README.md) and the Node defaults in [node.md](node.md), and never contradict them. Navigation and skills: [stacks/nestjs.md](../stacks/nestjs.md).

Spring Boot stays the default backend stack. A product picks NestJS in its chapter 4; choosing one of the two documented stacks needs no ADR.

## Stack at a glance

Node.js 26 LTS · TypeScript 6.0 (ESM) · NestJS 12 on Fastify · zod 4 through Nest's Standard Schema support · `@nestjs/swagger` (code-first spec) · OAuth2 resource server with `jose` · PostgreSQL 18 + Kysely + Kysely migrator · Kafka with `@platformatic/kafka` · cockatiel · pino (`nestjs-pino`) · OpenTelemetry Node SDK · `@nestjs/terminus` · Vitest + vitest-mock-extended + Testcontainers · dependency-cruiser · ESLint (typescript-eslint type-checked, SonarJS) + Prettier · multi-stage Dockerfile on distroless (image build).

## Defaults

| # | Topic | Default | Defined in |
|---|---|---|---|
| NEST-D1 | Framework line | NestJS 12.x; TypeScript pinned to 6.0.x until `@nestjs/swagger` supports 7 | [nestjs-libraries.md](nestjs-libraries.md) |
| NEST-D2 | HTTP platform | Fastify adapter (`@nestjs/platform-fastify`); no Express, no Express middleware | [nestjs-libraries.md](nestjs-libraries.md) |
| NEST-D3 | Validation and DTOs | zod schemas on route parameters (`@Body({ schema })`) with a global `StandardSchemaValidationPipe`; no class-validator, no DTO classes | [08-crosscutting-concepts/api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md) |
| NEST-D4 | Wiring | One Nest module per bounded context as its composition root; core classes without decorators, created with `useFactory`; tokens are `Symbol`s | [05-building-block-view/nestjs.md](../05-building-block-view/nestjs.md) |
| NEST-D5 | Database | PostgreSQL; Kysely with `pg`; forward-only Kysely migrations at start-up, a migrate-only job as the alternative | [08-crosscutting-concepts/persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md) |
| NEST-D6 | Auth | Resource server validating JWTs from an external IdP with `jose`; authorization on a framework-free `Caller` | [08-crosscutting-concepts/security/nestjs.md](../08-crosscutting-concepts/security/nestjs.md) |
| NEST-D7 | Browser login | A NestJS backend may be the BFF (OIDC login, server-side session, cookie), decided per product in an ADR | [08-crosscutting-concepts/security/nestjs-hardening.md](../08-crosscutting-concepts/security/nestjs-hardening.md) |
| NEST-D8 | API versioning | Version folders (`adapter/in/rest/v1`) and a `/v1` path prefix; Nest's built-in versioning is not used | [08-crosscutting-concepts/api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md) |
| NEST-D9 | Messaging | Kafka through `@platformatic/kafka` in own adapters; not Nest's microservices transport | [08-crosscutting-concepts/messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md) |
| NEST-D10 | Resilience | Explicit timeouts per call; cockatiel for retry, circuit breaker and bulkhead in outgoing adapters | [08-crosscutting-concepts/resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md) |
| NEST-D11 | Logging | pino through `nestjs-pino`, JSON on stdout | [08-crosscutting-concepts/logging/nestjs.md](../08-crosscutting-concepts/logging/nestjs.md) |
| NEST-D12 | Local services | Docker Compose in `backend/compose.yaml` | [07-deployment-view/nestjs-local-development.md](../07-deployment-view/nestjs-local-development.md) |
| NEST-D13 | Images | OCI image meeting REL-IMG-*, built with a multi-stage Dockerfile on distroless (stack-level exception to REL-IMG-02 while Paketo cannot run Node 26) | [07-deployment-view/nestjs-delivery.md](../07-deployment-view/nestjs-delivery.md) |
