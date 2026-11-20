# Angular

Rules for Angular frontends. They implement the shared docs and the TypeScript docs ([../typescript/](../typescript/README.md)) and may tighten them, never contradict them.

| Doc | Covers | Rule IDs |
|---|---|---|
| [architecture.md](architecture.md) | Project layout, naming, DI and wiring, HTTP, routing, forms, setup | `NG-ARCH-*` |
| [state-management.md](state-management.md) | NgRx Signal Store as view state of the UI adapter | `NG-STATE-*` |
| [ui-material.md](ui-material.md) | Angular Material, Material Design 3, theming, layout, a11y in the UI | `NG-UI-*` |
| [testing.md](testing.md) | Vitest via the CLI, zoneless tests, Testing Library + harnesses, E2E | `NG-TEST-*` |
| [tooling.md](tooling.md) | Compiler options, angular-eslint, `@ngrx/eslint-plugin`, CLI scripts | `NG-TOOL-*` |

## Stack at a glance

Angular (current major, standalone, signals, zoneless) · Angular Material + CDK (Material Design 3) · NgRx Signal Store · Signal Forms + zod · Orval-generated HTTP clients · Vitest + vitest-mock-extended + Testing Library · Playwright + axe · ESLint (typescript-eslint type-checked, SonarJS, import-x, simple-import-sort, angular-eslint, NgRx) · Prettier 120 · dependency-cruiser.

## Skills for Angular work

Load these when creating or editing Angular code (the `baseline-angular` skill does this for you):

| Skill | For |
|---|---|
| `angular-developer` (official) | Angular APIs and idioms |
| `angular-new-app` (official) | Creating a new app (with the flags from NG-ARCH-17) |
| `ngrx-signals` (own) | Signal Stores |
| `angular-material-design` (own) | Angular Material, theming, layout, navigation |
| `accessibility` | WCAG 2.2 know-how |
| `vitest`, `playwright-best-practices`, `playwright-cli` | Tests and browser checks |
| `orval` | Generated API clients |
| `baseline-tdd` (own) | Test-first workflow |

**Where a skill and these docs disagree, the docs win.** Known conflicts are listed in the "Skill overrides" table of each doc: [architecture](architecture.md#skill-overrides-angular-developer-angular-new-app), [state management](state-management.md#skill-overrides-ngrx-signals-original-by-danielsogl), [UI](ui-material.md#skill-overrides), [testing](testing.md#skill-overrides-angular-developer), [TS testing](../typescript/testing.md#skill-overrides), [API clients](../typescript/openapi-clients.md#skill-overrides-orval-skill).
