# 2. Architecture Constraints

Constraints every product inherits from the baseline. A project's own chapter 2 links here and adds what is specific to it (customer requirements, hosting, regulation). Deviating from a MUST needs an ADR (ARCH-SC-02).

## Technical constraints

| Constraint | Details |
|---|---|
| Architecture style | Hexagonal (ports and adapters) in backends and frontends; dependencies point inward ([hexagonal-architecture.md](../04-solution-strategy/hexagonal-architecture.md)) |
| Backend stack | Java 25, Maven (wrapper), Spring Boot 4.1 ([04-solution-strategy/java.md](../04-solution-strategy/java.md), [04-solution-strategy/spring.md](../04-solution-strategy/spring.md)); alternative: Node.js 26 LTS, NestJS 12 ([04-solution-strategy/nestjs.md](../04-solution-strategy/nestjs.md)) |
| Frontend stack | TypeScript, Angular (current major) with Angular Material ([04-solution-strategy/typescript.md](../04-solution-strategy/typescript.md), [04-solution-strategy/angular.md](../04-solution-strategy/angular.md)); alternatives, chosen per product: React SPA ([04-solution-strategy/react.md](../04-solution-strategy/react.md)) and Next.js ([04-solution-strategy/nextjs.md](../04-solution-strategy/nextjs.md)) |
| Data and messaging | PostgreSQL and Kafka by default ([persistence](../08-crosscutting-concepts/persistence/spring.md), [spring-libraries.md](../04-solution-strategy/spring-libraries.md); NestJS: [persistence](../08-crosscutting-concepts/persistence/nestjs.md), [nestjs-libraries.md](../04-solution-strategy/nestjs-libraries.md)). A database or broker the customer mandates instead is a product ADR; it changes only the outgoing adapters and their tests, not the core (ARCH-DEP-01) |
| API contracts | REST with OpenAPI, code-first, clients generated (D8, [openapi-contracts.md](../08-crosscutting-concepts/api/openapi-contracts.md)) |
| Accessibility | WCAG 2.2 AA mandatory (D10) |
| Developer platforms | Linux, macOS and Windows; every script runs on all three (TOOL-SKL-08); IDEs: VS Code and IntelliJ IDEA Ultimate (TOOL-IDE) |
| Runtime for baseline tooling | Node.js (version in the baseline's `package.json`, `engines.node`) and Git |
| Delivery infrastructure | CI system, registry, runtime platform and secret store are usually the customer's. Rules name capabilities; tools are reference tools (replaceable). Each product records its platform in the delivery platform mapping of its chapter 7 (REL-CD-06) |

## Organisational constraints

| Constraint | Details |
|---|---|
| Repository layout | One repository per product, components in folders (D12, REPO-LAY-01) |
| Decisions | Recorded as ADRs in `docs/adr/` (D6) |
| Documentation | Each product keeps an arc42 doc in `docs/architecture/` (DOC-ARC-01) |
| Agent skills | Docs win over skills; third-party skills pinned and reviewed (D11) |
| Baseline updates | Projects re-sync the baseline; they don't edit baseline-owned files ([agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md#distribution-to-consuming-projects)) |

## Conventions

Rule IDs, MUST/SHOULD and doc placement: [README.md](../README.md#conventions-for-these-docs).
