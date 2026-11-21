# Node.js Tooling

Runtime, compiler, lint and build settings for Node.js backends. The TypeScript rules in [typescript-tooling.md](typescript-tooling.md) apply (TS-TOOL-03..16) with the Node-specific settings below; TS-TOOL-01's `target`/`lib` and TS-TOOL-02 (browser matrix) are replaced by NODE-TOOL-02. Editor integration: [ide-setup.md](ide-setup.md).

## Runtime (default NODE-D1)

- **NODE-TOOL-01: The Node version is the current Active LTS line, pinned in `backend/.nvmrc`** (`26`) and in `package.json` `engines` (`"node": ">=26.13 <27"`, `"npm": ">=11.10.0"`), with `engine-strict=true` (TS-TOOL-14). CI and the image build use the same major. Move to the next LTS line when it becomes Active LTS (October), as a reviewed change; odd majors are never used.

## Compiler

- **NODE-TOOL-02: `tsconfig.json` uses the TS-TOOL-01 checks with Node settings:**

```jsonc
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2025",
    "lib": ["ES2025"],              // no DOM in a backend
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "rootDir": ".",
    "outDir": "dist",
    "sourceMap": true,
    "experimentalDecorators": true,  // NestJS DI (NEST-LIB-05)
    "emitDecoratorMetadata": true,
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
  },
  "include": ["src", "test", "scripts", "vitest.config.ts", "eslint.config.ts"]
}
```

  `tsconfig.build.json` extends it with `"rootDir": "src"`, `"include": ["src"]` and excludes `src/**/*.test.ts`. `@types/node` matches the Node major. Relative imports carry the `.js` extension (ESM).
- **NODE-TOOL-03: Production runs compiled JavaScript.** `npm run build` (`tsc -p tsconfig.build.json`) writes `dist/`; the image starts `node --import ./dist/instrumentation.js dist/main.js` (NEST-OBS-05). No `ts-node`, `tsx` or Node's type stripping in production (type stripping cannot run decorators).

## Lint and format

- **NODE-TOOL-04: ESLint uses the TS-TOOL-04 config** (template: `.agents/skills/baseline-nestjs/templates/eslint.config.ts`, which contains every rule of NODE-TOOL-05), with ESLint 9: `eslint-import-resolver-typescript` still pulls in `eslint-plugin-import`, whose peer range ends at ESLint 9. Move to ESLint 10 when the resolver allows it. `npm run lint` runs `eslint . --max-warnings 0` (TS-TOOL-05).
- **NODE-TOOL-05: Node backends add these rules** to the shared set:

| Rule | Setting | Why |
|---|---|---|
| `no-restricted-properties` on `process.env`, plus `no-restricted-imports` for `process` and `node:process` (catches `import { env } from 'node:process'`) | error; off in `src/platform/config/**`, `*.test.ts` and `scripts/**` | NODE-ARCH-12 ([configuration/nestjs.md](../configuration/nestjs.md)) |
| `no-restricted-globals` for `fetch` | error | HTTP calls import `fetch` and `Agent` from `undici` with explicit timeouts ([resilience/nestjs.md](../resilience/nestjs.md)) |
| `no-console` | error | pino only ([logging/nestjs.md](../logging/nestjs.md)) |
| `no-restricted-imports` for `child_process`, `vm` (with and without `node:`) | error | No child processes or dynamic code ([security/nestjs-hardening.md](../security/nestjs-hardening.md)) |
| `no-eval`, `no-new-func`, `@typescript-eslint/no-implied-eval`, `no-restricted-syntax` for `import()` of a computed path | error | Same |
| `eslint-plugin-security`: `detect-non-literal-regexp`, `detect-non-literal-require`, `detect-non-literal-fs-filename` | error | NEST-SEC-24/26 |
| `eslint-plugin-regexp`: `no-super-linear-backtracking`, `no-super-linear-move` | error | ReDoS (NEST-SEC-24); precise, so `security/detect-unsafe-regex` stays off |
| `no-restricted-syntax` on owner, tenant, role and audit fields in `*Request` schemas, in `adapter/in/rest/**` | error | Mass assignment (NEST-SEC-27) |
| `@typescript-eslint/no-floating-promises`, `no-misused-promises` | error (in `strictTypeChecked`) | NODE-ARCH-11 |
| `no-restricted-globals` for `Intl`, `no-restricted-properties` for `toLocale*` and `localeCompare`, in `domain`, `ports` and `application` | error | No locale logic in the core (NEST-I18N-05) |
| `@typescript-eslint/no-extraneous-class` | `allowWithDecorator: true` | Nest modules are empty decorated classes |
| `@typescript-eslint/no-unsafe-class-instance-assignment` | off | Nest types its option objects as classes; object literals are the documented way to pass them |
| `@typescript-eslint/unbound-method` | off in `*.test.ts` | `expect(mock.method)` with vitest-mock-extended |

- **NODE-TOOL-06: Prettier as in TS-TOOL-08** (`printWidth: 120`, `singleQuote`, `trailingComma: all`); `.prettierignore` lists `dist/`, `coverage/`, `openapi/` and generated folders.

## Standard npm scripts

- **NODE-TOOL-07: Every Node backend offers these script names** (TS-TOOL-10 for backends):

| Script | Does |
|---|---|
| `build` | `tsc -p tsconfig.build.json` |
| `start` | `node --import ./dist/instrumentation.js dist/main.js` (local check of the built app, started as the image starts it) |
| `start:dev` | Watch mode against local services ([nestjs-local-development.md](../../07-deployment-view/nestjs-local-development.md)) |
| `typecheck` | `tsc -p tsconfig.json --noEmit` (includes tests and scripts) |
| `lint` / `lint:fix` | ESLint with `--max-warnings 0` |
| `format` / `format:check` | Prettier write / check |
| `check:arch` | `depcruise src` (NODE-ARCH-13) |
| `check:unused` | `knip`: unused dependencies, exports and files (TS-TOOL-17) |
| `test` | Unit and adapter tests without Docker (`vitest run --project unit`) |
| `test:it` | Container-backed tests (`vitest run --project it`), needs Docker |
| `test:coverage` | `vitest run --project unit --coverage`: coverage report, no threshold (NEST-TEST-13) |
| `openapi` | Regenerates the committed spec: `OPENAPI_UPDATE=true vitest run --project unit openapi`; without the variable the same test fails on a difference ([api/nestjs-openapi.md](../api/nestjs-openapi.md)) |
| `generate:api` | Generates outbound clients with Orval, only when the service has some; `build`, `typecheck` and `test` call it first |
| `migrate` | `node dist/migrate.js`: migrate-only entrypoint ([nestjs-delivery.md](../../07-deployment-view/nestjs-delivery.md)) |
| `check:migrations` | `node scripts/check-migrations.mjs`: merged migrations unchanged (NEST-DB-19 in [persistence/nestjs.md](../persistence/nestjs.md)) |
| `verify` | The local gate from a clean checkout: `format:check`, `lint`, `typecheck`, `check:arch`, `check:migrations`, `check:unused`, `test`, `test:it`, `build` |

  Scripts never rely on `pre*`/`post*` hooks (`ignore-scripts=true`, TS-TOOL-11). `verify` is what the backend's CI job runs (REPO-CI-01).

## Dependencies and supply chain

- **NODE-TOOL-08: TS-TOOL-11..16 apply unchanged** (`.npmrc` with `ignore-scripts=true`, `allow-git=none`, `min-release-age=7`, `engine-strict=true`; `npm ci`; lockfile review; scanning; update automation; reproducible builds). The NestJS reference set installs and runs with `ignore-scripts=true` (SWC uses prebuilt optional packages). A package that needs its install script is allow-listed with `npm rebuild <pkg> --ignore-scripts=false` in the setup docs, the Dockerfile or build step, and CI.
- **NODE-TOOL-09: Production dependencies are kept apart from dev dependencies.** The image installs with `npm ci --omit=dev`; the SBOM (`@cyclonedx/cyclonedx-npm --omit dev`, TS-TOOL-16) covers what runs (SEC-CI-03).
- **NODE-TOOL-10: `package.json` keeps `"version": "0.0.0"`.** The release version is injected at deploy time, never built in (NEST-REL-06); the field must exist for npm tooling.

*Agent checklist in [checklists/node.md](../../checklists/node.md) and sources in [sources.md](../../sources.md), section "Node.js Tooling".*
