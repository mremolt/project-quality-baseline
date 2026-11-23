# React: Testing

React specifics on top of [typescript.md](typescript.md) and [typescript-e2e.md](typescript-e2e.md), which implement the shared rules of [testing-by-architecture-element.md](testing-by-architecture-element.md), [tdd.md](tdd.md) and [accessibility.md](../../10-quality-requirements/accessibility.md): the Vitest projects, Testing Library with a provider wrapper and mocked use-case contracts in the feature's context, slice tests, axe in component tests, router tests, MSW adapter tests, the architecture canary and the stubbed Playwright tier. Rules that start with "(React SPA)" cover the Vite and TanStack Router defaults; Next.js replaces them in [nextjs.md](nextjs.md). Folder and file names follow [05-building-block-view/react.md](../../05-building-block-view/react.md).

## Element → setup

Test type, style and doubles: [element table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element). The React setup per element:

| Element | Setup |
|---|---|
| `domain`, `application`, `ports` | Vitest project `core` (node), plain functions and classes; ports via `mock<Port>()` (REACT-TEST-01) |
| Presentational component (`shared/ui`, small feature components) | Testing Library `render` with props; assert rendering and callbacks |
| Page with its slice, queries and mutations | `renderWithProviders` + real store, real `QueryClient`, **an object of mocked use cases in the feature's context** (REACT-TEST-05, REACT-TEST-06) |
| Slice | Real app store, slice injected, actions dispatched, selectors asserted (REACT-TEST-12) |
| Routes, route title and focus | (React SPA) memory router with the feature's real route options (REACT-TEST-14, REACT-TEST-15) |
| `adapter/out/http` | MSW with Orval handlers, mutator configured per test (REACT-TEST-16) |
| Architecture rules | Canary test through dependency-cruiser's `cruise()` API (REACT-TEST-17) |
| Main user paths | Stubbed E2E tier against the built app behind the CSP server (REACT-TEST-18); critical paths as full-stack smoke (TS-TEST-10) |

## Vitest

- **REACT-TEST-01: Vitest runs two projects: `core` in the `node` environment and `dom` in `jsdom`.** (React SPA) `core` holds the specs under `domain`, `application` and `ports` plus the tool-level specs in `test/` (architecture canary); `dom` holds every other spec in `src/` and loads `test/setup-dom.ts` (TS-TEST-05). Next.js splits by file extension instead (NEXT-TEST-01).
  *Why:* a core spec that needs a DOM fails, which shows a UI dependency in the core before dependency-cruiser does.
- **REACT-TEST-02: (React SPA) The Vitest config merges `vite.config.ts`**, so tests run through the same plugins as the build, React Compiler included (REACT-D1). Import it with its extension (`./vite.config.ts`, with `allowImportingTsExtensions`, [REACT-TOOL-08](../development/react-tooling.md#compiler-and-build)); Vite 8 warns that the extensionless import will stop working.
- **REACT-TEST-03: The DOM setup file registers jest-dom for Vitest and cleans up after each test:** `import '@testing-library/jest-dom/vitest'` and `afterEach(cleanup)`. Vitest runs without globals, so Testing Library's automatic cleanup does not run.

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

const core = ['src/**/domain/**/*.spec.ts', 'src/**/application/**/*.spec.ts', 'src/**/ports/**/*.spec.ts'];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        { extends: true, test: { name: 'core', environment: 'node', include: [...core, 'test/**/*.spec.ts'] } },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/*.spec.{ts,tsx}'],
            exclude: core,
            setupFiles: ['test/setup-dom.ts'],
          },
        },
      ],
    },
  }),
);
```

## Component and page tests

- **REACT-TEST-04: Component tests use `@testing-library/react` with role queries and `@testing-library/user-event`** (TS-TEST-07/08): one `userEvent.setup()` per test, `findBy*` and `waitFor` for anything asynchronous. Fake timers are not used to skip MUI transitions; wait for the result instead. `act()` is written by hand only around calls that bypass Testing Library (a direct `router.navigate`, `store.dispatch`). A test run SHOULD print no React `act` warnings and no MUI or router warnings; a new one is fixed, not ignored.
- **REACT-TEST-05: Screens are rendered with one shared `renderWithProviders(screen, { path, url, validateSearch })`** in `test/render-with-providers.tsx`. It renders the way the app does, with a fresh instance per test of everything that holds state:
  - a new app store (`createAppStore()`, REACT-STATE-02) and a new `QueryClient` with `retry: false`, so a rejected use case shows its error state at once;
  - the `PlatformProvider` with a frozen test configuration and `mock<ReportErrorUseCase>()`, so `useReportError()` and `useRuntimeConfig()` work and reporting can be asserted;
  - the real MUI theme and the real source-locale catalog (TEST-I18N-01);
  - the announcer context with `mock<Announcer>()` (REACT-TEST-09);
  - (React SPA) a memory router (`createMemoryHistory({ initialEntries: [url] })`) with one route at `path`, so `getRouteApi(...)` hooks of the screen work.

  It returns the Testing Library result plus `store`, `queryClient`, `announcer` and `reportError`.
- **REACT-TEST-06: Page tests mock use cases at the feature's context, never the store, the query cache, hooks or HTTP.** The test wraps the screen in the feature's one context with an object of `mock<UseCase>()` contracts (`<OrdersContext value={{ loadOrders, cancelOrder }}>`, REACT-ARCH-09); the slice, the queries, the mutations and the child components are real (TEST-ARCH-03, TEST-TDD-07). No `vi.mock` of hooks or modules (TS-TEST-02), no MSW in component tests. A slice that the composition injects lazily is injected at the top of the spec (`rootReducer.inject(ordersSlice)`).
- **REACT-TEST-07: Commands are verified by value; queries are stubbed with matchers.** Assert the command the form built: `toHaveBeenCalledExactlyOnceWith(CancelOrderCommand.of({ … }))` (a mutation passes no `AbortSignal`; a query's use case gets one, `expect.any(AbortSignal)`). `calledWith` of vitest-mock-extended compares plain arguments with `===`, so a query stub with a value-object argument uses `calledWith(matches((q: LoadOrdersQuery) => …))`; `expect.objectContaining` is untyped and fails `no-unsafe-argument` (TS-TEST-03).
- **REACT-TEST-08: Every component spec runs axe on its main states** with the shared helper `test/axe.ts` (TS-TEST-09: `color-contrast` and `target-size` disabled in jsdom), including loading-failed, empty and dialog states (UI-19). MUI renders dialogs, menus and popovers in a portal outside the render container, so those states are scanned on the dialog element or on `document.body`.
- **REACT-TEST-09: Announcements are verified as commands on the mocked `Announcer`:** `await waitFor(() => expect(announcer.announce).toHaveBeenCalledWith('Order A-1 cancelled.'))`. Visible status regions are asserted by role (`getByRole('status' | 'alert')`, A11Y-20). The live region of `@react-aria/live-announcer` is asserted only in E2E (TS-TEST-24).
  *Why:* the announcer is a contract we own (UI-15); its live region writes text outside the component and is not part of the screen's behaviour.
- **REACT-TEST-10: Form errors are asserted the way assistive technology sees them** (A11Y-22): the control is `toBeInvalid()`, its error text is its accessible description (`toHaveAccessibleDescription(...)`; MUI links `helperText` through `aria-describedby`, so `toHaveAccessibleErrorMessage` would fail), and after a failed submit the first invalid control `toHaveFocus()`. The use case was not called.
  *Why:* the focus assertion catches a wiring bug the other checks miss: with React Hook Form's `Controller`, spreading `{...field}` into `TextField` also passes `field.ref` to the root element, and focus on error then fails silently. Pass the ref only as `inputRef` (`render={({ field: { ref, ...field } }) => <TextField {...field} inputRef={ref} … />}`).
- **REACT-TEST-11: Focus after dialogs is asserted:** dismissing returns focus to the trigger; after a command that removes the trigger, focus is where UI-18 puts it (the page `h1`). Use `waitFor(() => expect(trigger).toHaveFocus())`, because MUI restores focus after its exit transition.

```tsx
// adapter/in/ui/orders-page.spec.tsx (excerpt)
rootReducer.inject(ordersSlice);

function renderPage(loadOrders = mock<LoadOrdersUseCase>(), cancelOrder = mock<CancelOrderUseCase>()) {
  const rendered = renderWithProviders(
    <OrdersContext value={{ loadOrders, cancelOrder }}>
      <OrdersPage />
    </OrdersContext>,
    { path: 'orders', validateSearch: z.object({ page: z.int().nonnegative().default(0).catch(0) }) },
  );
  return { ...rendered, loadOrders, cancelOrder, user: userEvent.setup() };
}

it('cancels an order with the command built from the form and announces it', async () => {
  const loadOrders = mock<LoadOrdersUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();
  loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
  cancelOrder.cancel.mockResolvedValue(anOrder('1', 'CANCELLED'));
  const { user, announcer } = renderPage(loadOrders, cancelOrder);

  await user.click(await screen.findByRole('button', { name: 'Cancel order A-1' }));
  const dialog = await screen.findByRole('dialog', { name: 'Cancel order A-1' });
  await expectNoAxeViolations(dialog); // portal: scan the dialog itself
  await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Ordered twice');
  await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

  await waitFor(() => expect(announcer.announce).toHaveBeenCalledWith('Order A-1 cancelled.'));
  expect(cancelOrder.cancel).toHaveBeenCalledExactlyOnceWith(
    CancelOrderCommand.of({ orderId: '1', reason: 'Ordered twice' }),
  );
  expect(loadOrders.load).toHaveBeenCalledTimes(2); // list invalidated in the mutation's onSuccess (REACT-TEST-13)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toHaveFocus();
});

it('reports an unexpected error once and shows the generic message (REACT-STATE-07)', async () => {
  const loadOrders = mock<LoadOrdersUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();
  const bug = new TypeError('a bug');
  loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
  cancelOrder.cancel.mockRejectedValue(bug);
  const { user, reportError } = renderPage(loadOrders, cancelOrder);

  const dialog = await submitCancel(user); // opens the dialog, types a reason, submits

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be cancelled');
  expect(reportError.report).toHaveBeenCalledExactlyOnceWith(bug); // a TechnicalError or domain error: not reported
});
```

## View state and server state

- **REACT-TEST-12: Slices are tested against the real app store** (REACT-STATE-13): `createAppStore()`, the slice injected, its actions dispatched, and the result read through the slice's selectors, never through the raw state shape. Slices hold no command logic (REACT-STATE-03), so there is nothing to mock.
- **REACT-TEST-13: TanStack Query behaviour, queries and mutations, is tested through the page test,** not by inspecting the cache or calling the hooks alone: the query use case is called with the expected query and an `AbortSignal`; after a command the list reloads (a second call to the query use case); a rejected load shows the error state and its retry button calls the use case again; each error class the command can reject with shows its mapped message (`OrderAlreadyShipped` → its key, `TechnicalError` → the generic key, both not reported), and an unexpected error shows the generic message and is reported once through the mocked `reportError` (REACT-STATE-07, REACT-STATE-10/11). Query keys and `staleTime` are not asserted directly.

## Routing (React SPA)

- **REACT-TEST-14: (React SPA) Route behaviour is tested with a memory router and the feature's real route options**, the lazy component replaced by a stub: `createRoute({ getParentRoute: () => rootRoute, ...ordersRouteOptions, component: () => <Page title="Orders" /> })` with `createMemoryHistory`. This tests the route's search validation (an invalid `?page=-3` falls back to `{ page: 0 }`, REACT-ARCH-19) and its title key without loading the feature chunk. `test/setup-dom.ts` stubs `window.scrollTo` once for all tests (`vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)`), because the router's scroll handling calls it and jsdom does not implement it.
- **REACT-TEST-15: (React SPA) The app-wide route-change handler has one test with several navigations** (A11Y-21, UI-16): first load sets the title and moves no focus; a path change sets "Page | App" and focuses the routed `h1`; a query-only change, a `replace` navigation and a navigation with `state: { keepFocus: true }` keep focus where it was; going back focuses the previous page's `h1`. Real browsers are covered by TS-TEST-26.
  *Why:* the handler ignores the first navigation, so a per-route test with a single navigation cannot see it move focus.

```tsx
// platform/adapter/in/ui/route-change-handler.spec.tsx (excerpt)
const router = setUp('/'); // memory router: root renders <main><Outlet/></main><RouteChangeHandler/>
await screen.findByRole('heading', { name: 'Home' });
expect(document.title).toBe('Home | Shop');
expect(screen.getByRole('heading', { name: 'Home' })).not.toHaveFocus();

await act(() => router.navigate({ to: '/orders', search: { page: 0 } }));
expect(document.title).toBe('Orders | Shop');
expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();

screen.getByRole('main').focus();
await act(() => router.navigate({ to: '/orders', search: { page: 2 } }));
expect(screen.getByRole('main')).toHaveFocus(); // query-only change: focus stays

act(() => router.history.go(-2));
await waitFor(() => expect(screen.getByRole('heading', { name: 'Home' })).toHaveFocus());
```

## HTTP adapters

- **REACT-TEST-16: HTTP adapters are tested against MSW 3 with the handlers and factories Orval generates** (TS-TEST-04, [react-openapi-clients.md](../api/react-openapi-clients.md)):
  - one `setupServer()` from `msw/node` per spec, `server.listen({ onUnhandledFrame: 'error' })` (MSW 3 renamed `onUnhandledRequest`), `resetHandlers()` after each test;
  - the platform mutator configured in `beforeEach` with `configureHttp({ timeoutMs, onUnauthorized, reportError })` and a `mock<ReportErrorUseCase>()`; the adapter is constructed with the same mock (`new HttpOrders(reportError)`, REACT-OBS-04);
  - responses from `get<Operation>MockHandler(dto | resolver)` and `get<Operation>ResponseMock(overrides)`; error statuses as `application/problem+json` through `http.get|post(...)` with a small `problem(status, code)` helper;
  - cases: success mapping to domain types, request parameters as sent (read in a resolver), a malformed response (`TechnicalError('malformed-response')`, reported once by the adapter), each documented problem `code` mapped to its business error and **not** reported, an unknown 4xx code mapped to a technical error and reported once by the adapter, a 5xx reported exactly once (by the mutator) with its `traceId`, a caller abort passed on and not reported (REACT-OBS-01/04).

  The generated MSW handlers import `@faker-js/faker`, a dev dependency; `npm test` runs `generate:api` first (TS-TOOL-10).

```ts
// adapter/out/http/http-orders.spec.ts (excerpt)
const server = setupServer();
const reportError = mock<ReportErrorUseCase>();
const adapter = new HttpOrders(reportError);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => configureHttp({ timeoutMs: 1_000, onUnauthorized: () => undefined, reportError }));
afterEach(() => { server.resetHandlers(); reportError.report.mockReset(); });
afterAll(() => server.close());

it('turns a server error into a reported technical error with the trace id', async () => {
  server.use(http.get('*/api/v1/orders', () => problem(503)));

  await expect(adapter.loadOrders({ page: 0, size: 20 })).rejects.toBeInstanceOf(TechnicalError);
  expect(reportError.report).toHaveBeenCalledExactlyOnceWith(expect.any(TechnicalError), {
    status: 503,
    traceId: 'trace-1',
  }); // by the mutator; the adapter passes the error on unreported
});
```

## Architecture rules

- **REACT-TEST-17: The architecture canary (TS-ARCH-13) runs as `test/architecture.spec.ts` in the `core` project,** through dependency-cruiser's `cruise()` API with the project's `.dependency-cruiser.cjs`. It cruises a fixture tree under `test/fixtures/arch-violation/src/` (excluded from `tsconfig.json` and ESLint) and asserts at least: a type-only import of generated code into a domain file fails `domain-is-pure`; a routes file that imports the composition statically fails `feature-routes-load-feature-lazily` (REACT-ARCH-20, REACT-ARCH-22); the real sources give no violation. `baseDir` is an **absolute** path (`fileURLToPath(new URL('fixtures/arch-violation', import.meta.url))`).
  *Why:* with a relative `baseDir`, bare imports (`react`, `zod`) stay unresolved and allow-list rules fire by accident, so the fixture can "fail" for the wrong reason.

## E2E with Playwright

- **REACT-TEST-18: (React SPA) The stubbed tier runs against the built `dist/` behind a small CSP server**, never against `vite dev`: `e2e/serve-dist.ts` (plain `node`, type stripping) stands in for the BFF. Per response it replaces the `html.cspNonce` placeholder with a fresh nonce and sends the production CSP with `require-trusted-types-for 'script'; trusted-types 'none'` (REACT-SEC-04, REACT-SEC-05), `Cache-Control: no-store` for the HTML, and **404** for a missing `/assets/*` file (never `index.html`, REL-FE-03). `playwright.config.ts` starts it as `webServer`; `npm run build` runs first (in CI, the job builds before `npm run e2e`).
  *Why:* only the built bundle under the real CSP shows violations from Emotion, zod or lazily loaded chunks; the dev server cannot set a per-response nonce.
- **REACT-TEST-19: All specs use one fixture file, `e2e/fixtures.ts`,** with:
  - a `page` fixture that collects `securitypolicyviolation` events through an init script and asserts after every test that there are none (REACT-SEC-09); (React SPA) it also stubs `/config.json` and the client-error endpoint by default;
  - (React SPA) `stub(operationId, responder)`, typed by an `Operations` map from `operationId` to the generated response model, whose responder returns a model or a `{ status, code?, traceId? }` problem (TS-TEST-10); bodies come from Orval's `get<Operation>ResponseMock(overrides)` factories;
  - `expectAccessible(label)` with the A11Y-05 tags, failing on AA and the adopted AAA rules, attaching all violations, and asserting that `target-size` ran (TS-TEST-12, TS-TEST-21);
  - `expectAnnounced(text)` on `[aria-live]` (TS-TEST-24) and a `consoleErrors` collector.

  `use` sets `locale`, `timezoneId: 'UTC'` and `reducedMotion: 'reduce'`.
- **REACT-TEST-20: (React SPA) The stubbed tier covers the platform flows once per app,** in addition to the main paths, keyboard journeys and request budgets of TS-TEST-13/14:
  - an invalid `/config.json` shows the static start-up message (REACT-CFG-03);
  - a route chunk that answers 404 once leads to exactly two document loads and a working page (REACT-ARCH-21);
  - a 5xx from the API sends exactly one error report with `traceId` and the route template, without query string or personal data (REACT-OBS-01);
  - route title and focus after a link click, a query-only change and back (TS-TEST-26).
- **REACT-TEST-21: `playwright.config.ts` defines the projects of TS-TEST-18 and the scripts of TS-TOOL-10.** T1 (`npm run e2e` = `playwright test --project=stubbed-*`): the default cell `stubbed-expanded`; `stubbed-firefox-expanded` and `stubbed-webkit-expanded`; `stubbed-compact`, `stubbed-medium` and `stubbed-reflow` (`@responsive`); `stubbed-dark` and `stubbed-high-contrast` (`@theme`) and `stubbed-forced-colors` (`@shell`) (TS-TEST-28). T2 (`npm run e2e:nightly`, adds `--project=nightly-*`): `nightly-large`, `nightly-extra-large`, `nightly-compact-landscape`, `nightly-webkit-compact`, `nightly-firefox-compact`. The full-stack tier (`npm run e2e:smoke` = `--project=smoke`) runs `e2e/smoke/*.spec.ts` against `SMOKE_BASE_URL`, a running BFF with the real backend; with that variable set the config starts no local server, and the smoke spec fails fast without it (TS-TEST-10). Stubbed projects ignore `e2e/smoke/`. The theme scans must run in both color schemes, because MUI's default light palette fails the adopted AAA rule `color-contrast-enhanced` while the dark defaults pass; the light theme darkens `primary.main` and `text.secondary` ([react-mui.md](../ui/react-mui.md)). The app-shell spec (`e2e/shell.spec.ts`, `@shell @theme @responsive`) scans the shell and asserts on the keyboard path that the focused navigation link has an outline and `aria-current="page"` (A11Y-28). Checked on 2026-11-21 in Chromium and Firefox (T1 and the non-WebKit nightly projects green); the WebKit projects and the smoke tier are marked "verify before first use" in the config.

```ts
// playwright.config.ts (excerpt; the projects are those of TS-TEST-18, see typescript-e2e.md)
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)
const stubbed = { testIgnore: 'smoke/**' }; // the stubbed tier never runs the real-backend specs
const smokeBaseUrl = process.env['SMOKE_BASE_URL'];

export default defineConfig({
  testDir: 'e2e',
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31
  use: { baseURL: smokeBaseUrl ?? 'http://localhost:4173', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' },
  ...(smokeBaseUrl === undefined && {
    webServer: { command: 'node e2e/serve-dist.ts', url: 'http://localhost:4173/', reuseExistingServer: !process.env['CI'] },
  }),
  projects: [
    { name: 'stubbed-expanded', ...stubbed, use: expanded },
    { name: 'stubbed-dark', ...stubbed, ...themed, use: { ...expanded, colorScheme: 'dark' } },
    { name: 'stubbed-firefox-expanded', ...stubbed, use: { ...expanded, browserName: 'firefox' } },
    // … the other stubbed-* and nightly-* projects of TS-TEST-18 …
    { name: 'smoke', testMatch: 'smoke/**/*.spec.ts', use: expanded },
  ],
});
```

```ts
// e2e/fixtures.ts (excerpt): no CSP or Trusted Types violation in any test
page: async ({ page }, use) => {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations ??= [];
      window.cspViolations.push(`${event.effectiveDirective} ${event.blockedURI} ${event.sample}`);
    });
  });
  await page.route('**/config.json', (route) => route.fulfill({ json: runtimeConfig }));
  await page.route('**/api/client-errors', (route) => route.fulfill({ status: 204 }));
  await use(page);
  expect(await page.evaluate(() => window.cspViolations ?? []), 'CSP / Trusted Types violations').toEqual([]);
},
```

- **REACT-TEST-22: Coverage is reported, not gated** (TEST-ARCH-09). The template ships `@vitest/coverage-v8` (the Vitest version), a `coverage` block in `vitest.config.ts` (`provider: 'v8'`, `include: src/**/*.{ts,tsx}`, generated code excluded, reporters `text-summary` and `lcov`, no threshold) and the script `test:coverage`; `verify` does not run it. The report shows which `domain` and `application` branches no test reaches.

## To verify before first use

Verified with React 19.3, Vitest 5.1, jsdom 31, Testing Library 16.3, user-event 14.6, jest-dom 7.0, MSW 3.0, Orval 8.47, Playwright 1.65 in Chromium and Firefox. Not yet verified, listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use):

- the WebKit projects (`stubbed-webkit-expanded`, `nightly-webkit-compact`) against the CSP server, and the smoke tier against a real BFF (TS-TEST-10/16/18);
- the locale projects (TEST-I18N-02) and per-locale axe (TEST-I18N-03);
- scroll restoration after back in E2E (TS-TEST-26, scroll part);
- the chunk-reload flow for routes split with `.lazy()` instead of `lazyRouteComponent`.

## Skill overrides

| Skill or source | Says | Our rule |
|---|---|---|
| Redux docs "Writing Tests" | Render components with a real store and mock the network with MSW | Real store, but use cases mocked in the feature's context; MSW only in HTTP adapter tests (REACT-TEST-06, REACT-TEST-16) |
| TanStack Query testing docs, `tanstack-query-best-practices` | Wrap hooks in a `QueryClientProvider` and mock `fetch`/the API; default `retry: 3` | `queryFn` calls a use case, which the test mocks; the test `QueryClient` sets `retry: false` (REACT-TEST-05, REACT-TEST-13) |
| Generic React testing habits | `vi.mock('./use-orders')`, mocking hooks, `getByTestId`, snapshotting rendered output | No module mocks of our code (TS-TEST-02), role queries (TS-TEST-07), no component snapshots (TS-TEST-06) |
| `playwright-best-practices`, Vite docs | Run E2E against the dev server or `vite preview` | (React SPA) Built `dist/` behind the CSP server (REACT-TEST-18) |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Testing".*
