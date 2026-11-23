# TypeScript Tooling

Compiler, linter and formatter settings for every TypeScript project. Each frontend stack adds its own tooling file (Per stack line at the end). Node.js backends replace TS-TOOL-01's `target`/`lib`, TS-TOOL-02 and the frontend scripts of TS-TOOL-10 with [node-tooling.md](node-tooling.md). Editor integration (format and fix on save): [08-crosscutting-concepts/development/ide-setup.md](ide-setup.md).

## Compiler (default TS-D3)

- **TS-TOOL-01: `strict` is on, plus these checks.** Turning one off needs an ADR.

```jsonc
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"], // newest level all supported browsers have (TS-TOOL-02)
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

- **TS-TOOL-02: The supported browsers are the Baseline "widely available" browsers of a date the baseline fixes, and `lib` is the newest ECMAScript level all of them support.** The date is currently **2026-05-07**, which resolves to Chrome and Edge 119, Firefox 119, Safari and iOS 17.0. The same matrix applies to every TypeScript frontend, whatever its framework, and the stack's build applies it (`browserslist` or the bundler's build target). For this date the level is **`ES2023`**: ES2024 adds `Promise.withResolvers` and `Object.groupBy`, which need Firefox 121 and Safari 17.4. `target` matches `lib`. A product that must support more browsers, or wants a newer `lib` with explicit polyfills, records that in an ADR. The baseline moves the date deliberately and re-checks the level when it does.
  *Why:* bundlers only downlevel syntax; nobody polyfills APIs. A `lib` above the supported browsers compiles calls that crash at runtime in some of them.
- **TS-TOOL-03: No `any`.** Use `unknown` and narrow it (type guards, zod parsing). The lint rules below enforce this. `as` casts need a comment explaining why the compiler can't know.

## ESLint (default TS-D4)

- **TS-TOOL-04: ESLint flat config with this plugin set:** typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, `eslint-plugin-sonarjs`, `eslint-plugin-import-x`, `eslint-plugin-simple-import-sort`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-config-prettier` (last). Each frontend stack adds its framework plugins, including its accessibility lint rules.
- **TS-TOOL-05: Lint errors fail the build. No warnings policy:** a rule is either `error` or `off`.
  *Why:* warnings pile up and train everyone to ignore the linter.
- **TS-TOOL-06: Disabling a rule inline requires a named rule and a reason** (`// eslint-disable-next-line rule -- reason`), enforced by `@eslint-community/eslint-comments/require-description` and `no-unlimited-disable`; `linterOptions.reportUnusedDisableDirectives: 'error'` removes stale directives. Disabling a rule globally is a reviewed change.
- **TS-TOOL-07: Known overlaps are resolved in the shared config, not per project:**
  - `simple-import-sort` sorts imports; `import-x/order` stays off.
  - `eslint-config-prettier` comes last, so no formatting rule fights Prettier.
  - Where SonarJS and typescript-eslint report the same thing (e.g. unused variables, deprecated APIs), keep the typescript-eslint rule and turn the SonarJS duplicate off.

```ts
// eslint.config.ts (framework-independent part)
import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { configs as sonarConfigs } from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/** TS-TOOL-05: a rule is `error` or `off`; some presets ship `warn` entries (import-x recommended). */
function warnAsError(config: Linter.Config): Linter.Config {
  const asError = (entry: Linter.RuleEntry): Linter.RuleSeverityAndOptions => {
    const [severity, ...options]: [Linter.RuleSeverity, ...unknown[]] = Array.isArray(entry) ? entry : [entry];
    return [severity === 'warn' || severity === 1 ? 'error' : severity, ...options];
  };
  const rules = Object.entries(config.rules ?? {}).flatMap(([name, entry]) =>
    entry === undefined ? [] : [[name, asError(entry)] as const],
  );
  return { ...config, rules: Object.fromEntries(rules) };
}

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '**/generated/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error', // TS-TOOL-06
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      sonarConfigs.recommended, // named import: typed as a flat config (the default export's `configs` is not)
      warnAsError(importX.flatConfigs.recommended), // ships `warn` entries
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
  {
    files: ['eslint.config.ts'],
    rules: { 'import-x/no-named-as-default-member': 'off' }, // tseslint.configs, eslint.configs
  },
  prettier,
);
```

> Check rule names against the installed plugin versions when upgrading; the overlap list in TS-TOOL-07 is maintained here.

Two details keep the template valid under TS-TOOL-05, and under TS-TOOL-01 when the tsconfig includes `eslint.config.ts` (then `tsc` checks it too):

- **Presets that ship `warn` entries are wrapped in `warnAsError`.** `importX.flatConfigs.recommended` sets several rules to `warn` (`no-named-as-default`, `no-duplicates` and others); `--max-warnings 0` would fail on them, but TS-TOOL-05 wants `error` or `off` in the config itself. A stack wraps its framework presets the same way when they ship `warn` entries.
- **SonarJS is imported as the named export `configs`.** With `moduleResolution: bundler`, the default export is typed as a generic `ESLint.Plugin`, whose `configs` may be undefined, is an index signature (`noPropertyAccessFromIndexSignature`) and mixes flat and legacy configs, so `sonarjs.configs.recommended` does not type-check. The named `configs.recommended` is typed as a flat config and is the same object at runtime (eslint-plugin-sonarjs 4.2). Under `nodenext` (Node backends) the default import of this CommonJS package already has that type.

## Prettier (default TS-D5)

- **TS-TOOL-08: Prettier formats everything it supports** (TS, HTML templates, SCSS/CSS, JSON, Markdown, YAML). Nobody discusses formatting in reviews.

```json
// .prettierrc.json
{
  "printWidth": 120,
  "singleQuote": true,
  "trailingComma": "all"
}
```

- **TS-TOOL-09: CI runs `prettier --check` and `eslint`**; editors format and fix on save ([08-crosscutting-concepts/development/ide-setup.md](ide-setup.md)).

## Standard npm scripts

- **TS-TOOL-10: Every TypeScript project offers the same script names**, so humans, agents and CI don't have to guess:

| Script | Does |
|---|---|
| `generate:api` | Runs Orval ([08-crosscutting-concepts/api/typescript-openapi-clients.md](../api/typescript-openapi-clients.md)) |
| `build` | `generate:api`, then the production build |
| `lint` / `lint:fix` | ESLint |
| `format` / `format:check` | Prettier write / check |
| `check:arch` | dependency-cruiser (TS-ARCH-12) |
| `check:unused` | knip: unused dependencies, exports and files (TS-TOOL-17) |
| `check` | The inner loop, seconds not minutes: type-check app and specs, `lint`, `check:arch`, then `test`. No `build`, no `format:check`, no E2E. Run it after every change; `verify` stays the final gate (TS-TOOL-18) |
| `test` | `generate:api`, then Vitest (unit, component, adapter) |
| `test:coverage` | `test` with the coverage report (REACT-TEST-22, NEST-TEST-13) |
| `e2e` | Playwright, stubbed tier |
| `e2e:fast` | Playwright, one cell only: the default cell of TS-TEST-18 (one browser, `expanded`, light theme). For milestones while building (TS-TEST-33) |
| `e2e:nightly` | Playwright, stubbed tier plus the nightly viewport and browser projects (TS-TEST-18) |
| `e2e:smoke` | Playwright, real-backend tier |
| `verify` | The component's local gate, from a clean checkout: `generate:api`, `format:check`, `lint`, `check:arch`, `check:unused`, `test`, `build`, run through `scripts/verify.mjs` so every finding shows in one run (TS-TOOL-19). No E2E, no security scans |

  `build` and `test` call `generate:api` explicitly. With `ignore-scripts=true` (TS-TOOL-11) npm skips `pre*` and `post*` scripts also for `npm run` and `npm test`, so no script relies on them. `verify` is what the component's CI job runs (REPO-CI-01); E2E tiers and the security job are separate pipeline jobs, listed with trigger and required status in the pipeline jobs table ([REPO-CI](../../07-deployment-view/repository-layout.md#ci)). A stack maps the scripts to its CLI where it has one.

## Dependencies and supply chain

- **TS-TOOL-11: `.npmrc` sets `ignore-scripts=true`, `allow-git=none` (or `root`) and `min-release-age=7`** (days; SEC-CI-02), CI installs with `npm ci`, and `package-lock.json` is committed with its diffs reviewed. Tools that need install scripts (husky, native modules) are allow-listed explicitly: husky's `prepare` is run by `npm run prepare` in the setup docs, not by install (REPO-TOOL-02); other packages through `npm rebuild <pkg> --ignore-scripts=false`.
  *Why:* install scripts and fresh malicious releases are the common npm attack path (Top 10:2025 A03).
- **TS-TOOL-12: CI scans the lockfile for known vulnerabilities and runs `npm audit signatures`;** new findings at or above the gate's threshold fail the build (SEC-CI-01 and its gate table). Reference tool (replaceable): OSV-Scanner on `package-lock.json`, or `npm audit --audit-level=high`.
- **TS-TOOL-13: Dependencies are added deliberately** (age, maintainers, install scripts, usage checked); apps pin exact versions in `package.json`.
- **TS-TOOL-14: The toolchain guarantees an npm that knows the `.npmrc` keys.** `min-release-age` needs npm 11.10 and `allow-git` npm 11.9; an older npm ignores unknown keys with only a warning, so the protection silently disappears. `package.json` sets `engines` for Node and npm (`"npm": ">=11.10.0"`), `.npmrc` sets `engine-strict=true`, and CI asserts before installing that the cooldown is active: `test "$(npm config get before)" != null`. npm maps `min-release-age` to its `before` setting (now minus the configured days), so `npm config get min-release-age` prints `null` even when it works (npm 11.13), and an npm that does not know the key leaves `before` at `null` too. `npm config list` shows the same value as `before = "<date>"`. Inside such a project, `npm view <pkg> --before <date>` fails with "--min-release-age cannot be provided when using --before"; run such lookups outside the project folder (a command-line `--min-release-age=0` does not help, npm 11.13). The Node version comes from a version file (`.nvmrc` or `.node-version`); if its bundled npm is older, the setup docs and CI install npm 11.10 or newer explicitly. A failing engine check of the root package under `engine-strict` is listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use); the CI assertion is the guarantee. The cooldown also hits a freshly generated project: `ng new` and other scaffolders write caret ranges of releases that are younger than `min-release-age`, and npm then fails with peer or "undefined" version errors that never name the cooldown. After scaffolding, pin the affected packages to the newest versions older than the cooldown (for Angular: all `@angular/*` packages and the CLI, Material and CDK together) and install everything else without a version.
- **TS-TOOL-15: Dependency updates are automated as a capability of the repository.** One update tool opens update pull requests for npm, Maven (JAVA-TOOL-16), container base images, Compose images and CI actions or plugins, grouped by ecosystem, and waits at least the `min-release-age` cooldown before proposing a release (reference tools, replaceable: Renovate, Dependabot). Update pull requests pass the same pipeline as any other change. Framework majors follow the stack's update rule.
- **TS-TOOL-16: Builds are reproducible.** CI installs with `npm ci` from the committed lockfile, on the pinned Node and npm (TS-TOOL-14) in a build image pinned by digest (SEC-CI-02), so the same commit gives the same bundle. The release job produces a CycloneDX SBOM with the CycloneDX npm tool (`@cyclonedx/cyclonedx-npm --omit dev`, a pinned dev dependency) and publishes it with the artifact (SEC-CI-03, JAVA-TOOL-17 for Maven). `npm sbom --omit dev` is not used: npm 11.13 drops production packages that are also peers of dev dependencies (in a NestJS service 196 of 285 components, `@nestjs/core` among the missing), and it fails without a `version` in `package.json`.

- **TS-TOOL-17: knip reports unused dependencies, exports and files, and `verify` runs it** (`check:unused`, `knip.json` in the component, entry points listed, generated code ignored). A dependency whose code is not written yet is not installed; one that is no longer used is removed. A finding is fixed or the entry is added to `knip.json` with the reason, never silenced by deleting the check (SEC-REV-02).
  *Why:* an installed but never wired `@nestjs/schedule` and an unused cluster-lock helper looked like a working scheduled purge; each unused dependency also widens the supply chain (TS-TOOL-13). The `knip.json` templates are not yet run against a real product ([chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)).

- **TS-TOOL-18: `check` is the inner loop, `verify` the gate.** While developing, humans and agents run `check` (and one spec by file pattern) and run `verify` once before the commit. `check` contains no step with a build, so it stays in the range of ~30 seconds; a step that makes it slower moves to `verify`. `check` uses the same runner as `verify` (TS-TOOL-19).
  *Why:* the first test drive of the baseline lost most of its time in 3–4 minute loops, because the only named command was the final gate.
- **TS-TOOL-19: `verify` and `check` run every step, report all failures together and fail at the end.** They call the runner `scripts/verify.mjs` (shipped in each TypeScript stack's skill templates) with the npm scripts in order, e.g. `node scripts/verify.mjs generate:api! format:check lint typecheck check:arch check:unused test build! check:bundle`. A failing step does not stop the run; a step marked `!` is a gate whose output later steps need (generated client, build), so its failure stops the run there. The runner prints a summary and exits non-zero when any step failed or was skipped, so every check still fails the build and CI (REPO-CI-01). Chaining with `&&` is not used for these two scripts.
  *Why:* with `&&` each run shows only the first failing stage; the first test drive needed four closing `verify` runs where one would have shown all findings.
- **TS-TOOL-20: E2E code is type-checked and linted inside `verify`.** `e2e/`, `e2e-smoke/` and the Playwright configs are in a tsconfig that `typecheck` runs (the project tsconfig's `include`, or an own `tsconfig.e2e.json` behind a `typecheck:e2e` step), and in the files ESLint lints (`eslint .`; Angular: `lintFilePatterns` in `angular.json`, NG-TOOL-04). Stub payloads are typed with the types generated from the spec (API-CON-07), never with hand-written interfaces.
  *Why:* Playwright only strips types, so untyped stubs drift from the contract while staying green, and a fixture guard that compares the wrong strings passes forever without a lint or type error.
- **TS-TOOL-21: ESLint bans reading the wall clock outside the platform clock (TS-ARCH-22).** Every stack's config adds these selectors to its `no-restricted-syntax` list for `src/**` and lifts them only for the platform clock and for specs (ESLint replaces a rule's options per block, so each block repeats its full list):

  ```ts
  const noWallClock = [
    { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'Use the platform clock (TS-ARCH-22).' },
    { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Use the platform clock (TS-ARCH-22).' },
  ];
  ```

  *Why:* "today" computed from `new Date()` in a component cannot be pinned in a test and is the usual source of time-zone bugs; a lint rule finds every place, a review finds some.

*Agent checklist in [checklists/typescript.md](../../checklists/typescript.md) and sources in [sources.md](../../sources.md), section "TypeScript Tooling".*
