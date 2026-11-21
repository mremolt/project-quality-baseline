# 4. Solution Strategy

The fundamental decisions every product starts from. Details are in the linked chapters; a product's chapter 4 links here and adds its own strategy.

## Strategy in brief

| Goal (chapter 1) | Approach |
|---|---|
| Changeability | Hexagonal architecture with ports and use cases ([hexagonal-architecture.md](hexagonal-architecture.md)), enforced by architecture tests from day one (D4) |
| Testability | Test type per architecture element, test-first (D5, D7) |
| Consistency | One repository per product (D12), stable rule IDs, the same commands per stack, agent skills that point at these docs (D11) |
| Contract safety | Code-first OpenAPI, committed spec, generated clients, breaking-change check (D8) |
| Accessibility | WCAG 2.2 AA asserted by tests (D10) |
| Security | ASVS level per product, hardening rules per stack, security gates in one pipeline (D14) |
| Operability | The application brings its own health and readiness endpoints, metrics, validated configuration, graceful shutdown and deploy-time migrations; one artifact promoted through all environments; infrastructure stays with the product ([scope](../03-context-and-scope/README.md#scope); [CFG](../08-crosscutting-concepts/configuration/configuration.md), [OBS](../08-crosscutting-concepts/observability/observability.md), [RES](../08-crosscutting-concepts/resilience/resilience.md), [REL](../07-deployment-view/delivery-and-release.md)) |

## Baseline defaults

Where the sources leave a choice open, this baseline decides:

| # | Topic | Default | Defined in |
|---|---|---|---|
| D1 | Incoming ports | Required; skipping needs an ADR (ARCH-SC-07) | [conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md) |
| D2 | Domain model | Rich for logic-heavy domains, anemic OK for CRUD | [use-cases.md](../05-building-block-view/use-cases.md) |
| D3 | Mapping | Full (adapter→app, commands); none → two-way (persistence, queries); Spring and NestJS always map persistence two-way (SPRING-ARCH-10, NEST-DB-06) | [mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md) |
| D4 | Enforcement | Architecture tests from day one; build modules once stable | [enforcing-boundaries.md](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md) |
| D5 | Coverage | Not the success metric; confidence to ship + bug post-mortems | [testing-by-architecture-element.md](../08-crosscutting-concepts/testing/testing-by-architecture-element.md) |
| D6 | ADRs | `docs/adr/NNNN-title.md`, Nygard format | [conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md) |
| D7 | TDD style | London by default; Chicago for domain and pure code; mixing expected | [tdd.md](../08-crosscutting-concepts/testing/tdd.md) |
| D8 | API contracts | OpenAPI, code-first; spec committed per major version; clients generated | [openapi-contracts.md](../08-crosscutting-concepts/api/openapi-contracts.md) |
| D9 | N+1 over REST | Checked for every data-loading change; strategy recommended, developer decides | [avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md) |
| D10 | Accessibility | WCAG 2.2 AA mandatory, adopted AAA set where possible, asserted by tests | [accessibility.md](../10-quality-requirements/accessibility.md) |
| D11 | Agent skills | Docs win over skills; third-party skills pinned and reviewed | [agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md) |
| D12 | Repository layout | One repo per product, backend and frontends in component folders; separate repos only for signals from the decision guide, with an ADR | [repository-layout.md](../07-deployment-view/repository-layout.md) |
| D13 | Architecture documentation | arc42 in `docs/architecture/`, one Markdown file per chapter, linking to this baseline | [architecture-documentation.md](../08-crosscutting-concepts/development/architecture-documentation.md) |
| D14 | Security | OWASP ASVS 5.0: L2 target, L1 minimum release gate; Top 10:2025 mapped in reviews; no architecture, compiler, lint, security or accessibility check is weakened to pass a build (SEC-REV-02) | [security-requirements.md](../08-crosscutting-concepts/security/security-requirements.md) |
| D15 | Error modelling | Business errors are exceptions in five categories (validation, business rule, not found, conflict, technical) with one handling table for HTTP, messaging and UI; results only for expected alternative outcomes | [use-cases.md](../05-building-block-view/use-cases.md#error-categories) (ARCH-UC-10/13) |
| D16 | Delivery | One image per commit, identified by commit SHA and digest and promoted unchanged; the release version is attached without a rebuild and injected at deploy time; Buildpacks by default (NestJS and Next.js: a Dockerfile, NEST-REL-07, NEXT-REL-05); the BFF image embeds the frontend bundle (a Next.js app is its own image and BFF, NEXT-D2); migrations at start-up by default, a pre-deploy job as the alternative; CI, registry and runtime are the customer's, recorded in a delivery platform mapping | [delivery-and-release.md](../07-deployment-view/delivery-and-release.md), [container-runtime.md](../07-deployment-view/container-runtime.md) |
| D17 | Stack choice | Spring Boot backend and Angular frontend by default; NestJS ([nestjs.md](nestjs.md)), the React SPA ([react.md](react.md)) and Next.js ([nextjs.md](nextjs.md#when-to-choose-nextjs)) are documented alternatives, chosen per product in its chapter 4 without an ADR; Next.js only for a stated reason the SPA cannot meet. A product declares its stacks in `.baseline.json` | [agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md#declared-stacks) |

## Stack strategies

Each stack tightens the defaults with its own (`JAVA-D*`, `SPRING-D*`, `NODE-D*`, `NEST-D*`, `TS-D*`, `REACT-D*`, `NEXT-D*`):

| Stack | Strategy |
|---|---|
| Java | [java.md](java.md) |
| Spring Boot | [spring.md](spring.md), libraries: [spring-libraries.md](spring-libraries.md) |
| Node.js | [node.md](node.md) |
| NestJS | [nestjs.md](nestjs.md), libraries: [nestjs-libraries.md](nestjs-libraries.md) |
| TypeScript | [typescript.md](typescript.md) |
| Angular | [angular.md](angular.md) |
| React | [react.md](react.md) |
| Next.js | [nextjs.md](nextjs.md) |
