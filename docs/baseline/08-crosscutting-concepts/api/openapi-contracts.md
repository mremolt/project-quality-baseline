# OpenAPI Contracts

Every REST API between our systems is described by an OpenAPI spec, and clients are generated from it. This doc covers the contract itself; what the payloads, errors and collection parameters look like is in [rest-conventions.md](rest-conventions.md) (API-REST-*). Generating clients is stack-specific: [08-crosscutting-concepts/api/typescript-openapi-clients.md](typescript-openapi-clients.md), and producing the spec in Spring: [08-crosscutting-concepts/api/spring-openapi.md](spring-openapi.md).

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

## Agent checklist

- [ ] Endpoint change → spec regenerated and committed in the same change?
- [ ] Breaking? Then new version or explicit decision, including the rollout (REPO-API-02)?
- [ ] `operationId` names the use case; examples present; errors as problem+json?
- [ ] Consumer: client generated, not hand-written; generated types confined to the adapter?
- [ ] Consumer in the same repo: regenerated and adapted in the same pull request as the spec change?
- [ ] N+1 check done ([08-crosscutting-concepts/api/avoiding-n-plus-one.md](avoiding-n-plus-one.md))?

## Sources

OpenAPI Specification 3.1 (openapis.org). RFC 9457, *Problem Details for HTTP APIs*. oasdiff (github.com/oasdiff/oasdiff). Placement rules follow Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, ch. 5–6.
