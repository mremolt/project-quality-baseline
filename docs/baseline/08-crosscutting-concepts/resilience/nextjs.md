# Next.js: Resilience

The Next.js settings and code for [resilience.md](resilience.md) (`RES-*`), limited to what a BFF and frontend server needs: timeouts on every server-side call, the timeout ladder from the browser to the backend, retries, concurrency and caching. A Next.js app has no database, no message consumers and no scheduled jobs of its own (NODE-BFF-01: no business logic); transactions (RES-TX), idempotency storage (RES-IDM-03..05) and jobs (RES-JOB) belong to the backend. Browser-side retries of queries: [ui/react-state-management.md](../ui/react-state-management.md) (REACT-STATE-15); configuration keys: [configuration/nextjs.md](../configuration/nextjs.md).

Rules marked *verified* were built in the baseline's Next.js reference app (Next.js 16.4, openid-client 6.9, redis 6.3, MSW 3.0); *to verify before first use* items are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Rules

### Timeouts (RES-TMO)

- **NEXT-RES-01: Every server-side outbound call has an explicit deadline from configuration** (RES-TMO-01/02):

| Call | Where | Deadline |
|---|---|---|
| Backend from server components and server actions | Server-side Orval mutator `platform/adapter/out/http/server-fetch.ts` → shared `sendRequest()` ([api/nextjs-openapi-clients.md](../api/nextjs-openapi-clients.md)) | One `AbortSignal.timeout(API_TIMEOUT_MS)` per call, started before the session lookup and combined with the caller's signal by `AbortSignal.any`; the session lookup, a token refresh and the backend call share it (NEXT-RES-03); `redirect: 'error'` |
| Backend through the API proxy | `FetchBackendRelay` (`platform/adapter/out/http/`) behind the `/api/[...path]` route handler | The proxy creates `AbortSignal.any([request.signal, AbortSignal.timeout(API_TIMEOUT_MS)])` on entry and passes it to the session lookup, the token refresh (through `ApiRelayService`) and the relay, which uses it as its `fetch` signal: one deadline, and the browser's disconnect cancels the upstream call; `redirect: 'error'`; timeout (also while resolving the session) → `504`, other failure → `502` problem response |
| IdP (discovery, token, refresh, revocation) | `openid-client` in `platform.composition.server.ts` | `discovery(issuer, clientId, metadata, clientAuth, { timeout: OIDC_TIMEOUT_S })`, in **seconds**; it applies to every later request made with the returned configuration |
| Session store | `redis` `createClient` in `platform.composition.server.ts` | `socket: { connectTimeout: 2_000 }`, `commandOptions: { timeout: 1_000 }` |
| Telemetry export | OTLP exporter in `src/telemetry.ts` | `OTEL_EXPORTER_OTLP_TIMEOUT` set explicitly by the deployment ([observability/nextjs.md](../observability/nextjs.md)); *to verify before first use* |

  The per-call `AbortSignal` is the deadline RES-TMO-04 counts: it covers connecting, waiting for headers and reading the body. A separate connect timeout through an undici `Agent` passed as `dispatcher` is *to verify before first use*: Next.js patches the global `fetch` on the server, and the reference app did not test a dispatcher with it. `fetch` is allowed only in `adapter/out/http` (ESLint `no-restricted-globals`, *verified*); every other module calls a use case (NEXT-D4). Discovery runs at the first login, not at start-up, because nothing may connect at import ([NEXT-CFG-03](../configuration/nextjs.md)); this is the first-login variant NODE-BFF-02 allows for frameworks that evaluate modules at build time. A failed discovery is not cached, so the next login tries again.
- **NEXT-RES-02: Every outgoing HTTP adapter has a timeout test** (RES-TMO-03): Vitest in the `node` project with MSW's `setupServer` and a handler that never answers (`() => new Promise<never>(() => undefined)`), a short timeout (50 ms), and an assertion on the port's error: `sendRequest` rejects with `TechnicalError`, the relay answers `504` (*verified*). A second test asserts that a caller's abort is passed through unchanged and not reported as a technical error (*verified*). Redis and the IdP are covered by their adapter tests against Testcontainers and stubs; their timeouts are configuration, asserted where they are created.

### Timeout ladder (RES-TMO-04)

- **NEXT-RES-03: The Next.js ladder runs from the browser to the backend; each rung is shorter than the one outside it, so the inner one answers first.** Default values (the product may change values, not the order; it records them in chapter 7, "Timeouts and capacity"):

| Rung | Default | Notes |
|---|---|---|
| Browser HTTP mutator | 20 s | `BROWSER_REQUEST_TIMEOUT_MS` in the public configuration; longer than the ingress, so the browser gets the server's `504` instead of its own abort |
| Ingress / gateway in front of Next.js | 15 s | Platform setting (RES-TMO-04 gateway rung), with the request limits of [NEXT-SEC-12](../security/nextjs.md) |
| Server-side call (`API_TIMEOUT_MS`) | 12 s | **Total** deadline of one proxied call or server fetch: session lookup, a token refresh and the backend call share one `AbortSignal`, so the whole call stays below the ingress. Longer than the backend's own request budget (10 s on the shared default ladder), so the backend cancels and answers first when the session lookup was quick; a slow refresh leaves the backend less time, and the BFF answers `504` (proxy) or a timeout `TechnicalError` (server mutator) first |
| Backend request budget and its rungs | 10 s, 5 s, 3 s | The backend's ladder (request budget, transaction, statement) |
| IdP call (`OIDC_TIMEOUT_S`) | 5 s | Login and callback; a refresh happens inside a page or API request and counts against its `API_TIMEOUT_MS`. A caller whose deadline passes stops waiting; the refresh itself (one per session, NEXT-SEC-01) runs on and stores its result for the next call. The refresh lock lives `OIDC_TIMEOUT_S` + 1 s |
| Redis | connect 2 s, command 1 s | Every request resolves the session first, inside the call's deadline |

  The reference app used `API_TIMEOUT_MS` 5 s and a fixed 10 s browser timeout, which fit only a backend whose budget is below 5 s; the defaults above are aligned with the shared ladder. A server-rendered page fits the ingress rung only if its backend calls run in parallel: two sequential 12 s calls already exceed it. Waterfalls are therefore not only slow but break the ladder; independent calls start together and are awaited with `Promise.all` (NEXT-ARCH-09, API-N1-01). Next.js does not cancel a render or route handler when the ingress gives up; the call deadlines below it end the work. The stubbed E2E suite asserts that the first page arrives with its data and without a browser-side API call (*verified*).

### Retries (RES-RTY)

- **NEXT-RES-04: Server-side calls are not retried; the browser query layer is the one layer that retries reads** (RES-RTY-01..04). The server mutator, the API proxy and the IdP adapter make one attempt each. The API proxy is a pass-through and cannot know whether a relayed call is idempotent; the browser's TanStack Query retries transient failures of queries only, with jitter (REACT-STATE-15), so a retry through the proxy happens once, in the browser. A failed server-rendered read shows the route's error UI with a retry button (`error.tsx`, [observability/nextjs.md](../observability/nextjs.md)), never an automatic re-render loop. A server-side retry policy, where a product needs one for an idempotent call, sits in the outgoing adapter with backoff, jitter and a total time that fits the ladder (RES-RTY-03), and the product documents the retry layer for that flow.
- **NEXT-RES-05: Server actions are never retried automatically.** An action is a `POST` (RES-RTY-01): neither the client component nor the action nor the server mutator retries it, and the RHF submit stays disabled while it is pending (`isSubmitting`), so a double click does not send it twice. A `TechnicalError` result shows the generic error with a manual retry. Where the backend command is a retryable `POST` (RES-IDM-02), the client component creates one `Idempotency-Key` per logical operation (when the form opens), passes it as part of the action's input, and the action hands it to the use case, which sends it unchanged on every attempt (*to verify before first use*: not built in the reference app). Actions of an older release fail after a deployment and the client reloads once ([NEXT-SEC-07](../security/nextjs.md)); that is not a retry of the action.

### Concurrency (RES-CAP)

- **NEXT-RES-06: Concurrency toward each dependency is bounded where its capacity is lower than ours** (RES-CAP-01). The Redis client multiplexes all commands over one connection, so its command timeout bounds the wait. Backend calls are bounded by the backend's own limits and the instance count; when a backend or IdP has a lower capacity, the outgoing adapter gets a bulkhead that rejects at once (a semaphore with queue `0`, mapped to `TechnicalError` or the proxy's `503`; library choice and wiring *to verify before first use*). CPU-heavy work (large exports, PDF rendering) does not run in the Next.js process: it belongs to the backend. Instance count and memory per instance are recorded in chapter 7 ([NEXT-REL-10](../../07-deployment-view/nextjs-delivery.md)).

### Caching (RES-CCH, NEXT-D3)

- **NEXT-RES-07: Rendering is dynamic by default; static or cached rendering only for public pages without personal data and without a nonce need** (NEXT-D3, NEXT-ARCH-10). In the reference app every route is `ƒ (Dynamic)` because the root layout reads `headers()` for the nonce (*verified*). Banned on any route that shows or depends on personal or caller-specific data: `'use cache'` and `cacheComponents`, ISR (`revalidate`), `export const dynamic = 'force-static'`, `generateStaticParams` for user data, `unstable_cache`. A public, cacheable page (a marketing or help page that must be fast without a session) needs an ADR covering its CSP: a statically rendered page cannot carry a per-response nonce. *To verify before first use* (no static page was built).
- **NEXT-RES-08: Server-side `fetch` is never a cache.** Backend calls through the mutator and the relay carry no `next: { revalidate, tags }` and no `cache: 'force-cache'`; the shared `sendRequest()` sets `cache: 'no-store'` explicitly, so the behaviour does not depend on Next.js's default for its patched `fetch` (*to verify before first use*: the reference app relied on the default, which is uncached in Next.js 16). `revalidatePath`/`revalidateTag` are not used. After a server action the client refreshes its data by invalidating TanStack Query keys (REACT-STATE-11), not through Next.js's cache.
- **NEXT-RES-09: Caches across requests are explicit, bounded adapter caches; per-request memoization uses React `cache()`** (RES-CCH-01..05). React `cache()` in the server composition (`ordersServerUseCases = cache(() => …)`, NEXT-ARCH-03) builds adapters and use cases once per request and is not a cache across requests (*verified*). A cross-request cache (reference data from the backend) is an `lru-cache` instance inside the outgoing adapter with `max` and `ttl`, the caller and tenant in the key when the data depends on them (RES-CCH-02). Module-level state on the server is shared by all requests and all users: besides such caches it holds only composition singletons without user data (the platform instance, the Redis client). Authenticated responses are `Cache-Control: no-store` (route handlers set it; Next.js sets it for dynamic pages, [NEXT-SEC-03](../security/nextjs.md)).

## Tests

| What | How |
|---|---|
| Timeout (RES-TMO-03) | NEXT-RES-02: never-answering MSW handler, port error within the timeout; caller abort passed through |
| Relay failures | `504` on timeout, `502` on a backend redirect (`redirect: 'error'`) (*verified*) |
| One deadline per call (NEXT-RES-03) | API proxy: the same signal reaches the session lookup and the relay, `504` when it passes during the lookup; server mutator: a session lookup and a backend answer that each fit the deadline but not together → timeout `TechnicalError`; session use case: an expired deadline stops the wait, the shared refresh is still stored (*verified*, unit tests) |
| No retry | Adapter test: a `503` from the backend → exactly one call; action test in the stubbed E2E tier: one `POST` per submit |
| Ladder | Review against the values in chapter 7 (the ingress is platform configuration); E2E: the first page arrives without a browser API call |
| Caching | `next build` output lists no static (`○`) route that renders personal data (review of the build log in CI); cache adapter tests per RES-CCH-05 |

*Agent checklist in [checklists/nextjs.md](../../checklists/nextjs.md) and sources in [sources.md](../../sources.md), section "Next.js: Resilience".*

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| `vercel-react-best-practices` `server-cache-lru`: module-level LRU cache across requests | Only inside the outgoing adapter, bounded, with caller/tenant in the key (NEXT-RES-09, RES-CCH-02) |
| `vercel-react-best-practices` `server-no-shared-module-state` | Agreed: no user data in module state; composition singletons only (NEXT-RES-09) |
| `vercel-react-best-practices` `server-parallel-fetching`, `server-parallel-nested-fetching` | Agreed on parallel calls (NEXT-RES-03); the calls go through use cases, never `fetch` in the component (NEXT-D4) |
| `vercel-react-best-practices` `server-after-nonblocking`: `after()` for side work | Only for work not needed for correctness; it still has deadlines and ends within the shutdown grace period ([observability/nextjs.md](../observability/nextjs.md)) |
| Next.js cache workflow skills and docs: `'use cache'`, `cacheComponents`, ISR, `revalidateTag` | Dynamic by default; caching only for public pages by ADR (NEXT-D3, NEXT-RES-07/08) |
| `tanstack-query-best-practices` `ssr-stale-time-server`: raise `staleTime` to avoid refetch after SSR | Server-rendered data goes in as `initialData`; `staleTime` per REACT-STATE-11 |
| Generic habit: `fetch` without a timeout in a route handler, retry wrapper around every call | Deadline on every call, one retry layer (NEXT-RES-01/04) |
