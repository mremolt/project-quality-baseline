# React: Tooling

React additions to [typescript-tooling.md](typescript-tooling.md) (`TS-TOOL-*`): the React ESLint set and why each plugin was chosen, the React Compiler, compiler options, the script mapping, bundle budgets, source maps and updates. Rules that start with "(React SPA)" describe the Vite build; Next.js replaces them in [nextjs-tooling.md](nextjs-tooling.md). Editor setup: [ide-setup.md](ide-setup.md).

## ESLint

- **REACT-TOOL-01: The React plugin set extends the shared TypeScript config (TS-TOOL-04, REACT-D10):**

| Plugin (verified version) | Preset | Files | Why |
|---|---|---|---|
| `eslint-plugin-react-hooks` 7.1 | `configs.flat['recommended-latest']` | `src/**/*.{ts,tsx}` | Rules of hooks, exhaustive deps and the React Compiler rules (`refs`, `purity`, `set-state-in-effect`, `static-components`, `incompatible-library`, …), which run the compiler itself (REACT-TOOL-10) |
| `@eslint-react/eslint-plugin` 5.30 | `configs['strict-type-checked']`, minus its hooks duplicates (REACT-TOOL-03) | `src/**/*.tsx` | Component and JSX rules (`no-array-index-key`, `dom-no-missing-button-type`, `no-class-component`, …) and the DOM security rules of REACT-SEC-01/02 |
| `eslint-plugin-jsx-a11y-x` 0.2 | `configs.strict` | `src/**/*.tsx` | Accessibility lint (A11Y layer L1); the ESLint 10 fork of `eslint-plugin-jsx-a11y` (REACT-TOOL-02) |
| `@tanstack/eslint-plugin-query` 5.107 | `configs['flat/recommended-strict']` | `src/**/*.{ts,tsx}` | Query keys complete (`exhaustive-deps`), `queryOptions` used (`prefer-query-options`), stable query clients |

  Accessibility rules are errors (A11Y-04); disabling one inline needs a reason and a ticket (TS-TOOL-06).

- **REACT-TOOL-02: ESLint 10 with `eslint-plugin-jsx-a11y-x`, not `eslint-plugin-jsx-a11y`.** `eslint-plugin-jsx-a11y` 6.10 declares ESLint up to 9 as peer, so `npm install` fails with `ERESOLVE`. The fork `eslint-plugin-jsx-a11y-x` 0.2 accepts `^9 || ^10`, ships `configs.strict` as a flat config and prefixes its rules `jsx-a11y-x/`. Switch back when the original supports the ESLint major in use. ESLint 10 loads `eslint.config.ts` natively on Node 26; `jiti` is not needed. `eslint` is pinned in `package.json` before the plugins are installed: adding it in the same `npm install` command as `eslint-import-resolver-typescript` makes npm resolve that package's optional peer `eslint-plugin-import` against `eslint@*` and fail.
- **REACT-TOOL-03: Hooks and compiler rules come from `eslint-plugin-react-hooks`; `@eslint-react`'s copies are off** (TS-TOOL-07). `@eslint-react` 5 re-implements nine of them: `rules-of-hooks`, `exhaustive-deps`, `error-boundaries`, `purity`, `set-state-in-effect`, `set-state-in-render`, `static-components`, `unsupported-syntax`, `use-memo`. Its preset `disable-conflict-eslint-plugin-react-hooks` switches the **react-hooks** rules off, the wrong side, and is not used.
  *Why:* the react-hooks compiler rules run the real React Compiler, so lint reports exactly what the compiler cannot optimize.
- **REACT-TOOL-04: Presets that ship `warn` are promoted to `error` with one `warnAsError()` helper in `eslint.config.ts`** (TS-TOOL-05): `importX.flatConfigs.recommended`, react-hooks `recommended-latest`, `@eslint-react` `strict-type-checked` (about 45 rules at `warn`, including the DOM security rules) and `jsx-a11y-x` `strict`. `lint` still runs with `--max-warnings 0` as a second net.
- **REACT-TOOL-05: ESLint carries the bans of the React architecture and security rules:**
  - `no-restricted-globals` forbids `fetch` everywhere except `src/**/adapter/out/http/**` (REACT-ARCH-12, TS-ARCH-04), and (React SPA) `process` in `src/` (one tsconfig includes `@types/node`, REACT-TOOL-08, so the compiler would accept it; the browser has no `process`, and per-environment values come from `/config.json`, REACT-CFG-01). ESLint replaces a rule's options per block instead of merging them, so each block lists every restricted global it needs;
  - `no-restricted-syntax` forbids `innerHTML`/`outerHTML` assignments and `insertAdjacentHTML` calls (REACT-SEC-03, TS-SEC-02);
  - `@eslint-react/dom-no-dangerously-set-innerhtml`, `dom-no-dangerously-set-innerhtml-with-children`, `dom-no-script-url`, `dom-no-unsafe-target-blank`, `dom-no-find-dom-node` from the preset, as errors (REACT-SEC-01/02/03);
  - `no-eval`, `no-new-func` and `@typescript-eslint/no-implied-eval` (TS-SEC-02).
- **REACT-TOOL-06: A new or upgraded lint plugin is proven to fire.** On setup and after every major of a lint plugin, a temporary probe file in `src/` shows each plugin reporting (for example `rules-of-hooks`, `exhaustive-deps`, the compiler rules `refs` and `set-state-in-effect`, `@eslint-react/no-array-index-key`, `jsx-a11y-x/alt-text`, `@tanstack/query/exhaustive-deps`, `no-restricted-globals` on `fetch`, `@eslint-community/eslint-comments/require-description`); then the file is removed. A misconfigured `files` glob otherwise switches a plugin off without any message.
- **REACT-TOOL-07: Exceptions are narrow and stated in the config:**
  - spec files, `test/` and `e2e/`: `sonarjs/no-hardcoded-passwords`, `@typescript-eslint/no-non-null-assertion` and `@typescript-eslint/unbound-method` off (the last for `expect(mock.method)` with vitest-mock-extended);
  - `eslint.config.ts`: `import-x/no-named-as-default-member` off. The config file is type-checked like all code, so the SonarJS preset comes through the named import of the TS-TOOL-04 template (`import { configs as sonarConfigs }`), which is typed as a flat config; the default export's `configs` is not;
  - the root error boundary is the one class component; `@eslint-react/no-class-component` already accepts error-boundary classes, so it needs no disable (REACT-ARCH-05/15), and an unneeded directive fails lint (`reportUnusedDisableDirectives`).

```ts
// eslint.config.ts (React part; the TS-TOOL-04 blocks come first and use warnAsError(importX.flatConfigs.recommended))
function asError(entry: Linter.RuleEntry): Linter.RuleSeverityAndOptions {
  const [severity, ...options]: [Linter.RuleSeverity, ...unknown[]] = Array.isArray(entry) ? entry : [entry];
  return [severity === 'warn' || severity === 1 ? 'error' : severity, ...options];
}
/** TS-TOOL-05: a rule is `error` or `off`; the React presets ship many `warn` entries. */
function warnAsError(config: Linter.Config): Linter.Config {
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).flatMap(([name, entry]) => (entry === undefined ? [] : [[name, asError(entry)]])),
  );
  return { ...config, rules };
}

const eslintReactHooksDuplicates = ['rules-of-hooks', 'exhaustive-deps', 'error-boundaries', 'purity',
  'set-state-in-effect', 'set-state-in-render', 'static-components', 'unsupported-syntax', 'use-memo'];
const fetchOnlyInHttpAdapters = { name: 'fetch', message: 'Backend calls go through an outgoing port in adapter/out/http (TS-ARCH-04).' };
const noProcessInBrowser = { name: 'process', message: 'No process in browser code; runtime values come from /config.json (CFG-11).' };
const noHtmlWrites = [
  { selector: 'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]', message: 'TS-SEC-02' },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'TS-SEC-02' },
];

export default defineConfig(
  // … TS-TOOL-04 blocks for **/*.{ts,tsx}, with:
  //   'no-eval': 'error', 'no-new-func': 'error', 'no-implied-eval': 'off', '@typescript-eslint/no-implied-eval': 'error',
  //   'no-restricted-globals': ['error', fetchOnlyInHttpAdapters], 'no-restricted-syntax': ['error', ...noHtmlWrites]
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [warnAsError(reactHooks.configs.flat['recommended-latest']), pluginQuery.configs['flat/recommended-strict']],
    rules: { 'no-restricted-globals': ['error', fetchOnlyInHttpAdapters, noProcessInBrowser] },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [warnAsError(eslintReact.configs['strict-type-checked']), warnAsError(jsxA11y.configs.strict)],
    rules: Object.fromEntries(eslintReactHooksDuplicates.map((rule) => [`@eslint-react/${rule}`, 'off'])), // REACT-TOOL-03
  },
  {
    files: ['src/**/adapter/out/http/**/*.ts', 'src/platform/adapter/out/http/**/*.ts'],
    rules: { 'no-restricted-globals': ['error', noProcessInBrowser] }, // fetch allowed here only
  },
  {
    files: ['**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off', // expect(mock.method) with vitest-mock-extended
    },
  },
  { files: ['eslint.config.ts'], rules: { 'import-x/no-named-as-default-member': 'off' } },
  prettier, // stays last
);
```

> Rule and preset names follow the versions in the table. A removed rule makes ESLint fail loudly, which is intended; re-run the probe of REACT-TOOL-06 after the upgrade.

## Compiler and build

- **REACT-TOOL-08: (React SPA) `tsconfig.json` adds to TS-TOOL-01 only what React and Vite need:** `"jsx": "react-jsx"`, `"types": ["vite/client", "node"]`, `"resolveJsonModule": true`, `"noEmit": true` and `"allowImportingTsExtensions": true` (lets `vitest.config.ts` import `./vite.config.ts` with its extension, as Vite 8 asks; allowed because nothing is emitted). One tsconfig covers `src`, `test`, `e2e`, `scripts` and the root config files, because ESLint's `projectService` type-checks all of them; `test/fixtures` is excluded (it holds deliberate violations, REACT-TEST-17). All other TS-TOOL-01 checks stay on.
- **REACT-TOOL-09: TypeScript is pinned to the newest 6.0.x until typescript-eslint supports a newer line.** typescript-eslint 8.72 and 8.73 declare `typescript >=4.8.4 <6.1.0`, while TypeScript 7 is already `latest`. The update automation (TS-TOOL-15) does not propose a TypeScript version outside typescript-eslint's peer range; when typescript-eslint widens it, TypeScript moves in the same pull request.
  *Why:* type-aware lint is the main guard of TS-TOOL-03/05; an unsupported TypeScript makes typescript-eslint fail or warn on every run.
- **REACT-TOOL-10: (React SPA) The React Compiler runs as a Babel preset in the Vite build** (REACT-D1):

```ts
// vite.config.ts (excerpt)
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // …
});
```

  Packages: `@vitejs/plugin-react` 6.3, `@rolldown/plugin-babel` 0.3, `babel-plugin-react-compiler` 1.0, `@babel/core` 7.29. `react({ compiler: true })` (the Rust port, needs `oxc-transform-react`, marked experimental) is not used. After setup and after every upgrade of these packages, check that the built app chunks contain `react.memo_cache_sentinel`; without it the compiler silently did nothing. Vitest merges `vite.config.ts`, so tests run compiled code too (REACT-TEST-02). With the compiler on, components carry no manual `useMemo`, `useCallback` or `memo` unless a measurement shows the need (REACT-ARCH-05).
- **REACT-TOOL-11: (React SPA) Build settings that the gates rely on:**
  - `build.target: ['chrome119', 'edge119', 'firefox119', 'safari17']`, the browser set of TS-TOOL-02;
  - `build.sourcemap: 'hidden'`: maps are written for the error-reporting upload, without a `sourceMappingURL` comment, and removed before packaging (REACT-OBS-06, TS-SEC-05);
  - `define` holds only constants that are the same in every deployment, such as the commit; never the release version (REL-VER-05) and never a per-environment value (REACT-CFG-01).

  The other settings of `vite.config.ts` (CSP nonce placeholder, strict execution order, dev proxy) belong to [REACT-ARCH-18](../../05-building-block-view/react.md) and [REACT-SEC-04/05](../security/react.md).

## Scripts

- **REACT-TOOL-12: (React SPA) The standard scripts (TS-TOOL-10) map to the React tools like this** (Next.js: NEXT-TOOL):

| Script | Command |
|---|---|
| `generate:api` | `orval --config orval.config.ts` |
| `build` | `npm run generate:api && tsc --noEmit && vite build` |
| `lint` / `lint:fix` | `eslint . --max-warnings 0` / `eslint . --fix` |
| `format` / `format:check` | `prettier --write .` / `prettier --check .` |
| `check:arch` | `depcruise src` |
| `check:bundle` | `node scripts/check-bundle.ts` (React SPA, REACT-TOOL-13) |
| `test` | `npm run generate:api && vitest run` |
| `e2e` | `playwright test --project=stubbed-*` against the built `dist/` (REACT-TEST-18, T1 of TS-TEST-18); `npm run build` runs before it |
| `e2e:nightly` | `playwright test --project=stubbed-* --project=nightly-*` (T2 of TS-TEST-18) |
| `e2e:smoke` | `playwright test --project=smoke` against `SMOKE_BASE_URL`, a running BFF with the backend (TS-TEST-10); verify before first use |
| `verify` | `generate:api`, `format:check`, `lint`, `check:arch`, `test`, `build`, `check:bundle` |

  `check:bundle` is the one addition to `verify` and runs after `build`. Extra scripts (`dev`, `typecheck`) are allowed; none relies on a `pre*` hook (TS-TOOL-11). From a clean tree `verify` took about 26 s in the reference project.
- **REACT-TOOL-13: (React SPA) `check:bundle` enforces the bundle budgets and fails the build.** A small Node script, `scripts/check-bundle.ts` (run with plain `node` through type stripping, no dependency), reads `dist/index.html` to find the chunks that load initially (entry plus modulepreloads), gzips every chunk and fails when:
  - the initial JavaScript exceeds its budget (default 230 kB gzip);
  - a lazy chunk exceeds its budget (default 80 kB gzip);
  - an initially loaded chunk holds feature code, found by a marker such as the feature API path (`/api/v1/`) (REACT-ARCH-20, TS-ARCH-20);
  - any chunk contains `sourceMappingURL` (REACT-OBS-06);
  - `dist/config.json` exists (CFG-02, REACT-CFG-01).

  The budgets are per product; the defaults leave about 10 % headroom over the reference app (initial 206.5 kB, lazy feature chunk 54.1 kB). Raising a budget is a reviewed change that records the new value and its reason in the product's chapter 10 (quality requirements), as NG-TOOL-05. A static import of a feature composition into a routes file fails both this check and `check:arch`.
  *Why:* the initial bundle decides the first paint, and a single wrong import moves a whole feature into it without any other signal.

## Updates

- **REACT-TOOL-14: Keep the React stack current, one major at a time.** React, Vite, TanStack Router and Query, Redux Toolkit, MUI, React Hook Form, use-intl, Orval, MSW, Vitest and Playwright majors are adopted by default within six months of their release, following the library's migration guide and codemods; minor and patch releases come through the update automation (TS-TOOL-15). Packages that are released together are updated together in one pull request: `react` with `react-dom` and `@types/react*`; `@tanstack/react-query` with `@tanstack/eslint-plugin-query`; `@mui/material` with `@mui/utils`; `@playwright/test` with `playwright-core` (pinned as a dev dependency, because `@axe-core/playwright` otherwise pulls a newer `playwright-core` and the e2e types break) and the CI image's browsers. With `min-release-age` a family released over several minutes can fail with `ETARGET` (`@playwright/test` 1.65.1 passed the cooldown, its exact dependency `playwright-core` 1.65.1 did not); then stay on the previous release until the whole family is old enough. After an upgrade of the compiler packages check the compiler output (REACT-TOOL-10); after a lint plugin major re-run the probe (REACT-TOOL-06); after a typescript-eslint release re-check the TypeScript pin (REACT-TOOL-09).
- **REACT-TOOL-15 (implements TS-TOOL-21): The wall-clock ban covers all of `src/` except the platform composition and tests.** The `no-restricted-syntax` list of the `src/**/*.{ts,tsx}` block spreads `noWallClock` (TS-TOOL-21) next to `noHtmlWrites` (REACT-SEC-03); a block for `src/platform/platform.composition*.{ts,tsx}`, specs and `test/**` repeats the list without it. Code below the platform gets the clock from `createPlatform()` (REACT-ARCH-25). Next.js applies the same list to its client and server blocks, with the platform composition files as the exception.

## Skill overrides

| Skill or habit | Our rule |
|---|---|
| `vercel-react-best-practices` `rerender-memo`, `rerender-simple-expression-in-memo` and similar: wrap components in `memo()`, values in `useMemo` | React Compiler is on; no manual memoization unless measured (REACT-TOOL-10, REACT-ARCH-05) |
| `vercel-react-best-practices` `bundle-barrel-imports`: avoid barrel files | Applies to third-party packages (import `@mui/material/Button`, not `@mui/material`); each feature's `index.ts` stays its only public API (TS-ARCH-10, TS-ARCH-19) |
| `vercel-react-best-practices` `bundle-dynamic-imports`: `next/dynamic` | (React SPA) Features load through lazy route components (REACT-ARCH-20); `check:bundle` guards it (REACT-TOOL-13) |
| `vercel-react-best-practices` `async-dependencies`: add `better-all` | New dependencies are added deliberately (TS-TOOL-13); default to `Promise.all` |
| `tanstack-query-best-practices`: React Query Devtools in the app | Not in the production bundle: only through a dev-only dynamic import behind `import.meta.env.DEV`, added deliberately (TS-TOOL-13) |
| React docs and generic habit: `eslint-plugin-jsx-a11y` | `eslint-plugin-jsx-a11y-x` while the original does not support ESLint 10 (REACT-TOOL-02) |
| `@eslint-react` docs: preset `disable-conflict-eslint-plugin-react-hooks` | Keep react-hooks, switch off the `@eslint-react` copies (REACT-TOOL-03) |
| Generic habit: `size-limit` or a bundle analyzer service for budgets | `scripts/check-bundle.ts` without a dependency (REACT-TOOL-13) |
| Vite habit: `vite build --mode staging`, `VITE_*` per environment, release version in `define` | One build; runtime values from `/config.json`; `define` only for deployment-independent constants (REACT-TOOL-11, REACT-CFG-01) |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Tooling".*
