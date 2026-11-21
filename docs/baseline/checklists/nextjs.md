# Agent checklists: nextjs

The agent checklists of the nextjs docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Solution Strategy: Next.js

[04-solution-strategy/nextjs.md](../04-solution-strategy/nextjs.md)

- [ ] Next.js chosen for one of the stated reasons, recorded in the product's chapter 4?
- [ ] React defaults kept except the ones a NEXT-D row replaces (REACT-D1, D2, D7, D9)?
- [ ] No Pages Router, no `next-auth`, no `NEXT_PUBLIC_*` environment values, no cached pages with personal data?
- [ ] Versions taken from the `baseline-nextjs` template, not from memory or `latest`?

## Next.js: Architecture and Project Structure

[05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md)

- [ ] `src/app` route files only re-export a pages file or bind a platform handler?
- [ ] Server components `.server.tsx` in `adapter/in/ui`, use case as prop, no `fetch`, generated client or port?
- [ ] Server composition `server-only`, per request with `cache()`, nothing user-specific at module level?
- [ ] Server action in `adapter/in/next/*-actions.ts`: `unknown` input parsed `.strict()`, caller from the session, one use case, error codes; called through an `adapter/out/next` adapter, never from a component?
- [ ] Route handlers only the fixed BFF set, created in the platform composition, calling use cases?
- [ ] `'use client'` only in suffix files; `server-only` in every server module; correct platform entry on each side?
- [ ] Props to client components and action results carry no tokens, secrets, DTOs or server config?
- [ ] Core free of `next`, `react`, `server-only`; domain data crossing the boundary is plain data?
- [ ] N+1 check done, including server-side waterfalls and per-row server components?
- [ ] Page dynamic, or public without personal data and with a stated reason for caching?
- [ ] `npm run check:arch` and the canary (including the blind-spot test) green, rules not loosened?

## Next.js: Delivery

[07-deployment-view/nextjs-delivery.md](../07-deployment-view/nextjs-delivery.md)

- [ ] `output: 'standalone'`; image starts `node server.js` in exec form; `.next/static` copied next to it (NEXT-REL-04/06)?
- [ ] Dockerfile multi-stage, distroless `nonroot`, both bases pinned by digest, user 65532; specs, e2e and `.env*` in `.dockerignore`; CI copies the backend spec in with `npm run copy:api-spec` before `docker build` (NEXT-REL-06/07)?
- [ ] No secret, `.env*` file, per-environment `NEXT_PUBLIC_*` or `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in the build (NEXT-REL-08)?
- [ ] Nothing writes to disk at run time: `images.unoptimized`, no ISR or revalidation; read-only root filesystem without tmpfs (NEXT-REL-11)?
- [ ] Pre-stop delay, grace period above pre-stop + longest request; `HOSTNAME=0.0.0.0` (NEXT-REL-12/13)?
- [ ] `RELEASE_VERSION` injected at deploy; commit built in; both in the public config (NEXT-REL-15)?
- [ ] Previous release's static files in the image; `deploymentId` = commit SHA; server-action callers reload once on an unknown action (NEXT-REL-16..18)?
- [ ] Stored session shape compatible with the previous release (NEXT-REL-03)?
- [ ] Own `frontend/v…` tag and changelog; backend and frontend N-1 compatible (NEXT-REL-02)?
- [ ] Image SBOM and npm SBOM published; image scanned (NEXT-REL-19/20)?

## Next.js: Local Development

[07-deployment-view/nextjs-local-development.md](../07-deployment-view/nextjs-local-development.md)

- [ ] New infrastructure dependency in `compose.yaml` (core: no profile; extra: profile), pinned, bound to `127.0.0.1` (NEXT-DEV-01/02)?
- [ ] New key: throwaway value in `.env.development` if needed locally, entry in `configuration-keys.yaml`, no real secret, no `.env`/`.env.production` committed (NEXT-DEV-03)?
- [ ] `APP_TEST_STUBS` refused outside test and local environments, with a test (NEXT-DEV-05)?
- [ ] Dev server on `localhost` only, `APP_ORIGIN` equal to the browser URL, `agentRules: false` (NEXT-DEV-08/09)?
- [ ] Build-dependent behaviour checked against the built server or image, not `next dev` (NEXT-DEV-10)?
- [ ] Inspector only on `127.0.0.1`; no new start-up shell script (NEXT-DEV-11/12)?

## Next.js: Generated API Clients

[08-crosscutting-concepts/api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md)

- [ ] Browser, server and zod outputs from one spec; `urlEncodeParameters: true` on both clients; each output cleans only its own folder?
- [ ] One adapter class; server factory `server-only`; each factory used only by its composition?
- [ ] Server mutator: base URL from server config, bearer token from the request-scoped resolver, time-out, `redirect: 'error'`, no retry, token never logged?
- [ ] Nothing user-specific at module level; no server call outside a request or inside a cross-request cache?
- [ ] Browser mutator: relative `/api` paths, XSRF header, no `Authorization`, settings from the root providers, `anySignal` not `AbortSignal.any`?
- [ ] Proxy: session and XSRF checked, allow-listed headers, time-out, `no-store`, no business logic?
- [ ] Mutator, proxy and adapter tests against MSW, including time-out, 401 and the missing token?

## Next.js: Configuration

[08-crosscutting-concepts/configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md)

- [ ] No `NEXT_PUBLIC_*` or `next.config.ts` `env` for a per-environment value; no `.env`/`.env.production` committed (NEXT-CFG-01)?
- [ ] New key in `ServerConfigSchema`: constrained, `.describe()`d, unit in the name, no default unless right everywhere (NEXT-CFG-02)?
- [ ] Parsed in `register()`; nothing parses or connects at import; error names keys only (NEXT-CFG-03)?
- [ ] `process.env` only in `src/platform/config` (and the listed exceptions); values reach adapters through the composition (NEXT-CFG-04)?
- [ ] Browser value: added to `PublicConfig` and `publicConfig()` explicitly, public only (NEXT-CFG-05)?
- [ ] Secret: `secret()`, `KEY_FILE`, `reveal()` only at the client library, never in public config or logs (NEXT-CFG-06)?
- [ ] Stubs gated by `APP_ENVIRONMENT_KIND`; nothing else branches on it (NEXT-CFG-07)?
- [ ] `configuration-keys.yaml`, `.env.development` and the binding test updated (NEXT-CFG-09, NEXT-DEV-03)?

## Next.js: Tooling

[08-crosscutting-concepts/development/nextjs-tooling.md](../08-crosscutting-concepts/development/nextjs-tooling.md)

- [ ] `next.config.ts` has exactly the options of NEXT-TOOL-01, including `agentRules: false`; no `env`, `webpack` or caching options?
- [ ] Compiler output present after a `next` or compiler upgrade (NEXT-TOOL-02)?
- [ ] tsconfig: TS-TOOL-01 complete, Next.js additions accepted, `types` explicit; tests kept out of the image build (NEXT-TOOL-03/04)?
- [ ] ESLint: React set plus `@next/eslint-plugin-next` as errors, no `next lint`, `process.env` only in config, directives only in suffix files (NEXT-TOOL-05/06)?
- [ ] Scripts as in NEXT-TOOL-07, `dev` on loopback; `verify` green including `typecheck` and `check:bundle`?
- [ ] Telemetry off; no `AGENTS.md` or `CLAUDE.md` in the component folder (NEXT-TOOL-09/10)?
- [ ] Next.js API looked up in `node_modules/next/dist/docs/`, baseline docs followed where they differ (NEXT-TOOL-11)?
- [ ] Upgrade done through the automation, codemods pinned, the post-upgrade checks run (NEXT-TOOL-12)?

## Next.js: Internationalization

[08-crosscutting-concepts/i18n/nextjs.md](../08-crosscutting-concepts/i18n/nextjs.md)

- [ ] New text: key in `messages/en.json` with context, typed key, no literal in JSX, metadata or the title template (NEXT-I18N-02/03/08, REACT-I18N-06)?
- [ ] Locale read only through `getLocale()`/`useLocale()`; no own parsing of `Accept-Language` or the cookie (NEXT-I18N-04)?
- [ ] Time zone from the request configuration, not a literal and not the browser's (NEXT-I18N-05)?
- [ ] Domain values, not formatted strings, passed from server to client components (NEXT-I18N-07)?
- [ ] Server actions and route handlers return codes (NEXT-I18N-09)?
- [ ] Backend calls send the active locale (NEXT-I18N-11)?
- [ ] No `[locale]` segment or i18n middleware without the public-pages ADR (NEXT-I18N-13)?
- [ ] Component tests with the real `en` catalog in `NextIntlClientProvider`; locale projects for server-rendered text (NEXT-I18N-14)?

## Next.js: Observability and Operability

[08-crosscutting-concepts/observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md)

- [ ] Telemetry only in `register()` on the Node.js runtime, configured through `OTEL_*`, sampler explicit (NEXT-OBS-01/02)?
- [ ] New business metric: outgoing port, `Meter` adapter, closed-set attributes, cardinality test (NEXT-OBS-03)?
- [ ] Outbound calls through `fetch` so the trace propagates; incoming `traceparent` dropped at the ingress or by the propagator (NEXT-OBS-04/05)?
- [ ] Logging only through the platform's pino logger, values in the object, constant message, no `console.*` (NEXT-OBS-07, NEXT-OBS-10)?
- [ ] A `TechnicalError` reported once, by the code that creates it, through `serverReportError`; other unexpected errors left to `onRequestError`, not logged and rethrown (NEXT-OBS-09, TS-ARCH-18)?
- [ ] No token, session id, cookie, XSRF token, body, query string or personal data in a log line; redaction paths extended for new fields (NEXT-OBS-10)?
- [ ] `/livez` plain, `/readyz` with shutdown flag and session store only, not routed by the ingress (NEXT-OBS-11)?
- [ ] Pre-stop delay, request budget and grace period recorded in chapter 7 and adding up (NEXT-OBS-12)?
- [ ] `error.tsx` and `global-error.tsx` show the generic message and report with `digest`, never the server's message (NEXT-OBS-14)?
- [ ] `instrumentation-client.ts` holds only zod jitless and the Trusted Types policy (NEXT-OBS-15)?
- [ ] `productionBrowserSourceMaps` still `false` (NEXT-OBS-17)?
- [ ] Browser reports go to `/client-errors` (path from `PublicConfig`), which checks origin, rate, size and schema and logs a scrubbed line (NEXT-OBS-18)?

## Next.js: Resilience

[08-crosscutting-concepts/resilience/nextjs.md](../08-crosscutting-concepts/resilience/nextjs.md)

- [ ] New server-side call: deadline from configuration via `AbortSignal.timeout`, caller's signal combined, `redirect: 'error'`, timeout test (NEXT-RES-01/02)?
- [ ] Values on the ladder: browser > ingress > `API_TIMEOUT_MS` > backend budget; `API_TIMEOUT_MS` is one deadline for session lookup, refresh and backend call; recorded in chapter 7 (NEXT-RES-03)?
- [ ] Independent backend calls of a page start in parallel (NEXT-RES-03, NEXT-ARCH-09)?
- [ ] No server-side retry unless idempotent and documented; queries retry only in the browser (NEXT-RES-04)?
- [ ] Server action not retried; submit disabled while pending; `Idempotency-Key` per operation where the backend requires it (NEXT-RES-05)?
- [ ] Bulkhead where a dependency has less capacity; no CPU-heavy work in the Next.js process (NEXT-RES-06)?
- [ ] No `'use cache'`, ISR, `force-static` or `unstable_cache` on routes with personal data; static pages only by ADR (NEXT-RES-07)?
- [ ] `fetch` without `next.revalidate`/`tags`, `cache: 'no-store'`; cross-request caches bounded and keyed by caller (NEXT-RES-08/09)?

## Next.js: Security

[08-crosscutting-concepts/security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md)

- [ ] Login, callback, logout, API proxy as route handlers that call the session and relay use cases; cookies set only in route handlers or `proxy.ts` (NEXT-SEC-01/02)?
- [ ] Session store behind the port, Redis `compareAndSet` in Lua, 256-bit id, no tokens in cookies; pre-login state under `__Host-login`, session cookie only from a successful callback; one refresh per session (in-process map plus Redis lock), touches without a generation bump (NEXT-SEC-01)?
- [ ] XSRF synchronizer token checked with `timingSafeEqual` on every unsafe API-proxy call and on logout (NEXT-SEC-02)?
- [ ] Nonce created in `proxy.ts`, passed as request headers, read by the root layout and given to `AppRouterCacheProvider` (NEXT-SEC-03)?
- [ ] New server action: module-level, session re-resolved, `unknown` input parsed `.strict()`, one use case, error codes only (NEXT-SEC-04/07)?
- [ ] Cross-origin writes to page paths (actions, no-JS form posts) rejected in `proxy.ts`; new route handler prefixes added to `isRouteHandlerPath()` with their own checks; `allowedOrigins` unset (NEXT-SEC-05)?
- [ ] Client props and action results hold no token, session, configuration object or raw backend response; secret-holding modules import `server-only` (NEXT-SEC-06)?
- [ ] No `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in the build (NEXT-SEC-07)?
- [ ] Security headers from `security-headers.ts`, `poweredByHeader: false` (NEXT-SEC-08)?
- [ ] Threat model and the security tests in CI before go-live (NEXT-SEC-09)?
- [ ] `instrumentation-client.ts`: zod jitless first, `default` policy allows only `/_next/static/chunks/`, returns the input unchanged (NEXT-SEC-10)?
- [ ] No elevated MUI surface rendered on the server; no `'unsafe-inline'` (NEXT-SEC-11)?
- [ ] Body, header, time and rate limits at the ingress recorded in chapter 7 (NEXT-SEC-12)?
- [ ] `APP_TEST_STUBS` refused outside test and local environments, with a test (NEXT-SEC-13)?

## Next.js: Testing

[08-crosscutting-concepts/testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md)

- [ ] Spec in the right project: `.ts` in `core` (node), `.tsx` in `dom` (NEXT-TEST-01)?
- [ ] Client component tested with `renderWithProviders`, server data as props, an object of mocked use cases in the feature's context (NEXT-TEST-03)?
- [ ] Server component still thin (use case, redirect, translate, pass data), covered by E2E (NEXT-TEST-04)?
- [ ] New route handler: factory with contracts, `Request`-based spec incl. 401/403 and XSRF cases (NEXT-TEST-05)?
- [ ] New server action: handler spec for unauthenticated, invalid input with unknown keys, each domain error (NEXT-TEST-06)?
- [ ] BFF adapter change: Redis container spec or MSW IdP spec still green, expiry asserted with a bound (NEXT-TEST-08/09)?
- [ ] New backend operation: stub handler with fixed data and its problem answers (NEXT-TEST-10)?
- [ ] Test-stub switch still refused outside a test environment, with its test (NEXT-TEST-11)?
- [ ] E2E against the built standalone server, real BFF login, zero CSP/Trusted Types violations, `@theme` specs in all theme projects (NEXT-TEST-12..15)?
- [ ] Architecture canary green, `'use client'` blind-spot assertion kept, new suffix rules with a fixture (NEXT-TEST-17)?
