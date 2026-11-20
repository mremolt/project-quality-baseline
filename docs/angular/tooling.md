# Angular Tooling

Angular additions to [typescript/tooling.md](../typescript/tooling.md): compiler options, angular-eslint, `@ngrx/eslint-plugin`, CLI usage. Editor setup: [shared/tooling/ide-setup.md](../shared/tooling/ide-setup.md).

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

## ESLint

- **NG-TOOL-02: angular-eslint and `@ngrx/eslint-plugin` extend the shared TypeScript config**, including the template accessibility rules:

```ts
// eslint.config.ts (Angular part, appended to the config from typescript/tooling.md)
import angular from 'angular-eslint';
import ngrx from '@ngrx/eslint-plugin';

export default defineConfig(
  // … shared TypeScript config (TS-TOOL-04) …
  {
    files: ['**/*.ts'],
    extends: [angular.configs.tsRecommended, ...ngrx.configs.signalsTypeChecked],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-class-suffix': 'off', // suffixless naming (NG-ARCH-02)
      '@angular-eslint/directive-class-suffix': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-developer-preview': 'error',
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
    files: ['**/adapter/out/http/**/*.ts', 'src/platform/adapter/out/http/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' }, // dependency-cruiser still guards the boundaries
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

> Rule names follow angular-eslint 22 / `@ngrx/eslint-plugin` 22. Check them on upgrades; a removed rule makes ESLint fail loudly, which is intended.

- **NG-TOOL-03: Template accessibility lint rules are errors** (A11Y layer L1). Disabling one inline needs a reason and a ticket (A11Y-04).

## CLI and scripts

- **NG-TOOL-04: The standard scripts (TS-TOOL-10) map to the CLI** where it has a builder:

| Script | Command |
|---|---|
| `generate:api` | `orval` |
| `lint` / `lint:fix` | `ng lint` / `ng lint --fix` |
| `test` | `ng test` (Vitest) |
| `e2e` / `e2e:smoke` | `playwright test --project=stubbed-*` / `playwright test --project=smoke` |
| `check:arch` | `depcruise src --config .dependency-cruiser.cjs` |
| `verify` | `npm run format:check && npm run lint && npm run check:arch && npm test -- --watch=false && ng build` |

- **NG-TOOL-05: Bundle budgets in `angular.json` stay enabled** and fail the build when exceeded; raising them is a reviewed change.
- **NG-TOOL-06: Keep Angular current with `ng update`** and apply the official migrations (`ng generate @angular/core:<migration>`), one major version at a time.

## Agent checklist

- [ ] Strict template checking green, extended diagnostics clean?
- [ ] No `httpResource` outside the HTTP adapter, no classic `@ngrx/store`?
- [ ] Template a11y rules green without new disables?
- [ ] `npm run verify` green?

## Sources

angular-eslint (github.com/angular-eslint/angular-eslint), `@ngrx/eslint-plugin` (ngrx.io/guide/eslint-plugin), Angular compiler options (angular.dev/reference/configs/angular-compiler-options), Angular CLI unit-test builder (angular.dev/guide/testing).
