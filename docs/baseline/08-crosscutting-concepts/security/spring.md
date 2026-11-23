# Spring Boot: Security

Authentication and authorization for Spring Boot services (hardening beyond this: [spring-hardening.md](spring-hardening.md); shared process: [security-requirements.md](security-requirements.md)): the backend validates tokens from an external identity provider (IdP), and the core decides on a framework-free `Caller`. Framework know-how (Security 6/7 APIs, test post-processors) comes from the `spring-security` skill; where it disagrees with this doc, this doc wins.

## Model

```
Browser (Angular) ──session cookie──▶ BFF ──access token──▶ API (resource server) ──▶ use case(Caller, command)
Service / job     ────────────────access token───────────▶ API (resource server)
Kafka listener    ───────────system Caller──────────────────────────────────────▶ use case(Caller, command)
```

The API validates bearer JWTs. It does not issue tokens, store passwords or handle login pages.

## Rules

### Authentication

- **SPRING-SEC-01: The `SecurityFilterChain`, CORS configuration and the `Authentication → Caller` conversion live in `adapter.in.rest`** (next to what they configure, SPRING-ARCH-02). URL rules end in `anyRequest().authenticated()` (deny by default). Public paths are listed explicitly: on every service the probe paths `/livez` and `/readyz` (SPRING-OBS-02); on the chain that serves the SPA these are `index.html`, the hashed assets, `/config.json`, `/.well-known/security.txt` (SEC-INC-02), the CSP report endpoint (SPRING-SEC-13) and the login and logout endpoints.
- **SPRING-SEC-02: Authorization is plain code on a `Caller`; the REST adapter authenticates, the use case authorizes ([ARCH-UC-15](../../05-building-block-view/use-cases.md)).** The REST adapter authenticates, converts the principal into a framework-free `Caller` record (user id, roles/permissions; defined in `ports.in` or `domain`), passes it with the command, and may do coarse route checks (for example `hasRole` on a URL pattern). Object-level authorization happens in the use case, using methods on `Caller` or a domain policy; this is unit-testable without Spring. `SecurityContextHolder` and `org.springframework.security..` are forbidden in `domain` and `ports` (ArchUnit). `@PreAuthorize` is allowed in `application` for coarse role checks only (the architecture test's allow-list for `application` includes `org.springframework.security.access.prepost..`); if it becomes the main mechanism, write an ADR.
  *Why:* the core stays framework-free (ARCH-DEP), and a Kafka listener or scheduled job calls the same use case with its own `Caller` (e.g. a system caller).
- **SPRING-SEC-39: `Caller` is a record in `domain`, built in one place per adapter, and never null.** Its components are the stable subject (IdP `sub`) and what use cases need to authorize or address the person (product user id, roles or permissions, display name, e-mail, language), all required and checked in the constructor. Each incoming adapter has one conversion from its principal to a `Caller` (`CallerResolver` in `adapter.in.rest`, SPRING-SEC-01); a claim the IdP is configured to send but that is missing is a server error (`IllegalStateException`), not a 400. Listeners and scheduled jobs use a named system `Caller`, never `null` and never a fake user. Every use-case command carries the `Caller` (ARCH-UC-15), which the use-case generator relies on (SPRING-ARCH-19). The one use case that creates the `Caller` from the IdP identity (resolving or registering the user at login) cannot receive it: its command carries the named system caller of the login flow plus the verified identity (subject and claims), and says so in its Javadoc.
  *Why:* one shape of the caller gives every adapter the same authorization decision, and a null caller is how an unauthorized path ships.
- **SPRING-SEC-03: The backend API is an OAuth2 resource server as soon as a non-browser client calls it** (`spring-boot-starter-security-oauth2-resource-server`, JWT validated through `issuer-uri`): a separate BFF component, another service, a mobile app, a script. A backend whose only clients are browsers behind its own in-process BFF chain (SPRING-SEC-09) has the session chain alone and adds the resource-server chain with the first machine client; no deviation ADR is needed for that. The IdP is external (Keycloak locally, see [07-deployment-view/spring-local-development.md](../../07-deployment-view/spring-local-development.md)): the organisation's IdP where one exists, otherwise Keycloak in every environment, recorded in an ADR. No self-issued tokens, no JJWT, no hand-written JWT filter. A product that must be the IdP uses Spring Authorization Server, recorded in an ADR.
- **SPRING-SEC-04: Stateless and token-based means CSRF off for that chain; a cookie-authenticated chain keeps CSRF on.** Never disable a protection to make a test or a demo pass.
- **SPRING-SEC-05: CORS is one `CorsConfigurationSource`** with explicit origins from configuration. No `*` together with credentials. A test sends a preflight from a foreign origin and asserts that no `Access-Control-Allow-Origin` comes back.

### Operations

- **SPRING-SEC-06: Secrets: see [SEC-INC-01](vulnerability-management.md) and [CFG-05](../configuration/configuration.md); nothing sensitive is logged (SPRING-LOG-08).** No direct dependency on `jjwt`, `nimbus-jose-jwt` or `spring-security-jwt`: the starter brings what is needed.
- **SPRING-SEC-07: Actuator is allow-listed:** `health,info`, plus `prometheus` only where the platform pulls metrics (SPRING-LIB-10), in which case SPRING-OBS-02 also permits it by name. Probes are served on the main port at `/livez` and `/readyz` (SPRING-OBS-01, OBS-19); everything else stays on the management port ([observability/spring.md](../observability/spring.md)). No application endpoint shares a path with a probe or health path (CVE-2026-59378: with Jersey and the default actuator security, such a resource lost its authentication; fixed in Boot 4.1.3 and 4.0.10). `env`, `configprops`, `heapdump`, `threaddump`, `loggers` and `shutdown` are never exposed publicly.

### Browser login (default SPRING-D6)

- **SPRING-SEC-08: Browser applications authenticate through a backend-for-frontend (BFF)** that performs the OIDC login, keeps the tokens server-side and gives the browser a session cookie (CSRF protection on). The browser holds no access token. The API behind it stays a plain resource server (SPRING-SEC-03).
- **SPRING-SEC-09: Whether the BFF is its own component** (`backend-bff/`, REPO-LAY-03) **or an additional filter chain** (`spring-boot-starter-security-oauth2-client`) in the backend is decided per project in an ADR. The BFF holds no business logic (ARCH-ADP). With a Next.js frontend, the Next.js app is the BFF (NODE-BFF-*) and the Spring backend stays a plain resource server.

- **SPRING-SEC-41: Users the product administers are provisioned in the IdP through an outgoing port**, never by a second user store with passwords: invitation (create the user, send the IdP's set-password action), deactivation (disable the user and end their sessions, SPRING-SEC-40), and language or name sync are calls of a `@HttpClientAdapter` in `adapter.out.http` to the IdP's admin API (Keycloak: a confidential service-account client with only the `manage-users`/`view-users` roles and the `kc-admin-api` client scope, realm template of SPRING-DEV-12). The product keeps its own user row (id, IdP subject, roles it assigns, language) and links it to the IdP subject; timeouts and retries follow SPRING-RES-01, and a failed provisioning call leaves no half-created user (create in the IdP first, or compensate).
  *Why:* every product with admin-managed users needs this, and a hand-rolled password store bypasses the IdP's password policy, lockout and MFA.
- **SPRING-SEC-44: A product account is linked to an IdP subject only on a verified e-mail address and only while it is not linked yet.** The first login of an invited person may find the product row by e-mail when the IdP subject is unknown; the link happens only when the ID token or user info carries `email_verified: true` and the row has no IdP subject, otherwise the login gets the "no access" answer and a security event (SPRING-SEC-22). An invitation that hits an existing IdP account (409 on create) adopts it only when no product row is linked to that subject yet; a duplicate subject is a domain conflict, never a 500. A retried invitation for a pending person either applies the submitted data or answers 409 ("invitation pending"), never 201 with the old data. The IdP client allows exact redirect and post-logout redirect URIs (`{origin}/login/oauth2/code/<registration>`, `{origin}/`), no wildcards, also in the committed development realm. Tests: linking without `email_verified`, and linking a row that already has a subject, are refused.
  *Why:* linking by e-mail trusts whoever first logs in with that address; as soon as the realm allows self-registration, brokering or e-mail changes, that is an account takeover of the invited person and their roles. Wildcard redirect URIs widen any open redirect into token or logout abuse (RFC 9700 §4.1).

The cookie, CSRF and session details of the BFF are SPRING-SEC-24/25 and SPRING-SEC-32/33 ([spring-hardening.md](spring-hardening.md)); the Angular side is NG-SEC-07/08 ([angular.md](angular.md)); the BFF sets the CSP (NG-SEC-06).

> **Not yet written:** a project ADR template for the BFF decision.

### Tests

- **SPRING-SEC-10: Every endpoint has security tests** for 401 (no token), 403 (insufficient permission) and the success case, with the `jwt()` request post-processor from the `*-security-test` starters. A new unauthenticated endpoint needs a stated reason in the pull request.
- **SPRING-SEC-11: Authorization rules are unit-tested on `Caller`** without a Spring context (use-case tests, London style for the ports, TEST-TDD).

### Proxies

- **SPRING-SEC-12: The forwarded-header strategy is set explicitly per deployment**, never left to the default: on Boot 4.1 `server.forward-headers-strategy` (`native` behind a trusted reverse proxy or load balancer, `none` when nothing sits in front). The proxy strips client-supplied `Forwarded`/`X-Forwarded-*` headers before setting its own. Boot 4.2 deprecates that property for `server.request.header.forwarded.strategy` (values `web-server`, formerly `native`, `framework`, `none`; setting both properties fails the start-up), reads only `X-Forwarded-*` by default (RFC 7239 `Forwarded` needs `server.request.header.forwarded.naming=rfc-7239`, which Tomcat does not support), and ignores `X-Forwarded-Prefix` unless `server.request.header.forwarded.use-prefix=true`. Switch the property name in the same change as the Boot upgrade.
  *Why:* scheme, host and client address from forwarded headers drive redirects, generated links, cookie `Secure` flags and audit logs; trusting them from the client is a spoofing hole, ignoring them behind a proxy breaks the BFF login redirects.

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Security".*
