# Angular: Architecture and Project Structure

How the hexagonal frontend ([05-building-block-view/typescript.md](typescript.md)) is built with current Angular (standalone, signals, zoneless). The official `angular-developer` skill is the reference for Angular APIs; this doc wins where they disagree (see the override table at the end).

## Project layout

```
src/
  app/
    app.ts                  ← root component (shell: layout, navigation)
    app.config.ts           ← root composition: router, HTTP stack, platform providers, provideBrowserGlobalErrorListeners()
                              + ErrorHandler binding (NG-OBS-01), provideAppInitializer for /config.json (NG-CFG-02)
    app.routes.ts           ← top-level routes, lazy-loads feature routes
  platform/                 ← app-wide, cross-cutting; same ring layout as a feature
    domain/  ports/  application/
    domain/index.ts         ← framework-free entry: shared value objects, TechnicalError (TS-ARCH-01/18)
    adapter/in/ui/          ← app-wide stores (session), error pages, store features (withRequestStatus)
    adapter/out/http/       ← interceptors (auth, errors), shared API clients, untilAborted helper, runtime-config loader
    adapter/out/error-reporting/ ← the only code that knows the error-reporting tool (NG-OBS-02)
    platform.tokens.ts      ← RUNTIME_CONFIG and other platform tokens (NG-CFG-04)
    index.ts
  features/
    orders/
      domain/               ← order.ts, order-status.ts, can-be-cancelled.ts …
      application/          ← load-order-history-service.ts …
      ports/in/             ← load-order-history-use-case.ts, cancel-order-command.ts (+ zod schema)
      ports/out/            ← load-orders-port.ts …
      adapter/in/ui/        ← pages, components, orders-store.ts, guards, resolvers
      adapter/out/http/     ← http-orders.ts, orders-mapper.ts, generated/
      orders.tokens.ts      ← injection tokens of the port and use-case contracts (imports only ports)
      orders.providers.ts   ← composition root of the feature (wiring)
      orders.routes.ts      ← feature routes; attaches orders.providers at route level; loaded lazily by app.routes.ts (TS-ARCH-20)
      index.ts              ← public API: published contracts, their tokens, provideOrdersApi() (TS-ARCH-19); no routes
  shared/ui/                ← presentational components (incl. Material gap components), stateless UI services and pipes
  styles/theme.scss         ← the global Angular Material theme
```

## Rules

### Structure and naming

- **NG-ARCH-01: New code follows the layout above.** Generate with the CLI and the target path, e.g. `ng generate component features/orders/adapter/in/ui/order-list`. A new feature is created with the `baseline-angular` generator (`.agents/skills/baseline-angular/templates/scripts/new-feature.mjs`, NG-ARCH-23), which writes the ring folders, tokens, providers, lazy routes, page and catalogs in one step.
- **NG-ARCH-02: Angular artifacts use the suffixless naming of the Angular style guide** (CLI default since v20): `order-list.ts` / `class OrderList`, `orders-store.ts` / `OrdersStore`. Templates and styles share the base name (`order-list.html`, `order-list.scss`).
- **NG-ARCH-03: Core files are named by business term** (`order.ts`, `place-order-service.ts`), with a role suffix where the architectural role matters: `-port`, `-use-case`, `-command`, `-query`. Adapters are named technology + subject: `http-orders.ts` / `HttpOrders`. No `.model.ts` files.
- **NG-ARCH-04: `src/platform` is treated like a feature**: same rings, the same dependency-cruiser rules (TS-ARCH-12), reachable only through its `index.ts`, never imports `features/`. Shared API clients and interceptors live in `platform/adapter/out/http`. A feature's `domain`, `ports` and `application` may import only `src/platform/domain/index.ts` (framework-free shared value objects and errors), never `src/platform/index.ts`, which also exports tokens and UI code.
- **NG-ARCH-22: Imports across rings use path aliases, never deep relative paths.** `tsconfig.json` defines exactly these aliases: `@platform` (`src/platform/index.ts`), `@platform/domain` (`src/platform/domain/index.ts`), `@shared/ui/*`, `@features/*` (a feature's `index.ts`, TS-ARCH-19) and `@testing/*`. Inside one ring or one feature, relative imports stay. dependency-cruiser resolves the aliases through `tsConfig` (TS-ARCH-12), so the ring rules apply unchanged; an alias that points past an `index.ts` is a violation.
  *Why:* `../../../../../platform` is error-prone to write and unreadable to review, and wrong import depths were a recurring source of failed builds.
- **NG-ARCH-23: A new feature starts from the `baseline-angular` feature generator.** `templates/scripts/new-feature.mjs` creates the ~10 files of a feature (tokens, providers, routes, `index.ts`, page `.ts`/`.html`/`.scss`/spec, two catalogs with `context.json`) with the aliases of NG-ARCH-22; the product adds it as `npm run new:feature`. After generating, the next step is the failing test (TEST-TDD-01), not more scaffolding. A product adapts the generator to its shell (page header, test helpers) and keeps it current when a rule changes.
  *Why:* an Angular feature needs about ten hand-written files; written by hand (or by an agent) they drift from the rings.

### Components and templates

- **NG-ARCH-05: Standalone components, `OnPush`, zoneless**: the defaults of current Angular. No `NgModule`s in new code.
- **NG-ARCH-21: Every component keeps its template and its styles in dedicated files**: `templateUrl: './<name>.html'` and, when the component has styles, `styleUrl: './<name>.scss'`, next to `<name>.ts`. Never `template:`, `styles:` or `styleUrls` with inline content, however short; a component without styles has no style file. Enforced by `@angular-eslint/component-max-inline-declarations` at 0 (NG-TOOL-02) and by the CLI defaults (`inlineTemplate`/`inlineStyle` `false`, NG-ARCH-17). Only test host components declared inside a `*.spec.ts` may use an inline `template`.
  *Why:* templates get the HTML tooling (angular-eslint template and accessibility rules on `*.html`, Prettier's Angular parser, editor support) and readable diffs; one layout for every component, independent of size.
- **NG-ARCH-06: Signal APIs only**: `input()`, `output()`, `model()`, `viewChild()`, `computed()`, `linkedSignal()`; `inject()` instead of constructor injection; built-in control flow (`@if`, `@for`, `@switch`, `@defer`).
- **NG-ARCH-07: Components render and forward intent** (TS-ARCH-02). Derived values come from `computed()` or the store; templates don't do expensive work or business logic.
- **NG-ARCH-08: `effect()` is for synchronizing with non-Angular APIs** (DOM, third-party widgets, logging), not for state propagation. Use `computed()`, `linkedSignal()` or store methods instead.

### Dependency injection and wiring

The Angular form of TS-ARCH-09: the feature's composition file is `<feature>.providers.ts`. `InjectionToken`s are Angular types, so they live in `<feature>.tokens.ts`, not in `ports` (TS-ARCH-17). Adapters are injectable classes that use `inject()` and are bound to their port tokens with `useExisting`; use cases are plain classes created with `useFactory` and `inject()`.

- **NG-ARCH-09: Use cases are plain classes** (no Angular decorators, TS-ARCH-01), created with `useFactory` in the feature's providers file.
- **NG-ARCH-10: Adapters are injectable but not auto-provided**: `@Service({ autoProvided: false })` (or `@Injectable()` without `providedIn`), take their dependencies with `inject()`, are listed once in the providers file and bound to each port token with `useExisting` (one instance for all ports it implements). Tokens come from `<feature>.tokens.ts` (TS-ARCH-17). Auto-provided root services (`@Service()`) only for cross-cutting infrastructure in `src/platform`.
  *Why:* auto-provided singletons bypass the composition root, so wiring becomes invisible and architecture tests can't see it.
- **NG-ARCH-11: Feature providers are attached at route level** (`providers: ordersProviders` in `orders.routes.ts`), so they are lazy and scoped to the feature. `app.routes.ts` loads `orders.routes.ts` with a dynamic `import()`, never through `index.ts` (TS-ARCH-20). A feature whose use cases others may call publishes `provideOrdersApi()` (in `orders.providers.ts`, re-exported by `index.ts`) that wires exactly those use cases; a consuming feature adds it to its own route providers (TS-ARCH-19). A unit test creates an injector with only `provideOrdersApi()` (plus platform providers) and resolves every published token. Several pages over one set of aggregates (an admin list for people, one for projects) stay one feature with several route sets in its `<feature>.routes.ts`.

```ts
// features/orders/orders.tokens.ts (imports only ports)
export const LOAD_ORDERS_PORT = new InjectionToken<LoadOrdersPort>('LoadOrdersPort');
export const CANCEL_ORDER_PORT = new InjectionToken<CancelOrderPort>('CancelOrderPort');
export const LOAD_ORDER_HISTORY = new InjectionToken<LoadOrderHistoryUseCase>('LoadOrderHistory');
export const CANCEL_ORDER = new InjectionToken<CancelOrderUseCase>('CancelOrder');

// features/orders/orders.providers.ts (composition root)
export const ordersProviders: Provider[] = [
  OrdersApiService, // generated by Orval (TS-API-04)
  HttpOrders,
  { provide: LOAD_ORDERS_PORT, useExisting: HttpOrders },
  { provide: CANCEL_ORDER_PORT, useExisting: HttpOrders },
  {
    provide: LOAD_ORDER_HISTORY,
    useFactory: () => new LoadOrderHistoryService(inject(LOAD_ORDERS_PORT)),
  },
  {
    provide: CANCEL_ORDER,
    useFactory: () => new CancelOrderService(inject(LOAD_ORDERS_PORT), inject(CANCEL_ORDER_PORT)),
  },
  OrdersErrorKeys, // feature error mapper, not auto-provided (NG-STATE-09)
];

// the published API for other features (TS-ARCH-19); index.ts re-exports it with LOAD_ORDER_HISTORY
export function provideOrdersApi(): Provider[] {
  return [
    OrdersApiService,
    HttpOrders,
    { provide: LOAD_ORDERS_PORT, useExisting: HttpOrders },
    { provide: LOAD_ORDER_HISTORY, useFactory: () => new LoadOrderHistoryService(inject(LOAD_ORDERS_PORT)) },
  ];
}

// features/orders/orders.routes.ts
export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    providers: ordersProviders,
    children: [
      { path: '', loadComponent: () => import('./adapter/in/ui/order-history-page').then((m) => m.OrderHistoryPage) },
      { path: ':orderId', loadComponent: () => import('./adapter/in/ui/order-detail-page').then((m) => m.OrderDetailPage) },
    ],
  },
];

// app/app.routes.ts
export const routes: Routes = [
  { path: 'orders', loadChildren: () => import('../features/orders/orders.routes').then((m) => m.ORDERS_ROUTES) },
];
```

### HTTP and data loading

- **NG-ARCH-12: The HTTP stack is configured once** in `app.config.ts` (`provideHttpClient(withInterceptors([...]))`), with interceptors from `src/platform/adapter/out/http`. `app.config.ts` also loads the runtime configuration ([NG-CFG-02](../08-crosscutting-concepts/configuration/angular.md)) and wires the global error path ([NG-OBS-01](../08-crosscutting-concepts/observability/angular.md)).
- **NG-ARCH-13: `HttpClient`, `httpResource` and generated API services are used only in `adapter/out/http`** (TS-ARCH-04, TS-API-03). The UI loads data through its store or, on a small read-only screen without a store (TS-ARCH-08), a `resource()` whose loader calls the incoming query use case:

```ts
// adapter/in/ui/order-detail-page.ts
export class OrderDetailPage {
  private readonly loadOrder = inject(LOAD_ORDER_DETAIL); // token from orders.tokens.ts
  readonly orderId = input.required<string>(); // route param via withComponentInputBinding()

  protected readonly order = resource({
    params: () => ({ id: OrderId.of(this.orderId()) }),
    loader: ({ params, abortSignal }) => this.loadOrder.loadOrderDetail(params.id, abortSignal),
  });
}
```

- **Promises and errors in Angular (TS-D1, TS-ARCH-18):** ports return `Promise`, so HTTP adapters convert the `HttpClient` observable with the shared `untilAborted` helper, which honors the `AbortSignal` (TS-API-06, [api/angular-openapi-clients.md](../08-crosscutting-concepts/api/angular-openapi-clients.md)). The error interceptor reports server errors, network failures and time-outs before the adapter's mapper turns them into `TechnicalError`; the adapter reports the `TechnicalError`s it creates itself (a malformed body, a 4xx it cannot map) through `REPORT_ERROR`, once (TS-ARCH-18, NG-OBS-04); stores map domain errors to translation keys through the feature's error mapper (NG-STATE-09).
- **NG-ARCH-14: Route params arrive as component inputs** (`withComponentInputBinding()`). Guards and resolvers are incoming adapters: they call use cases, never HTTP.
- **NG-ARCH-20: A failed lazy-chunk load reloads the page once** ([REL-FE-04](../07-deployment-view/container-runtime.md)). During a rolling deployment a browser on release N can ask an instance for a chunk it no longer has. A platform handler registered with `withNavigationErrorHandler` in `app.config.ts` recognises a rejected dynamic import and does one full navigation to the target URL, guarded by a `sessionStorage` flag keyed by the release version from `RUNTIME_CONFIG` (NG-CFG-04), so it never loops. A second failure shows the global error state (NG-UI-35) and is reported (NG-OBS-02). An E2E test stubs a failing chunk and asserts exactly one reload.
- **NG-ARCH-24 (implements TS-ARCH-22): Time comes from the `CLOCK` token, the business date from `businessDate()` in `src/platform/domain`.** `src/platform/ports/out/clock.ts` declares `interface Clock { now(): number }` (epoch milliseconds); `platform.tokens.ts` exports `CLOCK = new InjectionToken<Clock>('Clock', { providedIn: 'root', factory: () => ({ now: () => Date.now() }) })`, the only `Date.now()` outside specs (ESLint NG-TOOL-12, [angular-tooling.md](../08-crosscutting-concepts/development/angular-tooling.md)). Stores, the session activity service (NG-SEC-13) and tickers inject `CLOCK`; component tests provide a fixed one. `businessDate(instant)` and `businessMonth(instant)` format with `Intl.DateTimeFormat('en-CA', { timeZone })` in the product's zone, declared once in the platform.
- **NG-ARCH-15: Every data-loading feature gets an N+1 check** (API-N1-01). Typical Angular trap: a row component with its own `resource()` per item; fix with coalescing in the adapter (API-N1 S4) or a view endpoint (S1).

### Forms

- **NG-ARCH-16: New forms use Signal Forms**; existing forms keep their current form API. Validation comes from the zod schema next to the command in `ports/in` (`validateStandardSchema`), and submitting builds the command through its validating factory (TS-ARCH-06, ARCH-UC-05). Schema messages are translation codes (`required`, `email`), never text; the template shows them through the catalog (`<feature>.validation.<code>`, NG-I18N-05).

```ts
// ports/in/cancel-order-command.ts — framework-free
export const CancelOrderInput = z.object({ orderId: z.string().min(1), reason: z.string().max(500) });
export type CancelOrderCommand = Readonly<z.output<typeof CancelOrderInput>> & { readonly __brand: 'CancelOrderCommand' };
export const CancelOrderCommand = {
  // typed input, never unknown: a missing reason is a compile error at the call site (TS-ARCH-06)
  of: (input: z.input<typeof CancelOrderInput>): CancelOrderCommand => CancelOrderInput.parse(input) as CancelOrderCommand,
};

// adapter/in/ui/cancel-order-dialog.ts
protected readonly model = signal({ orderId: '', reason: '' });
protected readonly cancelForm = form(this.model, (path) => validateStandardSchema(path, CancelOrderInput));
```

### Project setup

- **NG-ARCH-17: New apps are created with** `ng new <name> --style=scss --inline-template=false --inline-style=false --ai-config=none` (plus `--ssr` only if the rendering decision says so), then the baseline is synced into the project ([08-crosscutting-concepts/development/agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md)). `--ai-config=none` because the baseline's `AGENTS.md` and skills replace the generated agent files.
- **NG-ARCH-18: The rendering strategy (CSR, SSR, prerendering) is a project decision recorded as an ADR.** Default: CSR.
- **NG-ARCH-19: The Angular CLI MCP server SHOULD be configured** (`ng mcp`) for agents in the project's MCP configuration.

## Enforcement

The dependency-cruiser rules of [05-building-block-view/typescript.md](typescript.md#enforcement) already cover `src/platform` (NG-ARCH-04), the routes (NG-ARCH-11) and the stores (`stores-only-call-use-cases`, NG-STATE-02). Angular sets the constants at the top of that template:

```js
// Angular additions to .dependency-cruiser.cjs
const COMPOSITION_FILE = '\\.providers\\.ts$'; // <feature>.providers.ts
const ROOT_HTTP_SETUP = '^src/app/app\\.config\\.ts$'; // provideHttpClient(withInterceptors([...]))
const HTTP_CLIENT_MODULES = 'node_modules/(@angular/common/http|axios|ky)';
```

With these, `http-clients-only-in-http-adapter` lets only `adapter/out/http`, `src/platform/adapter/`, the providers files and `app.config.ts` import `@angular/common/http`, and `stores-only-call-use-cases` forbids it in stores.

`app.config.ts` and `app.routes.ts` are the root composition and may import `platform/index.ts`, feature `index.ts` files and, with a dynamic `import()` only, feature routes.

## Skill overrides (`angular-developer`, `angular-new-app`)

| Skill says | Our rule |
|---|---|
| `httpResource` / `HttpClient` services used directly by components | Only in `adapter/out/http`; UI uses store or `resource()` calling a use case (NG-ARCH-13) |
| `@Service()` auto-provided singletons as the default | Adapters bound to port tokens (`useExisting`) in the providers file; use cases are plain classes (NG-ARCH-09/10) |
| Folders `core/`, `features/<x>/components/`, `shared/components/` | Ring layout per feature, `src/platform`, `src/shared/ui` (NG-ARCH-01/04) |
| `.model.ts` for interfaces | Business-term names, role suffixes in the core (NG-ARCH-03) |
| Prefer component harnesses for everything | Testing Library by role; harnesses for Material widgets ([08-crosscutting-concepts/testing/angular.md](../08-crosscutting-concepts/testing/angular.md)) |
| Signal Forms validation defined in the component | zod schema from `ports/in` via `validateStandardSchema` (NG-ARCH-16) |
| Tailwind (`ng add tailwindcss`) | No Tailwind ([08-crosscutting-concepts/ui/angular-material.md](../08-crosscutting-concepts/ui/angular-material.md)) |
| E2E with Cypress, Nightwatch, WebdriverIO, Puppeteer or Playwright | Playwright only ([08-crosscutting-concepts/testing/angular.md](../08-crosscutting-concepts/testing/angular.md)) |
| `ng new --ai-config=agents` | `--ai-config=none`, baseline `AGENTS.md` (NG-ARCH-17) |
| Inline `template:` / `styles:` in examples and generated components | `templateUrl` and `styleUrl` in dedicated files, always (NG-ARCH-21) |
| Angular Aria for accordion, menu, tabs, … | Angular Material first (NG-UI-01/02) |
| Run `ng build` after generating code | Run `npm run verify` (format, lint, architecture, tests, build) |

*Agent checklist in [checklists/angular.md](../checklists/angular.md) and sources in [sources.md](../sources.md), section "Angular: Architecture and Project Structure".*
