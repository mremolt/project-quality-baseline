# Angular Tooling

Angular additions to [08-crosscutting-concepts/development/typescript-tooling.md](typescript-tooling.md): compiler options, angular-eslint, `@ngrx/eslint-plugin`, CLI usage. Editor setup: [08-crosscutting-concepts/development/ide-setup.md](ide-setup.md).

## Compiler

- **NG-TOOL-01: Strict Angular compiler options are on**, extended diagnostics are errors:

```jsonc
// tsconfig.json (excerpt, in addition to TS-TOOL-01)
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictStandalone": true,
    "extendedDiagnostics": { "defaultCategory": "error" }
  }
}
```

- **NG-TOOL-10: The Angular CLI applies the browser matrix of TS-TOOL-02.** The date TS-TOOL-02 fixes is Angular's supported-browser date (Angular 22: 2026-05-07); the CLI's default `browserslist` resolves it, so no own `.browserslistrc` is added. On every Angular major, re-check the date and the `lib` level against Angular's supported browsers and raise a baseline change if they differ.

## ESLint

- **NG-TOOL-02: angular-eslint and `@ngrx/eslint-plugin` extend the shared TypeScript config**, including the template accessibility rules:

```ts
// eslint.config.ts (Angular part, appended to the config from typescript-tooling.md)
import angular from 'angular-eslint';
import ngrx from '@ngrx/eslint-plugin';
import security from 'eslint-plugin-security';
import vitest from '@vitest/eslint-plugin';
import playwright from 'eslint-plugin-playwright';
import type { Linter } from 'eslint';

// the angular-eslint and ngrx presets are typed with typescript-eslint's FlatConfig, which does not satisfy
// ESLint's under exactOptionalPropertyTypes: one cast keeps eslint.config.ts tsc-clean (TS-TOOL-04)
const flat = (configs: unknown): Linter.Config[] => configs as Linter.Config[];

export default defineConfig(
  // … shared TypeScript config (TS-TOOL-04) …
  {
    files: ['**/*.ts'],
    extends: [...flat(angular.configs.tsRecommended), ...flat(ngrx.configs.signalsTypeChecked)],
    ...(angular.processInlineTemplates ? { processor: angular.processInlineTemplates } : {}), // possibly undefined in the typings
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-class-suffix': 'off', // suffixless naming (NG-ARCH-02)
      '@angular-eslint/directive-class-suffix': 'off',
      // NG-ARCH-05: OnPush is the default since Angular 22; spelling it out is redundant (one entry in the shared no-restricted-syntax list, NG-TOOL-07/12)
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='changeDetection'] > MemberExpression[property.name='OnPush']",
          message: 'OnPush is the default since Angular 22; remove changeDetection (NG-ARCH-05).',
        },
      ],
      // NG-ARCH-21: templates and styles only in dedicated files
      '@angular-eslint/component-max-inline-declarations': ['error', { template: 0, styles: 0, animations: 0 }],
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-developer-preview': 'error', // NG-TOOL-09
      '@angular-eslint/no-experimental': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }], // NG-TOOL-11: components without members
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@angular/common/http', importNames: ['httpResource'], message: 'Only in adapter/out/http (NG-ARCH-13).' },
            { name: '@ngrx/store', message: 'Classic NgRx store needs an ADR (NG-STATE-13).' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'], // NG-ARCH-21: test host components may declare an inline template
    rules: { '@angular-eslint/component-max-inline-declarations': 'off' },
  },
  {
    files: ['**/adapter/out/http/**/*.ts', 'src/platform/adapter/out/http/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' }, // dependency-cruiser still guards the boundaries
  },
  // NG-TOOL-09 allow-list: one block per mandated preview API, each with its reason. Empty with Angular 22.
  // {
  //   files: ['src/platform/adapter/in/ui/preview/<api>.ts'], // <API>: mandated by <rule>, reviewed on Angular <major>
  //   rules: { '@angular-eslint/no-developer-preview': 'off', '@angular-eslint/no-experimental': 'off' },
  // },
  {
    // TS-TOOL-22: tests and E2E code
    files: ['**/*.spec.ts'],
    ignores: ['e2e/**', 'e2e-smoke/**'],
    extends: [warnAsError(vitest.configs.recommended)],
  },
  {
    files: ['e2e/**/*.ts', 'e2e-smoke/**/*.ts'],
    extends: [warnAsError(playwright.configs['flat/recommended'])],
  },
  {
    // NG-TOOL-07: folders that look up objects by untrusted keys
    files: ['**/adapter/out/http/**/*.ts'],
    plugins: { security },
    rules: { 'security/detect-object-injection': 'error' },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/no-inline-styles': 'error',
    },
  },
  prettier, // stays last
);
```

> Rule names follow angular-eslint 22 / `@ngrx/eslint-plugin` 22. Check them on upgrades; a removed rule makes ESLint fail loudly, which is intended. A preset that ships `warn` entries is wrapped in the shared `warnAsError` helper (TS-TOOL-05, [typescript-tooling.md](typescript-tooling.md#eslint-default-ts-d4)); whether the angular-eslint and NgRx presets above contain any is to verify on adoption.

Prettier formats the templates with the Angular parser (TS-TOOL-08):

```json
// .prettierrc.json (addition)
{ "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }] }
```

- **NG-TOOL-03: Template accessibility lint rules are errors** (A11Y layer L1). Disabling one inline needs a reason and a ticket (A11Y-04).

## CLI and scripts

- **NG-TOOL-04: The standard scripts (TS-TOOL-10) use the Angular CLI where it has a builder:** `lint` is `ng lint`, `build` is `npm run generate:api && ng build`, `test` is `npm run generate:api && ng test --watch=false` (Vitest, one run; `npx ng test` watches while developing). `check` and `verify` call the runner of TS-TOOL-19 (`.agents/skills/baseline-angular/templates/scripts/verify.mjs`, copied to `frontend/scripts/`); `check` type-checks app and specs with `tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.spec.json` in a `typecheck` script; `tsconfig.e2e.json` (including `e2e/**`, `e2e-smoke/**` and `playwright*.config.ts`) is the third project of that script, and `lintFilePatterns` in `angular.json` lists `e2e/**/*.ts` and `e2e-smoke/**/*.ts` next to `src/**` (TS-TOOL-20). `generate:api` and `check:arch` call Orval and dependency-cruiser directly; the E2E scripts select Playwright projects (TS-TEST-18). No script relies on an npm `pre*` hook, because `ignore-scripts=true` skips them (TS-TOOL-11).
- **NG-TOOL-05: Bundle budgets in `angular.json` stay enabled** and fail the build when exceeded; raising them is a reviewed change. The mandated stack alone (Angular with router and forms, Angular Material, Transloco with `intl-messageformat`, zod) measured 737 kB raw and 157 kB transferred for the first page, and about 940 kB raw with the first features (NG-TOOL-14); the CLI defaults are 500 kB warning and 1 MB error. A product therefore starts with `initial` at 810 kB warning and 970 kB error (the measured value plus 10 %), keeps the CLI defaults for `anyComponentStyle`, and watches the transferred size, which is the number users feel (NG-TOOL-13). Once the first feature screen builds, the warning level is reset to that measured build plus 10 % (error about 20 % above the warning). An `anyComponentStyle` warning on a page with several cards is fixed by trimming the stylesheet or splitting the component, not by raising the budget. A warning is a task in the same step, not a note for later: split a lazy chunk, defer a shared Material import, or raise the level. Every raise is a reviewed change that records the new value and its reason in the product's chapter 10 (quality requirements).
  *Why:* defaults the baseline's own stack exceeds invite a blanket raise; a stated starting point keeps the budget meaningful.
- **NG-TOOL-06: Keep Angular current with `ng update`** and apply the official migrations (`ng generate @angular/core:<migration>`), one major version at a time. A product never runs an Angular major outside active or LTS support; by default a new major is adopted within six months of its release (one release cycle). Minor and patch updates of Angular and the other packages come through the update automation (TS-TOOL-15).
- **NG-TOOL-07: ESLint carries the security rules** for the bans in [angular.md](../security/angular.md) and [typescript.md](../security/typescript.md): `no-restricted-syntax` for `bypassSecurityTrust*`, `innerHTML`/`outerHTML` and `nativeElement` writes, and the redundant `changeDetection: ChangeDetectionStrategy.OnPush` (NG-ARCH-05), plus `no-eval`, `no-implied-eval`, `no-new-func`. `eslint-plugin-security`'s `detect-object-injection` is `error` in the folders that look up objects by untrusted keys (`adapter/out/http` mappers) and off elsewhere, which keeps the error-or-off policy (TS-TOOL-05); a project adds further folders that handle untrusted keys. Check the exact rule list when adopting.
- **NG-TOOL-08: Production builds publish no source maps** (TS-SEC-05): `sourceMap: false`, or, with error reporting, hidden maps that are uploaded and removed before packaging ([NG-OBS-06](../observability/angular.md)); the dev server sends the other security headers through `headers` in `angular.json`. It cannot create a per-request nonce, so the CSP and Trusted Types are asserted against the BFF-served build in E2E (NG-SEC-06/12).
- **NG-TOOL-09: `@angular-eslint/no-developer-preview` and `@angular-eslint/no-experimental` are errors.** An API that the baseline mandates while it is still in preview goes on a named allow-list in `eslint.config.ts`: one wrapper file per API in `src/platform` that re-declares it (`export const form = previewForm;`, a plain re-export may still be reported), with the rules off for that file only and a comment giving the reason. The allow-list is reviewed on every Angular update and an entry is removed once the API is stable. With Angular 22 it is empty: Signal Forms (`form`, `validateStandardSchema`), `resource` and `httpResource` are stable since v22.0.
- **NG-TOOL-11: Two typescript-eslint rules need an option or a different test style, never `off`.** `@typescript-eslint/no-extraneous-class` rejects every decorated class without members (the root component, pure-template components), so it runs with `allowWithDecorator: true`. `@typescript-eslint/unbound-method` rejects `expect(mock.method)` on mocks from `vitest-mock-extended`; specs use explicit `vi.fn()` fakes for those collaborators instead. Switching either rule off is a lowering of the lint rules (SEC-REV-02).
  *Why:* both rules guard real defects elsewhere; the Angular and mocking idioms only need a narrower setting.
  *Why:* preview APIs may break in patch releases; the rules have no per-API option (`no-experimental` only ignores whole packages), so the wrapper file is the narrowest exception.
- **NG-TOOL-12 (implements TS-TOOL-21): The wall-clock ban covers all of `src/` except `platform.tokens.ts` and specs.** The `no-restricted-syntax` list of the `src/**/*.ts` block includes the `noWallClock` selectors of TS-TOOL-21 next to the security bans of NG-TOOL-07; a block for `src/platform/platform.tokens.ts` and `**/*.spec.ts` repeats the list without them. Components, stores and services inject `CLOCK` (NG-ARCH-24).
- **NG-TOOL-13: `check:bundle` enforces gzip budgets** (template `scripts/check-bundle.mjs`, the Angular counterpart of REACT-TOOL-13): the initial JavaScript (entry plus modulepreloads) and each lazy chunk stay below their gzip budget (default initial 200 kB, lazy 80 kB, set per product to the measured value plus 10 %), no chunk links a source map, and `config.json` is not in the output (NG-CFG-06). It runs in `verify` after `ng build`; raising a budget is a reviewed change recorded in chapter 10 (NG-TOOL-05). `angular.json` budgets measure raw size only.
- **NG-TOOL-14: The zod import form is chosen so that the initial bundle does not carry what it does not use.** The classic entry point of zod 4 drags all locales, `compile` and the JSON-schema code under the esbuild builder (the package's `sideEffects` list names `compile.js`): 521 of 937 kB of one product's initial bundle. Orval's generated `.zod.ts` files import it the same way, so the project cannot change the import path in generated code; the lever is the configuration (candidates, not yet verified in a product: a zod-mini output of Orval, a build alias to `zod/mini`, or schemas only for what the screen parses), measured by `check:bundle` (NG-TOOL-13). A product whose gzip budget is exceeded by zod records the chosen lever in chapter 10 and does not raise the budget silently.

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular Tooling".*
