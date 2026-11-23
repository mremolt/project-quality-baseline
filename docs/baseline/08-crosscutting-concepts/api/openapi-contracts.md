# OpenAPI Contracts

Every REST API between our systems is described by an OpenAPI spec, and clients are generated from it. This doc covers the contract itself; what the payloads, errors and collection parameters look like is in [rest-conventions.md](rest-conventions.md) (API-REST-*). Generating clients is stack-specific: [08-crosscutting-concepts/api/typescript-openapi-clients.md](typescript-openapi-clients.md), and producing the spec in Spring: [08-crosscutting-concepts/api/spring-openapi.md](spring-openapi.md), in NestJS: [nestjs-openapi.md](nestjs-openapi.md).

## Workflow (default D8: code-first)

```
backend code (controllers, request/response models)
   │  build generates
   ▼
backend/openapi/<api>-v<N>.yaml   ← committed with the backend, CI fails if stale
   │
   ├─ same repository (default D12): the frontend generates from this file directly
   │
   └─ separate repository (REPO-LAY-01 deviation): copied deliberately (pinned copy)
         ▼
      consumer repo: openapi/<api>-v<N>.yaml
   │  consumer build generates (not committed)
   ▼
outgoing adapter: generated client + types + schemas + mocks
```

Which case applies is decided per consumer by [07-deployment-view/repository-layout.md](../../07-deployment-view/repository-layout.md).

## Rules

### The contract

- **API-CON-01: Every REST API consumed by one of our clients MUST be described by an OpenAPI 3.x spec.** No undocumented endpoints between our systems.
- **API-CON-02: The spec is generated from the backend code (code-first) and never edited by hand.** Annotations and models in the incoming REST adapter are the source.
  *Why:* the spec can't drift from what the service actually does.
- **API-CON-03: The generated spec is committed, one file per API major version** (`openapi/<api>-v1.yaml`), and CI regenerates it and fails if the committed file differs.
  *Why:* every contract change shows up as a reviewable diff in the pull request that causes it.
- **API-CON-04: CI checks for breaking changes** against the target branch (e.g. with `oasdiff breaking`). A breaking change requires a new major version (ARCH-ORG-03) or an explicit, reviewed decision that all consumers are migrated together.
- **API-CON-05: The spec is designed, not just emitted.**
  - `operationId`s are stable and name the use case (`placeOrder`, `listOpenInvoices`), not `getUsingGET_1`.
  - Request and response schemas are per use case and don't share bucket DTOs across operations (ARCH-ADP-04).
  - Errors are documented as RFC 9457 `application/problem+json` with their `code` values (API-REST-05/07).
  - Schemas carry examples, so generated mocks are realistic.
- **API-CON-06: Every new or changed endpoint is checked for N+1 usage** by its consumers ([08-crosscutting-concepts/api/avoiding-n-plus-one.md](avoiding-n-plus-one.md)).
- **API-CON-12: Schema names are unique across the API.** Code-first generators derive a schema from the simple class name and silently merge two different types with the same name (two nested `DayResponse` records), which changes existing clients without a breaking-change warning. Name request and response types after their use case (`WeekDayResponse`), and let the architecture tests reject two DTO types with the same simple name.
- **API-CON-13: One operation that accepts several request media types declares one content entry per media type; one that returns a file declares its media type with a binary schema.** A JSON-or-CSV import is one operation with two content entries, and the consumer's adapter picks the media type. A download declares `application/octet-stream` (or the concrete type, `text/csv`, `application/pdf`) with `type: string, format: binary`, so the generated client returns a `Blob` instead of parsing JSON (EXP-07).
- **API-CON-14: No two paths differ only in the name of a path template, and the spec is linted.** `/me/work-days/{date}` next to `/me/work-days/{workingDayId}` is one path to OpenAPI ("templated paths with the same hierarchy but different templated names MUST NOT exist"), and a server that separates them only by HTTP method gives one URL two meanings. Give the second resource its own segment (`/me/days/{date}/work-day`, or `/me/work-days/by-id/{id}`). The spec test (SPRING-API-08, NEST-API equivalent) SHOULD run a linter (Spectral with `spectral:oas`, or Redocly `recommended`) on the exported spec, so that this and similar contract errors fail the build.
  *Why:* strict validators, gateways and other generators reject or merge such paths, and code-first generators produce them without a warning.

### Consumers

- **API-CON-07: Consumers MUST NOT hand-write low-level HTTP calls or DTO types for an API that has a spec.** Clients, types and validation schemas are generated.
- **API-CON-08: The consumer pins the spec it was generated from.** Generated code is not committed; the build regenerates it.
  - *Same repository* (default D12): the consumer generates directly from the backend's committed spec file. The commit is the pin, and a spec change and its consumer changes go into the same pull request (REPO-API-01).
  - *Separate repository*: the consumer keeps a copy of the spec in its own repo and updates it deliberately (a pull request with the spec diff).
- **API-CON-09: Generated code lives inside the outgoing adapter for that API and never leaves it** (ARCH-ADP-12). The adapter maps generated types to core types; the core never sees them.
- **API-CON-10: Responses are validated at runtime** where the language doesn't guarantee the shape (TypeScript: generated zod schemas, TS-ARCH-06).
- **API-CON-11: Mocks for adapter tests and stubbed E2E tests are generated from the same spec**, so tests fail when the contract moves.

## Anti-patterns

- Hand-editing the generated spec "just to fix one description".
- A frontend fetching the spec from a running dev backend at build time (unpinned, non-reproducible).
- Generated DTOs imported in components, stores or use cases.
- One `OrderDto` schema used by create, update and list operations.
- A breaking change shipped under the same version because "only one client uses it" or "the frontend is fixed in the same PR" (REPO-API-02).
- A frontend in the same repository keeping its own copy of the spec.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "OpenAPI Contracts".*
