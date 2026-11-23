# Node.js Backend: Hexagonal Architecture

How the shared architecture rules apply to TypeScript backends on Node.js, independent of the framework. NestJS specifics are in [nestjs.md](nestjs.md). This file only adds what is specific to Node; the rules themselves are in the shared docs.

Implements: [hexagonal-architecture](../04-solution-strategy/hexagonal-architecture.md) · [code-organization](code-organization.md) · [use-cases](use-cases.md) · [adapters](adapters.md) · [enforcing-boundaries](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md)

## Folder layout

The shared reference layout, applied per bounded context. Paths are relative to the component folder (`backend/`):

```
src/
  main.ts                 ← bootstrap only
  features/<context>/
    domain/               ← plain TypeScript: types, value objects, rules, business errors
    application/          ← one use-case class per use case
    ports/in/             ← use-case interfaces, command/query schemas and factories, result types
    ports/out/            ← narrow outgoing ports
    adapter/in/<tech>/    ← rest/v1, messaging, scheduling, demo
    adapter/out/<tech>/   ← persistence, http (+ generated/), messaging, mail, file, metrics
    <context>.tokens.ts   ← injection tokens for the context's ports; imports only ports
    index.ts              ← public API for other contexts
  platform/               ← cross-cutting code in the same rings (platform/domain, platform/adapter/…, platform/config)
openapi/                  ← committed spec
```

- **NODE-ARCH-01: New backends use this layout.** Adapter folders are named after the technology (`adapter/out/persistence`, `adapter/in/messaging`): outgoing mail and its outbox in `adapter/out/mail`, writers of generated files (CSV, Excel, PDF) in one `adapter/out/file` with a sub-folder per format, so the formats share helpers without breaking ARCH-DEP-05. Versioned REST APIs get one folder per version with their own schemas (ARCH-ORG-03). Tests sit next to the code (`*.test.ts`, container-backed `*.it.test.ts`).
- **NODE-ARCH-02: `src/platform` holds what several contexts share**, in the same rings: `platform/domain` (error base classes, `Caller`, shared value objects; entry `platform/domain/index.ts`), `platform/ports` (ports every context uses, such as `TransactionPort`; entry `platform/ports/index.ts`), `platform/adapter` (problem-details filter, auth guard, health, database instance, transaction adapter and migrations), `platform/config` (configuration schemas). A context core imports only these two entry files from the platform.
- **NODE-ARCH-03: Contexts import each other only through `index.ts`** (ARCH-ORG-09). The index exports the published `ports/in` contracts, their tokens and the context's module; a consuming context calls them from an outgoing adapter.

## Core rules

- **NODE-ARCH-04: `domain` imports only its own ring and `src/platform/domain/index.ts`; `ports` and `application` also their own rings, `src/platform/ports/index.ts` and zod** (ARCH-DEP-02/03). No framework, no Node built-ins (`node:*`), no database, HTTP or logging library. Time and ids come through ports (`Clock`, id generator) or as arguments.
  *Why:* the core runs in a plain unit test in milliseconds and survives a framework change; `node:crypto` or `Date.now()` in the core make tests non-deterministic.
- **NODE-ARCH-05: Ports return `Promise`** and may take an `AbortSignal` (NODE-D4). Streams are `AsyncIterable` and named as streams.
- **NODE-ARCH-06: Commands and queries are immutable and created only through a factory that validates with a zod schema next to them in `ports/in`** (ARCH-UC-05/06). The factory parameter is typed with the schema's input type, so the compiler reports a missing field at the call site:

```ts
// ports/in/place-order.use-case.ts
export const PlaceOrderCommandSchema = z.object({ customerId: z.string().min(1), total: z.string() });
export type PlaceOrderCommand = Readonly<z.output<typeof PlaceOrderCommandSchema>>;
export const PlaceOrderCommand = {
  of(input: z.input<typeof PlaceOrderCommandSchema>): PlaceOrderCommand {
    return Object.freeze(parseOrThrow(PlaceOrderCommandSchema, input)); // throws DomainValidationError
  },
};
export interface PlaceOrderUseCase { placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderResult>; }
```

  `parseOrThrow` lives in `platform/ports` (zod is not allowed in `domain`) and turns zod issues into `DomainValidationError` (NODE-ARCH-07); the core never lets a `ZodError` escape.
- **NODE-ARCH-07: Each error category of ARCH-UC-13 has one class in `src/platform/domain`:** `DomainValidationError` (code, optional field), and the abstract `BusinessRuleError`, `NotFoundError`, `AccessDeniedError`, `ConflictError`, all extending an abstract `DomainError` that carries a stable `code` and optional `params` (values for a localized message, I18N-*). The abstract `ConcurrentModificationError extends ConflictError` marks an optimistic-lock failure, which the transaction adapter retries ([persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md)). Concrete business errors extend exactly one of them (`class InsufficientFunds extends BusinessRuleError`). Anything else thrown is technical. One technical class is named because adapters must recognise it: `UnavailableError` (optional `retryAfterSeconds`), thrown by outgoing adapters when a dependency is temporarily unavailable (pool wait timed out, open circuit, full bulkhead); incoming adapters answer it with 503 + `Retry-After` or retry it. Adapters classify with `instanceof` on the base classes, never on concrete classes or messages. Nothing in the core throws a plain `Error` or `TypeError` for invalid input.
- **NODE-ARCH-08: Domain types are `readonly`**; entities change state only through functions or methods that keep invariants. No classes with public mutable fields in `domain`.
- **NODE-ARCH-09: The adapter maps; the core never sees transport types** (ARCH-MAP-*). Request schemas, rows, message payloads and generated client types stay in their adapter folder.

## Runtime rules

- **NODE-ARCH-10: Nothing blocks the event loop.** No synchronous I/O (`fs.*Sync`, `child_process.*Sync`) outside start-up, no CPU-heavy loops, large `JSON.parse` of untrusted input, or synchronous crypto (`pbkdf2Sync`, `scryptSync`) on the request path. CPU-heavy work goes to a worker thread ([resilience/nestjs.md](../08-crosscutting-concepts/resilience/nestjs.md)). Event-loop delay is a standard metric ([observability/nestjs.md](../08-crosscutting-concepts/observability/nestjs.md)).
  *Why:* one blocked loop stalls every request of the instance; timeouts and probes then fail together.
- **NODE-ARCH-11: Every promise is awaited or explicitly handled.** typescript-eslint's `no-floating-promises` and `no-misused-promises` are on (TS-TOOL-04). An unhandled rejection or uncaught exception is a bug: the process logs it and exits with a non-zero code, and the orchestrator restarts it. Nobody installs a handler that keeps the process running.
  *Why:* after an unknown failure the process state is unknown; a restart is safer than continuing.
- **NODE-ARCH-12: `process.env` is read only in `src/platform/config`** ([configuration/nestjs.md](../08-crosscutting-concepts/configuration/nestjs.md)). Everything else gets typed configuration injected.

## Enforcement

- **NODE-ARCH-13: dependency-cruiser checks the rings in CI** (ARCH-ENF-01, NODE-D8) with `tsPreCompilationDeps: true`, so type-only imports count. The NestJS template ([nestjs.md](nestjs.md#architecture-test-template)) implements NODE-ARCH-01..04 and NODE-ARCH-09. Test files are excluded from the ring allow-lists only.
- **NODE-ARCH-14: Guard against "checks nothing"** (ARCH-ENF-02). A test runs dependency-cruiser on a fixture with a deliberate type-only violation (an adapter type imported into `domain`) and expects it to fail. A test that calls `cruise()` passes an absolute `baseDir` (`fileURLToPath(new URL('fixtures/arch-violation', import.meta.url))`), as in TS-ARCH-13. Re-check the patterns after renaming folders.
- **NODE-ARCH-15: Larger backends may split contexts into npm workspaces** with explicit dependencies (ARCH-ENF-06).

## What does not carry over from Java

- **Package-private visibility**: TypeScript has none at folder level. `index.ts` public APIs and dependency-cruiser take its role.
- **Annotations on core classes**: the core stays free of decorators; wiring happens in the composition root.

*Agent checklist in [checklists/node.md](../checklists/node.md) and sources in [sources.md](../sources.md), section "Node.js Backend: Hexagonal Architecture".*
