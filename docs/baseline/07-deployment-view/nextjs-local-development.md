# Next.js: Local Development

How a developer, an agent or the backend team runs the Next.js component on a laptop: Docker Compose for the session store, Node from `.nvmrc`, `next dev` with a committed `.env.development`, either against stubs inside the server or against a real backend and IdP. Tests use Testcontainers instead ([testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md)). Configuration keys: [configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md). Image and runtime: [nextjs-delivery.md](nextjs-delivery.md). All commands run from `frontend/` (REPO-TOOL-03).

Everything marked *verified* was checked on 2026-11-20 with Next.js 16.4.6, Node 26 and Docker 29.8. Everything marked *to verify before first use* is listed in [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Rules

### Services

- **NEXT-DEV-01: `frontend/compose.yaml` defines every infrastructure dependency the Next.js server uses:** Redis as the session store (NODE-BFF-03), or Postgres where the product chose it. Docker and Node are the only prerequisites. It is a component file (REPO-LAY-05). Developers start the services with `docker compose up -d --wait` and the dev server separately (NEXT-DEV-08). The session store has no Compose profile; optional extras use profiles (`auth` for a local IdP, NEXT-DEV-06).
- **NEXT-DEV-02: Images are pinned, ports bind to `127.0.0.1`, credentials are throwaway.** The Redis image is the production major.minor and the same tag the Testcontainers tests use (`redis:8.4-alpine` in the reference build). No `latest`; images that CI starts are pinned by digest (SEC-CI-02) and updated by the update automation (TS-TOOL-15). The file contains no real secret (SEC-INC-03).

```yaml
# frontend/compose.yaml
services:
  redis:
    image: redis:8.4-alpine                 # production major.minor; same as the Testcontainers tests
    ports: ["127.0.0.1:6379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s, timeout: 3s, retries: 20 }
```

### Configuration

- **NEXT-DEV-03: Local configuration is the committed `.env.development`.** `next dev` loads it (*verified*: the start line reports `Environments: .env.development`); per the Next.js documentation, `next build` does not. It holds the throwaway values that match `compose.yaml` and the stubs (`APP_ORIGIN`, `API_BASE_URL`, `OIDC_*`, `REDIS_URL`, `APP_ENVIRONMENT_KIND=local`, `APP_TEST_STUBS`, `OTEL_SDK_DISABLED=true`), nothing machine-specific and no real secret. Personal overrides go into `.env.development.local`, which the `.env*.local` pattern in `.gitignore` keeps out of git. No committed `.env`, `.env.local` or `.env.production`: per the same documentation, Next.js loads `.env` and `.env.production` during `next build`, which would turn them into build-time configuration (CFG-02/04). The key list is `configuration-keys.yaml` (CFG-12), not an `.env.example`.
- **NEXT-DEV-04: The Node version comes from `.nvmrc`** (`nvm use`, `fnm use` or the IDE), the same major as CI and the image (TS-TOOL-14).

### Running against stubs or a real backend

- **NEXT-DEV-05: The default local mode runs the backend and the IdP as stubs inside the Next.js server** (NEXT-D5). With `APP_TEST_STUBS=1`, `instrumentation.ts` starts MSW with the contract's Orval handlers and the IdP stub handlers before the first request. *Verified in `next dev`:* `/livez` and `/readyz` up, `/auth/login` redirects with a discovery document from the stub, the callback creates a session in the Compose Redis, and `/orders` renders server-side with stub data. The flag is guarded: the stubs start only when `APP_ENVIRONMENT_KIND` is `local` or `test`; the configuration schema refuses the flag with `deployed`, asserted by a unit test (NEXT-CFG-07, *verified*: `deployed` exits with code 1).
  - Limit: the browser cannot finish a login against the stub IdP. The login redirects the browser to the stub's `authorize` URL, which exists only inside the server's MSW; the E2E login fixture answers that request itself. So the stub mode serves automated tests, scripts (`curl` through login and callback by hand, *verified*) and work on the server side. Clicking through the UI needs a real IdP (NEXT-DEV-06).
- **NEXT-DEV-06: Interactive login locally uses a local OIDC provider or the test environment's IdP.** Option A: Keycloak under the Compose profile `auth` (`docker compose --profile auth up -d`), pinned to the IdP version production uses, with a dev realm imported from `dev/keycloak/` (a confidential client with redirect URI `http://localhost:3000/auth/callback` and post-logout URI `http://localhost:3000/`, throwaway secret, a few test users without personal data, DP-ENV-01). Option B: a client registered for local use at the test environment's IdP; its secret goes into `.env.development.local`, never into git. *To verify before first use:* the Keycloak option with this app, and how the issuer URL rule fits it (the reference schema accepts only `https` issuers, so a local Keycloak needs HTTPS or the schema allows `http://localhost` only in a local environment).
- **NEXT-DEV-07: Against a real backend, the developer starts it from `backend/` with its own setup** and sets `API_BASE_URL` to it and `APP_TEST_STUBS=0` in `.env.development.local`. The backend must trust the same IdP as the frontend's login (NEXT-DEV-06), because the BFF relays the user's access token. No orchestrator or shared Compose file across components (REPO-LAY-04).

### Dev server and debugging

- **NEXT-DEV-08: `npm run dev` is `next dev --hostname localhost`** (Turbopack is the default in Next.js 16), after `generate:api`. `next dev` binds to `0.0.0.0` by default (*verified* in `next dev --help`), which exposes the dev server and its stubs to the network; `--hostname localhost` binds to loopback only (*verified*; on the reference host only `::1`, which browsers and `curl` reach as `localhost`). `APP_ORIGIN` is exactly the URL in the browser (`http://localhost:3000`), because the OIDC redirect URI and the server-action origin check derive from it (NEXT-SEC). The `__Host-session` cookie is `Secure`; Chromium and Firefox accept it on `http://localhost`, WebKit does not (*verified*), so Safari needs HTTPS locally (`next dev --experimental-https`, *to verify before first use*).
- **NEXT-DEV-09: `next.config.ts` sets `agentRules: false`.** Without it `next dev` writes an `AGENTS.md` into the component folder and re-adds it after every deletion (*verified* in 16.4.6; `agentRules: false` stops it, *verified*). The file tells agents to follow the framework docs in `node_modules`; in a baseline project the root `AGENTS.md` routes agents and the baseline docs win.
- **NEXT-DEV-10: The dev server is not the production server.** It runs `instrumentation.ts` and the proxy like production (*verified*), but compiles on demand and uses React's development build. Behaviour that depends on the build (chunks, nonces on every script, Trusted Types, caching, the read-only filesystem, shutdown) is checked against the built server: `npm run build` and the E2E server script, or the image (`docker build`, then `docker run --read-only --cap-drop ALL --security-opt no-new-privileges` with the Compose Redis). *To verify before first use:* whether the strict CSP of `proxy.ts` lets hot reload and React's development tooling work in the browser; the policy is never loosened for production to make dev work.
- **NEXT-DEV-11: Debugging uses `npm run dev:debug` = `next dev --hostname localhost --inspect`.** The inspector listens on `127.0.0.1:9229` in the `next-server` process (*verified*), which runs server components, route handlers, server actions and `proxy.ts`; attach from the IDE. Client components are debugged in the browser's developer tools. Never `--inspect=0.0.0.0`, never an inspector in an image or a deployed environment.
- **NEXT-DEV-12: No bash or PowerShell start-up scripts.** Compose and npm scripts cover starting, stopping and resetting (TOOL-SKL-08); a script that becomes unavoidable is a Node `.mjs` or `.ts` file (like the E2E server script).
- **NEXT-DEV-13: A backend developer gets a working frontend with one command line:** `cd frontend && docker compose up -d --wait && npm ci && npm run dev`, then points `API_BASE_URL` at the local backend and the login at the shared local IdP (NEXT-DEV-06/07).

*Agent checklist in [checklists/nextjs.md](../checklists/nextjs.md) and sources in [sources.md](../sources.md), section "Next.js: Local Development".*
