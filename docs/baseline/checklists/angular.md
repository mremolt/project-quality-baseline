# Agent checklists: angular

The agent checklists of the angular docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Angular: Architecture and Project Structure

[05-building-block-view/angular.md](../05-building-block-view/angular.md)

- [ ] File in the right ring and folder; suffixless Angular naming? New feature from the generator, cross-ring imports through the aliases (NG-ARCH-22/23)?
- [ ] Signal APIs, `inject()`, control flow; no `NgModule`, no constructor DI?
- [ ] Template and styles in dedicated `.html` / `.scss` files, no inline `template:` or `styles:` outside spec test hosts (NG-ARCH-21)?
- [ ] Use cases plain, wired in `<feature>.providers.ts`; adapters use `inject()` and are bound with `useExisting`; tokens in `<feature>.tokens.ts`?
- [ ] No `HttpClient`/`httpResource`/generated client outside `adapter/out/http`?
- [ ] Forms validated with the command's zod schema, its messages translation codes (NG-ARCH-16); the factory typed `z.input<typeof Schema>`?
- [ ] Feature routes loaded lazily from `app.routes.ts`, not via `index.ts`; another feature's use cases only via its `provide<Feature>Api()`?
- [ ] Failed chunk load reloads once, guarded by the release version (NG-ARCH-20)?
- [ ] N+1 check done?
- [ ] Time from the `CLOCK` token, business date from `businessDate()` in the platform, zone declared once (NG-ARCH-24)?

## Generated API Clients in Angular

[08-crosscutting-concepts/api/angular-openapi-clients.md](../08-crosscutting-concepts/api/angular-openapi-clients.md)

- [ ] `client: 'angular'` with `provideIn: false` and `urlEncodeParameters: true`; generated services listed in the providers file?
- [ ] Observables converted with `untilAborted`, never `firstValueFrom` alone or `toPromise`?
- [ ] Responses parsed with `safeParse`; a malformed body and an unmappable 4xx reported once through `REPORT_ERROR`, errors from a 5xx, status 0 or time-out passed on unreported (TS-API-05, TS-ARCH-18, NG-OBS-04)?

## Angular: Runtime Configuration

[08-crosscutting-concepts/configuration/angular.md](../08-crosscutting-concepts/configuration/angular.md)

- [ ] No `fileReplacements` or per-environment build configuration (NG-CFG-01)?
- [ ] New value: added to the schema, the server's `app.frontend.*` record (NestJS: `FRONTEND_*` schema) and its test, public only (NG-CFG-03/05, SPRING-CFG-10, NEST-CFG-11)?
- [ ] Read through `RUNTIME_CONFIG` in an adapter or providers file, never in the core (NG-CFG-04)?
- [ ] Tests provide the token or stub `/config.json`?

## Angular Tooling

[08-crosscutting-concepts/development/angular-tooling.md](../08-crosscutting-concepts/development/angular-tooling.md)

- [ ] Strict template checking green, extended diagnostics clean; browser matrix re-checked on a new major (NG-TOOL-10)?
- [ ] No `httpResource` outside the HTTP adapter, no classic `@ngrx/store`?
- [ ] Template a11y rules green without new disables?
- [ ] Security lint rules green, `bypassSecurityTrust*` not suppressed?
- [ ] No developer-preview or experimental API outside the allow-list (NG-TOOL-09)?
- [ ] No `no-extraneous-class` or `unbound-method` switched off (NG-TOOL-11)? Bundle budget warning set from the first feature build + 10 %, a warning fixed in the same step, every raise recorded in chapter 10 (NG-TOOL-05)?
- [ ] `check` and `verify` run through `scripts/verify.mjs` (NG-TOOL-04, TS-TOOL-19)?
- [ ] `npm run verify` green?
- [ ] `tsconfig.e2e.json` in `typecheck`, `e2e/**` and `e2e-smoke/**` in `lintFilePatterns` (NG-TOOL-04); wall-clock selectors banned outside `platform.tokens.ts` and specs (NG-TOOL-12)?

## Angular: Internationalization

[08-crosscutting-concepts/i18n/angular.md](../08-crosscutting-concepts/i18n/angular.md)

- [ ] ICU through the eval-free `IcuTranspiler`, no `@jsverse/transloco-messageformat` (NG-I18N-01)?
- [ ] Every new user-visible string, including `aria-label` and `title`, uses a key with context (NG-I18N-03/05)?
- [ ] Stores and mappers return codes or keys only (NG-I18N-04)? Scope catalogs without a root key, route titles in the shell catalog (NG-I18N-13)?
- [ ] No `translate()` in a `computed` for a lazy scope; texts built in the template (NG-I18N-14)?
- [ ] Money, dates and sorting go through the shared pipes or `Intl` with the active locale (NG-I18N-08)?
- [ ] `lang`, `dir`, formatting pipes and Material locale follow the active-language signal (NG-I18N-07)?
- [ ] Formatting pipes impure with a per-locale cache or pure with the locale as an argument; language-switch test (NG-I18N-08, TEST-I18N-08)?
- [ ] Layout checked in the pseudo-locale; logical properties only (NG-I18N-11)?

## Angular: Error Reporting and Correlation

[08-crosscutting-concepts/observability/angular.md](../08-crosscutting-concepts/observability/angular.md)

- [ ] New error path: ends in `GlobalErrorHandler` / `ReportErrorUseCase`, no direct SDK call (NG-OBS-01/02)?
- [ ] New HTTP adapter: errors flow through the platform interceptor, problem `code`s mapped to domain errors, the rest to `TechnicalError`; the `TechnicalError`s it creates (malformed body, a 4xx it cannot map) reported once through `REPORT_ERROR`, those from a 5xx, a network failure or a time-out passed on unreported (NG-OBS-04, TS-ARCH-18)?
- [ ] Reporting reached through the `REPORT_ERROR` token only (NG-OBS-02)?
- [ ] Report fields: route template and ids only, no personal data (NG-OBS-05)?
- [ ] Build change: source maps still hidden, uploaded and removed (NG-OBS-06)?

## Angular: Security

[08-crosscutting-concepts/security/angular.md](../08-crosscutting-concepts/security/angular.md)

- [ ] No `bypassSecurityTrust*`, `innerHTML` with data, or DOM write outside an adapter?
- [ ] Mutating HTTP calls relative, XSRF interceptor intact, no token handling in the SPA?
- [ ] CSP/header change: still strict (nonce in `script-src` and `style-src`, `base-uri 'self'`, Trusted Types incl. `angular#components`, report destination), `index.html` uncached, no `autoCsp`, E2E assertion updated (deep-link reload included)?
- [ ] New third-party script or font: nonce or trusted loader plus SRI, hosts in the matching non-script directive, or self-hosted?
- [ ] zod jitless module imported first in `main.ts` (TS-SEC-09)?
- [ ] BFF nonce templating: placeholders replaced, `nonce` added only where missing, tested against a real build's `index.html` (NG-SEC-06)?
- [ ] Session-timeout warning driven by the last backend answer and the configured idle seconds (NG-SEC-13)?
- [ ] Guards treated as UX; backend enforces the rule?

## Angular Testing

[08-crosscutting-concepts/testing/angular.md](../08-crosscutting-concepts/testing/angular.md)

- [ ] Right test type for the element ([element table](../08-crosscutting-concepts/testing/testing-by-architecture-element.md#test-type-style-and-doubles-per-element)) and the setup above?
- [ ] Zoneless pattern, no `detectChanges`/`fakeAsync` in new tests?
- [ ] Use cases mocked at the token, not the store?
- [ ] HTTP adapter test: exactly one report for a malformed body and for an unknown problem `code`, none for a passed-on error (NG-OBS-04, TS-ARCH-18)?
- [ ] Material widgets via harnesses, everything else by role?
- [ ] axe on main states including overlays?
- [ ] Announcements verified on a mocked `Announcer`; route titles in router tests, `RouteFocus` with two navigations; Material errors via accessible description?
- [ ] One component test per size-class variant with a stubbed `WindowSize`; no layout assertions in jsdom?

## Angular UI: Angular Material and Material Design 3

[08-crosscutting-concepts/ui/angular-material.md](../08-crosscutting-concepts/ui/angular-material.md)

- [ ] Material component used where one exists; gap components built from CDK/Aria with a keyboard test?
- [ ] Only `--mat-sys-*`, `--app-space-*`/`--app-motion-*` and the one `--app-color-*` family (light, dark, high contrast) in styles; runtime values through a host-bound custom property; no `.mat-mdc-*` or `::ng-deep` (NG-UI-05)?
- [ ] Fixed-colour panels and state-by-background components have a `forced-colors` rule (NG-UI-07)? Shared components never span grid columns themselves (NG-UI-22)?
- [ ] Date inputs through `provideDateFnsAdapter` with per-locale parse formats, typed-date harness test (NG-UI-36)?
- [ ] Focusable unavailable buttons and form controls bound with `[disabled]` + `disabledInteractive` or `[aria-disabled]`, never `[attr.aria-disabled]`; an unavailable checkbox or select shows its reason, no value silently ignored (NG-UI-37)?
- [ ] Works in light, dark and high contrast; density doesn't shrink targets below 24 px?
- [ ] Labels, errors, icon-button names, dialog focus handled?
- [ ] Status via visible region or `Announcer`; route `title`; `RouteFocus` only on path changes; snackbar, spinner and table labelled; dialog focus restored when the trigger can vanish?
- [ ] Loading, empty and error states from the shared components (NG-UI-35)?
- [ ] Harnesses for Material widgets in tests; theme projects cover the screen (TS-TEST-28)?
- [ ] Framework-neutral UI rules met ([ui-patterns.md](../08-crosscutting-concepts/ui/ui-patterns.md) checklist): layout per size class, `WindowSize` only for structure, logical properties, `dvh`, no hover-only function, zoom not blocked?
- [ ] Fonts and icons self-hosted, no Google Fonts link (NG-UI-34)?
- [ ] Route tabs are a `nav` with router links and `ariaCurrentWhenActive`, not `mat-tab-nav-bar` (UI-22)?

## Angular State Management: NgRx Signal Store

[08-crosscutting-concepts/ui/angular-state-management.md](../08-crosscutting-concepts/ui/angular-state-management.md)

- [ ] Store in `adapter/in/ui`, injecting only use-case tokens (from `<feature>.tokens.ts`, never the providers file)?
- [ ] Error mapper provided in `<feature>.providers.ts`, not root; no `adapter/out` or deep platform imports?
- [ ] No DTOs, no HTTP, no other stores, no business rules in the store?
- [ ] Scoped to component/route unless genuinely app-wide?
- [ ] Shared store parts as exported `signalStoreFeature` constants (NG-STATE-16); effects track only their triggers, the body in `untracked` (NG-STATE-17)?
- [ ] Loads through the shared latest-load feature (or `rxMethod` + `switchMap`), aborted on destroy; `patchState` with an updater after an `await`; per-key save queue; store test with an older response resolving last (NG-STATE-18)?
- [ ] Error and rollback paths tested with mocked use cases; the store holds error keys, not text?
