# Next.js: Tooling

Next.js additions to [typescript-tooling.md](typescript-tooling.md) (TS-TOOL-*) and [react-tooling.md](react-tooling.md) (REACT-TOOL-*): `next.config.ts`, Turbopack and the React Compiler, the tsconfig settings Next.js forces, the ESLint set with `@next/eslint-plugin-next`, the script mapping, the bundle check, telemetry, the agent files `next dev` writes, and upgrades. The React rules marked "(React SPA)" (Vite build, Vite tsconfig, Vite bundle check) are replaced here; all other REACT-TOOL rules apply. Local dev server and debugging: [nextjs-local-development.md](../../07-deployment-view/nextjs-local-development.md). Editor setup: [ide-setup.md](ide-setup.md).

## Configuration and build

- **NEXT-TOOL-01: `next.config.ts` sets exactly these options** (Replaces REACT-ARCH-18 and REACT-TOOL-11 for Next.js):
  - `output: 'standalone'`: the image runs `.next/standalone/server.js` (NEXT-D2, [nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md));
  - `reactCompiler: true` with the dev dependency `babel-plugin-react-compiler` (NEXT-TOOL-02);
  - `poweredByHeader: false`: no `X-Powered-By` header;
  - `images: { unoptimized: true }`: no image optimizer at runtime, which would write to the filesystem (read-only root filesystem, REL-RUN-02) and add an outbound fetcher; images are prepared at build time or served as they are;
  - `experimental.serverActions.bodySizeLimit` (`'100kb'` in the reference app, per product): server-action options are still under `experimental` in 16.4, so `next build` prints an "Experiments: serverActions" line, which is expected; `allowedOrigins` stays unset ([security/nextjs.md](../security/nextjs.md));
  - `agentRules: false` (NEXT-TOOL-10);
  - `turbopack: { root: import.meta.dirname }`: the component folder is the workspace root. Without it Next.js picks the folder of the outermost lockfile it finds above the project, and a `package-lock.json` in a parent folder (a developer's home, a root-level tool) moves `server.js` to `.next/standalone/<path>/` and breaks `npm run start`, `npm run e2e` and the image (*verified* with a lockfile two levels up);
  - wrapped by `createNextIntlPlugin('./src/platform/adapter/in/i18n/request.ts')` from `next-intl/plugin` ([i18n/nextjs.md](../i18n/nextjs.md)).

  Left at their defaults on purpose: `productionBrowserSourceMaps` (off: no `sourceMappingURL` in the client chunks, TS-SEC-05; verified), `typescript.ignoreBuildErrors` (off), `typedRoutes` (off). Never set: `env` (inlines values at build time, CFG-02), `assetPrefix` or `basePath` per environment, `webpack` (NEXT-TOOL-02), `cacheComponents` or `experimental.agentFeedback` (NEXT-ARCH-10, NEXT-TOOL-09). A deployment identifier for version skew (`deploymentId`) belongs to [nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md).

```ts
// next.config.ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/platform/adapter/in/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  poweredByHeader: false,
  images: { unoptimized: true }, // no image optimizer: read-only root filesystem (REL-RUN-02)
  agentRules: false, // the baseline's AGENTS.md routes agents (NEXT-TOOL-10)
  turbopack: { root: import.meta.dirname }, // never a lockfile in a parent folder: server.js stays at .next/standalone/
  experimental: {
    serverActions: { bodySizeLimit: '100kb' },
  },
};

export default withNextIntl(nextConfig);
```

- **NEXT-TOOL-02: Turbopack builds and serves; the React Compiler runs through `reactCompiler: true`.** Next.js 16 uses Turbopack for `next dev` and `next build` by default; no `--webpack` flag and no `webpack` config. After setup and after every upgrade of `next` or `babel-plugin-react-compiler`, check that the built client chunks contain `react.memo_cache_sentinel` (`grep -rl memo_cache_sentinel .next/static/chunks`; four chunks in the reference app); without it the compiler silently did nothing. Replaces REACT-TOOL-10 for Next.js. Turbopack's chunk loader assigns strings to `script.src`, which is why the Trusted Types default policy exists ([security/nextjs.md](../security/nextjs.md)); re-run the Trusted Types E2E after every Next.js upgrade.
- **NEXT-TOOL-03: `tsconfig.json` is TS-TOOL-01 complete plus what Next.js forces and needs** (Replaces REACT-TOOL-08 for Next.js):
  - **forced by Next.js**, which rewrites the file on the first build if they are missing: `"allowJs": true`, `"incremental": true`, `"plugins": [{ "name": "next" }]`, and `include` entries `next-env.d.ts`, `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`. They are accepted as written; `allowJs` changes nothing because the project has no JavaScript sources besides the bundle-check script and the config files. Next.js writes the file in its own JSON style, so run `prettier --write tsconfig.json` once after the first build (`format:check` fails otherwise);
  - **needed**: `"jsx": "react-jsx"` (accepted by Next.js), `"module": "preserve"`, `"moduleResolution": "bundler"`, `"types": ["node", "trusted-types"]` (TypeScript 6 no longer includes `@types/*` automatically), `"resolveJsonModule": true`, `"noEmit": true`, `"allowImportingTsExtensions": true` (the E2E server script runs with Node.js type stripping and imports `.ts` files), `"paths": { "@/*": ["./src/*"] }`;
  - one tsconfig for `src`, `test`, `e2e` and the root config files, `test/fixtures` excluded. `exactOptionalPropertyTypes` stays on; it caused no breakage with the Next.js, MUI, RTK or React Hook Form types.
- **NEXT-TOOL-04: `next build` type-checks every file in the tsconfig `include`, specs and E2E files too.** The image build therefore copies no test code: `.dockerignore` excludes `e2e`, `test`, `**/*.spec.ts`, `**/*.spec.tsx` and `src/testing` (the reference build failed on spec-only jest-dom types until it did). `typecheck` (`tsc --noEmit`) runs separately in `verify`, so tests are type-checked outside the image build. `next-env.d.ts` is generated: it is gitignored and in `.prettierignore`.

## ESLint

- **NEXT-TOOL-05: ESLint runs the React set (REACT-TOOL-01..07) plus `@next/eslint-plugin-next` with `configs['core-web-vitals']`, raised to errors, through `eslint` itself** (NEXT-D9). `next lint` no longer exists in Next.js 16 (the CLI treats `lint` as a directory name). `eslint-config-next` is not used: it brings its own React, hooks, import and accessibility plugins, which duplicate or conflict with the React set and its ESLint 10 choices (REACT-TOOL-02). The Next.js plugin preset ships warnings, so it goes through the same `warnAsError()` helper as the React presets (REACT-TOOL-04). `@next/next/no-html-link-for-pages` is off: it checks a `pages/` directory, which an App Router project does not have. The plugin is proven to fire like every plugin (REACT-TOOL-06), for example with `@next/next/no-img-element`.

```ts
// eslint.config.ts (Next.js part; the TS-TOOL-04 and REACT-TOOL blocks come first)
import nextPlugin from '@next/eslint-plugin-next';

{
  files: ['src/**/*.{ts,tsx}'],
  plugins: { '@next/next': nextPlugin },
  rules: {
    ...warnAsError({ rules: nextPlugin.configs['core-web-vitals'].rules ?? {} }).rules, // `rules` is optional in the plugin's types
    '@next/next/no-html-link-for-pages': 'off', // Pages Router rule; the app has no pages/ directory
  },
},
```

  `@eslint-react` runs with `strict-type-checked` (REACT-TOOL-01) on the `.tsx` code, async server components included, without exceptions (*verified* in the template). The server-action files are `.ts`, so a separate block turns on its `rsc-function-definition` rule for `src/**/adapter/in/next/*-actions.ts`: it reports a non-async export of a `'use server'` file (*verified* with a probe).

- **NEXT-TOOL-06: ESLint carries the Next.js bans that dependency-cruiser cannot:**
  - `no-restricted-properties` forbids `process.env` everywhere except `src/platform/config/**`, `src/instrumentation.ts`, the root `*.config.ts` files and `e2e/**` (CFG-09). This replaces the `process` part of REACT-TOOL-05 for Next.js, because server code legitimately uses `process` (signals, `NEXT_RUNTIME`); a client component that reads `process.env` would get a value inlined at build time (NEXT-D7). The `fetch` ban of REACT-TOOL-05 applies unchanged;
  - `no-restricted-syntax` with the selector `Program > ExpressionStatement[directive="use client"]` in every file except `**/*.client.tsx`, `**/*.composition.tsx`, `src/features/*/*.api.tsx`, `src/app/providers.tsx`, `src/app/app-shell.tsx` and `src/app/theme.ts`, and `Program > ExpressionStatement[directive="use server"]` in every file except `src/**/adapter/in/next/*-actions.ts`. This closes the blind spot of dependency-cruiser, which decides client-ness by file name (NEXT-ARCH-06, NEXT-ARCH-13). Because ESLint replaces a rule's options per block, each block repeats the HTML-writing selectors of REACT-TOOL-05. Both selectors fire with the typescript-eslint parser on `.ts` and `.tsx` files (*verified* with a probe file).

## Scripts and bundle check

- **NEXT-TOOL-07: The standard scripts (TS-TOOL-10) map to the Next.js tools like this** (Replaces REACT-TOOL-12 for Next.js):

| Script | Command |
|---|---|
| `copy:api-spec` | `node scripts/copy-api-spec.mjs`: the backend's `../backend/openapi/*.yaml` into `openapi/` (gitignored in a product repository); no-op without `../backend/openapi` ([NEXT-REL-06](../../07-deployment-view/nextjs-delivery.md)) |
| `generate:api` | `npm run copy:api-spec && orval` |
| `dev` | `npm run generate:api && next dev --hostname localhost` (loopback only, NEXT-DEV-08) |
| `dev:debug` | `next dev --hostname localhost --inspect` (inspector on `127.0.0.1:9229`, NEXT-DEV-11) |
| `build` | `npm run generate:api && next build` |
| `start` | `node .next/standalone/server.js` |
| `typecheck` | `tsc --noEmit` |
| `lint` / `lint:fix` | `eslint . --max-warnings 0` / `eslint . --fix` |
| `format` / `format:check` | `prettier --write .` / `prettier --check .` |
| `check:arch` | `depcruise src` |
| `check:bundle` | `node scripts/check-bundle.mjs` (NEXT-TOOL-08) |
| `test` | `npm run generate:api && vitest run` |
| `e2e` | `npm run build && playwright test`: against the built standalone server in test mode ([testing/nextjs.md](../testing/nextjs.md)) |
| `e2e:nightly`, `e2e:smoke` | `playwright test` with the projects of TS-TEST-18 and the smoke project (not in the template yet: to verify before first use) |
| `verify` | `generate:api`, `format:check`, `lint`, `typecheck`, `check:arch`, `test`, `build`, `check:bundle` |

  `typecheck` and `check:bundle` are the additions to `verify`; `check:bundle` runs after `build`. None relies on a `pre*` hook (TS-TOOL-11). `next build` takes 5–7 s for the template.
- **NEXT-TOOL-08: `check:bundle` enforces gzip budgets over the client chunks and fails the build** (Replaces REACT-TOOL-13 for Next.js). A small Node script without dependencies, `scripts/check-bundle.mjs`, gzips every `.js` file under `.next/static/chunks` and fails when:
  - the total client JavaScript exceeds its budget (default 400 KiB gzip; the reference app has 341 KiB, including a ~37 KiB `noModule` polyfill chunk);
  - the largest chunk exceeds its budget (default 150 KiB gzip; reference 70 KiB);
  - any chunk contains `sourceMappingURL` (TS-SEC-05).

  The App Router writes no `index.html`, so the script cannot tell initial from lazy chunks the way REACT-TOOL-13 does; the total and the largest chunk are the signals. The budgets are per product; raising one is a reviewed change that records the new value and its reason in the product's chapter 10 (quality requirements), as NG-TOOL-05. The template's script also fails when a `.map` file would be served.

## Telemetry and agents

- **NEXT-TOOL-09: Next.js telemetry is off in CI, in the image and on developer machines.** The Dockerfile sets `NEXT_TELEMETRY_DISABLED=1` in the build and the runtime stage, CI sets it for every job, and developers run `npx next telemetry disable` once (or set the variable). Telemetry sends usage data to Vercel, a recipient the product has not assessed (DP-MIN-02). `experimental.agentFeedback` stays off; it requires telemetry and instructs agents to prepare reports and run `npx next internal agent-feedback-instructions`.
- **NEXT-TOOL-10: `next dev` writes no agent instructions: `agentRules: false` in `next.config.ts`; the baseline's synced `AGENTS.md` is the only one** (NEXT-D12, NEXT-DEV-09). Verified with Next.js 16.4.6:
  - when `next dev` detects a coding agent (through `@vercel/detect-agent`, environment variables such as `CLAUDECODE` or `AI_AGENT`), it writes a managed block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` into `AGENTS.md` **in the folder it runs in**, creating the file if missing and appending the block to an existing file. It writes no `CLAUDE.md`. Without an agent in the environment it writes nothing;
  - in a product repository it runs in `frontend/` (REPO-TOOL-03), so it creates `frontend/AGENTS.md`, a second instruction file that agents load next to the root one and that tells them to follow the framework docs; where the component folder is the repository root, it appends to the synced `AGENTS.md` below the baseline block, and the sync keeps it there as a project note;
  - `agentRules: false` stops it, and the next `next dev` run removes an existing block; a file that held only the block is deleted.

  An `AGENTS.md` or `CLAUDE.md` in a component folder is never committed; one that appears is deleted after `agentRules: false` is set. The baseline's rules win over the Next.js block and over `create-next-app`'s agent files (NEXT-ARCH-12).
- **NEXT-TOOL-11: For Next.js APIs, agents read the docs bundled with the installed version, and the baseline docs win where they differ.** Next.js 16.2 and later ship their documentation in `node_modules/next/dist/docs/` (App Router guides, API reference, upgrade guides), matching the installed version. Agents look up APIs and options there, from the component folder, instead of relying on training data or `latest` web pages; this is what the generated block would have said. Where the bundled docs and these docs disagree (data fetching in server components, caching, `create-next-app`, Pages Router examples), the baseline wins (TOOL-SKL-01).

## Updates

- **NEXT-TOOL-12: Keep Next.js current, one major at a time, through the update automation.** Minor and patch releases come through the update automation (TS-TOOL-15); majors are adopted by default within six months, following the version's upgrade guide in `node_modules/next/dist/docs/01-app/02-guides/upgrading/` and its codemods run with an exact version (`npx @next/codemod@<version> …`), never `@latest` or `@canary` (TS-TOOL-13). Agents do not run `next upgrade --agent`, which installs a canary CLI; when an upgrade reminder of `next dev` or `next build` (`experimental.agentUpgrade`, default `security`) stops a command, the agent reports it to the developer and continues the task. Packages released together are updated together: `next` with `@next/eslint-plugin-next`; `@mui/material` with `@mui/material-nextjs`, whose import path names the Next.js major (`@mui/material-nextjs/v16-appRouter`); `next-intl` and `babel-plugin-react-compiler` checked against the new `next`. After a Next.js upgrade re-check: the compiler output (NEXT-TOOL-02), the options still under `experimental` (NEXT-TOOL-01), the `proxy.ts` contract and the server-action origin gate, the CSP and Trusted Types E2E, `deploymentId` and server-action skew ([nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md)), and the lint probe (REACT-TOOL-06).

## Skill overrides

| Skill or habit | Our rule |
|---|---|
| Next.js docs and generic habit: `next lint`, `eslint-config-next` | ESLint directly with the React set and `@next/eslint-plugin-next` (NEXT-TOOL-05) |
| Next.js docs: `create-next-app` with Tailwind, its `AGENTS.md` and agent feedback | Template of `baseline-nextjs` (NEXT-ARCH-12); `agentRules: false` (NEXT-TOOL-10) |
| Generated `AGENTS.md` block "This is NOT the Next.js you know" in the component folder | Not kept; bundled docs for API lookup, baseline docs win (NEXT-TOOL-10, NEXT-TOOL-11) |
| `next upgrade --agent`, `npx @next/codemod@latest`, `@canary` | Update automation, codemods with an exact version (NEXT-TOOL-12) |
| Next.js skills `next-dev-loop` (global `agent-browser@latest`), `next-bundle-optimizer` | Not installed; `playwright-cli` and `check:bundle` (NEXT-TOOL-08) |
| `env` in `next.config`, `NEXT_PUBLIC_*` for environment values | Runtime configuration from the server (NEXT-D7, NEXT-TOOL-06) |
| `webpack()` customisation, `--webpack` | Turbopack (NEXT-TOOL-02) |
| `size-limit`, `@next/bundle-analyzer` as a gate | `scripts/check-bundle.mjs` (NEXT-TOOL-08); an analyzer only for a one-off investigation |
| Telemetry left at its default | Disabled everywhere (NEXT-TOOL-09) |

*Agent checklist in [checklists/nextjs.md](../../checklists/nextjs.md) and sources in [sources.md](../../sources.md), section "Next.js: Tooling".*
