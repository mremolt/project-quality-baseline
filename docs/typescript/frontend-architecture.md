# TypeScript Frontend: Hexagonal Architecture (Angular / React / Vue)

How the shared architecture rules apply to frontend applications. The book is about backends, so not everything carries over. This doc says what does, what changes, and what doesn't apply.

Implements: [hexagonal-architecture](../shared/architecture/hexagonal-architecture.md) · [code-organization](../shared/architecture/code-organization.md) · [use-cases](../shared/architecture/use-cases.md) · [adapters](../shared/architecture/adapters.md) · [enforcing-boundaries](../shared/architecture/enforcing-boundaries.md) · [testing](../shared/testing/testing-by-architecture-element.md)

## How the concepts map

| Concept | In a frontend |
|---|---|
| Domain | Framework-free TypeScript: types, value objects, business rules, business errors |
| Application / use case | Plain functions or classes orchestrating domain + outgoing ports (e.g. `placeOrder`, `loadOrderHistory`) |
| Incoming adapter | **UI**: components, pages, routes, view-state stores (NgRx/signals, Redux/Zustand, Pinia) |
| Outgoing adapter | HTTP/API clients, WebSocket clients, `localStorage`/IndexedDB, analytics, feature flags |
| Composition root | Per feature: `<feature>.providers.ts` (Angular) / `<feature>.composition.ts(x)` (React, Vue) |

## Folder layout

The shared reference layout, applied **per feature**:

```
src/
  features/
    orders/
      domain/               ← pure TS; no framework, no HTTP
      application/          ← use cases
      ports/
        in/                 ← use-case contracts (types) + command/result types
        out/                ← OrdersApiPort, DraftStoragePort …
      adapter/
        in/ui/              ← components, pages, view-state store
        out/http/           ← adapter classes implementing ports, DTO↔domain mappers
          generated/        ← Orval output (client, types, zod schemas, MSW mocks); not committed
        out/storage/
      orders.providers.ts   ← composition root of the feature (Angular)  | orders.composition.tsx (React/Vue)
      index.ts              ← public API of the feature (routes, public components, public types)
  shared/
    ui/                     ← presentational components without business logic
```

## Rules

### Core stays framework-free

- **TS-ARCH-01: `domain`, `application` and `ports` MUST NOT import Angular, React, Vue, routers, state libraries or HTTP clients.**
  *Why:* business rules can be unit-tested in milliseconds and survive a framework migration.
  **Default TS-D1: ports and use cases return `Promise`**, optionally accepting an `AbortSignal` for cancellation. `Observable` (RxJS) is allowed only for real streams (WebSocket, server-sent events, live updates); such ports are named as streams (`watchOrderStatus`).
  *Why:* promises are language-native, trivial to mock with vitest-mock-extended, and fit `async` store methods and `resource()` loaders. Adapters convert framework observables with `firstValueFrom`.
- **TS-ARCH-02: No business logic in components or templates.** Components render state and forward user intent to a use case. Rules such as "can this order be cancelled?" live in `domain`.
- **TS-ARCH-03: View-state stores belong to the UI adapter.** They call use cases and hold what the screen shows. They don't make business decisions. They never call outgoing ports, HTTP clients or generated API code. Angular: [NgRx Signal Store rules](../angular/state-management.md).

### Ports and adapters

- **TS-ARCH-04: Every backend call goes through an outgoing port** implemented in `adapter/out/http`. Components never call `HttpClient` / `fetch` / generated API clients directly.
- **TS-ARCH-05: Backend DTOs MUST NOT leave `adapter/out/http`** (two-way mapping at the API boundary). Map to domain types in the adapter. API clients and DTO types are generated from the OpenAPI spec, never hand-written (API-CON-07, [openapi-clients.md](openapi-clients.md)).
  *Why:* backend API changes then touch one mapper, not dozens of components.
- **TS-ARCH-06: Validate untrusted input at the boundary with schema parsing; the schema library is zod (default TS-D2).** API responses are parsed in the HTTP adapter with the generated zod schemas. Form input is parsed before building a command. Commands are immutable (`readonly`) and are created only through a factory that validates with a zod schema living next to the command in `ports/in` (ARCH-UC-05). The same schema may drive form validation in the UI (Angular: Signal Forms `validateStandardSchema`).
  *Why:* one schema, one truth: the form can't accept what the command would reject.
- **TS-ARCH-07: Ports are narrow** (ARCH-ADP-08): `LoadOrdersPort`, `CancelOrderPort` rather than one `OrderService` mirroring the whole REST resource.
- **TS-ARCH-08: Components depend on use-case contracts from `ports/in`**, not on use-case implementations (default D1). For small CRUD screens, calling a query port directly is an allowed shortcut **with an ADR** ([conscious-shortcuts.md](../shared/architecture/conscious-shortcuts.md)).
- **TS-ARCH-15: Batching, request coalescing and caching of backend data live in the outgoing adapter**, as a decorator implementing the same port (API-N1-04). Use cases and stores stay unaware of them. Every data-loading feature gets an N+1 check ([avoiding-n-plus-one.md](../shared/api/avoiding-n-plus-one.md)).

### Wiring per framework

- **TS-ARCH-09: Only the feature's composition file connects implementations to contracts.**

**Angular:** `InjectionToken`s are Angular types, so they live in the providers file, not in `ports`. Details (naming, `@Service`, scopes): [angular/architecture.md](../angular/architecture.md).

```ts
// orders.providers.ts (composition root, may import everything)
export const LOAD_ORDERS_PORT = new InjectionToken<LoadOrdersPort>('LoadOrdersPort');
export const LOAD_ORDER_HISTORY = new InjectionToken<LoadOrderHistoryUseCase>('LoadOrderHistory');

export const ordersProviders: Provider[] = [
  { provide: LOAD_ORDERS_PORT, useClass: HttpOrdersAdapter },
  {
    provide: LOAD_ORDER_HISTORY,
    useFactory: (port: LoadOrdersPort) => new LoadOrderHistoryService(port),
    deps: [LOAD_ORDERS_PORT],
  },
];
```

**React:** the composition file creates adapters and use cases and exposes them through a context or provider component. Components get use cases via a hook (`useOrdersUseCases()`), typed with the `ports/in` contracts.

**Vue:** the same idea with `provide`/`inject` and typed `InjectionKey`s defined in the composition file.

### Feature boundaries

- **TS-ARCH-10: Features import each other only through `index.ts`.** Deep imports into another feature's folders are forbidden.
- **TS-ARCH-11: `shared/ui` contains no feature or business logic** and never imports from `features/`.

## Enforcement

- **TS-ARCH-12: Architecture rules are checked in CI** with dependency-cruiser (or `eslint-plugin-boundaries`). A starting point for `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure', severity: 'error',
      comment: 'domain may only import its own domain',
      from: { path: '^src/features/([^/]+)/domain/' },
      to: { pathNot: '^src/features/$1/domain/' },
    },
    {
      name: 'ports-only-domain', severity: 'error',
      from: { path: '^src/features/([^/]+)/ports/' },
      to: { pathNot: ['^src/features/$1/(domain|ports)/', 'node_modules/(zod|rxjs)'] }, // rxjs only for stream ports (TS-D1)
    },
    {
      name: 'application-no-adapters-no-framework', severity: 'error',
      from: { path: '^src/features/([^/]+)/application/' },
      to: { path: ['/adapter/', 'node_modules/(@angular|react|react-dom|vue|@tanstack|axios)'] },
    },
    {
      name: 'adapters-use-ports-not-services', severity: 'error',
      from: { path: '^src/features/([^/]+)/adapter/' },
      to: { path: '^src/features/$1/application/' },
    },
    {
      name: 'ui-and-http-adapters-independent', severity: 'error',
      from: { path: '/adapter/in/' },
      to: { path: '/adapter/out/' },
    },
    {
      name: 'features-only-via-index', severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'generated-api-only-in-http-adapter', severity: 'error',
      comment: 'Orval output is confined to adapter/out/http (API-CON-09, TS-ARCH-05)',
      from: { pathNot: '/adapter/out/http/' },
      to: { path: '/adapter/out/http/generated/' },
    },
    {
      name: 'http-clients-only-in-http-adapter', severity: 'error',
      comment: 'composition roots may configure the HTTP stack (provideHttpClient, interceptors)',
      from: { path: '^src/', pathNot: ['/adapter/out/http/', '^src/platform/adapter/', '\\.providers\\.ts$', '^src/app/app\\.config\\.ts$'] },
      to: { path: 'node_modules/(@angular/common/http|axios|ky)' },
    },
    {
      name: 'shared-ui-no-features', severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
};
```

- **TS-ARCH-13: Guard against "checks nothing"** (ARCH-ENF-02). Keep a small fixture with a deliberate violation and assert in CI that the checker fails on it. Re-check the regexes after renaming folders.
- **TS-ARCH-14: Larger frontends** may turn features into workspace packages/libraries (npm/pnpm workspaces, Nx) with explicit dependencies. This is the frontend equivalent of build modules (ARCH-ENF-06).

## Testing

| Element | Test |
|---|---|
| `domain` | Unit tests (Vitest), no DOM, no doubles (Chicago) |
| `application` | Unit tests (Vitest), outgoing ports mocked with `vitest-mock-extended` (London) |
| `adapter/in/ui` (components, view-state stores) | Component/store tests with Testing Library and **mocked use-case contracts**. Assert on what the user sees, query by role. |
| `adapter/out/http` | Integration tests of adapter + mapper + schema against MSW (Orval-generated handlers), including error and malformed responses |
| Main user paths | Playwright E2E in two tiers, with axe scans and keyboard journeys |

Details: [testing.md](testing.md).

## What does not carry over

- **Transactions and persistence mapping**: not relevant in the browser. The API boundary takes their place for mapping decisions.
- **Package-private visibility**: TypeScript has none at folder level. `index.ts` public APIs plus dependency-cruiser take its role.
- **The full hexagon for trivial screens**: a static page or a simple form → API → toast doesn't need use-case classes. Record the lighter structure as a conscious shortcut.

## Agent checklist

- [ ] No framework/HTTP imports in `domain`, `application`, `ports`?
- [ ] Backend DTOs mapped inside `adapter/out/http`; API client generated, not hand-written?
- [ ] Ports return `Promise` (or are explicit stream ports)?
- [ ] N+1 check done for new data loading?
- [ ] Component logic limited to rendering + forwarding intent?
- [ ] Cross-feature imports only via `index.ts`?
- [ ] dependency-cruiser green and rules not loosened?

## Sources

Concepts from Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019 (ch. 2–8, 10, 11), translated to frontend by this baseline. The frontend mapping is our own interpretation and is not from the book.
