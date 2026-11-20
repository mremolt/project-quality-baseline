# Quality Baseline: Architecture at a Glance

The current architecture, technologies and decisions of the quality baseline, for people who want the picture without reading every rule. The rules themselves are in [docs/baseline/](docs/baseline/README.md); where this page and the rule docs differ, the rule docs are right.

This page describes the current state only and changes together with the baseline (DOC-ARC-09).

## What it is

The quality baseline is our shared answer to "how do we build web software here?". It is a set of documents (an arc42 reference architecture), agent skills and templates. A product repository does not depend on it at build time: a sync script copies it in, and the team commits the result.

Each product then documents only what is specific to it: its own arc42 chapters in `docs/architecture/` and its decisions as ADRs in `docs/adr/`.

Rules have stable IDs (for example `ARCH-UC-01`). **MUST** rules can only be deviated from with an ADR; **SHOULD** rules are defaults that a team may leave with a stated reason. A rule without a keyword is a MUST unless it says *prefer*, *default* or *consider*. Coding agents (Claude Code, Codex, Copilot) read the same rules through `AGENTS.md` and the skills, and the docs win over any skill.

## Quality goals, in priority order

1. **Changeability**: business logic does not depend on frameworks or infrastructure.
2. **Testability and confidence to ship**: a green build means "releasable".
3. **Accessibility**: WCAG 2.2 AA, proven by tests.
4. **Security**: secure defaults, designed in, checked in the pipeline.
5. **Consistency**: the same structure, names and commands in every repository.
6. **Operability**: the application can be configured, deployed, observed and shut down safely.

## Architecture

Backends and frontends both use a **hexagonal architecture** (ports and adapters). Code is organised in four rings, and dependencies only point inward. Domain, ports and application together are called the *core*.

| Ring | Contains | May depend on |
|---|---|---|
| Domain | Entities, value objects, business rules, business exceptions and domain events | nothing |
| Ports | Interfaces: incoming (one per use case) and outgoing (what the core needs) | domain |
| Application | One service per use case, orchestrating the domain through ports | domain, ports, a short allow-list (transactions, logging, observation) |
| Adapters | REST controllers, message listeners, UI, database, HTTP clients, schedulers | everything inward; never another adapter |

What follows from this:

- **One class per use case**, reachable only through its incoming port. Queries are separate from commands. The adapter authenticates and builds the caller; the use case authorizes.
- **Bounded contexts meet only at incoming ports.** A context calls another through its own outgoing port; a shared kernel needs an ADR. In the frontend, a feature uses another only through its published provider, and feature routes load lazily.
- **Errors are modelled the same way everywhere.** Business errors are exceptions in five categories (validation, business rule, not found, conflict, technical), with one table that says how HTTP, message consumers and the UI handle each. Results are only for expected alternative outcomes.
- **Domain events** are handed to an outgoing port and published through the transactional outbox; use cases never call each other.
- **Models are mapped at the boundaries.** The database entity is never the domain model; API types never reach the core.
- **The frontend follows the same rings.** Components and the Signal Store are the UI adapter and hold view state only; use cases hold the logic; generated HTTP clients are outgoing adapters that map problem codes to domain errors.
- **Boundaries are enforced by tests from day one**, not by convention. ArchUnit finds adapters by package, checks cycles, the application allow-list and that every class has a valid home. dependency-cruiser also sees type-only imports and covers the shared `platform` folder.
- **Shortcuts are allowed, but never silently.** Each one is proposed and recorded as an ADR; following a documented default needs none.

## Technology

| Area | Choice |
|---|---|
| Backend | Java 25, Maven wrapper, Spring Boot 4.1 (Spring MVC on virtual threads) |
| Data | PostgreSQL by default, Flyway forward-only migrations, Spring Data JPA for aggregates and `JdbcClient` for reads and bulk work |
| Messaging | Kafka by default (rules phrased as broker capabilities), JSON payloads with a typed envelope, transactional outbox with a relay, AsyncAPI contract |
| Frontend | TypeScript (strict), Angular current major (standalone, signals, zoneless), Angular Material (Material Design 3), NgRx Signal Store |
| API | REST with OpenAPI, code-first; the spec is committed; clients are generated (Orval), never hand-written; shared wire-format conventions (decimals as strings, dates, enums, paging, sorting, filtering, ETags, deprecation headers); errors as RFC 9457 problem details with a stable `code` |
| Authentication | External identity provider (OIDC); backend validates JWTs as a resource server; browsers log in through a backend-for-frontend with a session cookie, fixed session lifetimes and logout at the identity provider |
| Observability | Health probes on the serving port, Micrometer and OpenTelemetry (metrics and traces over OTLP), structured JSON logs on stdout, frontend error reporting |
| Backend tests | JUnit, AssertJ, Mockito, Testcontainers, ArchUnit |
| Frontend tests | Vitest, Testing Library, Playwright with axe |
| Code quality | Java: Spotless, Error Prone with NullAway, SpotBugs with FindSecBugs. TypeScript: ESLint (type-checked, SonarJS), Prettier, dependency-cruiser |
| Internationalisation (optional per product) | Transloco in the frontend, message bundles in the backend, Weblate for translators |
| Local development | Docker Compose for the services a backend needs, images pinned |
| Container images | OCI image, non-root, minimal pinned base, SBOM. Buildpacks by default; a Dockerfile or Jib when the customer platform dictates it. The BFF image also carries the frontend bundle |

CI/CD, registry, hosting, the orchestrator and the scanners are **not** fixed by the baseline. They depend on the customer's infrastructure. The baseline states what the pipeline and the application must do as capabilities, names replaceable reference tools, and each product records its concrete tools in a delivery platform mapping in its chapter 7.

## Key decisions

| Topic | Decision |
|---|---|
| Repository | One repository per product, with `backend/` and `frontend/` folders. Separate repositories need a reason from the decision guide and an ADR. |
| Testing | Each architecture element has its test type, style and test doubles, defined in one table: unit tests for domain and use cases, integration tests for adapters against the real technology, system tests for main paths. Frontend system tests stub our backend from the contract and run on every pull request; a few full-stack tests stub only third parties. Written test-first, with deterministic test data (builders, fixed clocks and ids; fakers only seeded and for volume). |
| Coverage | Reported, not gated. The measure is confidence to ship, and every production bug gets a test that would have caught it. Mutation testing on the core is optional and reported. |
| API contracts | A breaking API change fails CI before merge. |
| Data loading | Every data-loading change is checked for N+1 requests; the developer decides the strategy. Collections are paged or have an enforced upper bound. |
| Accessibility | WCAG 2.2 AA is mandatory, with a chosen set of AAA criteria as the default. Six test layers, from lint to a manual release checklist with a desktop screen reader; the E2E suite also scans dark, high-contrast and forced-colors themes. Each product keeps a journey and screen inventory and records whether the European Accessibility Act applies. Mobile assistive technology is decided per product. Accessibility checks are never switched off to pass a build. |
| End-to-end tests | One default cell (browser, viewport, theme, locale); the matrix grows one dimension at a time. Pull-request E2E has a time budget; retries only in CI, with a ticket for every flaky test. |
| Security | OWASP ASVS 5.0: level 2 is the target, level 1 the minimum to release. Each product keeps a threat model and records whether the EU Cyber Resilience Act applies. Dependency, secret and code scans run on every pull request; images are scanned before release and again on a schedule; provenance is signed and verified before deployment; an external penetration test precedes go-live. Fix times: critical 7 days, high 30, medium 90, counted from detection. Shared rules for cryptography and the audit trail. |
| Data protection | Each product keeps a personal-data inventory and a deletion concept, updated in the same change that adds personal data; dead letters, inbox and idempotency stores are in scope. The controller decides on breach notification, the DPO advises; as a processor we inform the customer. Production personal data never enters other environments. |
| Delivery | Trunk-based development with squash merges and Conventional Commits. One image per commit, identified by commit SHA and digest, promoted unchanged through all environments; the release version is attached without a rebuild and injected at deploy time. Production needs a recorded approval. Customers who deploy themselves get a handover package. |
| Deployments | Rolling, with at least two backend instances. Every version works alongside the previous one (API, events, database schema, frontend chunks), so rollouts and rollbacks are safe. Migrations run at start-up by default, or as a pre-deploy job with the same image. The schema is never rolled back; faulty releases are fixed forward by default, and rollback and restore are rehearsed. A container runtime contract covers privileges, read-only filesystem, resources, start-up and termination. |
| Resilience | Every outbound call has explicit timeouts, fitted into one timeout ladder per product (gateway > request > transaction > statement). Only idempotent operations are retried, with a total time limit. Concurrency limits reject instead of queueing. No remote call inside a database transaction. Every message consumer is idempotent. |
| Configuration | Typed and validated at start-up; every component keeps a machine-readable list of its keys. Secrets come from a secret manager, never from git, and are held in a self-masking type. The frontend loads its environment settings at runtime, so one build serves all environments. |
| Builds | Reproducible on both stacks (fixed timestamps, `npm ci`, pinned toolchains and images), with an SBOM for backend and frontend. Dependency updates come from update automation covering all ecosystems. |

## How the rules are kept

- **In the build**: architecture tests, compiler checks, linters, accessibility tests, contract checks and security scans fail the build. None of them may be weakened to get a build green (SEC-REV-02). A component's `verify` command is its local gate; one pipeline jobs table says what CI runs.
- **In review**: the pull request template carries the security, N+1 and delivery checklists; reviewers cite rule IDs.
- **By agents**: entry skills (`baseline-spring`, `baseline-angular`, `baseline-security`, `baseline-i18n`, `baseline-tdd`) route agents to the right rules before they write code.
- **By decision record**: any deviation from a MUST is an ADR in the product repository.

## What the baseline does not cover

- Product requirements and the infrastructure the application runs on (clusters, networks, backups, monitoring stack, on-call). Each product documents these.
- Known open points, listed in [chapter 11](docs/baseline/11-risks-and-technical-debt/README.md): performance and load testing rules, parts of the frontend error and UX policy, a REST removal timeline for old majors, a single Definition of Done, multi-tenancy beyond tenant isolation, and legal and DPO confirmation of the CRA, EAA and breach-notification rules.
- Most operability, security hardening and i18n rules were written from documentation and have not yet been exercised in a product. Chapter 11 lists the concrete checks to run before first use; the first product that adopts them confirms or corrects them.
