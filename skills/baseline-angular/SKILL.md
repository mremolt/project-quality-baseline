---
name: baseline-angular
description: Entry point for any Angular work in a project that uses the quality baseline - creating or editing components, pages, services, routes, guards, forms, Signal Stores, HTTP adapters, styles/theming or Angular tests, and creating new Angular apps. Loads the right skills (angular-developer, ngrx-signals, angular-material-design, orval, accessibility, vitest, playwright-best-practices, baseline-tdd) and applies the baseline's rules, which override those skills. Use it before writing or changing any Angular code.
---

# Angular in the quality baseline

The baseline docs are the rules; skills supply framework know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). All paths below are relative to the project root.

## 1. Read the rules for the task

Never read every doc of the stack up front (TOOL-SKL-10). At the start: the rule index in `docs/baseline/rule-index/` (`shared.md`, `typescript.md`, `angular.md`), one line per rule ID, and `docs/baseline/05-building-block-view/angular.md`, `docs/baseline/05-building-block-view/typescript.md`. Then only the docs of the rows below that match the task; for a rule from a doc you have not read, search the doc for its ID and read that bullet.

| Task | Also read |
|---|---|
| Use case, port, command, domain type | `docs/baseline/05-building-block-view/use-cases.md`, `docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md` |
| Component, page, route, guard, form | `docs/baseline/08-crosscutting-concepts/ui/ui-patterns.md`, `docs/baseline/08-crosscutting-concepts/ui/angular-material.md`, `docs/baseline/10-quality-requirements/accessibility.md` |
| Signal Store | `docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md` |
| HTTP adapter, API client, backend data | `docs/baseline/08-crosscutting-concepts/api/typescript-openapi-clients.md`, `docs/baseline/08-crosscutting-concepts/api/angular-openapi-clients.md`, `docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md` |
| Tests | `docs/baseline/08-crosscutting-concepts/testing/testing-by-architecture-element.md` (element table), `docs/baseline/08-crosscutting-concepts/testing/tdd.md`, `docs/baseline/08-crosscutting-concepts/testing/typescript.md`, `docs/baseline/08-crosscutting-concepts/testing/typescript-e2e.md`, `docs/baseline/08-crosscutting-concepts/testing/angular.md` |
| User-visible text, locales, language switch | `docs/baseline/08-crosscutting-concepts/i18n/i18n.md`, `i18n/angular.md` (only if the project ADR says i18n is in scope, I18N-01) |
| Templates with user data, HTTP/session, headers, third-party scripts | `docs/baseline/08-crosscutting-concepts/security/angular.md`, `security/typescript.md` |
| Runtime configuration, `config.json`, environments | `docs/baseline/08-crosscutting-concepts/configuration/configuration.md`, `configuration/angular.md` (NG-CFG-*) |
| Global error handling, error reporting, source maps | `docs/baseline/08-crosscutting-concepts/observability/observability.md`, `observability/angular.md` (NG-OBS-*) |
| Personal data in the UI, third-party resources, fonts | `docs/baseline/08-crosscutting-concepts/data-protection/data-protection.md` (DP-*), NG-UI-34 |
| Lint, compiler, scripts | `docs/baseline/08-crosscutting-concepts/development/typescript-tooling.md`, `docs/baseline/08-crosscutting-concepts/development/angular-tooling.md` |
| Scripts `check`, `verify` | runner `templates/scripts/verify.mjs`, copied to `frontend/scripts/` (TS-TOOL-19, NG-TOOL-04) |
| ICU, session-timeout warning | templates `templates/src/platform/adapter/` (`icu-transpiler.ts` NG-I18N-01, `session-activity.ts` and `activity-interceptor.ts` NG-SEC-13; idle time shared across tabs, A11Y-29; needs the `CLOCK` token of NG-ARCH-24 in `platform.tokens.ts`) |
| Time, "today", business date | `CLOCK` token and `businessDate()` (NG-ARCH-24, TS-ARCH-22); never `Date.now()`/`new Date()` outside the platform (NG-TOOL-12) |
| Async loads and saves in stores | latest-load feature, updater patches, per-key save queue (NG-STATE-18, TS-ARCH-21); catch only expected errors (TS-ARCH-23) |
| New feature | generate with `templates/scripts/new-feature.mjs` (`.agents/skills/baseline-angular/templates/scripts/` in a project; copy to `frontend/scripts/`, NG-ARCH-23), imports through the aliases of NG-ARCH-22 |
| New app | `docs/baseline/05-building-block-view/angular.md` (NG-ARCH-17), `docs/baseline/08-crosscutting-concepts/development/agent-skills.md` |

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Any Angular code | `angular-developer` |
| New app | `angular-new-app` (with `--style=scss --ai-config=none`, NG-ARCH-17) |
| Signal Store | `ngrx-signals` (our adaptation) |
| UI, theming, layout, navigation, responsive | `angular-material-design` (our adaptation; for any screen or shell also its `references/layout-and-navigation.md`), `accessibility` |
| API clients | `orval` |
| Tests | `baseline-tdd`, `vitest`, `playwright-best-practices`; `playwright-cli` to check the running app |
| Security-relevant change | `baseline-security` |
| Multilingual product (text, locales, formatting) | `baseline-i18n` |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

| Skill habit | Baseline rule |
|---|---|
| `httpResource`/`HttpClient` in components or services used by components | HTTP only in `adapter/out/http`; UI uses its store or `resource()` calling a use case (NG-ARCH-13, TS-ARCH-04) |
| `@Service()` auto-provided everywhere | Use cases are plain classes; adapters use `inject()` and are bound to port tokens with `useExisting` in `<feature>.providers.ts`; tokens in `<feature>.tokens.ts` (NG-ARCH-09/10, TS-ARCH-17) |
| Inline `template:` / `styles:` in components | `templateUrl` + `styleUrl` in dedicated files, always; inline only for test hosts in `*.spec.ts` (NG-ARCH-21) |
| `core/`, `components/` folders | Ring layout per feature (`domain`, `application`, `ports`, `adapter`), `src/platform`, `src/shared/ui` (NG-ARCH-01/04) |
| Store calls an API service | Store calls use-case contracts (NG-STATE-02) |
| Root-provided feature stores | Component/route scope (NG-STATE-12) |
| Harnesses for everything | Testing Library by role; harnesses for Material widgets (NG-TEST-03) |
| Form validators in the component | zod schema from `ports/in` via `validateStandardSchema` (NG-ARCH-16); command factory typed `of(input: z.input<typeof Schema>)`, never `unknown` (TS-ARCH-06) |
| Routes exported from the feature `index.ts`; injecting another feature's tokens | `app.routes.ts` lazy-loads `<feature>.routes.ts`; other features' use cases only via their `provide<Feature>Api()` (TS-ARCH-19/20, NG-ARCH-11) |
| Tailwind, custom widgets | Angular Material + `--mat-sys-*` tokens; CDK/Aria only for gaps (NG-UI-01/02/05) |
| `setViewportSize` loops, 375/768/1920 or `xs`…`2xl` breakpoints | Viewport projects named after the MD3 size classes (NG-UI-09, TS-TEST-17) |
| `ng build` as the final check | `npm run verify`, plus `npm run e2e` for changed screens |

## 4. Workflow

1. **Place it.** Decide the ring and folder for every new file (ARCH-ORG-01, NG-ARCH-01); name it per NG-ARCH-02/03.
2. **N+1 check** for anything that loads data (API-N1-01): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: style per element (London for use cases, stores, pages; Chicago for domain).
4. **Accessibility as you go**: role-queryable elements, labels, focus, contrast tokens; axe in component tests; E2E axe + keyboard journey for changed main paths (A11Y-05).
   **Screen readers as you go**: status messages in a visible `role="status"` region or the app `Announcer`; route `title`, and focus on the new `h1` when the path changes; errors linked to the field; assert with `getByRole` options and `toHaveAccessible*` (A11Y-20..23, NG-UI-30..33, TS-TEST-23..26); see `angular-material-design/references/screen-readers.md`.
   **Responsive as you go**: state the screen's layout for compact, medium and expanded (NG-UI-23); keep `WindowSize` in the UI adapter (NG-UI-19); tag main-screen E2E specs `@responsive` (TS-TEST-18).
5. **Security as you go**: no `bypassSecurityTrust*`/`innerHTML` with data, no tokens in the browser, relative mutating calls (NG-SEC-01/02/07/08); E2E asserts payload, headers, XSRF (NG-SEC-12).
6. **Shortcuts**: if you need one (e.g. skipping a use case for trivial CRUD), propose it and draft an ADR; never take it silently (ARCH-SC-06).
7. **Finish** with `npm run verify` green and `npm run e2e` green for the specs that cover changed screens (axe, keyboard journeys, reflow, request budgets and locale projects run only there), and no architecture test, lint rule or a11y rule loosened. On a red gate run `npm run format` and `npm run lint:fix` first and hand-fix only what remains (TOOL-SKL-15).
8. **Self-review** against the agent checklist sections of the docs you used (`docs/baseline/checklists/`, TOOL-SKL-13).
