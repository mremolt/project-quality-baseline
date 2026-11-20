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

## ESLint

- **NG-TOOL-02: angular-eslint and `@ngrx/eslint-plugin` extend the shared TypeScript config**, including the template accessibility rules:

```ts
// eslint.config.ts (Angular part, appended to the config from typescript-tooling.md)
import angular from 'angular-eslint';
import ngrx from '@ngrx/eslint-plugin';
import security from 'eslint-plugin-security';

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
      '@angular-eslint/no-developer-preview': 'error', // NG-TOOL-09
      '@angular-eslint/no-experimental': 'error',
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
  // NG-TOOL-09 allow-list: one block per mandated preview API, each with its reason. Empty with Angular 22.
  // {
  //   files: ['src/platform/adapter/in/ui/preview/<api>.ts'], // <API>: mandated by <rule>, reviewed on Angular <major>
  //   rules: { '@angular-eslint/no-developer-preview': 'off', '@angular-eslint/no-experimental': 'off' },
  // },
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

> Rule names follow angular-eslint 22 / `@ngrx/eslint-plugin` 22. Check them on upgrades; a removed rule makes ESLint fail loudly, which is intended.

- **NG-TOOL-03: Template accessibility lint rules are errors** (A11Y layer L1). Disabling one inline needs a reason and a ticket (A11Y-04).

## CLI and scripts

- **NG-TOOL-04: The standard scripts (TS-TOOL-10) use the Angular CLI where it has a builder:** `lint` is `ng lint`, `build` is `npm run generate:api && ng build`, `test` is `npm run generate:api && ng test` (Vitest). `verify` runs the tests with `npm test -- --watch=false`. `generate:api` and `check:arch` call Orval and dependency-cruiser directly; the E2E scripts select Playwright projects (TS-TEST-18). No script relies on an npm `pre*` hook, because `ignore-scripts=true` skips them (TS-TOOL-11).
- **NG-TOOL-05: Bundle budgets in `angular.json` stay enabled** and fail the build when exceeded; raising them is a reviewed change.
- **NG-TOOL-06: Keep Angular current with `ng update`** and apply the official migrations (`ng generate @angular/core:<migration>`), one major version at a time. A product never runs an Angular major outside active or LTS support; by default a new major is adopted within six months of its release (one release cycle). Minor and patch updates of Angular and the other packages come through the update automation (TS-TOOL-15).
- **NG-TOOL-07: ESLint carries the security rules** for the bans in [angular.md](../security/angular.md) and [typescript.md](../security/typescript.md): `no-restricted-syntax` for `bypassSecurityTrust*`, `innerHTML`/`outerHTML` and `nativeElement` writes, plus `no-eval`, `no-implied-eval`, `no-new-func`. `eslint-plugin-security`'s `detect-object-injection` is `error` in the folders that look up objects by untrusted keys (`adapter/out/http` mappers) and off elsewhere, which keeps the error-or-off policy (TS-TOOL-05); a project adds further folders that handle untrusted keys. Check the exact rule list when adopting.
- **NG-TOOL-08: Production builds publish no source maps** (TS-SEC-05): `sourceMap: false`, or, with error reporting, hidden maps that are uploaded and removed before packaging ([NG-OBS-06](../observability/angular.md)); the dev server sends the other security headers through `headers` in `angular.json`. It cannot create a per-request nonce, so the CSP and Trusted Types are asserted against the BFF-served build in E2E (NG-SEC-06/12).
- **NG-TOOL-09: `@angular-eslint/no-developer-preview` and `@angular-eslint/no-experimental` are errors.** An API that the baseline mandates while it is still in preview goes on a named allow-list in `eslint.config.ts`: one wrapper file per API in `src/platform` that re-declares it (`export const form = previewForm;`, a plain re-export may still be reported), with the rules off for that file only and a comment giving the reason. The allow-list is reviewed on every Angular update and an entry is removed once the API is stable. With Angular 22 it is empty: Signal Forms (`form`, `validateStandardSchema`), `resource` and `httpResource` are stable since v22.0.
  *Why:* preview APIs may break in patch releases; the rules have no per-API option (`no-experimental` only ignores whole packages), so the wrapper file is the narrowest exception.

## Agent checklist

- [ ] Strict template checking green, extended diagnostics clean?
- [ ] No `httpResource` outside the HTTP adapter, no classic `@ngrx/store`?
- [ ] Template a11y rules green without new disables?
- [ ] Security lint rules green, `bypassSecurityTrust*` not suppressed?
- [ ] No developer-preview or experimental API outside the allow-list (NG-TOOL-09)?
- [ ] `npm run verify` green?

## Sources

angular-eslint (github.com/angular-eslint/angular-eslint; `no-developer-preview`, `no-experimental` and their options), API stability labels (angular.dev/api), Angular release and support policy (angular.dev/reference/releases), `@ngrx/eslint-plugin` (ngrx.io/guide/eslint-plugin), Angular compiler options (angular.dev/reference/configs/angular-compiler-options), Angular CLI unit-test builder (angular.dev/guide/testing).
