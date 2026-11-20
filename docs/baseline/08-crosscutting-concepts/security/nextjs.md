# Next.js: Security

Next.js rules on top of [react.md](react.md) (`REACT-SEC-*`) and [typescript.md](typescript.md) (`TS-SEC-*`). A Next.js app is its own image and the BFF for its browser users (NEXT-D2, NEXT-D8): it implements the framework-neutral BFF rules of [node-bff.md](node-bff.md) (`NODE-BFF-01..10`) with route handlers, `src/proxy.ts` and platform adapters. NEXT-SEC-03 and NEXT-SEC-10 replace the (React SPA) rules REACT-SEC-04 and REACT-SEC-05; NEXT-SEC-09 replaces the stubbed-server part of REACT-SEC-09. REACT-SEC-01..03 and 06..08 apply unchanged. Where server code lives and which adapter does what: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md) (NEXT-ARCH-*); configuration keys: [configuration/nextjs.md](../configuration/nextjs.md); timeouts: [resilience/nextjs.md](../resilience/nextjs.md).

Rules marked *verified* were built and tested in the baseline's Next.js reference app (Next.js 16.4, openid-client 6.9, redis 6.3, MUI 9.5); everything marked *to verify before first use* was not built there and is listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Next.js as the BFF

- **NEXT-SEC-01: Next.js implements NODE-BFF-01..10 with the wiring below; a product records in its BFF ADR (NODE-BFF-01) that the Next.js component is the BFF.**

| Rule | Next.js wiring | Status |
|---|---|---|
| NODE-BFF-01 role | Route handlers in `src/app/` bind platform handlers: `auth/login`, `auth/callback`, `auth/logout`, `api/[...path]` (same-origin API proxy), `livez`, `readyz`. The API proxy calls the `ApiRelayService` use case, which adds the session's access token and calls the `FetchBackendRelay` outgoing adapter. Server components and server actions reach the backend through the server-side Orval mutator with the same token ([api/nextjs-openapi-clients.md](../api/nextjs-openapi-clients.md)). The frontend is served by Next.js itself; its runtime configuration goes through the root layout (NEXT-CFG-05), not `/config.json` | verified; back-channel logout and CSP report endpoints: to verify |
| NODE-BFF-02 login | `OpenIdClientIdentityProvider` (`platform/adapter/out/oidc/`) with `discovery(issuer, clientId, undefined, ClientSecretBasic(secret), { timeout })`, PKCE S256, `randomState()`, `randomNonce()`, `authorizationCodeGrant(…, { pkceCodeVerifier, expectedState, expectedNonce, idTokenExpected: true })`. Discovery runs at the first login, not at start-up: `next build` evaluates route modules without the runtime environment, so nothing may connect at import. A failed discovery is not cached (the next login retries). `redirect_uri` and the callback URL are rebuilt from `APP_ORIGIN`, never from the `Host` header; `returnTo` must match `^\/(?!\/)[\w\-/?=&.]{0,200}$`, otherwise `/` | verified (client secret); `PrivateKeyJwt`: to verify |
| NODE-BFF-03 store | `SessionStore` port in `platform/ports/out` (`get`, `set`, `compareAndSet`, `destroy`); `RedisSessionStore` with a Lua compare-and-set on a `generation` counter (excerpt below). The session id is 256 bits from `crypto.getRandomValues` and is the cookie value itself: there is no signed cookie, so no cookie signing secret. Session data is parsed with a zod schema on read | verified (Testcontainers Redis, two concurrent writers: exactly one wins); token encryption at rest (SEC-CRY-03), Postgres store: to verify |
| NODE-BFF-04 cookie | `sessionCookie()` / `clearedSessionCookie()` in `platform/adapter/in/next/cookies.ts` write the `Set-Cookie` string `__Host-session=…; Path=/; HttpOnly; Secure; SameSite=Lax` and clear it with the same attributes. Next.js has no proxy-trust setting that drops `Secure`; the handler always sets it | verified (Chromium, Firefox); WebKit drops `Secure` cookies on `http://localhost` → HTTPS test origin needed (chapter 11) |
| NODE-BFF-05 id only | The cookie holds only the session id; no `iron-session`, no Auth.js (NEXT-D8) | verified |
| NODE-BFF-06 CSRF | Route handlers: synchronizer token (NEXT-SEC-02). Server actions: they cannot carry a custom header, so `proxy.ts` rejects cross-origin action calls (NEXT-SEC-05) | verified |
| NODE-BFF-07 lifetimes | `SessionService` (`platform/application`): idle and absolute limits checked against `lastSeenAt`/`createdAt`, every touch through `compareAndSet`; login destroys the pre-login session and issues a new id; the access token is refreshed with `refreshTokenGrant` when it expires within 30 s, written with `compareAndSet` (on a lost race the winner's token is read back); a failed refresh destroys the session and the caller answers 401 | verified (unit tests with a fixed clock) |
| NODE-BFF-08 logout | `POST /auth/logout`: XSRF check, session destroyed, refresh token revoked with `tokenRevocation` where the IdP offers it, `303` to `buildEndSessionUrl(…)`, both cookies cleared | verified; back-channel logout, `sid` index, logout UI: to verify (NEXT-SEC-02) |
| NODE-BFF-09 CSP | `proxy.ts` (NEXT-SEC-03, NEXT-SEC-08) | verified; report endpoint and `security.txt`: to verify |
| NODE-BFF-10 adoption | NEXT-SEC-09 | open per product |

```ts
// platform/adapter/out/session/redis-session-store.ts (excerpt): 1 = written, 0 = missing or changed
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if cjson.decode(current).generation ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;
const written = await this.redis.eval(COMPARE_AND_SET, {
  keys: [KEY_PREFIX + id],
  arguments: [String(expectedGeneration), JSON.stringify(data), String(ttlSeconds)],
});
```

- **NEXT-SEC-02: Login, callback, logout and the API proxy are route handlers that delegate to the platform's session use case; CSRF on route handlers is a synchronizer token in the session.** The `route.ts` files are one line (`export const GET = authRouteHandlers.login`, NEXT-ARCH-05); the handlers live in `src/platform/adapter/in/next/` and call `SessionUseCase` and `ApiRelayUseCase`, never the store or `openid-client` directly. Anything that sets or clears a cookie runs in a route handler (or `proxy.ts`): server components cannot set cookies, so they only read the session through `currentCaller()` and never rotate it.
  - The session holds a random `xsrfToken` (256 bits). The callback sets it as `XSRF-TOKEN=…; Path=/; Secure; SameSite=Strict` (readable by the browser mutator, REACT-SEC-06) together with the new session cookie; logout clears both.
  - `hasValidXsrfHeader(request, session.xsrfToken)` compares the `X-XSRF-TOKEN` header with `timingSafeEqual` against the token in the session, not against the cookie (stronger than double submit). The API proxy checks it on every `POST`, `PUT`, `PATCH` and `DELETE` and answers `403` without it; logout checks it whenever a session exists. Only the header counts, never the body.
  - The API proxy answers `401` without a valid session, forwards only an allow-list of request headers (`accept`, `accept-language`, `content-type`) and response headers (`content-type`, `content-language`), sets `Cache-Control: no-store` and calls the backend with `redirect: 'error'`.
  - *To verify before first use:* the back-channel logout route handler (`POST /auth/backchannel-logout`, `logout_token` verified with `jose` as NODE-BFF-08 states, `sid → session id` index in the store; no XSRF check, because it carries no cookie), audit events for login, logout and failed refresh, and the logout UI. The logout handler answers `303` to the IdP: a `fetch` caller cannot follow that cross-origin redirect, and a plain form post is likely blocked by `form-action 'self'`, which browsers also apply to the redirect. The expected shape is a JSON answer `{ redirectTo }` for the client to assign to `window.location`.

## Page CSP

- **NEXT-SEC-03: `src/proxy.ts` creates a fresh nonce per request, sends the CSP and hands the nonce to Next.js and the root layout through request headers.** Replaces REACT-SEC-04 for Next.js. Next.js 16 calls the file `proxy.ts` with `export function proxy(request)` (`middleware.ts` is deprecated) and runs it on the Node.js runtime. Mechanism (*verified*):
  1. `proxy.ts` deletes any incoming `x-nonce`, creates a nonce (`createNonce()`: 16 random bytes, base64), and for page requests sets **request** headers `x-nonce` and `content-security-policy` via `NextResponse.next({ request: { headers } })`. Next.js reads the nonce from the request's CSP header and stamps it on all its own `<script>` tags and inline scripts.
  2. The same policy goes on the response. Route handler paths (`/api`, `/auth`, `/livez`, `/readyz`) get `default-src 'none'; frame-ancestors 'none'` instead; the matcher skips `_next/static`.
  3. The root layout reads `(await headers()).get('x-nonce')` and passes it to the client providers, which give it to MUI's Emotion cache: `<AppRouterCacheProvider options={{ key: 'mui', nonce }}>` from `@mui/material-nextjs/v16-appRouter`; Emotion's server-rendered `<style>` tags then carry the nonce.

  ```
  default-src 'self'; script-src 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}'; connect-src 'self';
  img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'; trusted-types default; require-trusted-types-for 'script'
  ```

  Reading `headers()` in the root layout makes every route dynamic (`ƒ` in the build output), which is the rendering default anyway (NEXT-D3, NEXT-ARCH-10); a statically rendered page cannot carry a per-response nonce. Next.js answers dynamic HTML with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` and hashed `/_next/static` files with `public, max-age=31536000, immutable`; a missing static file is a `404` in plain text, never the app's HTML (*observed*). No `<meta http-equiv>` CSP, no CDN that caches HTML, no `'unsafe-inline'`, no `'unsafe-eval'`. `proxy.ts` holds no business logic and does not read the session store (NEXT-ARCH-11). *To verify before first use:* `report-to csp; report-uri /csp-reports` with the report endpoint of NODE-BFF-09 as a route handler (public, body-size and rate limited at the ingress, NEXT-SEC-12).

## Server actions and server data

- **NEXT-SEC-04: Every server action is a public `POST` endpoint and is written like one.** Anyone who has the action ID can call it with any arguments, whatever page rendered the form. Each action, in `adapter/in/next/<feature>-actions.ts` (NEXT-ARCH-04):
  - resolves the caller from the session itself (`currentCaller()`), and returns an `UNAUTHENTICATED` result without one; it never takes a user id, role or owner from its arguments;
  - takes `unknown` input and parses it with the command's zod schema in `.strict()` mode (unknown keys fail), then builds the command with its factory;
  - calls exactly one use case; authorization happens in the use case and the resource server, never in the page that renders the form (REACT-SEC-07);
  - returns a small serializable result (`{ ok: true } | { ok: false, errorCode }`) with mapped error codes, never an error message, stack or problem body; an unexpected error is rethrown, so Next.js answers with an error digest and `onRequestError` logs it ([observability/nextjs.md](../observability/nextjs.md)).

  ```ts
  export async function cancelOrderAction(input: unknown): Promise<CancelOrderActionResult> {
    const caller = await currentCaller();
    if (!caller) return { ok: false, errorCode: 'UNAUTHENTICATED' };
    const parsed = CancelOrderCommandSchema.strict().safeParse(input);
    if (!parsed.success) return { ok: false, errorCode: 'INVALID_INPUT' };
    try {
      await ordersServerUseCases().cancelOrder.cancelOrder(CancelOrderCommand.of(parsed.data));
      return { ok: true };
    } catch (error) {
      return { ok: false, errorCode: errorCodeOf(error) };
    }
  }
  ```

  Verified by direct `POST`s with the action ID: without a session the action returns `UNAUTHENTICATED`, with extra keys `INVALID_INPUT`. Actions are module-level exported functions in a file that starts with `'use server'`; no inline `'use server'` function inside a component (those close over values that Next.js serializes to the client, encrypted with the build key of NEXT-SEC-07). The request body is limited by `experimental.serverActions.bodySizeLimit` (`'100kb'` in the template; the option still sits under `experimental` in 16.4). *To verify before first use:* a lint selector that rejects an inline `'use server'` directive; rate limits for actions at the ingress (NEXT-SEC-12).
- **NEXT-SEC-05: Server actions run only for same-origin requests: `proxy.ts` rejects a `POST` with a `Next-Action` header unless `Sec-Fetch-Site` is `same-origin` or `Origin` equals `APP_ORIGIN`; `experimental.serverActions.allowedOrigins` stays unset.** Next.js's own check is not enough for NODE-BFF-06: a foreign `Origin` ends in a `500` (the action is aborted), but a request **without** `Origin` runs the action (*verified*). Browsers send `Origin` and `Sec-Fetch-Site` on every action call, so the check costs real users nothing and makes the CSRF protection independent of `SameSite=Lax`.

  ```ts
  // src/proxy.ts (excerpt)
  function isSameOrigin(request: NextRequest): boolean {
    if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
    return request.headers.get('origin') === serverConfig().APP_ORIGIN;
  }
  export function proxy(request: NextRequest): NextResponse {
    if (request.method === 'POST' && request.headers.has('next-action') && !isSameOrigin(request)) {
      return new NextResponse(null, { status: 403 });
    }
    // … nonce and headers (NEXT-SEC-03)
  }
  ```

  *Verified* in a copy of the reference app: no `Origin` → 403; foreign `Origin` → 403; `Sec-Fetch-Site: cross-site` or `same-site` → 403; same `Origin` or `Sec-Fetch-Site: same-origin` → the action runs; the stubbed E2E suite (Chromium, Firefox) passes with the check in place. The ingress must forward the public `Host` (or `X-Forwarded-Host`): Next.js compares it with `Origin` and aborts the action on a mismatch. `allowedOrigins` is set only when a product serves the same app under a second origin, with an ADR.
- **NEXT-SEC-06: Nothing secret or internal crosses to the client: server components pass explicit view props, never sessions, tokens, configuration or raw backend responses.** Every prop of a client component and every server action result is serialized into the page (RSC payload) and is public (TS-SEC-04). Server components map use-case results (domain types) to the props a client component needs; modules that hold or read secrets (`platform/config`, session, OIDC, server mutator, server composition) start with `import 'server-only'`, so importing them into client code fails the build (NEXT-ARCH-06/07). The public configuration is a separate, explicit subset (NEXT-CFG-05). React's taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`) are **not** enabled by default: `experimental.taint` switches the whole `app` directory to the `react@experimental` channel (Next.js 16.4 configuration types). A product that wants them as an extra guard records an ADR; the structural rules above stay mandatory either way.
- **NEXT-SEC-07: The server-action encryption key is public; no action relies on encrypted bound arguments or closures for security.** Next.js generates a key per build and stores it in `.next/server/server-reference-manifest.json` (field `encryptionKey`) inside the image (*verified*); `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set at build time would be embedded the same way, so it is not set (CFG-05, [NEXT-REL-08](../../07-deployment-view/nextjs-delivery.md)). Consequences: every action re-resolves the session, authorizes in the use case and parses all input (NEXT-SEC-04), including values passed with `.bind()`; actions are module-level, so the key protects nothing in them. Action IDs change with a clean build, so during a rolling deployment a browser on release N-1 calling an action of release N fails; the client then reloads the page once (*to verify before first use* with `deploymentId`, [NEXT-REL-17](../../07-deployment-view/nextjs-delivery.md)).

## Headers

- **NEXT-SEC-08: `proxy.ts` sets the security headers of NODE-BFF-09 on every response it handles; `next.config.ts` sets `poweredByHeader: false`.** From `platform/adapter/in/next/security-headers.ts`: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and a `Permissions-Policy` that denies every feature the app does not use (`camera=(), microphone=(), geolocation=(), payment=(), usb=()` in the template). Route handlers add `Cache-Control: no-store` themselves. A unit test asserts the policy string (nonce-only `script-src`, Trusted Types directives, fresh 128-bit nonce each call); the E2E suite asserts the headers on a real response. *To verify before first use:* the same headers on `/_next/static` files (the proxy matcher skips them; `headers()` in `next.config.ts` is the expected place) and `/.well-known/security.txt` (SEC-INC-02) as a route handler.

## Adoption

- **NEXT-SEC-09: A Next.js BFF goes live only with its threat model and the security tests in CI** (NODE-BFF-10, SEC-TM-02). The threat model covers the NODE-BFF list plus the Next.js entry points: every server action, the API proxy, `proxy.ts`, the test-stub switch (NEXT-SEC-13) and what the RSC payload exposes. Tests:

| What | How |
|---|---|
| Session use case | Vitest with a fixed clock and mocked ports: PKCE data in the pre-login session, absolute `returnTo` refused, new id at login, idle and absolute limits, refresh through `compareAndSet`, failed refresh ends the session, logout revokes and returns the end-session URL |
| Session store | Testcontainers Redis: TTL, `compareAndSet` on the right and wrong generation, missing session, two concurrent writers → exactly one wins |
| Route handlers | Vitest on the handler functions: login sets the pre-login cookie and redirects to the IdP; callback rebuilds the URL from `APP_ORIGIN`, ignores `Host`, answers `400` on a failed login; logout without the XSRF header → `403`, with it → session ended and both cookies cleared; API proxy `401` without session, `403` on an unsafe method without the header, header allow-lists |
| `proxy.ts` | Unit test of the policy string and nonce; E2E: CSP with a 24-character nonce, `require-trusted-types-for 'script'`, `nosniff` on a page response; an action `POST` without `Origin` and with a foreign `Origin` → `403` (request test in the stubbed tier) |
| Server actions | E2E through the UI plus request tests with the action ID: no session → `UNAUTHENTICATED`, extra keys → `INVALID_INPUT` (no unit test: actions take no injected dependencies, NEXT-ARCH-04) |
| CSP and Trusted Types | The shared Playwright fixture collects `securitypolicyviolation` events and CSP/Trusted Types console messages and asserts none after every test, in Chromium and Firefox, including a lazily loaded client component (`next/dynamic`) |

  The stubbed tier runs against the built standalone server, not `next dev` (which sends no production CSP), with `APP_TEST_STUBS=1` ([testing/nextjs.md](../testing/nextjs.md)); this replaces the `serve-dist` script of REACT-SEC-09. Security review per change: [security-review.md](security-review.md) (SEC-REV-01).

## Trusted Types, styles, limits, test mode

- **NEXT-SEC-10: Trusted Types are enforced with one `default` policy that only lets the app's own chunk URLs through.** Replaces REACT-SEC-05 for Next.js. Next.js 16.4 creates no Trusted Types policy in production, but Turbopack's chunk loader assigns a plain string to `script.src` for every lazy chunk (`next/dynamic`, client navigation), which `trusted-types 'none'` blocks. `src/instrumentation-client.ts` (runs before any app code in the browser) therefore:
  1. calls `z.config({ jitless: true })` first (TS-SEC-09; doing it in the providers module is too late);
  2. creates the `default` policy with only `createScriptURL`, which returns the input **unchanged** for same-origin URLs under `/_next/static/chunks/` and throws for everything else. Returning an absolute URL instead (`url.href`) loads the chunk but the component never renders. Without `createHTML` and `createScript`, every HTML and script string stays blocked; Next.js's error overlay writes `innerHTML` and is not allowed.

  ```ts
  // src/instrumentation-client.ts
  z.config({ jitless: true });
  if (typeof window !== 'undefined' && window.trustedTypes) {
    window.trustedTypes.createPolicy('default', {
      createScriptURL: (input) => {
        const url = new URL(input, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith('/_next/static/chunks/')) return input;
        throw new TypeError(`script URL blocked by the Trusted Types default policy: ${url.href}`);
      },
    });
  }
  ```

  The CSP names only this policy (`trusted-types default; require-trusted-types-for 'script'`, never `'allow-duplicates'`). *Verified* enforced in Chromium with a lazily loaded dialog, zero violations in the E2E fixture (Firefox does not enforce Trusted Types, so it is no evidence for this part). A new dependency that needs another sink gets a named policy with a review, not a wider `default` policy. As in every frontend, a changed Trusted Types setup starts in `Content-Security-Policy-Report-Only` and is enforced once the reports are clean; that needs the report endpoint (*to verify before first use*, NEXT-SEC-03).
- **NEXT-SEC-11: Server-rendered markup carries no inline `style` attribute; the CSP is never loosened for one.** `style-src 'self' 'nonce-…'` blocks `style="…"` attributes in the HTML. MUI 9 with the CSS-variables theme writes `style="--Paper-shadow:…;--Paper-overlay:…"` on every **elevated** `Paper` it renders on the server (AppBar, TableContainer, Card): the styles are dropped and the E2E fixture reports two violations per page (*verified*). Server-rendered surfaces use `variant="outlined"` or theme-level styles instead; elevated surfaces rendered on the client (Dialog, Menu) are fine, because React sets their styles through the CSSOM. Never `'unsafe-inline'` or `'unsafe-hashes'` in `style-src`. MUI's `InitColorSchemeScript` is not used (the theme follows `prefers-color-scheme` through `colorSchemeSelector: 'media'`, [ui/react-mui.md](../ui/react-mui.md)).
- **NEXT-SEC-12: Request limits that Next.js does not offer are set at the ingress.** Next.js limits only server-action bodies (`experimental.serverActions.bodySizeLimit`, NEXT-SEC-04); route handlers have no body, header or time limit of their own, and the API proxy reads the whole body (`request.arrayBuffer()`) before relaying it. The ingress in front of the app therefore sets a body-size limit (the largest API request plus margin), header-size and request-time limits on the timeout ladder ([NEXT-RES-03](../resilience/nextjs.md)), and rate limits for `/auth/*`, the CSP report endpoint and action `POST`s. The values are recorded in the product's chapter 7. *To verify before first use* (not built in the reference app).
- **NEXT-SEC-13: Test stubs ship in the one image but can only start in a test or local environment; the start-up refuses them anywhere else.** The production build contains MSW and faker in its server chunks (Turbopack bundles the dynamic import; accepted to keep one build, CFG-02). `register()` in `src/instrumentation.ts` parses the server configuration first and starts the stubs only when `APP_TEST_STUBS` is on; the schema rejects `APP_TEST_STUBS=1` unless `APP_ENVIRONMENT_KIND` is `test` or `local`, and an invalid configuration ends the process with exit code 1 (keys and mechanism: [NEXT-CFG-07](../configuration/nextjs.md)). A unit test asserts that the schema refuses the flag with `APP_ENVIRONMENT_KIND=deployed`; the image smoke test starts with stubs off ([NEXT-REL-21](../../07-deployment-view/nextjs-delivery.md)). *Verified* in a copy of the reference app: `APP_TEST_STUBS=1` with `deployed` → exit 1 before the first request; with `test` → the stubbed E2E suite passes.

## Agent checklist

- [ ] Login, callback, logout, API proxy as route handlers that call the session and relay use cases; cookies set only in route handlers or `proxy.ts` (NEXT-SEC-01/02)?
- [ ] Session store behind the port, Redis `compareAndSet` in Lua, 256-bit id, no tokens in cookies (NEXT-SEC-01)?
- [ ] XSRF synchronizer token checked with `timingSafeEqual` on every unsafe API-proxy call and on logout (NEXT-SEC-02)?
- [ ] Nonce created in `proxy.ts`, passed as request headers, read by the root layout and given to `AppRouterCacheProvider` (NEXT-SEC-03)?
- [ ] New server action: module-level, session re-resolved, `unknown` input parsed `.strict()`, one use case, error codes only (NEXT-SEC-04/07)?
- [ ] Cross-origin action `POST`s rejected in `proxy.ts`; `allowedOrigins` unset (NEXT-SEC-05)?
- [ ] Client props and action results hold no token, session, configuration object or raw backend response; secret-holding modules import `server-only` (NEXT-SEC-06)?
- [ ] No `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in the build (NEXT-SEC-07)?
- [ ] Security headers from `security-headers.ts`, `poweredByHeader: false` (NEXT-SEC-08)?
- [ ] Threat model and the security tests in CI before go-live (NEXT-SEC-09)?
- [ ] `instrumentation-client.ts`: zod jitless first, `default` policy allows only `/_next/static/chunks/`, returns the input unchanged (NEXT-SEC-10)?
- [ ] No elevated MUI surface rendered on the server; no `'unsafe-inline'` (NEXT-SEC-11)?
- [ ] Body, header, time and rate limits at the ingress recorded in chapter 7 (NEXT-SEC-12)?
- [ ] `APP_TEST_STUBS` refused outside test and local environments, with a test (NEXT-SEC-13)?

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| `vercel-react-best-practices` `server-auth-actions`: authenticate inside each action, examples call `db.*` and `verifySession()` | Right about authentication; the action resolves the BFF session and calls one use case, never a database or `fetch` (NEXT-SEC-04, NEXT-D4) |
| `vercel-react-best-practices` `rendering-hydration-no-flicker`: inline `<script>` for client-only data | Only nonced scripts; Next.js stamps its own; no app inline scripts and no data in storage (NEXT-SEC-03, TS-SEC-01) |
| `vercel-react-best-practices` `server-serialization`: pass only needed fields to client components (performance) | Also a security rule: explicit view props, nothing secret (NEXT-SEC-06) |
| Next.js docs: `next-auth`/Auth.js, `iron-session` or JWT cookie sessions | `openid-client` 6 and a server-side session store; the cookie holds only the id (NEXT-D8, NODE-BFF-05) |
| Next.js docs and examples: `middleware.ts` | `src/proxy.ts` with `export function proxy` (NEXT-SEC-03) |
| Next.js docs: rely on the built-in Origin check for server actions; `allowedOrigins` for reverse proxies | Own same-origin check in `proxy.ts`; `allowedOrigins` unset unless an ADR adds a second origin (NEXT-SEC-05) |
| Next.js docs: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for stable keys across instances | Not set; the key is treated as public (NEXT-SEC-07) |
| Next.js docs: `experimental.taint` as the protection against leaking data | Not enabled by default (experimental React channel); structural rules instead (NEXT-SEC-06) |
| Next.js docs: Trusted Types with `trusted-types nextjs` / pass-through `default` policy | `default` policy that allow-lists `/_next/static/chunks/` only (NEXT-SEC-10) |
| `material-ui-theming` / `material-ui-styling`: elevation on server-rendered `Paper`, `InitColorSchemeScript` | `variant="outlined"` on server-rendered surfaces, `colorSchemeSelector: 'media'` (NEXT-SEC-11) |

## Sources

Next.js 16 documentation (nextjs.org/docs): Content Security Policy guide (nonces through `proxy.ts`), `proxy.ts` file convention, Server Actions security ("Data Security" guide: Origin check, closures and encryption, `allowedOrigins`, `bodySizeLimit`), `instrumentation-client.ts`, `experimental.taint`, `poweredByHeader`. Next.js 16.4.6 source in `next/dist` (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `server-reference-manifest.json`, configuration types). React 19.3 serializable props of client components and taint APIs (react.dev). `@mui/material-nextjs` 9.5 `v16-appRouter` `AppRouterCacheProvider`; MUI Content Security Policy guide. `openid-client` 6.9 and `redis` 6.3 documentation. W3C Trusted Types, Fetch Metadata (`Sec-Fetch-Site`). OWASP ASVS 5.0 (V3, V4, V7, V10), OWASP CSRF Prevention, Session Management and Content Security Policy Cheat Sheets. Checked in the reference app and a copy of it on 2026-11-20 (Next.js 16.4.6, React 19.3.1, MUI 9.5.0, zod 4.6.7, openid-client 6.9.0, redis 6.3.1 against Redis 8.4, Playwright 1.65 with Chromium and Firefox).
