# Angular

Rules for Angular frontends. They implement the shared docs and the TypeScript docs ([stacks/typescript.md](typescript.md)) and may tighten them, never contradict them. Stack at a glance: [04-solution-strategy/angular.md](../04-solution-strategy/angular.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [typescript](../rule-index/typescript.md), [angular](../rule-index/angular.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/angular.md](../05-building-block-view/angular.md) | Project layout, naming, DI and wiring, HTTP, routing, forms, setup, `CLOCK` token and business date | `NG-ARCH-*` |
| [08-crosscutting-concepts/ui/angular-state-management.md](../08-crosscutting-concepts/ui/angular-state-management.md) | NgRx Signal Store as view state of the UI adapter, latest-load and per-key saves | `NG-STATE-*` |
| [08-crosscutting-concepts/ui/angular-material.md](../08-crosscutting-concepts/ui/angular-material.md) | Angular Material, Material Design 3, theming, the Angular mechanisms of the UI patterns (layout, route focus, loading/empty/error states; shared: [ui-patterns.md](../08-crosscutting-concepts/ui/ui-patterns.md)), a11y in the UI | `NG-UI-*`, `UI-*` |
| [08-crosscutting-concepts/api/angular-openapi-clients.md](../08-crosscutting-concepts/api/angular-openapi-clients.md) | Orval `angular` client, `provideIn: false`, `untilAborted`, adapter example (shared: [typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)) | `TS-API-*` |
| [08-crosscutting-concepts/security/angular.md](../08-crosscutting-concepts/security/angular.md) | Template and DOM safety, CSP (`base-uri 'self'`, report endpoint) and Trusted Types (incl. `angular#components`), XSRF with the BFF, SSR, security E2E tests | `NG-SEC-*` |
| [08-crosscutting-concepts/i18n/angular.md](../08-crosscutting-concepts/i18n/angular.md) | Transloco, catalogs and keys, locale and formatting, language switch (shared rules: [i18n.md](../08-crosscutting-concepts/i18n/i18n.md)) | `NG-I18N-*`, `I18N-*` |
| [08-crosscutting-concepts/testing/angular.md](../08-crosscutting-concepts/testing/angular.md) | Vitest via the CLI, zoneless tests, Testing Library + harnesses, E2E | `NG-TEST-*` |
| [08-crosscutting-concepts/development/angular-tooling.md](../08-crosscutting-concepts/development/angular-tooling.md) | Compiler options, browser matrix through the CLI, angular-eslint, `@ngrx/eslint-plugin`, Prettier template parser, CLI scripts, preview-API allow-list, wall-clock ban | `NG-TOOL-*` |
| [08-crosscutting-concepts/configuration/angular.md](../08-crosscutting-concepts/configuration/angular.md) | Runtime configuration: one build, `/config.json`, `RUNTIME_CONFIG` (shared rules: [configuration.md](../08-crosscutting-concepts/configuration/configuration.md)) | `NG-CFG-*`, `CFG-*` |
| [08-crosscutting-concepts/observability/angular.md](../08-crosscutting-concepts/observability/angular.md) | Global error path, error reporting, trace correlation, hidden source maps (shared rules: [observability.md](../08-crosscutting-concepts/observability/observability.md)) | `NG-OBS-*`, `OBS-*` |

## Skills for Angular work

Load these when creating or editing Angular code (the `baseline-angular` skill does this for you):

| Skill | For |
|---|---|
| `angular-developer` (official) | Angular APIs and idioms |
| `angular-new-app` (official) | Creating a new app (with the flags from NG-ARCH-17) |
| `ngrx-signals` (own) | Signal Stores |
| `angular-material-design` (own) | Angular Material, theming, layout, navigation |
| `baseline-security` (own) | Security rules by task, review checklist |
| `baseline-i18n` (own) | Multilingual products: keys, catalogs, formatting, workflow |
| `accessibility` | WCAG 2.2 know-how |
| `vitest`, `playwright-best-practices`, `playwright-cli` | Tests and browser checks |
| `orval` | Generated API clients |
| `baseline-tdd` (own) | Test-first workflow |

**Where a skill and these docs disagree, the docs win.** Known conflicts are listed in the "Skill overrides" table of each doc: [architecture](../05-building-block-view/angular.md#skill-overrides-angular-developer-angular-new-app), [state management](../08-crosscutting-concepts/ui/angular-state-management.md#skill-overrides-ngrx-signals-original-by-danielsogl), [UI](../08-crosscutting-concepts/ui/angular-material.md#skill-overrides), [testing](../08-crosscutting-concepts/testing/angular.md#skill-overrides-angular-developer), [TS testing](../08-crosscutting-concepts/testing/typescript.md#skill-overrides), [E2E](../08-crosscutting-concepts/testing/typescript-e2e.md#skill-overrides), [API clients](../08-crosscutting-concepts/api/typescript-openapi-clients.md#skill-overrides-orval-skill), [Angular API clients](../08-crosscutting-concepts/api/angular-openapi-clients.md#skill-overrides-orval-skill).
