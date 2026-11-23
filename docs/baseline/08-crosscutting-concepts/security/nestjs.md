# NestJS: Security

Authentication and authorization for NestJS backends (hardening and the NestJS BFF: [nestjs-hardening.md](nestjs-hardening.md); shared process: [security-requirements.md](security-requirements.md), [security-review.md](security-review.md)). The backend validates tokens from an external identity provider (IdP) and the core decides on a framework-free `Caller` ([ARCH-UC-15](../../05-building-block-view/use-cases.md)). Versions named here were verified together with NestJS 12.6 on the Fastify adapter.

## Model

```
Browser (SPA)     ──session cookie──▶ BFF ──access token──▶ API (resource server) ──▶ use case(caller, command)
Service / job     ────────────────access token───────────▶ API (resource server)
Kafka listener    ───────────system Caller──────────────────────────────────────▶ use case(caller, command)
```

The API validates bearer JWTs. It does not issue tokens, store passwords or render login pages.

## Rules

### Authentication

- **NEST-SEC-01: One global `AuthGuard` authenticates every request; endpoints are protected unless marked `@Public()`.** The guard, the `@Public()` and `@Roles()` decorators, the `@CurrentCaller()` parameter decorator and the CORS options live in `src/platform/adapter/in/rest`. The guard is registered once as `{ provide: APP_GUARD, useClass: AuthGuard }` in the root module, reads the `@Public()` metadata with `Reflector.getAllAndOverride` on handler and class, and otherwise requires a valid token (deny by default). Public endpoints are few and named: the probes `/livez` and `/readyz` (NEST-OBS rules in [../observability/nestjs.md](../observability/nestjs.md)); on a BFF also `index.html` and the hashed assets, `/config.json`, `/.well-known/security.txt` (SEC-INC-02), the CSP report endpoint, login, login callback and back-channel logout (NEST-SEC-44 ff.). A new `@Public()` endpoint states its reason in the pull request.
- **NEST-SEC-02: The REST adapter authenticates, the use case authorizes.** The guard turns the verified token into a `Caller` (`src/platform/domain/caller.ts`: user id, roles or permissions, tenant where the product has tenants), stores it on the Fastify request, and the controller passes it into the command (`@CurrentCaller() caller: Caller`). Object-level and business authorization happen in the use case with methods on `Caller` or a domain policy, testable without Nest. `@nestjs/*`, `fastify` and `jose` imports are forbidden in `domain`, `ports` and `application` (dependency-cruiser, NEST-ARCH rules in [../../05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md)). `@Roles(...)` on a controller is for coarse checks only (an admin-only controller); if guards become the main authorization mechanism, write an ADR. Kafka consumers and scheduled jobs call the same use cases with a system `Caller`.
  *Why:* the core stays framework-free, and every entry point goes through the same checks.
- **NEST-SEC-03: The backend API is an OAuth2 resource server as soon as a non-browser client calls it (a separate BFF, another service, a script), and it verifies JWTs with `jose` 6 and nothing else.** A backend whose only clients are browsers behind its own BFF module (NEST-SEC-13) authenticates by session alone and adds the token guard with the first machine client; no deviation ADR is needed for that. The IdP is the organisation's where one exists, otherwise Keycloak in every environment, recorded in an ADR. The key set is `createRemoteJWKSet(new URL(jwksUri), { timeoutDuration, cooldownDuration, cacheMaxAge })` with all three values set from configuration (jose defaults: 5 s, 30 s, 10 min; RES-TMO-01), created once and provided under an injection token so tests can replace it. No self-issued tokens, no hand-written parsing (no `split('.')`, no base64 decoding of tokens for decisions, no `decodeJwt` result used for authorization), no `jsonwebtoken`, `passport-jwt` or `jwt-decode`. A product that must be its own IdP records that in an ADR.
- **NEST-SEC-04: `jwtVerify` pins every check explicitly:**

  ```ts
  await jwtVerify(token, keys, {
    issuer: cfg.issuer,                   // exact iss
    audience: cfg.audience,               // this API's audience
    algorithms: ['RS256'],                // asymmetric algorithms the IdP uses; never HS* with a public key set
    clockTolerance: cfg.clockToleranceSeconds, // small, for example 30
    requiredClaims: ['sub', 'exp'],
  });
  ```

  The token comes only from `Authorization: Bearer <token>`, never from a query parameter or (on the API) a cookie. The guard tells two failures apart:

  | Failure | Answer | Audit event (NEST-SEC-33) |
  |---|---|---|
  | No bearer token | 401, `WWW-Authenticate: Bearer` | `auth.token_missing` |
  | Token rejected: any other `jose` error (`errors.JOSEError`), including a `kid` the key set does not contain (`JWKSNoMatchingKey`) | 401, `WWW-Authenticate: Bearer error="invalid_token"` (RFC 6750) | `auth.token_rejected` with the jose code |
  | Key set unavailable: `JWKSTimeout`, a network error of the fetch (a non-jose error such as `TypeError: fetch failed`), `JWKSInvalid`, and the generic `JOSEError` (`ERR_JOSE_GENERIC`) jose throws for a non-200 or non-JSON key set answer | 503 + `Retry-After` through `UnavailableError` (NODE-ARCH-07) | `auth.key_set_unavailable` with the jose code or error name |

  The distinction sits in a wrapper around the key set function that `jwtVerify` calls, so only errors of the key lookup can become 503; a token is never accepted because the key set failed (fail closed), and an identity-provider outage does not look like a wave of bad tokens to clients, which would drop their tokens and log users out. The problem filter adds `WWW-Authenticate: Bearer` to every other 401 (NEST-REST-14). The guard test signs tokens locally and asserts 401 with the challenge for: no token, wrong `aud`, wrong `iss`, expired, `alg: none`, an algorithm outside the list (an HS256 token), and a key not in the set; and, against a local `node:http` key set endpoint with `createRemoteJWKSet`, 503 with `Retry-After` for a key set timeout, an HTTP error, a non-JSON and an invalid key set, and an unreachable endpoint.
- **NEST-SEC-05: No `passport` and no `@nestjs/passport`.** `@nestjs/passport` 12.0.2 supports Nest 12, but it adds a strategy layer around `passport` 0.7 (last release January 2025) and `passport-jwt` 4.0.1, which verifies with `jsonwebtoken` instead of `jose`. The guard of NEST-SEC-01..04 is a few dozen lines, has no Express assumptions and is tested directly.
- **NEST-SEC-06: Stateless token APIs need no CSRF protection; a cookie-authenticated route always has it** (BFF, NEST-SEC-48). Never switch a protection off to make a test or a demo pass (SEC-REV-02).
- **NEST-SEC-07: CORS is configured once with `app.enableCors({ origin: [...], credentials })`** (Nest's Fastify adapter registers `@fastify/cors` 11.4) in `createApp()`, with the origins from configuration. Never `origin: true`, `'*'` or a reflecting function together with credentials. A browser app served by its BFF is same-origin and needs no CORS at all. A test sends a preflight from a foreign origin and asserts that no `Access-Control-Allow-Origin` comes back, and one from an allowed origin that it does.

### Object-level authorization

- **NEST-SEC-08: Every use case that takes a caller-supplied id checks owner or tenant, and a test proves that user A cannot read or change user B's resource.** The test is a use-case unit test (or REST adapter test) tagged `cross-user` with Vitest's tags (`describe('GetOrderService', { tags: ['cross-user'] }, …)`, tag declared in `vitest.config.ts` under `test.tags`; run alone with `--tags-filter=cross-user`). An architecture test lists the `*.service.ts` files under `src/features/*/application/` and fails when no `cross-user`-tagged block calls it (a tagged block elsewhere in the same file covers only the services it calls) and it is not listed there as taking no caller-supplied id. Status codes for foreign objects: NEST-SEC-29.
  *Why:* missing object-level checks (BOLA/IDOR) are the most common API flaw (ASVS V8, OWASP API1).

### Operations

- **NEST-SEC-09: Secrets and tokens never reach a log, a response or the repository** (SEC-INC-01, CFG-05, CFG-07). pino redacts at least `req.headers.authorization`, `req.headers.cookie` and `res.headers["set-cookie"]` (NEST-LOG rules in [../logging/nestjs.md](../logging/nestjs.md)); token payloads, session contents and the session and CSRF secrets are never logged. Secret configuration values use the masking `Secret` type of NEST-CFG ([../configuration/nestjs.md](../configuration/nestjs.md)).
- **NEST-SEC-10: Probe and operational endpoints expose nothing and are not routed from outside.** `/livez` and `/readyz` are `@Public()`, answer only status (no versions, no dependency details, no stack traces), and the ingress does not route them from the internet (the platform calls them directly). No application endpoint shares a path with a probe. A metrics endpoint, if the platform pulls metrics, is not public (separate port or network policy, NEST-OBS rules). No debug, heap-dump or admin endpoints.
- **NEST-SEC-11: Fastify's `trustProxy` is set explicitly per deployment, never left to chance:** `false` when nothing sits in front, otherwise the proxy's address or CIDR list (Fastify 5 rejects a hop count). `true` only where the network guarantees that nothing but the proxy reaches the port, recorded in chapter 7 of the product's architecture docs. The proxy strips client-supplied `Forwarded`/`X-Forwarded-*` headers before setting its own.
  *Why:* `request.ip`, `request.protocol` and `request.host` drive rate-limit keys, audit logs, redirects and the `Secure` session cookie; trusting a client's header is a spoofing hole, ignoring the proxy breaks the BFF's secure cookie and login redirects.

### Browser login

- **NEST-SEC-12: Browser applications authenticate through a backend-for-frontend (BFF)** that performs the OIDC login, keeps the tokens server-side and gives the browser only a session cookie with CSRF protection. The browser holds no access token. The API behind it stays a plain resource server (NEST-SEC-03).
- **NEST-SEC-13: Whether the BFF is its own component (`backend-bff/`, REPO-LAY-03) or a module of the NestJS backend is decided per project in an ADR.** The BFF holds no business logic (ARCH-ADP). Its rules are NODE-BFF-01..10 in [node-bff.md](node-bff.md), wired as NEST-SEC-44 ff. in [nestjs-hardening.md](nestjs-hardening.md). With a Next.js frontend, the Next.js app is the BFF and the NestJS backend stays a plain resource server.
- **NEST-SEC-53: Users the product administers are provisioned in the IdP through an outgoing port**, never by a second user store with passwords: invitation (create the user, trigger the IdP's set-password action), deactivation (disable the user and end their sessions), and language or name sync are calls of an adapter in `adapter/out/http/` to the IdP's admin API (Keycloak: a confidential service-account client with only `manage-users`/`view-users` and the `kc-admin-api` client scope), with explicit timeouts (NEST-LIB-07). The product keeps its own user row (id, IdP subject, assigned roles, language) linked to the IdP subject; a failed call leaves no half-created user (create in the IdP first, or compensate).

### Tests

- **NEST-SEC-14: Every endpoint has security tests for 401 (no or invalid token), 403 (insufficient role, where coarse roles apply) and the success case.** They are REST adapter tests: `Test.createTestingModule` with the controller, mocked use cases and the real `AuthGuard` as `APP_GUARD`, `createNestApplication(new FastifyAdapter())`, requests through `app.inject(...)`. Tokens are signed locally with the algorithm the guard pins (NEST-SEC-04): `generateKeyPair('RS256')`, the public key exported with `exportJWK` into `createLocalJWKSet({ keys: [jwk] })`, which replaces the remote key set under its injection token, and `new SignJWT(claims).setProtectedHeader({ alg, kid }).setIssuer(...).setAudience(...).setSubject(...).setExpirationTime(...)`. No test switches the guard off.
- **NEST-SEC-15: Authorization rules are unit-tested on `Caller`** in the use-case tests, without a Nest context (London style for the ports, [TEST-TDD](../testing/tdd.md); NEST-TEST rules in [../testing/nestjs.md](../testing/nestjs.md)).

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Security".*
