---
name: baseline-angular
description: Entry point for any Angular work in a project that uses the quality baseline - creating or editing components, pages, services, routes, guards, forms, Signal Stores, HTTP adapters, styles/theming or Angular tests, and creating new Angular apps. Loads the right skills (angular-developer, ngrx-signals, angular-material-design, orval, accessibility, vitest, playwright-best-practices, baseline-tdd) and applies the baseline's rules, which override those skills. Use it before writing or changing any Angular code.
---

# Angular in the quality baseline

The baseline docs are the rules; skills supply framework know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). All paths below are relative to the project root.

## 1. Read the rules for the task

Always: `docs/angular/README.md`, `docs/angular/architecture.md`, `docs/typescript/frontend-architecture.md`.

| Task | Also read |
|---|---|
| Use case, port, command, domain type | `docs/shared/architecture/use-cases.md`, `docs/shared/architecture/mapping-between-boundaries.md` |
| Component, page, route, guard, form | `docs/angular/ui-material.md`, `docs/shared/accessibility/wcag.md` |
| Signal Store | `docs/angular/state-management.md` |
| HTTP adapter, API client, backend data | `docs/typescript/openapi-clients.md`, `docs/shared/api/avoiding-n-plus-one.md` |
| Tests | `docs/shared/testing/tdd.md`, `docs/typescript/testing.md`, `docs/angular/testing.md` |
| Lint, compiler, scripts | `docs/typescript/tooling.md`, `docs/angular/tooling.md` |
| New app | `docs/angular/architecture.md` (NG-ARCH-17), `docs/shared/tooling/agent-skills.md` |

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Any Angular code | `angular-developer` |
| New app | `angular-new-app` (with `--style=scss --ai-config=none`, NG-ARCH-17) |
| Signal Store | `ngrx-signals` (our adaptation) |
| UI, theming, layout, navigation | `angular-material-design` (our adaptation), `accessibility` |
| API clients | `orval` |
| Tests | `baseline-tdd`, `vitest`, `playwright-best-practices`; `playwright-cli` to check the running app |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

| Skill habit | Baseline rule |
|---|---|
| `httpResource`/`HttpClient` in components or services used by components | HTTP only in `adapter/out/http`; UI uses its store or `resource()` calling a use case (NG-ARCH-13, TS-ARCH-04) |
| `@Service()` auto-provided everywhere | Use cases are plain classes; adapters bound to port tokens in `<feature>.providers.ts` (NG-ARCH-09/10) |
| `core/`, `components/` folders | Ring layout per feature (`domain`, `application`, `ports`, `adapter`), `src/platform`, `src/shared/ui` (NG-ARCH-01/04) |
| Store calls an API service | Store calls use-case contracts (NG-STATE-02) |
| Root-provided feature stores | Component/route scope (NG-STATE-12) |
| Harnesses for everything | Testing Library by role; harnesses for Material widgets (NG-TEST-03) |
| Form validators in the component | zod schema from `ports/in` via `validateStandardSchema` (NG-ARCH-16) |
| Tailwind, custom widgets | Angular Material + `--mat-sys-*` tokens; CDK/Aria only for gaps (NG-UI-01/02/05) |
| `ng build` as the final check | `npm run verify` |

## 4. Workflow

1. **Place it.** Decide the ring and folder for every new file (ARCH-ORG-01, NG-ARCH-01); name it per NG-ARCH-02/03.
2. **N+1 check** for anything that loads data (API-N1-01): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: style per element (London for use cases, stores, pages; Chicago for domain).
4. **Accessibility as you go**: role-queryable elements, labels, focus, contrast tokens; axe in component tests; E2E axe + keyboard journey for changed main paths (A11Y-05).
5. **Shortcuts**: if you need one (e.g. skipping a use case for trivial CRUD), propose it and draft an ADR; never take it silently (ARCH-SC-06).
6. **Finish** with `npm run verify` green, and no architecture test, lint rule or a11y rule loosened.
