# TypeScript Tooling

Compiler, linter and formatter settings for every TypeScript project. Framework additions: [angular/tooling.md](../angular/tooling.md). Editor integration (format and fix on save): [shared/tooling/ide-setup.md](../shared/tooling/ide-setup.md).

## Compiler (default TS-D3)

- **TS-TOOL-01: `strict` is on, plus these checks.** Turning one off needs an ADR.

```jsonc
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "target": "ES2025",
    "lib": ["ES2025", "DOM", "DOM.Iterable"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- **TS-TOOL-02: Target `ES2025`.** Check after upgrades that the TypeScript version supports it, and that the bundler (for Angular: the CLI with its `browserslist`) produces output for the supported browsers. The tsconfig target says which syntax we *write*; the browserslist says what we *ship*.
- **TS-TOOL-03: No `any`.** Use `unknown` and narrow it (type guards, zod parsing). The lint rules below enforce this. `as` casts need a comment explaining why the compiler can't know.

## ESLint (default TS-D4)

- **TS-TOOL-04: ESLint flat config with this plugin set:** typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, `eslint-plugin-sonarjs`, `eslint-plugin-import-x`, `eslint-plugin-simple-import-sort`, `eslint-config-prettier` (last). Framework plugins add to it (Angular: angular-eslint, `@ngrx/eslint-plugin`).
- **TS-TOOL-05: Lint errors fail the build. No warnings policy:** a rule is either `error` or `off`.
  *Why:* warnings pile up and train everyone to ignore the linter.
- **TS-TOOL-06: Disabling a rule inline requires a reason** (`// eslint-disable-next-line rule -- reason`), enforced with `eslint-comments`-style reporting (`linterOptions.reportUnusedDisableDirectives: 'error'`). Disabling a rule globally is a reviewed change.
- **TS-TOOL-07: Known overlaps are resolved in the shared config, not per project:**
  - `simple-import-sort` sorts imports; `import-x/order` stays off.
  - `eslint-config-prettier` comes last, so no formatting rule fights Prettier.
  - Where SonarJS and typescript-eslint report the same thing (e.g. unused variables, deprecated APIs), keep the typescript-eslint rule and turn the SonarJS duplicate off.

```ts
// eslint.config.ts (framework-independent part)
import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '**/generated/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      sonarjs.configs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import-x/order': 'off',
      'import-x/no-cycle': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'sonarjs/no-unused-vars': 'off', // covered by @typescript-eslint/no-unused-vars
      'sonarjs/deprecation': 'off', // covered by @typescript-eslint/no-deprecated
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'e2e/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off', // test fixtures
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
```

> Check rule names against the installed plugin versions when upgrading; the overlap list in TS-TOOL-07 is maintained here.

## Prettier (default TS-D5)

- **TS-TOOL-08: Prettier formats everything it supports** (TS, HTML templates, SCSS/CSS, JSON, Markdown, YAML). Nobody discusses formatting in reviews.

```json
// .prettierrc.json
{
  "printWidth": 120,
  "singleQuote": true,
  "trailingComma": "all",
  "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }]
}
```

- **TS-TOOL-09: CI runs `prettier --check` and `eslint`**; editors format and fix on save ([ide-setup.md](../shared/tooling/ide-setup.md)).

## Standard npm scripts

- **TS-TOOL-10: Every TypeScript project offers the same script names**, so humans, agents and CI don't have to guess:

| Script | Does |
|---|---|
| `generate:api` | Runs Orval ([openapi-clients.md](openapi-clients.md)); also runs as `prebuild` / `pretest` |
| `lint` / `lint:fix` | ESLint |
| `format` / `format:check` | Prettier write / check |
| `check:arch` | dependency-cruiser (TS-ARCH-12) |
| `test` | Vitest (unit, component, adapter) |
| `e2e` | Playwright, stubbed tier |
| `e2e:smoke` | Playwright, real-backend tier |
| `verify` | Everything CI runs: `format:check`, `lint`, `check:arch`, `test`, build |

## Agent checklist

- [ ] No `any`, no unexplained `as`, no new `eslint-disable` without a reason?
- [ ] `npm run verify` green before finishing?
- [ ] No compiler check or lint rule loosened?

## Sources

typescript-eslint shared configs (typescript-eslint.io/users/configs), eslint-plugin-sonarjs (github.com/SonarSource/SonarJS), eslint-plugin-import-x (github.com/un-ts/eslint-plugin-import-x), eslint-plugin-simple-import-sort (github.com/lydell/eslint-plugin-simple-import-sort), eslint-config-prettier, Prettier options (prettier.io/docs/options).
