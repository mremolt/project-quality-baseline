# Angular Testing

Angular specifics on top of [typescript/testing.md](../typescript/testing.md): the Vitest runner of the Angular CLI, zoneless component tests, Testing Library with Material harnesses, stores, routing and Playwright.

## Element → test

| Element | Test | Setup |
|---|---|---|
| `domain`, `application` | Unit (Vitest), no `TestBed` | Plain classes; ports via `mock<Port>()` |
| Presentational component (`shared/ui`, small feature components) | Component test | Testing Library `render` with inputs; assert rendering and outputs |
| Page / container component with its store | UI adapter integration test | Real store + real child components, **use-case tokens mocked** |
| Signal Store with real logic | Store test | `TestBed` + mocked use-case tokens ([state-management.md](state-management.md)) |
| Routes, guards, resolvers | Router test | `RouterTestingHarness`, mocked use cases |
| `adapter/out/http` | Adapter integration | `TestBed` with `provideHttpClient()` + MSW (Orval handlers) |
| Main user paths | Playwright E2E | Two tiers, axe, keyboard journeys, request budgets |

## Rules

- **NG-TEST-01: Unit and component tests run with Vitest through the Angular CLI** (`ng test`, unit-test builder). Vitest options go into the builder configuration or the runner config file it points to, not into a free-standing Vite setup.
- **NG-TEST-02: Tests are zoneless: act → `await fixture.whenStable()` → assert.** No `fixture.detectChanges()`, no `fakeAsync`/`tick` in new tests. Update state through inputs, signals or DOM events.
- **NG-TEST-03: Component tests use `@testing-library/angular`** with role queries and `user-event` (TS-TEST-07/08). Material composite widgets (select, autocomplete, date picker, table, sort, paginator, menu) are driven through their harnesses (NG-UI-17), loaded from the fixture that `render` returns.
- **NG-TEST-04: Page tests mock use cases, not the store.** The store and the components form one incoming adapter; the boundary to mock is the incoming port (TEST-ARCH-03, TEST-TDD-07). Small presentational components are tested through their inputs and outputs alone.
- **NG-TEST-05: Every component test file runs axe on its main states** (TS-TEST-09), including opened overlays: Material renders overlays outside the component host, so scan `document.body` for those states.
- **NG-TEST-06: Router behavior is tested with `RouterTestingHarness`** against the real route config of the feature, with use cases mocked.
- **NG-TEST-07: E2E tests locate overlays by role** (`getByRole('dialog')`, `getByRole('listbox')`, `getByRole('option', { name })`), never by `.cdk-overlay-container` or `.mat-mdc-*` classes.
- **NG-TEST-08: The stubbed E2E tier serves the app with `ng serve`** (or the built app) and stubs `/api/**` through the typed fixture (TS-TEST-10); the smoke tier runs against the deployed or containerized backend.

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

    const status = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Status"]' }));
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

## Agent checklist

- [ ] Right test type for the element (table above)?
- [ ] Zoneless pattern, no `detectChanges`/`fakeAsync` in new tests?
- [ ] Use cases mocked at the token, not the store?
- [ ] Material widgets via harnesses, everything else by role?
- [ ] axe on main states including overlays?

## Sources

Angular testing guide (angular.dev/guide/testing), `angular-developer` skill references (testing-fundamentals, component-harnesses, router-testing), Testing Library for Angular (testing-library.com/docs/angular-testing-library/intro), Angular CDK testing harnesses (material.angular.dev/cdk/testing/overview).
