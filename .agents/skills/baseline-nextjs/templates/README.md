# Next.js templates

A complete, minimal Next.js 16 app (App Router, React 19 with the React Compiler, Turbopack, standalone output) that is its own image and the BFF of its browser users (NEXT-D2): platform rings with three entry points, BFF login and session (`openid-client`, Redis, a separate pre-login cookie, single-flight token refresh), API proxy with one deadline per call, client error intake, `proxy.ts` with nonce CSP, Trusted Types default policy and the origin gate for page writes, validated server configuration with its public subset, telemetry, logs, probes, test stubs behind the environment guard, one example feature `orders` (server-rendered list, client panel, server action, TanStack Query, Redux Toolkit, React Hook Form, MUI 9, next-intl), tests and tooling (NEXT-ARCH-12). It was validated as a whole on 2026-11-21 from a fresh copy made with this README: `npm install` (no lockfile), `npm run verify` (generate, format, lint, typecheck, dependency-cruiser, unit, component and Testcontainers tests, build, bundle check), `npm run e2e` (built standalone server in test mode: Chromium, Firefox, dark and high-contrast), `docker build` and `docker run --read-only` against Redis (`/livez`, `/readyz`). Versions in `package.json` were at least 7 days old then (`min-release-age`, TS-TOOL-11).

Copy everything except this README into `frontend/` (REPO-TOOL-03), then:

1. Rename the app: `name` in `package.json`, `service` in `src/platform/adapter/out/logging/logger.ts`, `serviceName` in `src/telemetry.ts`, `app.title` in `messages/*.json` and the title template in `src/app/layout.tsx`.
2. Set the spec name in `orval.config.ts` (`./openapi/<api>.yaml`). In a product repo, delete the example spec in `openapi/`: `npm run copy:api-spec` (run by `generate:api`) copies `../backend/openapi/*.yaml` there, `.gitignore` keeps the copy out of git, and CI runs `npm run copy:api-spec` before `docker build` (NEXT-REL-06, TS-API-01). In a separate frontend repository keep the spec in `openapi/` and delete the `/openapi/` line of `.gitignore`.
3. Rename the example feature `orders` (folder, file names, `src/app/orders/`, the redirect in `src/app/page.tsx`, catalog namespace, Orval output names, the stubs in `src/backend-stubs.ts`, `e2e/orders.spec.ts`) or keep it as the model for the first real feature and delete it afterwards. The fixture tree under `test/fixtures/arch-violation/` stays as it is.
4. Set the values of `env.development` and `configuration-keys.yaml` for the product (client id, backend URL); both hold no real secret.
5. Run `npm install` once to create the lockfile, then `npm run verify` and `npm run e2e`. Docker must be running: the session-store test and the E2E server start Redis with Testcontainers.

| Template | Goes to | Notes |
|---|---|---|
| `package.json` | `frontend/package.json` | Exact pins, `engines`, scripts per NEXT-TOOL-07; msw and faker under `dependencies` (NEXT-REL-19); then always `npm ci` |
| `npmrc`, `nvmrc`, `gitignore`, `dockerignore`, `prettierrc.json`, `prettierignore`, `dependency-cruiser.cjs`, `env.development` | `frontend/.<name>` (renamed with a leading dot) | TS-TOOL-11; NEXT-REL-07; NEXT-ARCH-13; `.env.development` is committed with throwaway values (NEXT-DEV-03) |
| `next.config.ts`, `tsconfig.json`, `eslint.config.ts`, `vitest.config.ts`, `vitest.setup-dom.ts`, `playwright.config.ts`, `orval.config.ts` | `frontend/` | NEXT-TOOL-01/03/05/06, NEXT-TEST, NEXT-API-01 |
| `compose.yaml` | `frontend/compose.yaml` | Redis for `npm run dev` (NEXT-DEV-01/02) |
| `configuration-keys.yaml` | `frontend/configuration-keys.yaml` | Checked against the schema by `src/platform/config/configuration-keys.spec.ts` (NEXT-CFG-09) |
| `Dockerfile` | `frontend/Dockerfile` | Base images pinned by digest; the update automation bumps them (NEXT-REL-06) |
| `messages/` | `frontend/messages/` | next-intl catalogs (NEXT-I18N) |
| `openapi/` | `frontend/openapi/` | Example spec for `orders`; in a product repo replaced by the gitignored copy of the backend's spec (`npm run copy:api-spec`), kept only in a separate frontend repository |
| `src/` | `frontend/src/` | `app/` (routes and root composition), `platform/` (BFF, configuration, HTTP, logging, OIDC, session), `features/orders/`, `shared/ui/`, `testing/`, `proxy.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `telemetry.ts`, `backend-stubs.ts` (NEXT-ARCH-01..11) |
| `test/` | `frontend/test/` | The dependency-cruiser canary with `fixtures/arch-violation` (NEXT-ARCH-13, NEXT-TEST-17), the one-build check (NEXT-CFG-01) |
| `e2e/` | `frontend/e2e/` | `stubbed-server.ts` (standalone server in test mode with Redis), `fixtures.ts` (login through the real BFF, CSP and axe checks), `orders.spec.ts` (NEXT-TEST-12..15) |
| `scripts/check-bundle.mjs`, `scripts/copy-api-spec.mjs` | `frontend/scripts/` | Gzip budgets, no source maps (NEXT-TOOL-08); the backend's spec into `openapi/` (NEXT-REL-06) |

Locally: `docker compose up -d --wait`, then `npm run dev`; backend and IdP are stubs inside the server (`APP_TEST_STUBS=1`, NEXT-DEV-05). Against a real backend and IdP: NEXT-DEV-06/07.

Not in the template, add when the product needs it (marked "verify before first use" in the docs): the back-channel logout route, logout UI, audit events and the CSP report endpoint (NEXT-SEC-02/03), the language switch (NEXT-I18N-10), metrics (NEXT-OBS-03), the previous release's static files in the image (NEXT-REL-16), WebKit once the E2E server has HTTPS (NEXT-TEST-16), the locale Playwright projects, an `@shell` spec for the forced-colors project and the `e2e:nightly`/`e2e:smoke` scripts (NEXT-TOOL-07, NEXT-TEST-15; the viewport and forced-colors projects are in `playwright.config.ts`, marked verify before first use), the Keycloak profile of `compose.yaml` (NEXT-DEV-06).
