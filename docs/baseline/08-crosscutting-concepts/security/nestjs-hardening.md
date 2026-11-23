# NestJS: Hardening

Hardening for NestJS backends on Node on top of authentication and authorization ([nestjs.md](nestjs.md), `NEST-SEC-01..15`); numbering continues there. The last section covers a NestJS backend-for-frontend (BFF). Shared process rules: [security-requirements.md](security-requirements.md), [secure-pipeline.md](secure-pipeline.md), [vulnerability-management.md](vulnerability-management.md), [security-review.md](security-review.md). Option names and defaults below were checked against Fastify 5.12, `@fastify/*` plugins of the versions named and Node 26.

## Transport and headers

- **NEST-SEC-20: `createApp()` registers `@fastify/helmet` 13 for the whole app; no route turns it off (`helmet: false` is forbidden).**

  | Header | API | BFF route that serves the SPA (NEST-SEC-51) |
  |---|---|---|
  | `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'`: `contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }` (without `useDefaults: false` helmet merges its HTML defaults) | the nonce policy of NEST-SEC-51 |
  | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (helmet default; `preload` only by decision of the domain owner) | same |
  | `X-Content-Type-Options` | `nosniff` (helmet default) | same |
  | `Referrer-Policy` | `no-referrer` (helmet default) | same |
  | `Cross-Origin-Resource-Policy` | `same-origin` (helmet default) | same |
  | `Cross-Origin-Opener-Policy` | helmet default `same-origin`, harmless | `same-origin` |
  | `Cache-Control` | `no-store` on every authenticated response, set by an `onSend` hook in `createApp()` (helmet sets no `Cache-Control`) | `no-store` on `index.html`; hashed assets cacheable |
  | `Permissions-Policy` | not needed | every feature the app does not use denied, for example `camera=(), microphone=(), geolocation=(), payment=(), usb=()`, set by the BFF (helmet does not set it) |

  A test asserts the API headers on one public and one authenticated endpoint.
- **NEST-SEC-21: TLS everywhere outside the developer machine, with the versions of SEC-CRY-01.** TLS ends at a managed proxy or in the service; plain HTTP is never reachable from outside. Connections to the database, Kafka and the IdP use TLS with certificate verification in every non-local environment. Forwarded headers: NEST-SEC-11.

## Input

- **NEST-SEC-22: Request limits are set explicitly on `new FastifyAdapter({...})` from configuration, not left to defaults:**

  | Option | Fastify/Node default | Rule |
  |---|---|---|
  | `bodyLimit` | 1 MiB | set explicitly; oversized bodies get 413 |
  | `http: { maxHeaderSize }` | 16 KiB (Node) | set explicitly; oversized headers get 431 |
  | `requestTimeout` | 0 (none) | set, for example 30 s |
  | `connectionTimeout` | 0 (none) | set |
  | `handlerTimeout` | 0 (none) | set; Fastify answers 503 and aborts `request.signal`; longer per route only with a reason |
  | `keepAliveTimeout` | 72 s | longer than the idle timeout of the proxy in front |
  | `maxParamLength` | 100 | keep |

  Every string and array in a request schema has a maximum length or size (NEST-REST rules in [../api/nestjs-rest.md](../api/nestjs-rest.md)). Multipart uploads have their own limits (NEST-SEC-37). Fastify has no JSON nesting-depth limit; the body limit and strict schemas bound it. The proxy or gateway in front also limits the body size.
  *Why:* unbounded input is a resource-exhaustion hole (ASVS V2, Top 10 A10), and on Node one slow request can hold the event loop.
- **NEST-SEC-23: Untrusted JSON is parsed strictly and never merged into existing objects.**
  - Fastify's `onProtoPoisoning` and `onConstructorPoisoning` stay at their default `'error'`: a body with a `__proto__` or `constructor.prototype` key is rejected with 400.
  - Request bodies, query strings, parameters, Kafka payloads and responses of outbound calls are parsed with zod schemas; request schemas are `z.object(…)`, which strips unknown keys (tolerant reader, API-REST-04, NEST-REST-08), so only declared fields reach the handler (NEST-SEC-27).
  - Untrusted objects are never copied with `Object.assign`, spread or a deep-merge or path-setting helper (`lodash.merge`, `set`, `defaultsDeep` and similar) onto existing objects, configuration or prototypes. Maps keyed by user input are `Map` or `Object.create(null)`.
  - Polymorphic payloads are closed unions (`z.discriminatedUnion` with a fixed tag); no type names from the payload pick a class or a module.
  - Consider starting Node with `--disable-proto=delete` (removes `Object.prototype.__proto__`; the reference app runs unchanged with it); a product that adopts it runs its full test suite with the flag.
- **NEST-SEC-24: No regular expression comes from user input, and every regex that sees user input is linear.** `new RegExp(...)` takes only literals or constants (`security/detect-non-literal-regexp` from `eslint-plugin-security` 4.2); regexes are checked for catastrophic backtracking with `eslint-plugin-regexp` (`regexp/no-super-linear-backtracking`, `regexp/no-super-linear-move`; `security/detect-unsafe-regex` is not used, it flags linear patterns such as `^\d+(\.\d{1,2})?$`) and reviewed, including those in zod schemas; input length is limited by the schema before the regex runs. Fastify's `allowUnsafeRegex` stays `false`.
  *Why:* one backtracking regex blocks the single event loop for every request (ReDoS).
- **NEST-SEC-25: Queries receive user-influenced values only as bind parameters.** Kysely's builder and its `sql` template tag bind interpolated values. `sql.raw`, `sql.ref`, `sql.id`, `sql.table` and `sql.lit` insert text and take only values from an allow-list in the adapter that maps API values to fixed identifiers (sort columns and directions from the `sort` parameter, API-REST-09). `LIKE` patterns escape `%`, `_` and the escape character. No process execution with user-influenced input: `node:child_process` is imported only in one named adapter, which starts a fixed command with `execFile`/`spawn` and an argument array (never a shell, never `exec`), arguments checked against an allow-list. The same holds for LDAP filters, XPath and template engines.
- **NEST-SEC-26: No dynamic code.** No `eval`, `new Function`, `node:vm`, string arguments to `setTimeout`/`setInterval`, and no `import()`/`require()` or file-system path built from user input. ESLint enforces it: `no-eval`, `no-implied-eval` (or `@typescript-eslint/no-implied-eval`), `no-new-func`, `no-restricted-imports` for `child_process`, `node:child_process`, `vm`, `node:vm` (the process adapter of NEST-SEC-25 is the one exception), `security/detect-non-literal-require`, `security/detect-non-literal-fs-filename`, and `no-restricted-syntax` for `ImportExpression` with a non-literal source. Node's `--disallow-code-generation-from-strings` cannot be used: Fastify's router compiles code with `new Function` at start-up.

## Authorization

- **NEST-SEC-27: Request schemas carry only what the caller may set.** Owner, tenant, role and permission fields, ids of new aggregates and audit fields (`createdBy`, `createdAt`) are never request fields; they come from the `Caller`, the use case or the server. Status changes are explicit commands (`CancelOrder`), not a writable `status` field. Requests map to commands field by field ([mapping-between-boundaries.md](../mapping/mapping-between-boundaries.md)); a body is never spread into a command, a domain object or a table row. ESLint enforces the usual names in `adapter/in/rest/**`: `no-restricted-syntax` with the selector `VariableDeclarator[id.name=/Request$/] Property[key.name=/^(ownerId|tenantId|role|roles|permissions|createdBy|createdAt)$/]` (request schema constants end in `Request`).
  *Why:* mass assignment turns a profile update into a privilege escalation (ASVS V8, A01).
- **NEST-SEC-28: A multi-tenant product takes the tenant only from the `Caller`** (a token claim mapped by the guard), never from a path, query parameter or body. Every query port for tenant-owned data takes the tenant and every Kysely query filters by it, or the database enforces it with row-level security set per transaction. Cache keys and outgoing calls include the tenant. Each use case that takes an id has a cross-tenant test, tagged `cross-user` like the cross-user test (NEST-SEC-08). Whether the product is multi-tenant and how tenants are isolated (column, schema, database) is an ADR.
- **NEST-SEC-29: An object the caller may not see answers 404, as if it did not exist; 403 only when the caller may know the object but lacks the permission for this action** (may read an order, may not cancel it). The use case throws the same `NotFoundError` subclass for missing and foreign objects, so the response body cannot tell them apart; the 403 case is `AccessDeniedError` (ARCH-UC-13). The cross-user test asserts the status.
  *Why:* a 403 for a foreign id confirms that the id exists and makes enumeration cheap.

## Errors and outbound calls

- **NEST-SEC-30: Responses never contain stack traces, SQL, class names or exception messages.** The global problem-details filter (`@Catch()` in `src/platform/adapter/in/rest`, NEST-REST rules) maps by error category; `title` is the fixed reason phrase of the status, never `error.message`; unknown errors become a generic 500 with the trace id (OBS-11). Errors thrown by Fastify plugins are not `HttpException`s but carry a `statusCode` (rate limit 429, CSRF 403, multipart 413): the filter maps a 4xx `statusCode` to that status with a generic title, otherwise they turn into 500. Nest's built-in exception handler never answers a request. A guard that fails for an unexpected reason denies (fail closed).
- **NEST-SEC-31: Outbound HTTP to a destination that users or data influence is restricted:** an allow-list of hosts per adapter; no redirects (`fetch` follows them by default, so `redirect: 'error'`; undici's `request` does not follow); and an undici `Agent` whose `connect.lookup` resolves the name and rejects loopback, private, link-local and metadata ranges (`net.BlockList`). The lookup is not called for IP literals, so the adapter also checks a literal host against the same list before the call. With a forward proxy that resolves names, restrict at the proxy. Timeouts per RES-TMO-01 (NEST-RES rules in [../resilience/nestjs.md](../resilience/nestjs.md)).

## Abuse protection and audit

- **NEST-SEC-32: Rate limiting answers 429 and sits at the gateway or reverse proxy by default.** In the service only for business limits (password-reset or invitation requests per account, exports, expensive searches): `@fastify/rate-limit` 11 registered with `global: false`, limits per route with `@RouteConfig({ rateLimit: { max, timeWindow } })` from `@nestjs/platform-fastify`, keyed by the `Caller` id on authenticated routes (`keyGenerator`). Shared counters across instances use its `redis` option. Login throttling belongs to the IdP. The client address is `request.ip`, which is only right with NEST-SEC-11. Public routes (login start, callback, back-channel logout, report endpoints, NODE-BFF-11) are limited too: by the gateway, recorded in chapter 7, or by this plugin. A product that does neither does not install `@fastify/rate-limit` (an unused dependency looks like a finished control).
- **NEST-SEC-33: Security events are logged as structured audit events:** login, logout, denied access (401/403 by the guard), token validation failure, key set unavailable (NEST-SEC-04; an outage, not an attack, but it explains a burst of 503), permission change, administrative action, key destruction (SEC-CRY-04). Each carries the pseudonymous user id and the trace id and no other personal or sensitive data (NEST-LOG rules), and a test asserts each event type. Storage, retention and alerting: SEC-AUD-01..03.

## Process and runtime

- **NEST-SEC-34: An unhandled rejection or uncaught exception ends the process.** Node's default (`--unhandled-rejections=throw`, exit code 1) stays; no `warn`/`none` mode. A `process.on('uncaughtException' | 'unhandledRejection')` handler may only log the error synchronously and call `process.exit(1)`; the orchestrator restarts the container. Floating promises are a lint error (NODE-TOOL rules in [../development/node-tooling.md](../development/node-tooling.md)).
  *Why:* after an unexpected error the process state is unknown; continuing can leak data or locks between requests.
- **NEST-SEC-35: Nothing CPU-heavy or synchronous runs on the event loop in a request path:** no `*Sync` crypto, `zlib` or `fs` calls, no password hashing or large JSON work without a bound. Such work uses the async API (thread pool) or a worker thread.
- **NEST-SEC-36: Deployed environments run only production code:** the image contains `dist/` and production dependencies only (`npm ci --omit=dev`); no `--inspect`, no `@nestjs/devtools-integration`, no REPL, no request-body logging, and no OpenAPI UI (`SwaggerModule.setup`) unless it is protected. A test with the deployed configuration asserts that the OpenAPI UI path answers 404 or 401, and the release build fails when the image contains a dev dependency.

## Uploads

- **NEST-SEC-37: Uploads are limited and stored, scanned and served so that a file cannot attack the server or other users:**
  - `@fastify/multipart` 10 with explicit `limits` (`fileSize`, `files`, `fields`, `fieldSize`, `parts`, `headerPairs`); multipart bodies bypass `bodyLimit`, so these limits are the only bound in the service;
  - type detected from the content, not from the extension or the client's `Content-Type`;
  - stored under a server-generated name outside any served directory or in object storage; the client's file name is kept only as escaped metadata;
  - scanned for malware by a capability the product names before anyone else can download the file; quarantined until then;
  - archives (including Office files, which are ZIPs) are not unpacked, or only with limits on entry count, total uncompressed size and compression ratio, or counted caps on the inflated bytes per entry and in total (a ratio cannot be checked while streaming), and entry paths checked (no `..`, no absolute paths, no links);
  - downloads authorized per object like any read (NEST-SEC-08, NEST-SEC-29), served with `Content-Disposition: attachment`, a safe file name, `X-Content-Type-Options: nosniff` and the content type stored at upload; active content (HTML, SVG, PDF shown inline) only from a separate origin without the session cookie, or not inline at all.

  Tests build hostile files in memory (oversized entries, too many entries, `../` paths, wrong content behind a known extension) and keep at least one fixture per format written by a real producer (an office suite). Importing structured data from an upload follows the bulk-import default (ARCH-UC-19) of [use-cases.md](../../05-building-block-view/use-cases.md).

## Database, Kafka and image

- **NEST-SEC-38: The application's database role has DML rights only;** migrations run with a separate DDL role and a `lock_timeout` (NEST-DB rules in [../persistence/nestjs.md](../persistence/nestjs.md), NEST-REL rules in [../../07-deployment-view/nestjs-delivery.md](../../07-deployment-view/nestjs-delivery.md)); no superuser; `pg` connects with `ssl` and certificate verification (`rejectUnauthorized` is never `false`); `scram-sha-256` authentication.
- **NEST-SEC-39: Kafka in non-local environments uses TLS, SASL, ACLs per service and no auto-created topics.** TLS and SASL are the client options `tls` and `sasl` with SCRAM, from configuration; the ACLs cover topics and consumer groups (NEST-MSG rules in [../messaging/nestjs.md](../messaging/nestjs.md)).
- **NEST-SEC-40: The image meets REL-IMG-01 and REL-RUN-01/02:** OCI, runs as a non-root user, minimal Node base image pinned by digest, read-only root filesystem with a size-limited `/tmp`, no compilers, sources, `.npmrc` with tokens or other secrets in any layer, `node dist/main.js` as the entry command, an SBOM from the build (SEC-CI-03), referenced by digest. Scanning: SEC-CI-06 ([container-runtime.md](../../07-deployment-view/container-runtime.md), NEST-REL rules).
- **NEST-SEC-41: Consider Node's permission model** for services with a narrow footprint: `node --permission --allow-fs-read=/app --allow-net dist/main.js` (plus `--allow-fs-write=/tmp` if needed). The reference app runs with it on Node 26, but `--allow-net` is still marked experimental there, so it is an option recorded in an ADR, not a default.

## Cryptography and supply chain

- **NEST-SEC-42: Cryptography follows SEC-CRY-01..05 with `node:crypto` and `jose` only:** `randomBytes`/`randomUUID` for tokens and ids (never `Math.random`), SHA-256 or better for hashes, `timingSafeEqual` to compare secrets and tokens, and, if passwords ever exist, Argon2id (`crypto.argon2`, available in Node 26) or scrypt with OWASP parameters, with the algorithm and parameters stored with each hash so the default can change. No other crypto packages, no custom crypto, no MD5 or SHA-1 for security purposes.
- **NEST-SEC-43: The npm supply-chain rules of TS-TOOL-11..16 ([typescript-tooling.md](../development/typescript-tooling.md)) apply to the backend unchanged:** `.npmrc` with `ignore-scripts=true`, `allow-git=none` and `min-release-age=7`, committed lockfile and `npm ci`, lockfile vulnerability scan and `npm audit signatures` in CI, exact versions, automated updates, reproducible builds; every new dependency is reviewed (age, maintainers, install scripts).

## NestJS as backend-for-frontend

The framework-neutral BFF rules are NODE-BFF-01..10 in [node-bff.md](node-bff.md). The rules below add only the NestJS and Fastify wiring. They are written from documentation and a scratch test of the plugins; no product has run them yet ([chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)).

- **NEST-SEC-44: The BFF implements NODE-BFF-01.** A separate BFF component relays API calls through an outgoing adapter; a BFF module inside the backend gives its session-authenticated routes the same `Caller` by verifying the session's access token with the guard's `jwtVerify` (NEST-SEC-03). Login, callback, back-channel logout, the CSP report endpoint and the SPA routes are `@Public()` (NEST-SEC-01).
- **NEST-SEC-45: The OIDC login of NODE-BFF-02 lives in a BFF controller in `adapter/in/rest`**; the `openid-client` configuration is created once in a provider factory at start-up, so a failing discovery stops the start (OBS readiness).
- **NEST-SEC-46: The session store of NODE-BFF-03 is `@fastify/session` 11 (with `@fastify/cookie` 11)** with a store object implementing `set`, `get`, `compareAndSet` (`ENOENT` on a missing session or a generation mismatch) and `destroy`. Redis: `connect-redis` 11 `RedisStore` with the `redis` client, extended by an atomic `compareAndSet` (Lua script, as in the plugin's `examples/redis.js`); stores written for express-session lack `compareAndSet`. Postgres: a small store in `adapter/out/persistence` on its own table. `saveUninitialized: false`; the signing `secret` from the secret manager, an array for rotation.
- **NEST-SEC-47: The cookie of NODE-BFF-04 is configured as `cookieName: '__Host-session'`, `cookie: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' }`** without `domain`, and cleared with `secure: true`, `path: '/'`. The plugin sets no `Secure` cookie on a plain-HTTP request, so behind a TLS-terminating proxy `trustProxy` must be right (NEST-SEC-11).
- **NEST-SEC-48: CSRF (NODE-BFF-06) uses `@fastify/csrf-protection` 8 with `sessionPlugin: '@fastify/session'`** and `getToken: (req) => req.headers['x-xsrf-token']` (the default also reads the body and other headers). The `XSRF-TOKEN` cookie value is `await reply.generateCsrf()`; `fastify.csrfProtection` runs as `onRequest` hook on every unsafe method, logout included.
- **NEST-SEC-49: Lifetimes and refresh (NODE-BFF-07) run in an `onRequest` hook** that checks `lastSeenAt` and `createdAt` in the session; login calls `await request.session.regenerate()` before storing the user.
- **NEST-SEC-50: Logout (NODE-BFF-08) calls `request.session.destroy()`** and clears the cookie as in NEST-SEC-47; the back-channel endpoint is a `@Public()` route with a body limit.
- **NEST-SEC-51: The BFF serves the SPA (NODE-BFF-09, REL-FE-01..05 in [container-runtime.md](../../07-deployment-view/container-runtime.md)) with `@fastify/static` 10 (an exact-version dependency added together with this serving code; the service skeleton does not contain it) and helmet's CSP directive functions:**
  - hashed assets through `@fastify/static` with `index: false` and `dotfiles: 'ignore'` (the default `'allow'` serves dotfiles), the cache header via `setHeaders(reply, path)`;
  - `index.html` is never served by the static plugin (it would go out with the nonce placeholder and a cache header); keep the template outside the static root or route `/index.html` to the same handler as deep links;
  - the handler creates the nonce, helmet's CSP directives read it through directive functions, and the handler replaces the build's nonce placeholder where the frontend stack says (Angular: the `ngCspNonce` attribute and the `nonce` attribute of every `<script>`, `<style>` and stylesheet `<link>`, with `trusted-types angular angular#bundler angular#components`, NG-SEC-05/06);
  - `/config.json` is generated per environment and not cached.
- **NEST-SEC-52: The NestJS BFF meets NODE-BFF-10**, and its end-to-end test also checks every header of NEST-SEC-20.

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Hardening".*
