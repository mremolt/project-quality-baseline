# Next.js: Generated API Clients

How a Next.js app calls its backend from two places: from server code (server components, server actions) with the user's access token, and from the browser through the BFF's `/api` proxy. It implements the generated-client rules in [typescript-openapi-clients.md](typescript-openapi-clients.md) (TS-API-*) and adds to [react-openapi-clients.md](react-openapi-clients.md) (REACT-API-*), whose rules apply to the browser side unchanged unless a rule below says otherwise. Defaults: NEXT-D10 in [04-solution-strategy/nextjs.md](../../04-solution-strategy/nextjs.md). Wiring: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md). Token relay and the BFF: [node-bff.md](../security/node-bff.md) (NODE-BFF-01, NODE-BFF-07).

## Two clients, one adapter

```ts
// orval.config.ts
const spec = '../backend/openapi/orders-v1.yaml'; // separate repository: './openapi/orders-v1.yaml' (TS-API-01)
const generated = './src/features/orders/adapter/out/http/generated';
const http = './src/platform/adapter/out/http';

// One plain fetch client per side (TS-API-03): the same operations, bound to the browser or the server mutator.
const fetchClient = (side: 'browser' | 'server', mutator: string, mock: boolean) => ({
  input: { target: spec },
  output: {
    mode: 'tags-split' as const,
    client: 'fetch' as const,
    target: `${generated}/${side}`,
    schemas: `${generated}/model`,
    override: {
      mutator: { path: `${http}/${mutator}`, name: 'customFetch' },
      fetch: { includeHttpResponseReturnType: false },
    },
    urlEncodeParameters: true, // TS-API-09, REACT-API-03
    ...(mock ? { mock: { generators: [{ type: 'msw' as const, useExamples: true }] } } : {}),
    clean: [`${generated}/${side}`], // never clean the shared model/ folder from one output
  },
});

export default defineConfig({
  ordersBrowser: fetchClient('browser', 'browser-fetch.ts', true),
  ordersServer: fetchClient('server', 'server-fetch.ts', false),
  ordersZod: {
    input: { target: spec },
    output: { mode: 'tags-split', client: 'zod', target: `${generated}/zod`, fileExtension: '.zod.ts', clean: [`${generated}/zod`] },
  },
});
```

## Rules

### Generation

- **NEXT-API-01: Orval generates two `fetch` clients from the same spec, one per side, plus one zod output.** The browser output uses the mutator `browser-fetch.ts`, the server output `server-fetch.ts`; both share the `model/` folder, and each output cleans only its own folder (`clean: [dir]`), because a second output that cleans the shared folder deletes the first one's models. MSW handlers are generated once, on the browser output; the same handlers stub the backend in the server's test mode (NEXT-D5) and in adapter tests. `urlEncodeParameters: true` is set on both clients (TS-API-09; the validation project's config lacked it and is corrected here). Everything else follows REACT-API-01..04.
- **NEXT-API-02: One HTTP adapter class serves both sides; two factories bind it to a client.** `http-orders.ts` implements the outgoing ports and takes the generated operations as a constructor argument typed from the generated signatures (`typeof listOrders`); it parses with the generated zod schemas and maps errors as in REACT-API-10. `orders-http.browser.ts` binds the browser functions; `orders-http.server.ts` starts with `import 'server-only'` and binds the server functions. Only the matching composition calls each factory (NEXT-ARCH-03, NEXT-ARCH-15). The adapter stays free of side-specific code, so its tests run once.

```ts
// features/orders/adapter/out/http/orders-http.server.ts
import 'server-only';
import { cancelOrder, listOrders } from './generated/server/orders/orders';
import { HttpOrders } from './http-orders';

/** Server side: direct backend calls with the session's access token. */
export function createServerHttpOrders(): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder });
}
```

### The server mutator

- **NEXT-API-03: The server mutator `server-fetch.ts` is `server-only`, relays the session's access token, sets its own timeout and reports the technical failures it creates.** It is the only place that turns a server-side backend exchange into a result or an error:

  | Situation | Behaviour |
  |---|---|
  | Every call | URL resolved against `API_BASE_URL` from the validated server configuration (NEXT-D7, an origin without a path), never against the request's `Host`; `backendUrl()` (`platform/adapter/out/http/backend-url.ts`) refuses a path with `.`/`..` segments (also `%2e`), encoded `/` or `\`, or one that leaves the origin or `/api/` after resolution, with a `TechnicalError` before any request (path steering: an id `..` in a generated URL); `Authorization: Bearer <access token>` of the current request's session (token relay, NODE-BFF-01); `Accept: application/json, application/problem+json`; `redirect: 'error'`, so a redirect never carries the token to another target |
  | No session or no access token | `UnauthenticatedError` before any request; the server component redirects to the login, the server action answers `UNAUTHENTICATED` (NEXT-ARCH-02/04) |
  | Timeout | one `AbortSignal.timeout(API_TIMEOUT_MS)` per call, started **before** the session lookup: `accessToken(deadline)` resolves the session and any token refresh within it, and `sendRequest()` combines the same deadline with the caller's signal by `AbortSignal.any` (available in Node.js 26; the browser restriction of REACT-API-05 does not apply on the server). It is the total deadline of the call and also bounds the connect phase (RES-TMO-01); `API_TIMEOUT_MS` is below the ingress rung (RES-TMO-02, RES-TMO-04, NEXT-RES-03). A deadline that passes during the session lookup is a timeout `TechnicalError` |
  | 2xx | body as `unknown` for the adapter's zod parsing; an empty body returns `undefined` |
  | 401 | `UnauthenticatedError` (the token was rejected; the session layer refreshes before expiry, NODE-BFF-07) |
  | Other non-2xx | `HttpProblem` with status and the parsed convention fields of the problem body (REACT-API-08) for the feature's mapper; a 5xx is first reported with status and the backend's `traceId` and passed on marked as reported, so the mapper's `server` error that wraps it is not logged again (TS-ARCH-18) |
  | Network failure, time-out, refused path | `TechnicalError` whose message has the path without the query string, reported once through the platform's server reporter (`serverReportError`, NEXT-OBS-09), never with the token |
  | Caller aborted | the abort error is rethrown unchanged |

  It never retries (RES-RTY-04): server actions are commands (RES-RTY-01), and a server component that fails renders the route's error UI. It never logs the token or the request body.

- **NEXT-API-04: The server mutator gets its token through a request-scoped resolver, never through a stored value.** Orval's `fetch` client calls a module function, so the mutator cannot take constructor arguments. `platform.composition.server.ts` therefore calls `configureServerFetch(() => settings)` once, at module load, with a function that returns the base URL, the time-out and an `accessToken()` function. `accessToken()` reads the session cookie with `cookies()` from `next/headers` **on every call**, and `cookies()` resolves to the request that is currently executing (Next.js keeps it in async context). Module state therefore holds only configuration and functions, the same for every request, and the token always belongs to the request that makes the call. This is request-safe under four conditions, which the code keeps:
  - nothing user-specific (token, session id, caller, response) is kept at module level or in a closure created at module load; the setter receives a resolver, never a value;
  - the server client is called only inside a request: a server component render, a server action or a route handler. Outside one (in `instrumentation.ts`, a timer, a module-level `await`) and inside an `after()` callback during rendering, `cookies()` throws (checked in the `next/dist` source of 16.4.6), so the call fails closed;
  - no server call runs inside `'use cache'`, `unstable_cache` or another cross-request cache (NEXT-ARCH-10): Next.js 16.4 throws when `cookies()` is called inside `'use cache'` (`next-request-in-use-cache`) or `unstable_cache`, so such a call fails instead of sharing one user's answer with others;
  - token refresh is safe under concurrency: several calls of one request (and requests on other instances) may find the token about to expire at once; the session use case runs one refresh per session (an in-process promise map plus a Redis lock, the others wait and re-read the session), writes it with compare-and-set and merges onto a newer record when it loses that write, so a rotated refresh token is never dropped ([security/nextjs.md](../security/nextjs.md), NODE-BFF-07). Compare-and-set alone would not be enough: two parallel refreshes spend the same refresh token, and an IdP with refresh-token reuse detection then revokes the whole grant.

  `server-fetch.spec.ts` asserts it with two concurrent calls, each inside its own `AsyncLocalStorage` scope standing in for the request, the first answered last: each backend call carries its own token (*verified*; a mutator that keeps a token from an earlier call fails the spec). The spec also covers the base URL, a missing or rejected token, problem bodies, the timeout, the shared deadline of session lookup and backend call, and `redirect: 'error'`.

```ts
// src/platform/platform.composition.server.ts (excerpt)
async function currentSessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value; // the request that is executing now
}

configureServerFetch(() => ({
  apiBaseUrl: platform().config.API_BASE_URL,
  timeoutMs: platform().config.API_TIMEOUT_MS,
  accessToken: async (deadline) => platform().sessions.accessToken(await currentSessionId(), deadline),
}));

// src/platform/adapter/out/http/server-fetch.ts (excerpt)
import 'server-only';

let settings: (() => ServerFetchSettings) | undefined;

/** Called once by the platform composition; an Orval mutator is a plain function and cannot take constructor arguments. */
export function configureServerFetch(value: () => ServerFetchSettings): void {
  settings = value;
}

export async function customFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (!settings) throw new TechnicalError('server fetch used before the platform composition configured it');
  const { apiBaseUrl, timeoutMs, accessToken } = settings();
  const target = backendUrl(url, apiBaseUrl);
  if (!target) throw new TechnicalError('backend path refused (path steering)');
  const deadline = AbortSignal.timeout(timeoutMs); // one budget per call: session lookup, refresh, backend (NEXT-RES-03)
  let token: string | undefined;
  try {
    token = await accessToken(init.signal ? AbortSignal.any([init.signal, deadline]) : deadline); // current request
  } catch (error) {
    if (init.signal?.aborted || !deadline.aborted) throw error;
    throw new TechnicalError('session lookup exceeded the call deadline', { cause: error, failure: 'timeout' });
  }
  if (!token) throw new UnauthenticatedError('no session');
  return sendRequest<T>(target.href, init, { deadline, headers: { authorization: `Bearer ${token}` } });
}
```

### Browser calls

- **NEXT-API-05: The browser mutator is the REACT-API-05 mutator, calling the BFF's `/api` proxy on the same origin.** URLs stay relative (`/api/v1/…`), mutating calls carry the `X-XSRF-TOKEN` header, no `Authorization` header is ever set (TS-SEC-01). Differences to the React SPA: the settings come from the root client providers instead of `/config.json` (Replaces the `/config.json` source of REACT-API-05/06 and the `createPlatform()` location of REACT-ARCH-12 for Next.js): `src/app/providers.tsx` calls `configureHttp({ timeoutMs, onUnauthorized, reportError })` once, in a lazy `useState` initializer, before any child renders, with the time-out from the public configuration (NEXT-D7) and `onUnauthorized` navigating to `/auth/login?returnTo=<current path>` with a full page load (this fixed BFF route replaces the `loginPath` from `/config.json` of REACT-SEC-06; the rest of REACT-SEC-06 applies unchanged). The settings are the same for every user, so running this in the SSR pass is harmless. The browser path combines signals with the `anySignal` helper of REACT-API-05, not `AbortSignal.any` (browser set of TS-TOOL-02). The same `reportError` is provided to client code through `ReportErrorProvider` (`useReportError()` from `@/platform/index.client`); the feature's browser factory hands it to the shared HTTP adapter, which reports the technical errors it creates (REACT-OBS-04). The server factory (`orders-http.server.ts`) gives the same adapter a reporter that logs through the platform logger (NEXT-OBS-07), because server-side failures have no browser reporting path; a 5xx on the server is not reported by the adapter and reaches the logs through the caller or `onRequestError`. *To verify before first use:* the `configureHttp()` placement in `providers.tsx`; the validation project's browser mutator used a constant time-out, no 401 callback and no reporting, and its shared send helper used `AbortSignal.any` in the browser, which these rules correct.
- **NEXT-API-06: The `/api/[...path]` route handler relays browser calls to the backend and does nothing else** (NEXT-ARCH-05, NODE-BFF-01). Per request it: resolves the session (no session or no token → `401` problem); checks the XSRF header on `POST`, `PUT`, `PATCH`, `DELETE` (→ `403`, NODE-BFF-06); forwards only the allow-listed request headers `accept`, `accept-language`, `content-type` (never `cookie`, `host` or `x-forwarded-*`); adds the access token through the `ApiRelayService` use case; calls `API_BASE_URL` + path and query, refused with `400` by the same `backendUrl()` check as the server mutator when the path would leave `/api/`, with `redirect: 'error'` and one deadline, `AbortSignal.any([request.signal, AbortSignal.timeout(API_TIMEOUT_MS)])`, created on entry and shared by the session lookup, a token refresh and the backend call (RES-TMO-01, NEXT-RES-03); answers `504` on time-out (also when it passes while the session is resolved) and `502` on a network failure or a redirect; streams the backend's body back with only `content-type` and `content-language` plus `cache-control: no-store`. It never rewrites bodies, never adds business logic and never retries. Next.js sets no body-size or header limits for route handlers, so the ingress limits them ([security/nextjs.md](../security/nextjs.md)).
- **NEXT-API-07: Each call takes one fixed path.**

  | Caller | Path |
  |---|---|
  | Server component (first render) | server use case → server adapter → server client → backend |
  | Client component, read or refetch | TanStack Query → browser use case → browser adapter → browser client → `/api` proxy → backend |
  | Client component, command | browser use case → either the browser client and the proxy, or a server action through the `adapter/out/next` adapter (NEXT-ARCH-04); one path per command, chosen in the feature |
  | Server action | server use case → server adapter → server client → backend |

  The browser never calls the backend directly (no CORS, no tokens in the browser). Server code never calls its own `/api` proxy over HTTP; it uses the server client.

### Tests

- **NEXT-API-08: Both mutators, the proxy and the shared adapter have their own tests** (TS-TEST-04, REACT-API-12). The server mutator and the proxy run in the Vitest `node` project with MSW `setupServer` (`onUnhandledFrame: 'error'`); `server-only` is aliased to its empty module in `vitest.config.ts`. `backend-url.spec.ts` covers the path-steering cases (dot segments, encoded and mixed forms, encoded separators, other origins, paths outside `/api/`). The server mutator covers: the `Authorization` header from the resolver, no token → `UnauthenticatedError` without a request, 401, a problem body → `HttpProblem`, time-out (`delay('infinite')`, RES-TMO-03), a redirect not followed, caller abort; with a `mock<ReportErrorUseCase>()` in its settings: exactly one report for a time-out, a network failure, a refused path and a 5xx (with status and `traceId`, the thrown `HttpProblem` marked), none for a 4xx, a 401 or a cancelled call. The proxy covers: allow-listed headers only, `400` for a path that leaves `/api/`, 401 without session or token, 403 without the XSRF header on a mutating call, body forwarded, 504 on time-out, 502 on a redirect. The adapter's tests (REACT-API-12) run once, against the browser factory; a server-path spec with a fake `OrdersApi` asserts that a marked 5xx and a reported time-out pass on unreported and that the adapter reports its own two `TechnicalError`s once.

## Skill overrides

| Skill or habit says | Our rule |
|---|---|
| `orval` skill: one client with `baseUrl` per environment, or the spec's `servers` | Two outputs; the server resolves against `API_BASE_URL` from server config, the browser uses relative `/api` paths (NEXT-API-01, NEXT-API-03, NEXT-API-05) |
| `orval` / generic: `Authorization` header in a browser mutator, token in a client component | Tokens only on the server: server mutator and proxy (NEXT-API-03, NEXT-API-06, TS-SEC-01) |
| Generic Next.js habit: `fetch` in a server component, a server action or a route handler | Through the use case, the server adapter and the server mutator (NEXT-D4, NEXT-API-07) |
| Next.js docs: `fetch` options `cache`, `next: { revalidate, tags }` for backend calls | No cross-request caching of authenticated calls (NEXT-API-04, NEXT-ARCH-10) |
| Generic: module-level token or `Authorization` header set once at startup | Request-scoped resolver through `cookies()` (NEXT-API-04) |
| Generic proxy habit: forward all request headers, follow redirects | Allow-listed headers, `redirect: 'error'`, `no-store` (NEXT-API-06) |
| Server component calling `fetch('/api/…')` on its own origin | Server client directly (NEXT-API-07) |
| `vercel-react-best-practices` `client-swr-dedup`: SWR / `fetch('/api/…')` in components | TanStack Query calls the use case; the browser adapter calls the proxy (REACT-ARCH-13, NEXT-API-07) |

*Agent checklist in [checklists/nextjs.md](../../checklists/nextjs.md) and sources in [sources.md](../../sources.md), section "Next.js: Generated API Clients".*
