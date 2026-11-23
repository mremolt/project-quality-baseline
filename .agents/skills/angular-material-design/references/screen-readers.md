# Screen readers in an Angular Material app: code

The rules are in the docs and win over this file: requirements A11Y-19..25 and the L6 release checklist
(`docs/baseline/10-quality-requirements/accessibility.md`), mechanisms NG-UI-30..33 and 35
(`docs/baseline/08-crosscutting-concepts/ui/angular-material.md`), assertions NG-TEST-12..14
(`docs/baseline/08-crosscutting-concepts/testing/angular.md`) and TS-TEST-23..27
(`docs/baseline/08-crosscutting-concepts/testing/typescript-e2e.md`). This file only holds the code.
Cite rule ids.

## Announcer (NG-UI-30)

```ts
// src/shared/ui/a11y/announcer.ts
@Injectable({ providedIn: 'root' })
export class CdkAnnouncer {
  private readonly live = inject(LiveAnnouncer);
  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): Promise<void> {
    return this.live.announce(message, politeness); // CDK writes after a 100 ms timer: don't "fix" it
  }
}

/** The contract UI adapters inject; tests use mock<Announcer>() (NG-TEST-12). */
@Injectable({ providedIn: 'root', useExisting: CdkAnnouncer })
export abstract class Announcer {
  abstract announce(message: string, politeness?: 'polite' | 'assertive'): Promise<void>;
}
```

## Route focus (NG-UI-31)

```ts
// src/platform/adapter/in/ui/route-focus.ts
@Injectable({ providedIn: 'root' })
export class RouteFocus {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  start(): void {
    let previousPath: string | undefined;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        const extras = this.router.lastSuccessfulNavigation()?.extras; // a property before Angular 21
        const keepFocus = extras?.replaceUrl === true || extras?.state?.['keepFocus'] === true; // canonical URL, same-route pager
        const moveFocus = previousPath !== undefined && path !== previousPath && !keepFocus; // not on first load, not on query-only changes
        previousPath = path;
        if (!moveFocus) return;
        afterNextRender(
          () => (document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main'))
            ?.focus({ preventScroll: true }), // back/forward too; scroll restoration keeps the position
          { injector: this.injector },
        );
      });
  }
}
```

```ts
// app.config.ts
provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
// app.ts (shell)
constructor() { inject(RouteFocus).start(); }
// same-route pager: focus stays on the button, the new period is announced (A11Y-21)
void this.router.navigate(['/week', next], { state: { keepFocus: true } });
this.announcer.announce(this.transloco.translate('week.shown', { week: label }));
```

```html
<h1 tabindex="-1">Orders</h1>
<a mat-list-item routerLink="/orders" routerLinkActive ariaCurrentWhenActive="page">Orders</a>
```

## Form errors (A11Y-22)

```ts
const email = screen.getByRole('textbox', { name: 'Email' });
expect(email).toBeInvalid();
expect(email).toHaveAccessibleDescription(/required/i); // Material uses aria-describedby, not aria-errormessage
```

## Dialog with a vanishing trigger (NG-UI-33)

```ts
this.dialog.open(ConfirmDelete).afterClosed().subscribe(() => this.listHeading().nativeElement.focus());
```

## Tests

```ts
// component test: announcement as a command (NG-TEST-12)
const announcer = mock<Announcer>();
await render(OrderHistoryPage, { providers: [{ provide: Announcer, useValue: announcer }, ...useCaseMocks] });
// … act …
expect(announcer.announce).toHaveBeenCalledWith('Order o-1 cancelled');

// RouteFocus: one test, two navigations (NG-TEST-13)
const harness = await RouterTestingHarness.create();
TestBed.inject(RouteFocus).start();
await harness.navigateByUrl('/orders');
expect(document.activeElement).toBe(document.body);
await harness.navigateByUrl('/orders/o-1');
expect(document.activeElement).toBe(harness.routeNativeElement?.querySelector('h1'));
await harness.navigateByUrl('/orders/o-1?tab=items');
// focus unchanged

// component test: snackbar through its harness (NG-TEST-14)
const snackBar = await loader.getHarness(MatSnackBarHarness);
expect(await snackBar.getAriaLive()).toBe('polite');
```

E2E examples for title, focus, back/forward and the ARIA snapshots of shell and screen are in TS-TEST-26 and
TS-TEST-25. Before building a custom widget (NG-UI-02), check the APG pattern's assistive-technology support
table (w3.org/WAI/ARIA/apg/about/at-support-tables/).
