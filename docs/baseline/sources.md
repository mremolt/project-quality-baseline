# Sources

The sources of every baseline doc, one section per doc, titled like the doc. For people checking where a rule comes from; agents do not need this file.

## Hexagonal Architecture (Ports & Adapters)

[04-solution-strategy/hexagonal-architecture.md](04-solution-strategy/hexagonal-architecture.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 1 (What's Wrong with Layers?), ch. 2 (Inverting Dependencies), ch. 12 (Deciding on an Architecture Style). Background: Robert C. Martin, *Clean Architecture*; Alistair Cockburn, "Hexagonal Architecture".

## NestJS: Libraries

[04-solution-strategy/nestjs-libraries.md](04-solution-strategy/nestjs-libraries.md)

NestJS documentation (docs.nestjs.com), npm registry metadata (peer dependencies of `@nestjs/swagger` 12.1.2 and `nestjs-zod` 5.6.0), Fastify documentation (fastify.dev), versions read from a validated template build.

## Solution Strategy: Next.js

[04-solution-strategy/nextjs.md](04-solution-strategy/nextjs.md)

Next.js 16.4 documentation (nextjs.org/docs and the copy bundled in `node_modules/next/dist/docs/`: App Router, `proxy.ts`, `output`, `reactCompiler`, `agentRules`), React 19 (react.dev), `@mui/material-nextjs` (mui.com/material-ui/integrations/nextjs), next-intl 4 (next-intl.dev), openid-client 6 (github.com/panva/openid-client), OpenTelemetry JS (opentelemetry.io/docs/languages/js), pino (getpino.io), Orval (orval.dev). Versions as installed and verified in the baseline's Next.js validation project (2026-11-20).

## Solution Strategy: React

[04-solution-strategy/react.md](04-solution-strategy/react.md)

React (react.dev), React Compiler (react.dev/learn/react-compiler), Vite (vite.dev), TanStack Router and Query (tanstack.com), Redux Toolkit (redux-toolkit.js.org), MUI (mui.com), React Hook Form (react-hook-form.com), use-intl (next-intl.dev), Orval (orval.dev), MSW (mswjs.io). Versions as installed and verified in the baseline's React SPA validation project (2026-11-20).

## Spring Boot: Libraries

[04-solution-strategy/spring-libraries.md](04-solution-strategy/spring-libraries.md)

Spring Boot 4.0 Migration Guide, Spring Boot reference (packaging OCI images: Buildpacks), Jib (github.com/GoogleContainerTools/jib) and 4.1 release notes (github.com/spring-projects/spring-boot/wiki), Spring Framework 7 release notes, springdoc-openapi compatibility matrix (springdoc.org/faq.html), OpenAPI Generator (openapi-generator.tech), Resilience4j. Versions read from a validated template build.

## Implementing Adapters

[05-building-block-view/adapters.md](05-building-block-view/adapters.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 5 (Implementing a Web Adapter), ch. 6 (Implementing a Persistence Adapter).

## Angular: Architecture and Project Structure

[05-building-block-view/angular.md](05-building-block-view/angular.md)

Angular documentation (angular.dev), Angular style guide (angular.dev/style-guide), `angular-developer` skill (github.com/angular/skills). Architecture mapping: this baseline.

## Code Organization

[05-building-block-view/code-organization.md](05-building-block-view/code-organization.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 3 (Organizing Code), ch. 9 (Assembling the Application), ch. 10 (Enforcing Architecture Boundaries). Package layout: internal proposal from our Java team.

## Java: Hexagonal Architecture

[05-building-block-view/java.md](05-building-block-view/java.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 3, 4, 9, 10. The book uses Lombok and mutable getters in places; this baseline updates those parts to Java records.

## NestJS: Hexagonal Architecture

[05-building-block-view/nestjs.md](05-building-block-view/nestjs.md)

NestJS documentation: custom providers (`useFactory`, `useExisting`), injection scopes, circular dependency, lifecycle events (docs.nestjs.com). Validated against a template service (NestJS 12.5, Fastify adapter), 2026-11-20.

## Next.js: Architecture and Project Structure

[05-building-block-view/nextjs.md](05-building-block-view/nextjs.md)

Next.js 16.4 documentation (bundled in `node_modules/next/dist/docs/`: App Router project structure, Server and Client Components, `'use client'`, `'use server'`, Server Actions and Mutations, Route Handlers, `proxy.ts`, `next/dynamic`, `generateMetadata`, dynamic rendering), React 19 (`cache`, Server Components), `server-only` (npm package README), TanStack Query 5 (`initialData`, advanced SSR guide), Redux Toolkit "Usage with Next.js", dependency-cruiser 18 (rules reference, `cruise()` API). All rules above, unless marked to verify, were compiled and exercised in the baseline's Next.js validation project (2026-11-20). Architecture mapping: this baseline.

## Node.js Backend: Hexagonal Architecture

[05-building-block-view/node.md](05-building-block-view/node.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, translated to TypeScript backends by this baseline. Node.js documentation: "Don't block the event loop" (nodejs.org/learn), process events `unhandledRejection` and `uncaughtException`.

## React: Architecture and Project Structure

[05-building-block-view/react.md](05-building-block-view/react.md)

React 19 (react.dev: Rules of Hooks, You Might Not Need an Effect, Error boundaries, React Compiler), Vite 8 (vite.dev: `html.cspNonce`, `build.rolldownOptions`), `@vitejs/plugin-react` 6 README (`reactCompilerPreset`), TanStack Router 1.170 (tanstack.com/router: code-based routing, `lazyRouteComponent`, `validateSearch`, `getRouteApi`, `createLink`), TanStack Query 5 (`queryOptions`, `keepPreviousData`), React Hook Form 7 and `@hookform/resolvers` 7 (`standardSchemaResolver`), dependency-cruiser 18 (rules reference, `cruise()` API). All APIs and options above were compiled and exercised in the baseline's React SPA validation project (2026-11-20). Architecture mapping: this baseline.

## Spring Boot: Hexagonal Architecture

[05-building-block-view/spring.md](05-building-block-view/spring.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 5, 6, 7, 9, 10. Package structure: proposal from our Java team. Updated for Spring Boot 4 (constructor injection, `@MockitoBean`, `@ServiceConnection`, `ProblemDetail`, Jackson 3, modular test starters).

## TypeScript Frontend: Hexagonal Architecture

[05-building-block-view/typescript.md](05-building-block-view/typescript.md)

Concepts from Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019 (ch. 2–8, 10, 11), translated to frontend by this baseline. The frontend mapping is our own interpretation and is not from the book.

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Implementing Use Cases

[05-building-block-view/use-cases.md](05-building-block-view/use-cases.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 4 (Implementing a Use Case), ch. 6 (transactions), ch. 11 (sharing models).

## Container Images, Frontend Delivery and Runtime Contract

[07-deployment-view/container-runtime.md](07-deployment-view/container-runtime.md)

OCI Image Format Specification, annotations (github.com/opencontainers/image-spec). Cloud Native Buildpacks (buildpacks.io); Paketo image labels buildpack (`BP_OCI_*`) and JVM memory calculator (paketo.io). Kubernetes documentation: pod security standards, `securityContext`, resource management, startup probes, pod termination (kubernetes.io). Docker Compose file reference (docs.docker.com/compose). OpenJDK container support, `-XX:MaxRAMPercentage`. Angular deployment guide, server configuration for routed apps (angular.dev).

Per stack (frontend): Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Delivery and Release

[07-deployment-view/delivery-and-release.md](07-deployment-view/delivery-and-release.md)

Paul Hammant, trunkbaseddevelopment.com (short-lived branches, branch for release). Conventional Commits 1.0.0 (conventionalcommits.org). Semantic Versioning 2.0.0 (semver.org). Keep a Changelog 1.1.0 (keepachangelog.com). release-please (github.com/googleapis/release-please). Jez Humble, David Farley, *Continuous Delivery* (build once, deployment pipeline). Pete Hodgson, *Feature Toggles (aka Feature Flags)* (martinfowler.com). OpenFeature specification (openfeature.dev). Danilo Sato, *ParallelChange* (martinfowler.com). Flyway documentation: PostgreSQL transactional lock setting, lock retry count setting (documentation.red-gate.com/fd). Squawk, PostgreSQL migration linter (squawkhq.com). Kubernetes documentation, pod lifecycle and termination (kubernetes.io). SLSA v1.0 (slsa.dev).

## NestJS: Delivery

[07-deployment-view/nestjs-delivery.md](07-deployment-view/nestjs-delivery.md)

Paketo Node.js buildpack how-to (paketo.io/docs/howto/nodejs) and the READMEs of `paketo-buildpacks/npm-start` and `npm-install`. Cloud Native Buildpacks `pack` CLI. Docker documentation: multi-stage builds, `buildx build --build-context`. Distroless images (github.com/GoogleContainerTools/distroless). npm documentation, `npm sbom`. Kysely 0.29 `Migrator` source. Checked in a scratch build on 2026-11-20: `pack` 0.40.11 with `paketobuildpacks/ubuntu-noble-builder`, Docker 29.8, `node:26-trixie-slim` and `gcr.io/distroless/nodejs26-debian13:nonroot`, PostgreSQL 18.

## NestJS: Local Development

[07-deployment-view/nestjs-local-development.md](07-deployment-view/nestjs-local-development.md)

Docker Compose file reference and profiles (docs.docker.com/compose). PostgreSQL image notes, init scripts and PostgreSQL 18 `PGDATA` (hub.docker.com/_/postgres). Apache Kafka Docker image (hub.docker.com/r/apache/kafka). Node.js documentation: `--env-file`, `--inspect`. Nest CLI 12 (`nest start --watch --debug --env-file`, `nest-cli.json`). Checked in a scratch build on 2026-11-21 (Nest CLI 12.0.13, Node 26.13, Docker Compose with `postgres:18.1`, the role split of NEST-DEV-04 with the start-up migration and the pre-deploy check).

## Next.js: Delivery

[07-deployment-view/nextjs-delivery.md](07-deployment-view/nextjs-delivery.md)

Next.js 16 documentation: `output: 'standalone'`, self-hosting guide (version skew, `deploymentId`, server actions encryption key, caching and ISR on self-hosted servers), `images.unoptimized`, `outputFileTracingExcludes` (nextjs.org/docs). Next.js 16.4.6 source in `next/dist` (`deploymentId`, `NEXT_DEPLOYMENT_ID`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `server-reference-manifest.json`). Distroless images (github.com/GoogleContainerTools/distroless). Docker documentation: multi-stage builds, `.dockerignore`, `docker run --read-only`. Kubernetes documentation: container lifecycle hooks (`sleep` action), pod termination. CycloneDX npm (`@cyclonedx/cyclonedx-npm`). Checked in a scratch build on 2026-11-20: Next.js 16.4.6, Node 26.1, Docker 29.8, `node:26-trixie-slim` and `gcr.io/distroless/nodejs26-debian13:nonroot`, Redis 8.4 (read-only run, SIGTERM drain, action IDs across builds, static file serving of an added previous-release chunk).

## Next.js: Local Development

[07-deployment-view/nextjs-local-development.md](07-deployment-view/nextjs-local-development.md)

Next.js 16 documentation: `next dev` CLI options (`--hostname`, `--inspect`, `--experimental-https`), environment variables and `.env` load order, debugging guide, `agentRules` in `next.config.js` (nextjs.org/docs). Docker Compose file reference and profiles (docs.docker.com/compose). Redis image (hub.docker.com/_/redis). Keycloak realm import (keycloak.org/server/importExport). Node.js documentation: `--inspect`. Checked on 2026-11-20 in a copy of the reference app: Next.js 16.4.6 `next dev` with `.env.development`, `APP_TEST_STUBS=1` and `redis:8.4-alpine` (login and callback by `curl`, server-rendered page with stub data), `--hostname localhost` binding, `--inspect` port, `agentRules: false`.

## Repository Layout

[07-deployment-view/repository-layout.md](07-deployment-view/repository-layout.md)

GitHub Actions docs: path filters and skipped required checks (docs.github.com, "Troubleshooting required status checks"), deployment environments; dorny/paths-filter; GitLab CI `rules:changes`, protected environments and deployment approvals; Jenkins Pipeline syntax (`changeset`, `input`); Azure Pipelines branch policies, environments, approvals and checks, pull request templates. husky docs, "Project not in git root" (typicode.github.io/husky). Parallel change / expand-contract: Danilo Sato, *ParallelChange* (martinfowler.com). Conway's law as the reason ownership signals (S2, S9) dominate.

## Spring Boot: Delivery

[07-deployment-view/spring-delivery.md](07-deployment-view/spring-delivery.md)

Spring Boot reference: "Execute Flyway database migrations on startup" (docs.spring.io/spring-boot/how-to/data-initialization.html), info endpoint and info contributors (docs.spring.io/spring-boot/reference/actuator/endpoints.html), application properties appendix (`spring.flyway.*`, `management.info.*`). Flyway documentation: PostgreSQL transactional lock setting, lock retry count setting. PostgreSQL documentation, `GRANT`, `ALTER DEFAULT PRIVILEGES` and `lock_timeout`. Maven, CI-friendly versions (maven.apache.org/maven-ci-friendly.html). git-commit-id-maven-plugin (github.com/git-commit-id/git-commit-id-maven-plugin). Maven Resources Plugin, `copy-resources`.

## Spring Boot: Local Development

[07-deployment-view/spring-local-development.md](07-deployment-view/spring-local-development.md)

Spring Boot Docker Compose support (docs.spring.io/spring-boot/reference/features/dev-services.html), Docker Compose file reference and profiles (docs.docker.com/compose), Apache Kafka Docker image (hub.docker.com/r/apache/kafka), PostgreSQL 18 image notes (hub.docker.com/_/postgres).

## Generated API Clients in Angular

[08-crosscutting-concepts/api/angular-openapi-clients.md](08-crosscutting-concepts/api/angular-openapi-clients.md)

Orval 8 type definitions (`override.angular.provideIn`), RxJS `firstValueFrom` and `takeUntil` (rxjs.dev), Angular `HttpClient` (angular.dev).

## Avoiding N+1 Requests over REST

[08-crosscutting-concepts/api/avoiding-n-plus-one.md](08-crosscutting-concepts/api/avoiding-n-plus-one.md)

DataLoader pattern: github.com/graphql/dataloader. HTTP caching and conditional requests: RFC 9111, RFC 9110 (ETag). Use-case-shaped queries follow ARCH-UC-03 (Command-Query Separation) in this baseline.

## NestJS: Producing the OpenAPI Contract (code-first)

[08-crosscutting-concepts/api/nestjs-openapi.md](08-crosscutting-concepts/api/nestjs-openapi.md)

OpenAPI 3.0, `@nestjs/swagger` 12 (`SwaggerDocumentOptions.operationIdFactory` and `include`, `standardSchema` on response decorators, the Standard Schema converter with target `openapi-3.0`), zod 4 (`z.toJSONSchema`, `.meta`), `yaml` (`stringify` with `sortMapEntries`), RFC 9457, oasdiff (github.com/oasdiff/oasdiff), Orval 8 (orval.dev; `client: 'fetch'`, `httpClientInjection`, `client: 'zod'`).

## NestJS: REST and JSON Conventions

[08-crosscutting-concepts/api/nestjs-rest.md](08-crosscutting-concepts/api/nestjs-rest.md)

RFC 9457 (Problem Details), RFC 3339 / ISO 8601, NestJS documentation (pipes and Standard Schema validation, exception filters, Fastify adapter; the `StandardSchemaValidationPipe` options and `FastifyAdapter.mapException` in the `@nestjs/common` and `@nestjs/platform-fastify` 12 sources), Fastify reference (content-type parser, error codes, `onProtoPoisoning`), zod 4 documentation (`z.iso.*`, `z.config`, `.meta`).

## Next.js: Generated API Clients

[08-crosscutting-concepts/api/nextjs-openapi-clients.md](08-crosscutting-concepts/api/nextjs-openapi-clients.md)

Orval 8.47 (orval.dev; multiple outputs, `override.mutator`, `urlEncodeParameters`, `clean`, `mock.generators`), Next.js 16.4 (`cookies()` and dynamic APIs, Route Handlers, `'use cache'` restrictions; bundled docs in `node_modules/next/dist/docs/`), Node.js 26 (`AbortSignal.any`, `AbortSignal.timeout`, global `fetch` with `redirect: 'error'`), MSW 3 (`setupServer`, `onUnhandledFrame`, `delay`), RFC 6750 (bearer token usage). Two-client setup, server mutator, request-scoped resolver, proxy and their tests as built in the baseline's Next.js validation project (2026-11-20), with the corrections named in the rules.

## OpenAPI Contracts

[08-crosscutting-concepts/api/openapi-contracts.md](08-crosscutting-concepts/api/openapi-contracts.md)

OpenAPI Specification 3.1 (openapis.org). RFC 9457, *Problem Details for HTTP APIs*. oasdiff (github.com/oasdiff/oasdiff). Placement rules follow Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, ch. 5–6.

## React: Generated API Clients

[08-crosscutting-concepts/api/react-openapi-clients.md](08-crosscutting-concepts/api/react-openapi-clients.md)

Orval 8.47 (orval.dev; output options `client`, `override.mutator`, `override.fetch.includeHttpResponseReturnType`, `urlEncodeParameters`, `mock.generators`, verified against the generated output), MSW 3 (mswjs.io; `setupServer`, `onUnhandledFrame`, `delay`, `HttpResponse.error`), zod 4 (zod.dev), MDN `AbortSignal.timeout`, `AbortSignal.any` (browser compatibility table) and `addEventListener` `signal` option, `@faker-js/faker` 10. All options and APIs above were compiled and tested in the baseline's React SPA validation project (2026-11-20).

## REST Conventions (wire format)

[08-crosscutting-concepts/api/rest-conventions.md](08-crosscutting-concepts/api/rest-conventions.md)

RFC 9457 (Problem Details for HTTP APIs), RFC 9110 (HTTP Semantics: conditional requests, status codes), RFC 3339 / ISO 8601, ISO 4217, RFC 9745 (Deprecation header), RFC 8594 (Sunset header), OpenAPI Specification 3.1 and the OpenAPI format registry (`decimal`), Microsoft REST API Guidelines and Zalando RESTful API Guidelines (paging, sorting, filtering).

## Spring Boot: Producing the OpenAPI Contract (code-first)

[08-crosscutting-concepts/api/spring-openapi.md](08-crosscutting-concepts/api/spring-openapi.md)

springdoc-openapi (springdoc.org, including the properties reference), OpenAPI 3.x, RFC 9457, oasdiff (github.com/oasdiff/oasdiff).

## Spring Boot: REST and JSON Conventions

[08-crosscutting-concepts/api/spring-rest.md](08-crosscutting-concepts/api/spring-rest.md)

RFC 9457 (Problem Details), RFC 3339 / ISO 8601, springdoc-openapi (`SpringDocUtils.replaceWithSchema`), Spring MVC reference (docs.spring.io/spring-framework/reference/web/webmvc.html), Jackson 3 (github.com/FasterXML/jackson-3), Microsoft REST API Guidelines (money and date conventions).

## Generated API Clients (Orval)

[08-crosscutting-concepts/api/typescript-openapi-clients.md](08-crosscutting-concepts/api/typescript-openapi-clients.md)

Orval (orval.dev, `orval` skill from github.com/orval-labs/orval; option names `mock.generators` and `urlEncodeParameters` from the Orval 8 type definitions, zod schema names from Orval 8.47 output), MSW (mswjs.io; `onUnhandledFrame` in MSW 3), zod (zod.dev).

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Enforcing Architecture Boundaries

[08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md](08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 10 (Enforcing Architecture Boundaries), ch. 1 (shortcuts in layered architectures).

## Angular: Runtime Configuration

[08-crosscutting-concepts/configuration/angular.md](08-crosscutting-concepts/configuration/angular.md)

Angular API reference: `provideAppInitializer` (stable; `APP_INITIALIZER` deprecated), `isDevMode`, workspace configuration and dev-server proxy (angular.dev); zod; The Twelve-Factor App.

## Configuration and Environments

[08-crosscutting-concepts/configuration/configuration.md](08-crosscutting-concepts/configuration/configuration.md)

The Twelve-Factor App (12factor.net: III Config, V Build, release, run, X Dev/prod parity), OWASP Secrets Management Cheat Sheet, OWASP ASVS 5.0 (V13 Configuration), Spring Boot externalized configuration reference.

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## NestJS: Configuration

[08-crosscutting-concepts/configuration/nestjs.md](08-crosscutting-concepts/configuration/nestjs.md)

zod 4 documentation (`z.coerce`, `z.url`, `.meta`, `z.toJSONSchema` with `io: 'input'`), Node.js documentation (`util.inspect.custom`, `--env-file`), NestJS documentation (custom providers, `useFactory`), ESLint rules `no-restricted-properties` and `no-restricted-imports`, The Twelve-Factor App. Code above checked in a scratch build on 2026-11-21 (zod 4.6.7, Node 26.13, ESLint 9.39, the version NODE-TOOL-04 and the template pin).

## Next.js: Configuration

[08-crosscutting-concepts/configuration/nextjs.md](08-crosscutting-concepts/configuration/nextjs.md)

Next.js 16 documentation (nextjs.org/docs): environment variables (load order, `NEXT_PUBLIC_` inlining, runtime environment for dynamic rendering), `next.config.ts` `env`, `instrumentation.ts` `register()`, `server-only`. zod 4.6 documentation (`z.coerce`, `z.url`, `.describe`, `.refine`, `z.toJSONSchema` with `io: 'input'`). Node.js documentation (`util.inspect.custom`, `process.exit`). ESLint `no-restricted-properties`, `no-restricted-imports`. The Twelve-Factor App (III Config). Checked in the reference app and a copy of it on 2026-11-20 (Next.js 16.4.6 standalone server, zod 4.6.7, Node 26.1).

## React: Runtime Configuration

[08-crosscutting-concepts/configuration/react.md](08-crosscutting-concepts/configuration/react.md)

Vite 8.3 (vite.dev): env variables and modes, `define`, `server.proxy`; React 19.3 `createContext`, `use`; zod 4.6; MDN `fetch` `cache: 'no-store'`, `AbortSignal.timeout`; The Twelve-Factor App (config).

## Spring Boot: Configuration

[08-crosscutting-concepts/configuration/spring.md](08-crosscutting-concepts/configuration/spring.md)

Spring Boot reference: externalized configuration (config tree, relaxed binding, `@ConfigurationProperties` validation, constructor binding with records), common application properties appendix (4.1); Spring Boot `ApplicationContextRunner` (test utilities); Hibernate Validator; The Twelve-Factor App.

## Data Protection (GDPR / DSGVO)

[08-crosscutting-concepts/data-protection/data-protection.md](08-crosscutting-concepts/data-protection/data-protection.md)

Regulation (EU) 2016/679 (GDPR), Art. 4, 5, 9, 12–22, 25, 28, 30, 32–35, 37–39, 44–49, Recital 26 (eur-lex.europa.eu). Bundesdatenschutzgesetz (BDSG), § 38. Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG), § 25. DIN 66398, *Leitlinie zur Entwicklung eines Löschkonzepts*. EDPB Guidelines 4/2019 on Article 25 (data protection by design and by default); EDPB Guidelines 01/2025 on pseudonymisation (status: [chapter 11](11-risks-and-technical-debt/README.md#verify-before-first-use)). EU General Court, judgment of 3 September 2025, T-553/23 *Latombe v Commission*; appeal C-703/25 P. Standard Data Protection Model (SDM) of the German supervisory authorities.

## NestJS: Data Protection

[08-crosscutting-concepts/data-protection/nestjs.md](08-crosscutting-concepts/data-protection/nestjs.md)

`@nestjs/schedule` 12 documentation. PostgreSQL documentation, foreign keys and `ON DELETE CASCADE`. Kysely 0.29 documentation (`deleteFrom` with subqueries). Apache Kafka documentation, log compaction and tombstones. pino documentation (`redact`), nestjs-pino README (`pinoHttp` with a destination stream). Checked in a scratch build on 2026-11-20: batched delete with cascade against PostgreSQL 18, log capture and redaction with nestjs-pino 5.3.2.

## Spring Boot: Data Protection

[08-crosscutting-concepts/data-protection/spring.md](08-crosscutting-concepts/data-protection/spring.md)

Spring Framework reference, task scheduling (`@Scheduled`). PostgreSQL documentation, foreign keys and `ON DELETE CASCADE`. Hibernate Envers user guide. Apache Kafka documentation, log compaction and tombstones. Spring Boot reference, testing with `OutputCaptureExtension`.

## Agent Skills

[08-crosscutting-concepts/development/agent-skills.md](08-crosscutting-concepts/development/agent-skills.md)

`skills` CLI (github.com/vercel-labs/skills), Agent Skills format (agentskills.io).

## Angular Tooling

[08-crosscutting-concepts/development/angular-tooling.md](08-crosscutting-concepts/development/angular-tooling.md)

angular-eslint (github.com/angular-eslint/angular-eslint; `no-developer-preview`, `no-experimental` and their options), API stability labels (angular.dev/api), Angular release and support policy (angular.dev/reference/releases), `@ngrx/eslint-plugin` (ngrx.io/guide/eslint-plugin), Angular compiler options (angular.dev/reference/configs/angular-compiler-options), Angular CLI unit-test builder (angular.dev/guide/testing).

## Architecture Documentation (arc42)

[08-crosscutting-concepts/development/architecture-documentation.md](08-crosscutting-concepts/development/architecture-documentation.md)

arc42 (arc42.org, docs.arc42.org, "arc42 by Example"), C4 model (c4model.com), Michael Nygard, "Documenting Architecture Decisions" (2011).

## IDE Setup: VS Code and IntelliJ IDEA Ultimate

[08-crosscutting-concepts/development/ide-setup.md](08-crosscutting-concepts/development/ide-setup.md)

VS Code workspace settings and recommended extensions (code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions), vscode-eslint, prettier-vscode, IntelliJ IDEA docs: Prettier, ESLint, Required plugins, Actions on Save (jetbrains.com/help/idea), EditorConfig (editorconfig.org).

## Java Tooling

[08-crosscutting-concepts/development/java-tooling.md](08-crosscutting-concepts/development/java-tooling.md)

Error Prone (errorprone.info), NullAway (github.com/uber/NullAway), JSpecify (jspecify.dev), Spotless Maven plugin (github.com/diffplug/spotless), palantir-java-format, SpotBugs and FindSecBugs, JaCoCo, maven-enforcer-plugin, OSV-Scanner (google.github.io/osv-scanner), CycloneDX Maven plugin, Maven guide to reproducible builds (maven.apache.org/guides/mini/guide-reproducible-builds.html), Spring Boot Maven plugin `build-info` goal (`time` defaults to `project.build.outputTimestamp`).

## Next.js: Tooling

[08-crosscutting-concepts/development/nextjs-tooling.md](08-crosscutting-concepts/development/nextjs-tooling.md)

Next.js 16.4 documentation, bundled in `node_modules/next/dist/docs/` (`next.config.js` options `output`, `reactCompiler`, `poweredByHeader`, `images`, `serverActions`, `agentRules`, `agentFeedback`, `agentUpgrade`, `productionBrowserSourceMaps`, `typescript`; guides "AI Coding Agents", "Upgrading", "TypeScript", "ESLint"; Turbopack), Next.js 16.4.6 source `dist/server/lib/generate-agent-files.js` and `dist/server/lib/app-info-log.js`, Next.js telemetry (nextjs.org/telemetry), `@next/eslint-plugin-next` 16.4, `@mui/material-nextjs` 9.5, TypeScript 6.0 `types` default change (typescriptlang.org), ESLint `no-restricted-syntax` and ESTree `directive`. Verified in the baseline's Next.js validation project (2026-11-20) and, for `agentRules`, in a copy of it: `next dev` with and without an agent environment, with and without an existing `AGENTS.md`, and with `agentRules: false`.

## Node.js Tooling

[08-crosscutting-concepts/development/node-tooling.md](08-crosscutting-concepts/development/node-tooling.md)

Node.js release schedule (nodejs.org/en/about/previous-releases, `index.json` of nodejs.org/dist: 26.x Active LTS "Lithium" since 2026-10-28), TypeScript `module: nodenext` (typescriptlang.org/docs/handbook/modules), typescript-eslint rules, npm registry peer dependencies (eslint-plugin-import 2.32: ESLint up to 9). Validated in a template build on 2026-11-20 (ESLint 9.39, typescript-eslint 8.73, Prettier 3.10).

## React: Tooling

[08-crosscutting-concepts/development/react-tooling.md](08-crosscutting-concepts/development/react-tooling.md)

eslint-plugin-react-hooks 7.1 (react.dev/reference/eslint-plugin-react-hooks), `@eslint-react/eslint-plugin` 5.30 (eslint-react.xyz), eslint-plugin-jsx-a11y-x 0.2 (github.com/es-tooling/eslint-plugin-jsx-a11y-x), `@tanstack/eslint-plugin-query` 5.107 (tanstack.com/query/latest/docs/eslint/eslint-plugin-query), ESLint 10 flat config (eslint.org/docs/latest/use/configure), typescript-eslint 8.72 peer range (typescript-eslint.io/users/dependency-versions), React Compiler (react.dev/learn/react-compiler), `@vitejs/plugin-react` 6.3 `reactCompilerPreset` and `@rolldown/plugin-babel` 0.3 (github.com/vitejs/vite-plugin-react), Vite 8.3 build options `target`, `sourcemap`, `define` (vite.dev/config/build-options), TypeScript `allowImportingTsExtensions` (typescriptlang.org/tsconfig), Node.js type stripping (nodejs.org/api/typescript.html).

## TypeScript Tooling

[08-crosscutting-concepts/development/typescript-tooling.md](08-crosscutting-concepts/development/typescript-tooling.md)

typescript-eslint shared configs (typescript-eslint.io/users/configs), eslint-plugin-sonarjs (github.com/SonarSource/SonarJS), eslint-plugin-import-x (github.com/un-ts/eslint-plugin-import-x), eslint-plugin-simple-import-sort (github.com/lydell/eslint-plugin-simple-import-sort), `@eslint-community/eslint-plugin-eslint-comments` (eslint-community.github.io/eslint-plugin-eslint-comments), eslint-config-prettier, Prettier options (prettier.io/docs/options), npm config `min-release-age`, `allow-git`, `engine-strict`, `ignore-scripts` (docs.npmjs.com/cli/v11/using-npm/config), npm CLI changelog (11.9.0: `allow-git`, 11.10.0: `min-release-age`), `npm sbom` (docs.npmjs.com/cli/v11/commands/npm-sbom), Baseline (web-platform-dx.github.io/web-features), Angular browser support (angular.dev/reference/versions) for the current date.

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Angular: Internationalization

[08-crosscutting-concepts/i18n/angular.md](08-crosscutting-concepts/i18n/angular.md)

Angular i18n and `LOCALE_ID` guides (angular.dev/guide/i18n), Angular Material `DateAdapter`, angular-eslint `template/i18n` rule options, Angular pipes guide (pure and impure pipes, angular.dev/guide/templates/pipes), MDN `Intl`, Transloco docs (jsverse.gitbook.io/transloco), `TranslocoTranspiler` and `provideTranslocoTranspiler` (Transloco 8 API), `intl-messageformat` 12 (FormatJS; parses to an AST and interprets, no code generation), `@messageformat/core` 3 (compiles with `new Function`, the reason it is not used), `@jsverse/transloco-keys-manager`, WCAG 3.1.1, 3.1.2, 3.2.3, 3.2.6.

## Internationalization (i18n)

[08-crosscutting-concepts/i18n/i18n.md](08-crosscutting-concepts/i18n/i18n.md)

Weblate docs (docs.weblate.org: formats, continuous localization, checks, machine translation, installation), RFC 9457, WCAG 3.1.1 and 3.1.2 (w3.org/WAI/WCAG22), Playwright emulation (`locale`, `timezoneId`), Spring Boot internationalization, ICU MessageFormat.

Per stack (frontend): Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## NestJS: Internationalization

[08-crosscutting-concepts/i18n/nestjs.md](08-crosscutting-concepts/i18n/nestjs.md)

`intl-messageformat` 12.2 (FormatJS), `negotiator` 1.1, `nestjs-i18n` 10.8.5 package (`package.json`, `dist/utils/i18n-messageformat.js`), RFC 9457 (localized titles), RFC 9110 (`Accept-Language`, `Content-Language`), TypeScript `resolveJsonModule` and import attributes, ESLint `no-restricted-globals` and `no-restricted-properties`, PostgreSQL ICU collations. Checked on 2026-11-20: catalog loading under `tsc` and Vitest, negotiation cases, ICU arguments and parity test, the per-locale REST test with `app.inject()`, the dependency-cruiser and ESLint rules, decimal strings in ICU number arguments, `de-x-icu` ordering in `postgres:18-alpine`.

## Next.js: Internationalization

[08-crosscutting-concepts/i18n/nextjs.md](08-crosscutting-concepts/i18n/nextjs.md)

next-intl 4.15 documentation (next-intl.dev: App Router setup without i18n routing, `createNextIntlPlugin`, `getRequestConfig`, `getTranslations`, `getLocale`, `getMessages`, `getFormatter`, `NextIntlClientProvider` inheritance in server components, `AppConfig` augmentation, routing and middleware), Next.js 16.4 documentation (`headers()`, `generateMetadata`, `router.refresh()`), Playwright `locale` option, MUI 9.5 localization, WCAG 3.1.1, 3.1.2, 3.2.3, 3.2.6. Validated in the Next.js reference build (2026-11-20, next-intl 4.15.1).

## React: Internationalization

[08-crosscutting-concepts/i18n/react.md](08-crosscutting-concepts/i18n/react.md)

`use-intl` 4.15 documentation (next-intl.dev: `IntlProvider`, `useTranslations`, `useFormatter`, `useLocale`, `AppConfig` type augmentation, `onError`, `getMessageFallback`, `IntlErrorCode`), ICU MessageFormat, MDN `Intl.NumberFormat` (string input, ES2023), `Intl.DateTimeFormat`, `Intl.Collator`, MUI 9.5 localization (`@mui/material/locale`), WCAG 3.1.1, 3.1.2, 3.2.3, 3.2.6. Validated in the React SPA reference build (2026-11-20).

## Spring: Internationalization

[08-crosscutting-concepts/i18n/spring.md](08-crosscutting-concepts/i18n/spring.md)

Spring Framework REST exceptions and `ErrorResponse` (message codes), Spring MVC locale resolution, Spring Boot internationalization (`spring.messages.*`), RFC 9457 (localized titles), Hibernate Validator reference (message interpolation).

## NestJS: Logging

[08-crosscutting-concepts/logging/nestjs.md](08-crosscutting-concepts/logging/nestjs.md)

pino and pino-http documentation (`mixin`, `serializers`, `redact`, `autoLogging`, transports), nestjs-pino README (`bufferLogs`, `useLogger`, `LoggerModule.forRoot`), OpenTelemetry JS API (`trace.getActiveSpan`, `isSpanContextValid`) and `@opentelemetry/instrumentation-pino` README, `pino-pretty` README. Checked in a scratch build on 2026-11-20 (nestjs-pino 5.3.2, pino 10.4.0, pino-http 11.0.0, pino-pretty 13.2.0).

## Spring Boot: Logging

[08-crosscutting-concepts/logging/spring.md](08-crosscutting-concepts/logging/spring.md)

SLF4J manual (slf4j.org/manual.html, fluent API), Spring Boot logging and structured logging reference (docs.spring.io/spring-boot/reference/features/logging.html), Micrometer Tracing.

## Mapping Between Boundaries

[08-crosscutting-concepts/mapping/mapping-between-boundaries.md](08-crosscutting-concepts/mapping/mapping-between-boundaries.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 8 (Mapping Between Boundaries).

## Messaging and Event Contracts

[08-crosscutting-concepts/messaging/messaging.md](08-crosscutting-concepts/messaging/messaging.md)

Gregor Hohpe, Bobby Woolf, *Enterprise Integration Patterns* (event message, command message, dead letter channel, idempotent receiver). Chris Richardson, *Microservices Patterns*, ch. 3 (transactional outbox). Martin Fowler, *Tolerant Reader*; *What do you mean by "Event-Driven"?*. AsyncAPI Specification 3.0 (asyncapi.com). CloudEvents 1.0 (cloudevents.io). W3C Trace Context. Apache Kafka documentation (producer idempotence, ordering).

## NestJS: Messaging with Kafka

[08-crosscutting-concepts/messaging/nestjs.md](08-crosscutting-concepts/messaging/nestjs.md)

`@platformatic/kafka` 2.15.0 package (README, `dist/**/*.d.ts`, `clients/producer/producer.js` idempotent defaults, `clients/consumer/messages-stream.js` autocommit and close, `clients/consumer/consumer.js` close and leave group, `clients/base/options.js` defaults, `errors.js`, `protocol/crc32c.js`) and `npm view @platformatic/kafka` (scripts, engines, release dates). `@testcontainers/kafka` 12.2 source. `@asyncapi/cli` 6.3.1 (`validate`, `diff`). zod 4 `toJSONSchema`. Kysely 0.29 (`onConflict`, `InsertResult`). OpenTelemetry JS API (`propagation`, `context`). All checked on 2026-11-20. Exercised with Node 26.1, TypeScript 6.0.3, vitest 5.1.0, zod 4.6.7 and `@testcontainers/kafka` 12.2.1 against `confluentinc/cp-kafka:8.1.0`: install with `ignore-scripts=true`; produce and consume; idempotent producer with `acks: -1`; `traceparent` injected and extracted; zod envelope; loss with `autocommit: true`; commit after processing; no redelivery after a clean stop; stop and force close with a record in progress; stall after an error leaves the loop; `'data'` listener skipping; dead letter with original bytes, partition and headers; `MESSAGE_TOO_LARGE`, unknown topic, connect and request timeouts and the unbounded retries of an idempotent producer with `retries` ≤ 1; loading under `node --permission` without `--allow-addons`.

## Spring Boot: Messaging with Kafka

[08-crosscutting-concepts/messaging/spring.md](08-crosscutting-concepts/messaging/spring.md)

Spring for Apache Kafka reference, *Handling Exceptions* and *Serialization* (docs.spring.io/spring-kafka/reference), Spring Kafka 4.2 API (`DefaultErrorHandler`, `DeadLetterPublishingRecoverer`, `ExponentialBackOffWithMaxRetries`, deprecations of the Jackson 2 classes), Spring Framework 7 `ExponentialBackOff` (jitter), Spring Kafka change history (`-dlt` suffix since 3.3), CVE-2026-59317 advisory (spring.io/security). Spring Boot application properties (`spring.kafka.*`). Apache Kafka producer and consumer configuration (kafka.apache.org/documentation) and the producer's configuration checks in `KafkaProducer` and `ProducerConfig` (delivery timeout, idempotence). Springwolf documentation (springwolf.dev). All checked on 2026-11-20.

## Angular: Error Reporting and Correlation

[08-crosscutting-concepts/observability/angular.md](08-crosscutting-concepts/observability/angular.md)

Angular API reference (`ErrorHandler`, `provideBrowserGlobalErrorListeners`, workspace configuration `sourceMap`; angular.dev), OpenTelemetry JavaScript browser status (opentelemetry.io/docs/languages/js), W3C Trace Context, OWASP Logging Cheat Sheet.

## NestJS: Observability and Operability

[08-crosscutting-concepts/observability/nestjs.md](08-crosscutting-concepts/observability/nestjs.md)

NestJS documentation (lifecycle events, `enableShutdownHooks`), `@nestjs/terminus` 12 source (`HealthIndicatorService`, `gracefulShutdownTimeoutMs`), `@nestjs/schedule` 12 and `cron` 4 source (`waitForCompletion`), OpenTelemetry JS READMEs (`@opentelemetry/auto-instrumentations-node`, `@opentelemetry/instrumentation` ESM section, `instrumentation-runtime-node`, `instrumentation-nestjs-core` supported versions, `sdk-metrics`), `@fastify/otel` README, OpenTelemetry SDK environment variable specification, Kubernetes pod termination documentation. Checked in a scratch build on 2026-11-20 (Node 26, `@opentelemetry/sdk-node` 0.301.2, auto-instrumentations 0.83.1, `@fastify/otel` 1.0.1, `@opentelemetry/api` 1.10.0, terminus 12.2.0) with console exporters: spans for HTTP server, Fastify handler, pg and undici; the metrics above; exit code 143 after the drain.

## Next.js: Observability and Operability

[08-crosscutting-concepts/observability/nextjs.md](08-crosscutting-concepts/observability/nextjs.md)

Next.js 16.4 documentation: `instrumentation.ts` (`register`, `onRequestError`, `Instrumentation.onRequestError`), `instrumentation-client.ts`, OpenTelemetry guide, `error.tsx` and `global-error.tsx`, `productionBrowserSourceMaps`, self-hosting (standalone output, graceful shutdown). OpenTelemetry JS READMEs (`@opentelemetry/sdk-node` 0.301, `instrumentation-http`, `instrumentation-undici`, `exporter-trace-otlp-http`), OpenTelemetry SDK environment variable specification, W3C Trace Context, pino 10 documentation (`redact`, `mixin`, destinations), Kubernetes pod termination and `preStop` `sleep` action. Checked in the Next.js reference build on 2026-11-20 (Next 16.4.6, Node 26.1, `@opentelemetry/sdk-node` 0.301.2, pino 10.4.0): spans exported to a local OTLP sink, `onRequestError` line with `digest`, SIGTERM measurement (exit 143 after 3.0 s with one in-flight request), no browser source maps.

## Observability and Operability

[08-crosscutting-concepts/observability/observability.md](08-crosscutting-concepts/observability/observability.md)

OpenTelemetry specification and semantic conventions (opentelemetry.io), W3C Trace Context (w3.org/TR/trace-context), Google SRE Workbook (implementing SLOs, alerting on SLOs), Kubernetes probe and pod termination documentation, The RED Method (Tom Wilkie), Spring Boot actuator and observability reference.

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## React: Error Reporting and Correlation

[08-crosscutting-concepts/observability/react.md](08-crosscutting-concepts/observability/react.md)

React 19.3 error boundaries (react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary); TanStack Router 1.170 `errorComponent`, `ErrorComponentProps`, `lazyRouteComponent` (tanstack.com/router); Vite 8.3 `build.sourcemap` (vite.dev/config/build-options); MDN `unhandledrejection`, `fetch` `keepalive`; OpenTelemetry JavaScript browser status (opentelemetry.io/docs/languages/js); W3C Trace Context; OWASP Logging Cheat Sheet.

## Spring Boot: Observability and Operability

[08-crosscutting-concepts/observability/spring.md](08-crosscutting-concepts/observability/spring.md)

Spring Boot reference 4.2 (actuator endpoints: Kubernetes probes, health groups, additional paths; tracing; graceful shutdown) and the 4.1 common application properties appendix, Micrometer documentation (naming conventions, Observation API, `SimpleMeterRegistry`, tracing test), Spring for Apache Kafka reference and source (observation, container stop, `AbstractMessageListenerContainer.DEFAULT_PHASE`), Spring Boot source (`WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE`), Spring Boot `EndpointRequest` Javadoc (`toAdditionalPaths`), Spring Security reference (`EndpointRequest`), Kubernetes pod lifecycle (termination grace period), `spring-observability` skill.

## NestJS: Persistence with PostgreSQL

[08-crosscutting-concepts/persistence/nestjs.md](08-crosscutting-concepts/persistence/nestjs.md)

PostgreSQL 18 documentation (`lock_timeout`, `statement_timeout`, `transaction_timeout`, `idle_in_transaction_session_timeout`, advisory locks, `ALTER DEFAULT PRIVILEGES`, `CREATE INDEX CONCURRENTLY`). Kysely 0.29 documentation and source (`kysely/migration` `Migrator`, `PostgresAdapter.acquireMigrationLock`, `$pickTables`, `log`). kysely-codegen 0.20 README (`--print`, `--exclude-pattern`, `--verify`). node-postgres documentation (`Pool` options, type parsing). Node.js documentation, `AsyncLocalStorage`. Vitest documentation, `toMatchFileSnapshot`. Expand/contract: Martin Fowler, *Parallel Change*. Checked in a scratch build on 2026-11-20 (kysely 0.29.9, kysely-codegen 0.20.0, pg 8.23.1, PostgreSQL 18, Testcontainers 12.2.2); the role split, the grant migration, the session timeouts from configuration and `check-migrations` on 2026-11-21 (template `npm run verify`, Testcontainers 12.2.1).

## Spring Boot: Persistence with PostgreSQL

[08-crosscutting-concepts/persistence/spring.md](08-crosscutting-concepts/persistence/spring.md)

PostgreSQL documentation (postgresql.org/docs), Flyway documentation (documentation.red-gate.com/flyway), Hibernate ORM 7 user guide, Spring Boot data reference. Expand/contract: Martin Fowler, *Parallel Change*.

## NestJS: Resilience and Idempotency

[08-crosscutting-concepts/resilience/nestjs.md](08-crosscutting-concepts/resilience/nestjs.md)

undici documentation (`Agent`/`Client` options and timer precision, `fetch`, `compose` interceptors), node-postgres documentation (`Pool` options, `error` events), PostgreSQL 18 documentation (`statement_timeout`, `transaction_timeout`, advisory lock functions, `INSERT … ON CONFLICT`), cockatiel 4 README and type definitions (`retry`, `ExponentialBackoff`, `DelegateBackoff`, `bulkhead`, `circuitBreaker`, `timeout`, `wrap`), `@nestjs/schedule` 12 and `cron` 4 README (`waitForCompletion`), piscina and lru-cache READMEs. Checked in a scratch build on 2026-11-20 (undici 8.13.0, cockatiel 4.0.0, pg 8.23.1 against PostgreSQL 18, Kysely 0.29.9, piscina 5.3.2, lru-cache 11.5.3).

## Next.js: Resilience

[08-crosscutting-concepts/resilience/nextjs.md](08-crosscutting-concepts/resilience/nextjs.md)

Next.js 16 documentation (nextjs.org/docs): caching and revalidation, `fetch` options on the server, `'use cache'` and `cacheComponents`, route segment config (`dynamic`, `revalidate`), `after`, self-hosting guide. React 19.3 `cache` (react.dev). `openid-client` 6.9 (`discovery` `timeout` option, in seconds), `redis` 6.3 client options (`socket.connectTimeout`, `commandOptions.timeout`), MDN `AbortSignal.timeout` and `AbortSignal.any`, MSW 3.0 (`setupServer`, `onUnhandledFrame`), `lru-cache` README. AWS Builders' Library, *Timeouts, retries, and backoff with jitter*. Checked in the reference app on 2026-11-20 (Next.js 16.4.6, openid-client 6.9.0, redis 6.3.1, msw 3.0.5).

## Resilience and Idempotency

[08-crosscutting-concepts/resilience/resilience.md](08-crosscutting-concepts/resilience/resilience.md)

Michael T. Nygard, *Release It!*, 2nd ed. (timeouts, circuit breaker, bulkhead, steady state). AWS Builders' Library: *Timeouts, retries, and backoff with jitter*; *Making retries safe with idempotent APIs*. IETF draft *The Idempotency-Key HTTP Header Field* (draft-ietf-httpapi-idempotency-key-header). Google SRE Book, ch. 22 (*Addressing Cascading Failures*). HikariCP wiki, *About Pool Sizing*.

## Spring Boot: Resilience and Idempotency

[08-crosscutting-concepts/resilience/spring.md](08-crosscutting-concepts/resilience/spring.md)

Spring Framework 7.1 reference, *Resilience Features* (docs.spring.io/spring-framework/reference/core/resilience.html), and the Javadoc of `@ConcurrencyLimit` (`ThrottlePolicy`, since 7.0.3) and `@Retryable` (`timeout`, since 7.0.2). Spring Boot reference, *Calling REST Services* and application properties (`spring.http.clients.*`, `spring.http.serviceclient.*`, `spring.datasource.hikari.*`, `spring.transaction.default-timeout`). pgjdbc connection parameters (jdbc.postgresql.org/documentation/use). HikariCP configuration and *About Pool Sizing*. ShedLock README (github.com/lukas-krecan/ShedLock, 7.x compatibility table). Resilience4j Spring Boot documentation (resilience4j.readme.io). All checked on 2026-11-20.

## Angular: Security

[08-crosscutting-concepts/security/angular.md](08-crosscutting-concepts/security/angular.md)

Angular security guide (angular.dev/best-practices/security), Angular HttpClient security (XSRF), Angular `CSP_NONCE`, `ngCspNonce` and the Trusted Types policy names (angular.dev/best-practices/security), Angular Components Trusted Types policy `angular#components` (`angular/components` commit 881edec, `@angular/cdk/private` `trustedHTMLFromString`), Angular XSRF interceptor source (`packages/common/http/src/xsrf.ts`, v22), Trusted Types (w3c.github.io/trusted-types), OWASP Content Security Policy Cheat Sheet (strict policy), OWASP ASVS 5.0 V3 and V7.

## NestJS: Hardening

[08-crosscutting-concepts/security/nestjs-hardening.md](08-crosscutting-concepts/security/nestjs-hardening.md)

OWASP ASVS 5.0 (V1, V2, V3, V4, V5, V7, V8, V9, V11, V12, V13, V15, V16), OWASP REST Security, Content Security Policy, Mass Assignment, File Upload, Session Management, CSRF Prevention, SSRF Prevention, Prototype Pollution Prevention and NodeJS Security Cheat Sheets, Fastify 5 server reference (limits, timeouts, `onProtoPoisoning`, `trustProxy`), READMEs of `@fastify/helmet` 13, `@fastify/rate-limit` 11, `@fastify/multipart` 10, `@fastify/session` 11, `@fastify/csrf-protection` 8 and `@fastify/static` 10, `openid-client` 6 and `jose` 6 API documentation, Kysely `sql` reference, undici `Agent` connect options, Node.js documentation (permission model, `--disable-proto`, `crypto`), OpenID Connect RP-Initiated Logout 1.0 and Back-Channel Logout 1.0, RFC 7009, W3C Reporting API, `eslint-plugin-security`.

## NestJS: Security

[08-crosscutting-concepts/security/nestjs.md](08-crosscutting-concepts/security/nestjs.md)

jose 6 API documentation (`jwtVerify`, `createRemoteJWKSet`, `createLocalJWKSet`, `SignJWT`), NestJS documentation (guards, `Reflector`, custom decorators, testing), Fastify 5 server options (`trustProxy`), `@fastify/cors`, Vitest test tags, RFC 6750, RFC 8725 (JWT best current practice), OAuth 2.0 for Browser-Based Applications (IETF draft, BFF pattern), OWASP ASVS 5.0 (V6, V8, V9), OWASP API Security Top 10.

## Next.js: Security

[08-crosscutting-concepts/security/nextjs.md](08-crosscutting-concepts/security/nextjs.md)

Next.js 16 documentation (nextjs.org/docs): Content Security Policy guide (nonces through `proxy.ts`), `proxy.ts` file convention, Server Actions security ("Data Security" guide: Origin check, closures and encryption, `allowedOrigins`, `bodySizeLimit`), `instrumentation-client.ts`, `experimental.taint`, `poweredByHeader`. Next.js 16.4.6 source in `next/dist` (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `server-reference-manifest.json`, configuration types). React 19.3 serializable props of client components and taint APIs (react.dev). `@mui/material-nextjs` 9.5 `v16-appRouter` `AppRouterCacheProvider`; MUI Content Security Policy guide. `openid-client` 6.9 and `redis` 6.3 documentation. W3C Trusted Types, Fetch Metadata (`Sec-Fetch-Site`). OWASP ASVS 5.0 (V3, V4, V7, V10), OWASP CSRF Prevention, Session Management and Content Security Policy Cheat Sheets. Checked in the reference app and a copy of it on 2026-11-20 (Next.js 16.4.6, React 19.3.1, MUI 9.5.0, zod 4.6.7, openid-client 6.9.0, redis 6.3.1 against Redis 8.4, Playwright 1.65 with Chromium and Firefox).

## Node.js Backend-for-Frontend

[08-crosscutting-concepts/security/node-bff.md](08-crosscutting-concepts/security/node-bff.md)

OWASP ASVS 5.0 (V3, V7, V9, V10), OWASP Session Management, CSRF Prevention and Content Security Policy Cheat Sheets, `openid-client` 6 and `jose` 6 API documentation, OpenID Connect Core 1.0, RP-Initiated Logout 1.0 and Back-Channel Logout 1.0, RFC 7009, RFC 9700 (OAuth 2.0 Security BCP), IETF draft "OAuth 2.0 for Browser-Based Applications" (BFF pattern), W3C Reporting API, MDN `Set-Cookie` (cookie prefixes).

## React: Security

[08-crosscutting-concepts/security/react.md](08-crosscutting-concepts/security/react.md)

React DOM components and `dangerouslySetInnerHTML` (react.dev/reference/react-dom/components/common), React 19.3; Vite 8.3 `html.cspNonce` (vite.dev/config/shared-options); Rolldown `output.strictExecutionOrder` (rolldown.rs); Emotion 11.14 `@emotion/cache` `nonce`, `prepend`; MUI 9.5 Content Security Policy guide (mui.com/material-ui/guides/content-security-policy); zod 4.6 `z.config({ jitless: true })` (zod.dev); `@eslint-react/eslint-plugin` 5.30 DOM rules; `@react-aria/live-announcer` 3.5; Trusted Types (w3c.github.io/trusted-types); OWASP Content Security Policy Cheat Sheet (strict policy); OWASP Cross-Site Request Forgery Prevention Cheat Sheet; OWASP ASVS 5.0 V3 and V7.

## Secure Pipeline

[08-crosscutting-concepts/security/secure-pipeline.md](08-crosscutting-concepts/security/secure-pipeline.md)

OWASP Top 10:2025 A03 and A08, SLSA v1.2 (slsa.dev), CycloneDX (cyclonedx.org), Sigstore cosign and in-toto attestations, OSV-Scanner (google.github.io/osv-scanner), Semgrep CE (semgrep.dev), gitleaks, Trivy (trivy.dev), ZAP (zaproxy.org), GitHub Actions security hardening (docs.github.com).

## Security Requirements and Threat Modelling

[08-crosscutting-concepts/security/security-requirements.md](08-crosscutting-concepts/security/security-requirements.md)

OWASP ASVS 5.0 (github.com/OWASP/ASVS, chapters V1 to V17; V11 cryptography), OWASP Top 10:2025 (top10.owasp.org/2025), OWASP Password Storage Cheat Sheet, OWASP Cryptographic Storage Cheat Sheet, BSI TR-02102-2 (TLS), Threat Modeling Manifesto and the four questions (A. Shostack), OWASP Developer Guide (threat modelling), NIST SP 800-218 SSDF, Regulation (EU) 2024/2847 (Cyber Resilience Act), Art. 14 and Art. 71 (eur-lex.europa.eu).

## Security Review

[08-crosscutting-concepts/security/security-review.md](08-crosscutting-concepts/security/security-review.md)

OWASP Top 10:2025, OWASP ASVS 5.0, OWASP Code Review Guide.

## Spring Boot: Hardening

[08-crosscutting-concepts/security/spring-hardening.md](08-crosscutting-concepts/security/spring-hardening.md)

OWASP ASVS 5.0 (V1, V2, V3, V4, V5, V7, V8, V9, V11, V12, V13, V15, V16), OWASP REST Security Cheat Sheet, OWASP Content Security Policy Cheat Sheet, OWASP SQL Injection Prevention, OS Command Injection Defense, Mass Assignment, File Upload and Session Management Cheat Sheets, Spring Security reference (headers, CSRF with SPAs, OIDC logout, password storage), Spring Boot reference (`InetAddressFilter`, HTTP client settings), OpenID Connect RP-Initiated Logout 1.0 and Back-Channel Logout 1.0, RFC 7009 (token revocation), W3C Reporting API, Jackson 3.0 migration notes, Spring Boot Maven plugin (build-image).

## Spring Boot: Security

[08-crosscutting-concepts/security/spring.md](08-crosscutting-concepts/security/spring.md)

Spring Security reference (docs.spring.io/spring-security), OAuth 2.1 and OpenID Connect Core, OAuth 2.0 for Browser-Based Applications (IETF draft, BFF pattern), OWASP ASVS.

## TypeScript: Browser Security

[08-crosscutting-concepts/security/typescript.md](08-crosscutting-concepts/security/typescript.md)

OWASP ASVS 5.0 V3 (Web Frontend Security), V14, V15; OWASP DOM based XSS Prevention Cheat Sheet; OWASP HTML5 Security Cheat Sheet; MDN Subresource Integrity; CSP Level 3 `'strict-dynamic'` (w3.org/TR/CSP3); zod 4 `z.config({ jitless: true })` (zod.dev).

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Vulnerability Management, Secrets, Audit Trail and Incidents

[08-crosscutting-concepts/security/vulnerability-management.md](08-crosscutting-concepts/security/vulnerability-management.md)

OWASP Top 10:2025 A03 and A09, OWASP ASVS 5.0 V13 and V16, OWASP Logging Cheat Sheet, CISA / RFC 9116 (`security.txt`), gitleaks (github.com/gitleaks/gitleaks), Regulation (EU) 2024/2847 (Cyber Resilience Act), Art. 14.

## Angular Testing

[08-crosscutting-concepts/testing/angular.md](08-crosscutting-concepts/testing/angular.md)

Angular testing guide (angular.dev/guide/testing), `angular-developer` skill references (testing-fundamentals, component-harnesses, router-testing), Testing Library for Angular (testing-library.com/docs/angular-testing-library/intro), Angular CDK testing harnesses (material.angular.dev/cdk/testing/overview).

## NestJS: Testing

[08-crosscutting-concepts/testing/nestjs.md](08-crosscutting-concepts/testing/nestjs.md)

Vitest 5 documentation (projects, `globalSetup`, `provide`/`inject`, `vi.waitFor`, `expect.poll`, fake timers, coverage), `unplugin-swc` 2.0, `vitest-mock-extended` 6, `@nestjs/testing` 12 (`Test.createTestingModule`, `overrideProvider`), Fastify `inject` (light-my-request), Testcontainers for Node 12 (`@testcontainers/postgresql`, reuse), dependency-cruiser 18. Examples run on 2026-11-20 with Node 26, NestJS 12.6 and Vitest 5.1.1 (REST adapter test, use-case test, persistence test with a shared container, architecture canary).

## Next.js: Testing

[08-crosscutting-concepts/testing/nextjs.md](08-crosscutting-concepts/testing/nextjs.md)

Next.js 16.4 documentation (testing with Vitest and Playwright, `instrumentation.ts`, standalone output, server actions, route handlers), React 19.3 server components reference, Vitest 5.1 projects and environments, Testing Library React 16.3, MSW 3.0 (`setupServer`, `onUnhandledFrame`), Orval 8.47 MSW output, Testcontainers for Node.js 12.2 (`@testcontainers/redis`), `openid-client` 6.9 README (`Configuration`), Playwright 1.65 (`webServer`, fixtures, `APIRequestContext`, `contrast`, `colorScheme`), `@axe-core/playwright` 4.14, dependency-cruiser 18.7 API. Checked in the Next.js reference build on 2026-11-20.

## React: Testing

[08-crosscutting-concepts/testing/react.md](08-crosscutting-concepts/testing/react.md)

Vitest projects and environments (vitest.dev/guide/projects, vitest.dev/guide/environment), React Testing Library (testing-library.com/docs/react-testing-library/intro) and user-event 14, jest-dom (github.com/testing-library/jest-dom), Redux "Writing Tests" (redux.js.org/usage/writing-tests), TanStack Query testing (tanstack.com/query/latest/docs/framework/react/guides/testing), TanStack Router history types (tanstack.com/router/latest/docs/framework/react/guide/history-types), MSW 3 (mswjs.io), Orval MSW output (orval.dev), dependency-cruiser API (github.com/sverweij/dependency-cruiser), Playwright `webServer` and fixtures (playwright.dev/docs/test-webserver, playwright.dev/docs/test-fixtures), `@axe-core/playwright` 4.14.

## Spring Boot: Testing

[08-crosscutting-concepts/testing/spring.md](08-crosscutting-concepts/testing/spring.md)

Spring Boot testing reference (docs.spring.io/spring-boot/reference/testing), Spring Boot 4.0 Migration Guide (modular test starters), Testcontainers for Java 2.x (java.testcontainers.org), Spring Framework 7 testing (`MockMvcTester`, `RestTestClient`). Package names read from the Boot 4.1.3 artifacts.

## Test-Driven Development

[08-crosscutting-concepts/testing/tdd.md](08-crosscutting-concepts/testing/tdd.md)

Kent Beck, *Test-Driven Development: By Example*, Addison-Wesley 2002. Steve Freeman, Nat Pryce, *Growing Object-Oriented Software, Guided by Tests*, Addison-Wesley 2009 (London style, double loop, "don't mock what you don't own"). Nat Pryce, "Test Data Builders" (2007). Martin Fowler, "Mocks Aren't Stubs" (2007). Anti-patterns "tautological test" and "horizontal slicing" adapted from Matt Pocock's `tdd` skill (github.com/mattpocock/skills, MIT).

## Testing by Architecture Element

[08-crosscutting-concepts/testing/testing-by-architecture-element.md](08-crosscutting-concepts/testing/testing-by-architecture-element.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 7 (Testing Architecture Elements). Test pyramid: Mike Cohn, *Succeeding with Agile* (2009). Mutation testing: PIT (pitest.org), Stryker (stryker-mutator.io).

## TypeScript E2E: Matrix, Responsive, Themes, Screen Readers

[08-crosscutting-concepts/testing/typescript-e2e.md](08-crosscutting-concepts/testing/typescript-e2e.md)

Playwright test options `colorScheme`, `contrast`, `forcedColors`, projects and retries (playwright.dev/docs/api/class-testoptions, playwright.dev/docs/test-retries), ARIA snapshots (playwright.dev/docs/aria-snapshots), Guidepup (github.com/guidepup/guidepup-playwright), `@axe-core/playwright` (github.com/dequelabs/axe-core-npm).

## TypeScript Testing

[08-crosscutting-concepts/testing/typescript.md](08-crosscutting-concepts/testing/typescript.md)

Vitest (vitest.dev), vitest-mock-extended (github.com/eratio08/vitest-mock-extended), Testing Library guiding principles (testing-library.com), MSW (mswjs.io), Playwright (playwright.dev), `@axe-core/playwright` (github.com/dequelabs/axe-core-npm).

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Angular UI: Angular Material and Material Design 3

[08-crosscutting-concepts/ui/angular-material.md](08-crosscutting-concepts/ui/angular-material.md)

Angular Material documentation and theming guide (material.angular.dev/guide/theming), Material Design 3 (m3.material.io). Design concepts adapted from the `material-3` skill by CWTI Ltd (github.com/hamen/material-3-skill, MIT).

## Angular State Management: NgRx Signal Store

[08-crosscutting-concepts/ui/angular-state-management.md](08-crosscutting-concepts/ui/angular-state-management.md)

NgRx Signal Store guide (ngrx.io/guide/signals/signal-store). API patterns adapted from the `ngrx-signals` skill by Daniel Sogl (github.com/danielsogl/skills, MIT). Architecture placement: this baseline.

## React UI: Material UI and Material Design

[08-crosscutting-concepts/ui/react-mui.md](08-crosscutting-concepts/ui/react-mui.md)

Material UI 9.5 documentation (mui.com/material-ui: theming, CSS theme variables, dark mode, palette incl. Windows High Contrast mode, breakpoints, container queries, spacing, transitions and reduced motion, focus visible, density, `Dialog`, `Snackbar`, `TextField`; the docs bundled in `@mui/material` 9.5), Emotion 11.14 (`@emotion/cache` `nonce`, `prepend`), `@react-aria/live-announcer` 3.5, TanStack Router 1.170 (`createLink`, `staticData`, `scrollRestoration`, `router.subscribe`), Material Design 3 (m3.material.io), WAI-ARIA Authoring Practices (dialog pattern), WCAG 2.2. Validated in the React SPA reference build (2026-11-20). Skills: `material-ui-theming`, `material-ui-styling` (mui/material-ui, MIT).

## React: State Management with Redux Toolkit and TanStack Query

[08-crosscutting-concepts/ui/react-state-management.md](08-crosscutting-concepts/ui/react-state-management.md)

Redux Toolkit 2.14 (redux-toolkit.js.org: `combineSlices`, `withLazyLoadedSlices`, `inject`, serializability middleware), React Redux 9.3 (`useDispatch.withTypes`, `useSelector.withTypes`), TanStack Query 5.107 (tanstack.com/query: query keys, `queryOptions`, query cancellation, `useMutation`, `invalidateQueries`, optimistic updates, retry and `retryDelay`; default retry delay checked in `@tanstack/query-core` source), `@tanstack/eslint-plugin-query` 5.107, ESLint `no-restricted-imports`. Validated in the React SPA reference build (2026-11-20). Skill: `tanstack-query-best-practices` (DeckardGer/tanstack-agent-skills, MIT).

## UI Patterns: Responsive Layout, Screen Readers and Screen States

[08-crosscutting-concepts/ui/ui-patterns.md](08-crosscutting-concepts/ui/ui-patterns.md)

Material Design 3 layout (window size classes, canonical layouts, navigation) (m3.material.io), WCAG 2.2 (1.3.5, 1.4.4, 1.4.10, 2.2.1, 2.5.1, 2.5.7, 3.2.3, 3.2.6, 4.1.3), WAI-ARIA Authoring Practices (dialog pattern).

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Accessibility: WCAG 2.2

[10-quality-requirements/accessibility.md](10-quality-requirements/accessibility.md)

W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation, and *WCAG 2.2 Quick Reference* (w3.org/WAI/WCAG22/quickref). W3C *WAI-ARIA Authoring Practices Guide*. Deque axe-core API documentation, tag list (github.com/dequelabs/axe-core/blob/develop/doc/API.md). WebAIM, *Screen Reader User Survey #11* (2026, webaim.org/projects/screenreadersurvey11). Deque, *Automated testing coverage* (deque.com/automated-accessibility-testing-coverage). W3C Understanding 4.1.3, 3.3.1, 3.3.4, 2.2.1, 1.4.13, 2.4.2, 2.4.3. Directive (EU) 2019/882 (European Accessibility Act), Directive (EU) 2016/2102 (Web Accessibility Directive), ETSI EN 301 549. Content cross-checked with the `accessibility` skill by Addy Osmani (github.com/addyosmani/web-quality-skills, MIT).

Per stack: Angular ([stacks/angular.md](stacks/angular.md)), React ([stacks/react.md](stacks/react.md)), Next.js ([stacks/nextjs.md](stacks/nextjs.md)).

## Taking Shortcuts Consciously

[11-risks-and-technical-debt/conscious-shortcuts.md](11-risks-and-technical-debt/conscious-shortcuts.md)

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 11 (Taking Shortcuts Consciously). ADRs: Michael Nygard, "Documenting Architecture Decisions" (2011).
