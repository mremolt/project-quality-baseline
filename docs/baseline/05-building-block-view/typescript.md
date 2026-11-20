# TypeScript Frontend: Hexagonal Architecture (Angular / React / Vue)

How the shared architecture rules apply to frontend applications. The book is about backends, so not everything carries over. This doc says what does, what changes, and what doesn't apply.

Implements: [hexagonal-architecture](../04-solution-strategy/hexagonal-architecture.md) · [code-organization](code-organization.md) · [use-cases](use-cases.md) · [adapters](adapters.md) · [enforcing-boundaries](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md) · [testing](../08-crosscutting-concepts/testing/testing-by-architecture-element.md)

## How the concepts map

| Concept | In a frontend |
|---|---|
| Domain | Framework-free TypeScript: types, value objects, business rules, business errors |
| Application / use case | Plain functions or classes orchestrating domain + outgoing ports (e.g. `placeOrder`, `loadOrderHistory`) |
| Incoming adapter | **UI**: components, pages, routes, view-state stores (NgRx/signals, Redux/Zustand, Pinia) |
| Outgoing adapter | HTTP/API clients, WebSocket clients, `localStorage`/IndexedDB, analytics, feature flags |
| Composition root | Per feature: `<feature>.providers.ts` (Angular) / `<feature>.composition.ts(x)` (React, Vue); injection tokens or keys in `<feature>.tokens.ts` |

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
        out/                ← LoadOrdersPort, SaveDraftPort … (narrow, TS-ARCH-07)
      adapter/
        in/ui/              ← components, pages, view-state store
        out/http/           ← adapter classes implementing ports, DTO↔domain mappers
          generated/        ← Orval output (client, types, zod schemas, MSW mocks); not committed
        out/storage/
      orders.tokens.ts      ← injection tokens / keys for the port and use-case contracts; imports only ports
      orders.providers.ts   ← composition root of the feature (Angular)  | orders.composition.tsx (React/Vue)
      orders.routes.ts      ← feature routes; loaded only lazily by the app routes (TS-ARCH-20)
      index.ts              ← public API of the feature: published contracts, their tokens, the API provider (TS-ARCH-19); never routes
  platform/                 ← app-wide, cross-cutting code; same rings and rules as a feature (Angular: NG-ARCH-04)
    domain/index.ts         ← framework-free entry for shared value objects and errors; the only platform file a feature core may import
    index.ts                ← public API of the platform for adapters, composition and other UI code
  shared/
    ui/                     ← presentational components, plus stateless UI services and pipes (window size, announcer, formatting)
```

## Rules

### Core stays framework-free

- **TS-ARCH-01: `domain`, `application` and `ports` MUST NOT import Angular, React, Vue, routers, state libraries or HTTP clients.** The check is an allow-list (TS-ARCH-12): the core imports its own rings, `src/platform/domain/index.ts`, zod, and RxJS only for stream ports (TS-D1). Anything else (`@ngrx/*`, `rxjs` in an ordinary use case, a date or UI library) fails the build.
  *Why:* business rules can be unit-tested in milliseconds and survive a framework migration.
  **Default TS-D1: ports and use cases return `Promise`**, optionally accepting an `AbortSignal` for cancellation. `Observable` (RxJS) is allowed only for real streams (WebSocket, server-sent events, live updates); such ports are named as streams (`watchOrderStatus`).
  *Why:* promises are language-native, trivial to mock with vitest-mock-extended, and fit `async` store methods and `resource()` loaders. Adapters convert framework observables with the shared `untilAborted` helper ([typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)), which honors the `AbortSignal`.
- **TS-ARCH-02: No business logic in components or templates.** Components render state and forward user intent to a use case. Rules such as "can this order be cancelled?" live in `domain`.
- **TS-ARCH-03: View-state stores are part of the UI adapter** and follow TS-ARCH-08. Angular: [NG-STATE-02](../08-crosscutting-concepts/ui/angular-state-management.md).

### Ports and adapters

- **TS-ARCH-04: Every backend call goes through an outgoing port** implemented in `adapter/out/http`. Components never call `HttpClient` / `fetch` / generated API clients directly.
- **TS-ARCH-05: Backend DTOs MUST NOT leave `adapter/out/http`** (two-way mapping at the API boundary). Map to domain types in the adapter. API clients and DTO types are generated from the OpenAPI spec, never hand-written (API-CON-07, [08-crosscutting-concepts/api/typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)).
  *Why:* backend API changes then touch one mapper, not dozens of components.
- **TS-ARCH-06: Validate untrusted input at the boundary with schema parsing; the schema library is zod (default TS-D2).** API responses are parsed in the HTTP adapter with the generated zod schemas. Form input is parsed before building a command. Commands are immutable (`readonly`) and are created only through a factory that validates with a zod schema living next to the command in `ports/in` (ARCH-UC-05). The factory parameter is typed with the schema's input type, `of(input: z.input<typeof Schema>)`, never `unknown`, so the compiler reports a missing or misspelt field at the call site (ARCH-UC-06); input of unknown shape is parsed with the schema before the factory is called. Example: [NG-ARCH-16](angular.md#forms). The same schema may drive form validation in the UI (Angular: Signal Forms `validateStandardSchema`).
  *Why:* one schema, one truth: the form can't accept what the command would reject.
- **TS-ARCH-07: Ports are narrow** (ARCH-ADP-08): `LoadOrdersPort`, `CancelOrderPort` rather than one `OrderService` mirroring the whole REST resource.
- **TS-ARCH-08: The UI depends on use-case contracts from `ports/in`**, not on use-case implementations (shared default D1), and never on outgoing ports (`ports/out`). A small read-only screen may skip the view-state store: the component calls the incoming query use case directly (Angular: a `resource()` whose loader calls the use case, NG-ARCH-13). This is not a shortcut, so it needs no ADR and no dependency-cruiser exception; a screen with commands, shared state or optimistic updates gets a store (NG-STATE-*).
  *Why:* the store is an optional part of the UI adapter, not a layer; the dependency rule only requires that the UI reaches the core through incoming ports (ARCH-ADP-02).
- **TS-ARCH-18: The HTTP adapter turns error responses into domain errors, in one mapper per adapter (ARCH-ADP-05).** Business errors arrive as `application/problem+json` with a stable `code` (SPRING-I18N-02). The mapper turns each `code` the feature knows into the business error class from the feature's `domain` (`ORDER_ALREADY_SHIPPED` → `OrderAlreadyShipped`). A 404 or 409 becomes the feature's not-found or conflict error where the use case expects it; a 400 becomes a validation error that keeps the `errors[]` field codes. Server errors, network failures, time-outs and unknown codes become the platform's `TechnicalError` (from `src/platform/domain/index.ts`); the platform interceptor has already reported them (NG-OBS-04). Use cases, stores and components never see status codes or problem bodies; the UI maps domain errors to translation keys (Angular: NG-STATE-09). Error categories and their handling per channel: [use-cases.md](use-cases.md).
  *Why:* the frontend then reacts to business meaning, not to HTTP details, and a changed status code touches one mapper.

### Wiring per framework

- **TS-ARCH-09: Only the feature's composition file connects implementations to contracts.** Its tokens live in `<feature>.tokens.ts` (TS-ARCH-17).

**Angular:** `InjectionToken`s are Angular types, so they live in the tokens file, not in `ports`. Adapters are injectable classes that use `inject()` and are bound to their port tokens with `useExisting`; use cases are plain classes created with `useFactory` and `inject()`. Details and the tokens and providers example (naming, `@Service`, scopes): [05-building-block-view/angular.md](angular.md#dependency-injection-and-wiring).

**React:** the composition file creates adapters and use cases and exposes them through a context or provider component. Components get use cases via a hook (`useOrdersUseCases()`), typed with the `ports/in` contracts.

**Vue:** the same idea with `provide`/`inject` and typed `InjectionKey`s defined in the tokens file.

### Feature boundaries

- **TS-ARCH-10: Features import each other only through `index.ts`.** Deep imports into another feature's folders are forbidden.
- **TS-ARCH-19: A feature uses another feature's use cases only through that feature's published API.** The owning feature's `index.ts` exports the use-case contracts, their tokens and one API provider that wires exactly these use cases (Angular: `provide<Feature>Api()`, NG-ARCH-11; React: a provider component; Vue: a plugin). The consuming feature adds the API provider to its own route or composition and injects only the published tokens. It never injects a token or store the owning feature does not publish, and never relies on the owning feature's route providers being active. A use case that several features need, or that belongs to no single feature, is promoted to `src/platform`. Features share domain types only through published contracts or `src/platform/domain`.
  *Why:* a feature is a bounded context; its internals stay free to change, and the consumer's wiring works no matter which route is active.
- **TS-ARCH-20: `index.ts` never exports routes.** Routes live in `<feature>.routes.ts`, and only the app routes load them, with a dynamic `import()`.
  *Why:* other features import `index.ts` statically. If it carried the routes, such an import (or one from the app shell) would pull the routes, their providers and every adapter of a lazy feature into the importing chunk or the main bundle.
- **TS-ARCH-11: `shared/ui` contains no feature or business logic** and never imports from `features/`. It holds presentational components and stateless UI services and pipes (window size, announcer, color scheme, formatting pipes); nothing in it calls a use case, a port or HTTP.

## Enforcement

- **TS-ARCH-12: Architecture rules are checked in CI** with dependency-cruiser (or `eslint-plugin-boundaries`), with `tsPreCompilationDeps: true`. Without it dependency-cruiser does not see dependencies that exist only before compilation (`import type`, interfaces), which are exactly what the ring, token and store rules are about. The patterns cover every feature and `src/platform` alike. A starting point for `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure', severity: 'error',
      comment: 'TS-ARCH-01: domain imports only its own domain and the platform domain entry',
      from: { path: '^src/(features/[^/]+|platform)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'ports-only-domain', severity: 'error',
      from: { path: '^src/(features/[^/]+|platform)/ports/' },
      to: { pathNot: ['^src/$1/(domain|ports)/', '^src/platform/domain/index\\.ts$', 'node_modules/(zod|rxjs)/'] }, // rxjs only for stream ports (TS-D1)
    },
    {
      name: 'application-only-core', severity: 'error',
      comment: 'TS-ARCH-01 as an allow-list; add node_modules/rxjs/ only for features with stream use cases (TS-D1)',
      from: { path: '^src/(features/[^/]+|platform)/application/' },
      to: { pathNot: ['^src/$1/(domain|ports|application)/', '^src/platform/domain/index\\.ts$', 'node_modules/zod/'] },
    },
    {
      name: 'adapters-use-ports-not-services', severity: 'error',
      from: { path: '^src/(features/[^/]+|platform)/adapter/' },
      to: { path: '^src/$1/application/' },
    },
    {
      name: 'ui-and-http-adapters-independent', severity: 'error',
      from: { path: '/adapter/in/' },
      to: { path: '/adapter/out/' },
    },
    {
      name: 'ui-no-outgoing-ports', severity: 'error',
      comment: 'TS-ARCH-08: the UI reaches the core only through ports/in',
      from: { path: '/adapter/in/' },
      to: { path: '/ports/out/' },
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
      name: 'platform-only-via-index', severity: 'error',
      comment: 'NG-ARCH-04; a feature core may import only the platform domain entry (TS-ARCH-01); shared generated clients are allowed, generated-api-only-in-http-adapter limits who imports them',
      from: { path: '^src/(features|app|shared)/' },
      to: {
        path: '^src/platform/',
        pathNot: ['^src/platform/index\\.ts$', '^src/platform/domain/index\\.ts$', '^src/platform/adapter/out/http/[^/]+/generated/'],
      },
    },
    {
      name: 'platform-no-features', severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'feature-routes-only-from-app', severity: 'error',
      comment: 'TS-ARCH-20: only the app routes load feature routes',
      from: { pathNot: ['^src/app/', '\\.spec\\.tsx?$'] },
      to: { path: '^src/features/[^/]+/[^/]+\\.routes\\.tsx?$' },
    },
    {
      name: 'feature-routes-only-lazy', severity: 'error',
      comment: 'TS-ARCH-20: a static import would pull the lazy feature into the main bundle',
      from: { path: '^src/app/' },
      to: { path: '^src/features/[^/]+/[^/]+\\.routes\\.tsx?$', dependencyTypesNot: ['dynamic-import'] },
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
      name: 'tokens-only-ports', severity: 'error',
      comment: 'TS-ARCH-17: the tokens file imports only its own ports (and the framework)',
      from: { path: '^src/(features/[^/]+|platform)/[^/]+\\.tokens\\.ts$' },
      to: { path: '^src/', pathNot: ['^src/$1/ports/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'composition-root-not-imported', severity: 'error',
      comment: 'TS-ARCH-17/19: only routes, app config and the feature index (for the API provider) import the providers file',
      from: { pathNot: ['\\.routes\\.tsx?$', '^src/app/', '^src/features/[^/]+/index\\.ts$'] },
      to: { path: '\\.(providers|composition)\\.tsx?$' },
    },
    {
      name: 'shared-ui-no-features', severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true, // also see imports that vanish at compile time (import type, interfaces)
    doNotFollow: { path: 'node_modules' },
  },
};
```

- **TS-ARCH-13: Guard against "checks nothing"** (ARCH-ENF-02). Keep a small fixture with a deliberate **type-only** violation (for example `import type { OrderDto } from '../adapter/out/http/generated/model'` in a domain file) and assert in CI that the checker fails on it. A type-only fixture also proves `tsPreCompilationDeps` is on. Re-check the regexes after renaming folders.
- **TS-ARCH-14: Larger frontends** may turn features into workspace packages/libraries (npm/pnpm workspaces, Nx) with explicit dependencies. This is the frontend equivalent of build modules (ARCH-ENF-06).

### Data loading, results and tokens

- **TS-ARCH-15: Batching, request coalescing and caching of backend data live in the outgoing adapter**, as a decorator implementing the same port (API-N1-04). Use cases and stores stay unaware of them. Every data-loading feature gets an N+1 check ([08-crosscutting-concepts/api/avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md)).
- **TS-ARCH-16: Frontend use cases may return immutable frontend domain types** (`readonly Order[]`) instead of use-case specific result models. This is the frontend exception to ARCH-UC-07. The types are `readonly`, framework-free, and belong to the frontend's own `domain` (mapped from DTOs in the adapter, TS-ARCH-05), not to the backend. A use case whose result combines several aggregates or carries screen-specific data still gets its own result type in `ports/in`.
  *Why:* the frontend domain is already a read model of the API, shaped for this UI; a second result model per use case would be a copy of it. The reason behind ARCH-UC-07 (entities changing for UI reasons) does not apply when the domain types exist for this UI.
- **TS-ARCH-17: Injection tokens (keys) live in `<feature>.tokens.ts`, which imports only the feature's `ports`.** Stores, pages and adapters import tokens from there, never from the composition file.
  *Why:* incoming adapters then don't depend on the wiring (which imports every adapter), and no import cycle can form between the providers file and the components it wires.

## Testing

| Element | Test |
|---|---|
| `domain` | Unit tests (Vitest), no DOM, no doubles (Chicago) |
| `application` | Unit tests (Vitest), outgoing ports mocked with `vitest-mock-extended` (London) |
| `adapter/in/ui` (components, view-state stores) | Component/store tests with Testing Library and **mocked use-case contracts**. Assert on what the user sees, query by role. |
| `adapter/out/http` | Integration tests of adapter + mapper + schema against MSW (Orval-generated handlers), including error and malformed responses |
| Main user paths | Playwright E2E in two tiers, with axe scans and keyboard journeys |

Details: [08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md).

## What does not carry over

- **Transactions and persistence mapping**: not relevant in the browser. The API boundary takes their place for mapping decisions.
- **Package-private visibility**: TypeScript has none at folder level. `index.ts` public APIs plus dependency-cruiser take its role.
- **The full hexagon for trivial screens**: a static page needs no use case at all. For a simple form → API → toast there is one allowed lighter variant, the catalogued shortcut "skipping application services" ([conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md)): the HTTP adapter implements the `ports/in` contract itself, and the providers file binds the use-case token to it (`useExisting`). There is no application class and no outgoing port; the UI still injects the use-case token (TS-ARCH-08), so dependency-cruiser passes unchanged. Record it as an ADR (ARCH-SC-02); introduce the use case when the screen gains a rule.

## Agent checklist

- [ ] No framework/HTTP imports in `domain`, `application`, `ports` (also no `import type`)? Only `src/platform/domain/index.ts` from the platform?
- [ ] Backend DTOs mapped inside `adapter/out/http`; API client generated, not hand-written?
- [ ] Ports return `Promise` (or are explicit stream ports)?
- [ ] Tokens in `<feature>.tokens.ts`; UI injects use-case contracts, never outgoing ports?
- [ ] N+1 check done for new data loading?
- [ ] Component logic limited to rendering + forwarding intent?
- [ ] Cross-feature imports only via `index.ts`; another feature's use cases only through its published API provider (TS-ARCH-19)?
- [ ] Routes only in `<feature>.routes.ts`, loaded with a dynamic `import()` from the app routes (TS-ARCH-20)?
- [ ] HTTP errors mapped to domain errors in the adapter; no status codes above it (TS-ARCH-18)?
- [ ] dependency-cruiser green with `tsPreCompilationDeps: true`, rules not loosened?

## Sources

Concepts from Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019 (ch. 2–8, 10, 11), translated to frontend by this baseline. The frontend mapping is our own interpretation and is not from the book.
