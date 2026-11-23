# Angular Testing

Angular specifics on top of [typescript.md](typescript.md) and [typescript-e2e.md](typescript-e2e.md): the Vitest runner of the Angular CLI, zoneless component tests, Testing Library with Material harnesses, stores, routing and Playwright.

## Element → setup

Test type, style and doubles: [element table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element). The Angular setup per element:

| Element | Setup |
|---|---|
| `domain`, `application` | Vitest without `TestBed`; plain classes; ports via `mock<Port>()` |
| Presentational component (`shared/ui`, small feature components) | Testing Library `render` with inputs; assert rendering and outputs |
| Page / container component with its store | Real store + real child components, **use-case tokens mocked** |
| Signal Store with real logic | `TestBed` + mocked use-case tokens ([angular-state-management.md](../ui/angular-state-management.md)) |
| Routes, guards, resolvers | `RouterTestingHarness`, mocked use cases |
| `adapter/out/http` | `TestBed` with `provideHttpClient()` + MSW (Orval handlers), `REPORT_ERROR` as `mock<ReportErrorUseCase>()`: one report for a malformed body and for an unknown problem `code`, none for an error the adapter passes on (NG-OBS-04) |
| Main user paths | Frontend system test (TS-TEST-10 stubbed tier); critical paths as full-stack smoke |

## Rules

- **NG-TEST-01: Unit and component tests run with Vitest through the Angular CLI** (`ng test`, unit-test builder). Vitest options go into the builder configuration or the runner config file it points to, not into a free-standing Vite setup.
- **NG-TEST-02: Tests are zoneless: act → `await fixture.whenStable()` → assert.** No `fixture.detectChanges()`, no `fakeAsync`/`tick` in new tests. Update state through inputs, signals or DOM events.
- **NG-TEST-03: Component tests use `@testing-library/angular`** with role queries and `user-event` (TS-TEST-07/08). Material composite widgets (select, autocomplete, date picker, table, sort, paginator, menu) are driven through their harnesses (NG-UI-17), loaded from the fixture that `render` returns.
- **NG-TEST-04: Page tests mock use cases, not the store.** The store and the components form one incoming adapter; the boundary to mock is the incoming port (TEST-ARCH-03, TEST-TDD-07). Small presentational components are tested through their inputs and outputs alone.
- **NG-TEST-05: Every component test file runs axe on its main states** (TS-TEST-09), including opened overlays: Material renders overlays outside the component host, so scan `document.body` for those states.
- **NG-TEST-06: Router behavior is tested with `RouterTestingHarness`** against the real route config of the feature, with use cases mocked.
- **NG-TEST-07: E2E tests locate overlays by role** (`getByRole('dialog')`, `getByRole('listbox')`, `getByRole('option', { name })`), never by `.cdk-overlay-container` or `.mat-mdc-*` classes.
- **NG-TEST-08: The stubbed E2E tier serves the app with `ng serve`** (or the built app) and stubs `/api/**` through the typed fixture (TS-TEST-10); the smoke tier runs against the deployed or containerized backend.
- **NG-TEST-09: A component whose structure changes with the window size gets one component test per variant.** `WindowSize` is replaced by a stub whose size class is a writable signal, and assertions are by role and name, not by CSS. `WindowSize` is a contract we own (an abstract class in `src/shared/ui/layout`, NG-UI-19), so stubbing it follows TEST-TDD-07.
  *Why:* jsdom can render the component tree for a size class, but it can't lay it out.
- **NG-TEST-10: The `WindowSize` implementation is tested as a pure function plus the service with a fake `MediaMatcher`.** The tests cover the boundary widths 599 / 600, 839 / 840, 1199 / 1200 and 1599 / 1600.
  *Why:* off-by-one at a breakpoint is the typical bug; the CDK designed `MediaMatcher` to be faked.
- **NG-TEST-11: CSS-only responsive behavior (media and container queries) is not asserted in jsdom**: no layout assertions on `getComputedStyle` or `getBoundingClientRect`. The E2E viewport projects cover it ([TS-TEST-17](typescript-e2e.md#matrix)); real-browser component tests (Vitest browser mode) are not used for now.
  *Why:* jsdom has no layout, so such tests pass without testing anything.
- **NG-TEST-12: Announcements are verified as commands in component and page tests:** the app `Announcer` (NG-UI-30), a contract we own (abstract class, CDK implementation behind it), is provided as `mock<Announcer>()` and `announce` is verified with the message (TS-TEST-03); visible status regions are asserted by role (A11Y-20). No `fakeAsync` to flush the CDK 100 ms announcer timer (NG-TEST-02).
  *Why:* deterministic; the CDK `LiveAnnouncer` writes its text after a timer that Angular does not track as a pending task, so `whenStable()` in a zoneless test returns before the text is there.
- **NG-TEST-13: Route titles and the route focus service are tested at the level that can see them** (A11Y-21): each feature's router test (NG-TEST-06) asserts `Title.getTitle()` after `navigateByUrl`; the `TitleStrategy` formatting is a plain unit test; the app-wide `RouteFocus` service (NG-UI-31) has one test with two navigations (the first moves no focus, a path change focuses the `h1`, a query-only change and a `replaceUrl` or `keepFocus` navigation don't). Focus per route is asserted in E2E (TS-TEST-26).
  *Why:* the service ignores the first navigation, so a per-route test with a single navigation can't see it move focus.
- **NG-TEST-14: Material status and error behavior is asserted through harnesses and the accessible description:** `MatSnackBarHarness` (`getAriaLive`, `hasAction`, message); form-field errors with `toHaveAccessibleDescription` on the control plus `aria-invalid` (A11Y-22). Material writes error ids into `aria-describedby`, so `toHaveAccessibleErrorMessage` (which checks `aria-errormessage`) would fail.

```ts
// a page with a list-detail layout (NG-TEST-09)
const sizeClass = signal<WindowSizeClass>('compact');
const windowSize = { sizeClass, atLeastMedium: computed(() => sizeClass() !== 'compact'), atLeastExpanded: computed(() => !['compact', 'medium'].includes(sizeClass())) };

const { fixture } = await render(OrderBrowser, { providers: [{ provide: WindowSize, useValue: windowSize }, ...useCaseMocks] });
expect(screen.queryByRole('region', { name: 'Order details' })).toBeNull();

sizeClass.set('expanded');
await fixture.whenStable();
expect(screen.getByText('Select an order to see its details.')).toBeVisible();
```

## Example: page test

```ts
// adapter/in/ui/order-history-page.spec.ts
describe('OrderHistoryPage', () => {
  const loadHistory = mock<LoadOrderHistoryUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();

  async function renderPage() {
    return render(OrderHistoryPage, {
      providers: [
        { provide: LOAD_ORDER_HISTORY, useValue: loadHistory },
        { provide: CANCEL_ORDER, useValue: cancelOrder },
      ],
    });
  }

  it('lets the user cancel an open order', async () => {
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1')]);
    cancelOrder.cancelOrder.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { fixture } = await renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cancel order o-1' }));
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await fixture.whenStable();

    expect(cancelOrder.cancelOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o-1' }));
    expect(screen.getByRole('status')).toHaveTextContent('Order o-1 cancelled');
    await expectNoAxeViolations(document.body);
  });

  it('filters by status with the Material select', async () => {
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1'), aShippedOrder('o-2')]);
    const { fixture } = await renderPage();
    const loader = TestbedHarnessEnvironment.loader(fixture);

    const status = await loader.getHarness(MatSelectHarness.with({ label: 'Status' })); // the mat-label, not a CSS selector
    await status.clickOptions({ text: 'Shipped' });

    expect(screen.getAllByRole('row', { name: /o-\d/ })).toHaveLength(1);
  });
});
```

## Skill overrides (`angular-developer`)

| Skill says | Our rule |
|---|---|
| Component harnesses as the standard way to interact with all components | Testing Library by role; harnesses for Material composite widgets (NG-TEST-03) |
| E2E frameworks: Cypress, Nightwatch, WebdriverIO, Puppeteer, Playwright | Playwright only |
| Test examples use `TestBed` + `querySelector` | Testing Library queries; `querySelector` only for non-semantic structure checks |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular Testing".*
