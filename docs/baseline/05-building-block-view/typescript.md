# TypeScript Frontend: Hexagonal Architecture

How the shared architecture rules apply to frontend applications. The book is about backends, so not everything carries over. This doc says what does, what changes, and what doesn't apply.

Implements: [hexagonal-architecture](../04-solution-strategy/hexagonal-architecture.md) · [code-organization](code-organization.md) · [use-cases](use-cases.md) · [adapters](adapters.md) · [enforcing-boundaries](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md) · [testing](../08-crosscutting-concepts/testing/testing-by-architecture-element.md)

## How the concepts map

| Concept | In a frontend |
|---|---|
| Domain | Framework-free TypeScript: types, value objects, business rules, business errors |
| Application / use case | Plain functions or classes orchestrating domain + outgoing ports (e.g. `placeOrder`, `loadOrderHistory`) |
| Incoming adapter | **UI**: components, pages, routes, view-state stores |
| Outgoing adapter | HTTP/API clients, WebSocket clients, `localStorage`/IndexedDB, analytics, feature flags |
| Composition root | Per feature: one composition file (name per stack); injection tokens or keys in `<feature>.tokens.ts` |

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
      orders.<composition>  ← composition root of the feature; file name per stack (React splits off the published part: orders.api.tsx)
      orders.routes.ts      ← feature routes; loaded only lazily by the app routes (TS-ARCH-20)
      index.ts              ← public API of the feature: published contracts, their tokens, the API provider (TS-ARCH-19); never routes
  platform/                 ← app-wide, cross-cutting code; same rings and rules as a feature
    domain/index.ts         ← framework-free entry for shared value objects and errors; the only platform file a feature core may import
    index.ts                ← public API of the platform for adapters, composition and other UI code
  shared/
    ui/                     ← presentational components, plus stateless UI services and pipes (window size, announcer, formatting)
```

## Rules

### Core stays framework-free

- **TS-ARCH-01: `domain`, `application` and `ports` MUST NOT import UI frameworks, routers, state libraries or HTTP clients.** The check is an allow-list (TS-ARCH-12): the core imports its own rings, `src/platform/domain/index.ts`, zod, and RxJS only for stream ports (TS-D1). `domain` itself is zod-free (dependency-cruiser `domain-is-pure`): schemas live in `ports` (commands, TS-ARCH-06) and `application`; a domain value object validates in plain TypeScript. Anything else (a state library, `rxjs` in an ordinary use case, a date or UI library) fails the build.
  *Why:* business rules can be unit-tested in milliseconds and survive a framework migration.
  **Default TS-D1: ports and use cases return `Promise`**, optionally accepting an `AbortSignal` for cancellation. `Observable` (RxJS) is allowed only for real streams (WebSocket, server-sent events, live updates); such ports are named as streams (`watchOrderStatus`).
  *Why:* promises are language-native, trivial to mock with vitest-mock-extended, and fit `async` store methods and data loaders. An adapter whose HTTP stack returns observables converts them to promises that honor the `AbortSignal` (TS-API-06).
- **TS-ARCH-02: No business logic in components or templates.** Components render state and forward user intent to a use case. Rules such as "can this order be cancelled?" live in `domain`.
- **TS-ARCH-03: View-state stores are part of the UI adapter** and follow TS-ARCH-08: they call use-case contracts only, never HTTP, adapters, outgoing ports, generated code or another store.

### Ports and adapters

- **TS-ARCH-04: Every backend call goes through an outgoing port** implemented in `adapter/out/http`. Components never call the HTTP client, `fetch` or generated API clients directly.
- **TS-ARCH-05: Backend DTOs MUST NOT leave `adapter/out/http`** (two-way mapping at the API boundary). Map to domain types in the adapter. API clients and DTO types are generated from the OpenAPI spec, never hand-written (API-CON-07, [08-crosscutting-concepts/api/typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)).
  *Why:* backend API changes then touch one mapper, not dozens of components.
- **TS-ARCH-06: Validate untrusted input at the boundary with schema parsing; the schema library is zod (default TS-D2).** API responses are parsed in the HTTP adapter with the generated zod schemas. Form input is parsed before building a command. Commands are immutable (`readonly`) and are created only through a factory that validates with a zod schema living next to the command in `ports/in` (ARCH-UC-05). The factory parameter is typed with the schema's input type, `of(input: z.input<typeof Schema>)`, never `unknown`, so the compiler reports a missing or misspelt field at the call site (ARCH-UC-06); input of unknown shape is parsed with the schema before the factory is called. The same schema may drive form validation in the UI.
  *Why:* one schema, one truth: the form can't accept what the command would reject.
- **TS-ARCH-07: Ports are narrow** (ARCH-ADP-08): `LoadOrdersPort`, `CancelOrderPort` rather than one `OrderService` mirroring the whole REST resource.
- **TS-ARCH-08: The UI depends on use-case contracts from `ports/in`**, not on use-case implementations (shared default D1), and never on outgoing ports (`ports/out`). A small read-only screen may skip the view-state store: the component calls the incoming query use case directly through the stack's data-loading primitive. This is not a shortcut, so it needs no ADR and no dependency-cruiser exception; a screen with commands, shared state or optimistic updates gets a store.
  *Why:* the store is an optional part of the UI adapter, not a layer; the dependency rule only requires that the UI reaches the core through incoming ports (ARCH-ADP-02).
- **TS-ARCH-18: The HTTP adapter turns error responses into domain errors, in one mapper per adapter (ARCH-ADP-05).** Business errors arrive as `application/problem+json` with a stable `code` ([API-REST-07](../08-crosscutting-concepts/api/rest-conventions.md)). The mapper turns each `code` the feature knows into the business error class from the feature's `domain` (`ORDER_ALREADY_SHIPPED` → `OrderAlreadyShipped`). A 404 or 409 becomes the feature's not-found or conflict error where the use case expects it; a 400 becomes a validation error that keeps the `errors[]` field codes. Server errors, network failures, time-outs, unknown codes and malformed responses become the platform's `TechnicalError` (from `src/platform/domain/index.ts`). A `TechnicalError` is reported once, by the code that creates it, and passed on unchanged everywhere else: the platform's HTTP error path reports server errors, network failures and time-outs (OBS-*); unknown codes and bodies that fail the contract's schema arise after it, in the feature's HTTP adapter. The adapter reports those itself, once, through the report-error use case (React and Next.js: a constructor argument from the feature's factory, REACT-OBS-04; Angular: the `REPORT_ERROR` token, NG-OBS-04), and passes every `TechnicalError` it did not create on unreported. An adapter behind another channel follows the same rule (the Next.js server-action adapter, NEXT-ARCH-04). On the Next.js server the reporter is the platform logger, which marks what it logged so that `onRequestError` does not log it again (NEXT-OBS-09). Use cases, stores and components never see status codes or problem bodies; the UI maps domain errors to translation keys, once per feature. Error categories and their handling per channel: [use-cases.md](use-cases.md).
  *Why:* the frontend then reacts to business meaning, not to HTTP details, and a changed status code touches one mapper.

### Wiring

- **TS-ARCH-09: Only the feature's composition file connects implementations to contracts.** It creates the adapters and use cases (use cases are plain classes or functions, TS-ARCH-01) and binds them to the contracts' tokens or keys, which live in `<feature>.tokens.ts` (TS-ARCH-17). UI code gets use cases through the stack's injection mechanism, typed with the `ports/in` contracts.

### Feature boundaries

- **TS-ARCH-10: Features import each other only through `index.ts`.** Deep imports into another feature's folders are forbidden.
- **TS-ARCH-19: A feature uses another feature's use cases only through that feature's published API.** The owning feature's `index.ts` exports the use-case contracts, their tokens and one API provider that wires these use cases (the stack's mechanism; React: a provider of the feature's use-case object, of which `index.ts` publishes only the selector hooks of these use cases, REACT-ARCH-11); other features reach exactly the published ones. The consuming feature adds the API provider to its own route or composition and injects only the published tokens. It never injects a token or store the owning feature does not publish, and never relies on the owning feature's route providers being active. A use case that several features need, or that belongs to no single feature, is promoted to `src/platform`. Features share domain types only through published contracts or `src/platform/domain`. A published API may also export the feature's pure domain functions its consumers need (a parser, a predicate), nothing else of its domain. A feature that needs data owned by another audience (an employee's booking form needs the activities that only the admin feature lists) gets its own read use case and backend endpoint for that audience, rather than widening the other feature's API; the backend splits controllers (and so OpenAPI tags) by audience, so every generated client belongs to one feature. A component shown by several features and fed by a third one's data lives in `src/shared/ui` with a structural input type, its texts in the shared catalog.
  *Why:* a feature is a bounded context; its internals stay free to change, and the consumer's wiring works no matter which route is active.
- **TS-ARCH-20: `index.ts` never exports routes.** Routes live in `<feature>.routes.ts`, and only the app routes load them, with a dynamic `import()`.
  *Why:* other features import `index.ts` statically. If it carried the routes, such an import (or one from the app shell) would pull the routes, their providers and every adapter of a lazy feature into the importing chunk or the main bundle.
- **TS-ARCH-11: `shared/ui` contains no feature or business logic** and never imports from `features/`. It holds presentational components and stateless UI services and pipes (window size, announcer, color scheme, formatting pipes); nothing in it calls a use case, a port or HTTP.

## Enforcement

- **TS-ARCH-12: Architecture rules are checked in CI** with dependency-cruiser (or `eslint-plugin-boundaries`), with `tsPreCompilationDeps: true`. Without it dependency-cruiser does not see dependencies that exist only before compilation (`import type`, interfaces), which are exactly what the ring, token and store rules are about. The patterns cover every feature and `src/platform` alike. A starting point for `.dependency-cruiser.cjs`; each stack sets the constants at the top and adds its own rules (Per stack line at the end):

```js
// Set per stack: the feature composition file, the root file that configures the HTTP stack, the HTTP client modules
const COMPOSITION_FILE = '\\.composition\\.tsx?$';
const ROOT_HTTP_SETUP = '^src/app/providers\\.tsx?$';
const HTTP_CLIENT_MODULES = 'node_modules/(axios|ky)'; // stacks add their framework HTTP client
const TEST_FILE = '\\.(spec|test)\\.tsx?$'; // colocated tests import the test libraries: excluded from the core allow-lists

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure', severity: 'error',
      comment: 'TS-ARCH-01: domain imports only its own domain and the platform domain entry',
      from: { path: '^src/(features/[^/]+|platform)/domain/', pathNot: TEST_FILE },
      to: { pathNot: ['^src/$1/domain/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'ports-only-domain', severity: 'error',
      from: { path: '^src/(features/[^/]+|platform)/ports/', pathNot: TEST_FILE },
      to: { pathNot: ['^src/$1/(domain|ports)/', '^src/platform/domain/index\\.ts$', 'node_modules/(zod|rxjs)/'] }, // rxjs only for stream ports (TS-D1)
    },
    {
      name: 'application-only-core', severity: 'error',
      comment: 'TS-ARCH-01 as an allow-list; add node_modules/rxjs/ only for features with stream use cases (TS-D1)',
      from: { path: '^src/(features/[^/]+|platform)/application/', pathNot: TEST_FILE },
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
      name: 'stores-only-call-use-cases', severity: 'error',
      comment: 'TS-ARCH-03: no HTTP, no adapters, no services, no outgoing ports, no generated code, no other store',
      from: { path: '-store\\.tsx?$' },
      to: { path: ['/adapter/out/', '/application/', '/ports/out/', '/generated/', '-store\\.tsx?$', HTTP_CLIENT_MODULES] },
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
      comment: 'src/platform is treated like a feature; a feature core may import only the platform domain entry (TS-ARCH-01); shared generated clients are allowed, generated-api-only-in-http-adapter limits who imports them',
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
      from: { pathNot: ['^src/app/', TEST_FILE] },
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
      comment: 'TS-ARCH-04; the root HTTP setup and feature composition files may configure the HTTP stack',
      from: { path: '^src/', pathNot: ['/adapter/out/http/', '^src/platform/adapter/', COMPOSITION_FILE, ROOT_HTTP_SETUP] },
      to: { path: HTTP_CLIENT_MODULES },
    },
    {
      name: 'tokens-only-ports', severity: 'error',
      comment: 'TS-ARCH-17: the tokens file imports only its own ports (and the framework)',
      from: { path: '^src/(features/[^/]+|platform)/[^/]+\\.tokens\\.tsx?$' },
      to: { path: '^src/', pathNot: ['^src/$1/ports/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'composition-root-not-imported', severity: 'error',
      comment: 'TS-ARCH-17/19: only routes, the root composition and the feature index (for the API provider) import the composition file',
      from: { pathNot: ['\\.routes\\.tsx?$', '^src/app/', '^src/features/[^/]+/index\\.ts$'] },
      to: { path: COMPOSITION_FILE },
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

- **TS-ARCH-13: Guard against "checks nothing"** (ARCH-ENF-02). Keep a small fixture with a deliberate **type-only** violation (for example `import type { OrderDto } from '../adapter/out/http/generated/model'` in a domain file) and assert in CI that the checker fails on it. A type-only fixture also proves `tsPreCompilationDeps` is on. Re-check the regexes after renaming folders. A test that runs the checker through dependency-cruiser's `cruise()` API passes an **absolute** `baseDir`: with a relative one, bare imports (`zod`, framework packages) stay unresolved (`couldNotResolve`), allow-list rules match them by accident, and the fixture can fail for the wrong reason.

```ts
// test/architecture.spec.ts (excerpt)
const fixture = fileURLToPath(new URL('fixtures/arch-violation', import.meta.url)); // absolute baseDir
const result = await cruise(['src'], { ...config.options, ruleSet: { forbidden: config.forbidden }, validate: true, baseDir: fixture });
```
- **TS-ARCH-14: Larger frontends** may turn features into workspace packages/libraries (npm/pnpm workspaces, Nx) with explicit dependencies. This is the frontend equivalent of build modules (ARCH-ENF-06).

### Data loading, results and tokens

- **TS-ARCH-15: Batching, request coalescing and caching of backend data live in the outgoing adapter**, as a decorator implementing the same port (API-N1-04). Use cases and stores stay unaware of them. Every data-loading feature gets an N+1 check ([08-crosscutting-concepts/api/avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md)).
- **TS-ARCH-16: Frontend use cases may return immutable frontend domain types** (`readonly Order[]`) instead of use-case specific result models. This is the frontend exception to ARCH-UC-07. The types are `readonly`, framework-free, and belong to the frontend's own `domain` (mapped from DTOs in the adapter, TS-ARCH-05), not to the backend. A use case whose result combines several aggregates or carries screen-specific data still gets its own result type in `ports/in`.
  *Why:* the frontend domain is already a read model of the API, shaped for this UI; a second result model per use case would be a copy of it. The reason behind ARCH-UC-07 (entities changing for UI reasons) does not apply when the domain types exist for this UI.
- **TS-ARCH-17: Injection tokens (keys) live in `<feature>.tokens.ts`, which imports only the feature's `ports`.** Stores, pages and adapters import tokens from there, never from the composition file.
  *Why:* incoming adapters then don't depend on the wiring (which imports every adapter), and no import cycle can form between the composition file and the components it wires.
- **TS-ARCH-21: A new load supersedes the previous one, and every async result is applied to the current state.** A store (or hook) that loads data for a key the user can change (date, page, filter, selected id) aborts the previous load's `AbortController` when it starts a new one, drops the result of a superseded load, and aborts its loads when it is destroyed; a `new AbortController().signal` that nobody can abort does not count. A result that arrives after an `await` is merged into the state as it is then (an updater on the current state), never into a copy read before the `await`, and it is dropped when the key it belongs to is no longer the current one. Saves the user can fire in quick succession on the same item (autosave of a cell or field) are serialized or coalesced per item key, so two saves never start from the same old value. Realisation: Angular NG-STATE-18; React REACT-STATE-20. Test: a store test in which an older response resolves after a newer one, and one with two overlapping saves on the same key.
  *Why:* quick prev/next clicks or fast typing across cells otherwise show an older period under the new heading, or overwrite a saved value with a stale one, while the server holds the right data.
- **TS-ARCH-22: Frontend code reads the current time only from the platform's clock, and the business date only from one platform function (ARCH-UC-20).** `src/platform` provides a clock contract (a `CLOCK` token or port returning the instant) and one function that turns an instant into the business date or month in the product's time zone (`businessDate(instant)`, using `Intl.DateTimeFormat` with the zone from the runtime configuration or a platform constant). Features never compute "today" with `new Date().toISOString().slice(0, 10)` (that is the UTC date) or from the browser's zone, and they never declare the zone a second time. A page that stays open for long (a day view, a running timer) recomputes its business date when it changes: on the ticker crossing midnight in the product zone and on `visibilitychange` after a long gap, then reloads. Enforced by ESLint (TS-TOOL-21: `no-restricted-syntax` on `Date.now()` and argument-less `new Date()` outside the platform clock, [typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md)); tests provide a fixed clock (TEST-TDD-16).
  *Why:* between midnight and 01:00 (02:00 in summer) the UTC date is still yesterday in Central Europe, so pages pre-fill and book the wrong day; a pinned clock is also the only way to test month boundaries.
- **TS-ARCH-23: Stores and components catch only the errors they expect.** A `catch` handles the feature's domain errors and the platform's `TechnicalError` (TS-ARCH-18); any other error is a programming error and is rethrown or passed to the global error handler (Angular `ErrorHandler`, React error boundary or the report-error use case) before the store sets its failed state. No bare `catch {}` and no `.catch(() => {})` that drops the error.
  *Why:* a `TypeError` or a contract mismatch otherwise looks like a network failure to the user and never reaches error reporting, so the defect stays hidden in production.

## Testing

| Element | Test |
|---|---|
| `domain` | Unit tests (Vitest), no DOM, no doubles (Chicago) |
| `application` | Unit tests (Vitest), outgoing ports mocked with `vitest-mock-extended` (London); none for a use case that only forwards to one port (TEST-ARCH-02) |
| `adapter/in/ui` (components, view-state stores) | Component/store tests with Testing Library and **mocked use-case contracts**. Assert on what the user sees, query by role. |
| `adapter/out/http` | Integration tests of adapter + mapper + schema against MSW (Orval-generated handlers), including error and malformed responses |
| Main user paths | Playwright E2E in two tiers, with axe scans and keyboard journeys |

Details: [08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md).

## What does not carry over

- **Transactions and persistence mapping**: not relevant in the browser. The API boundary takes their place for mapping decisions.
- **Package-private visibility**: TypeScript has none at folder level. `index.ts` public APIs plus dependency-cruiser take its role.
- **The full hexagon for trivial screens**: a static page needs no use case at all. For a simple form → API → toast there is one allowed lighter variant, the catalogued shortcut "skipping application services" ([conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md)): the HTTP adapter implements the `ports/in` contract itself, and the composition file binds the use-case token to it. There is no application class and no outgoing port; the UI still injects the use-case token (TS-ARCH-08), so dependency-cruiser passes unchanged. Record it as an ADR (ARCH-SC-02); introduce the use case when the screen gains a rule.

*Agent checklist in [checklists/typescript.md](../checklists/typescript.md) and sources in [sources.md](../sources.md), section "TypeScript Frontend: Hexagonal Architecture".*
