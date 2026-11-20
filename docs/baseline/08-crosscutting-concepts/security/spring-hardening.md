# Spring Boot: Hardening

Hardening for Spring Boot services on top of authentication and authorization ([spring.md](spring.md), `SPRING-SEC-01..12`). Numbering continues there. Shared process rules: [security-requirements.md](security-requirements.md), [secure-pipeline.md](secure-pipeline.md), [vulnerability-management.md](vulnerability-management.md). Framework know-how comes from the `spring-security` skill; where it disagrees with this doc, this doc wins (for example its default CSP `default-src 'self'` is wrong for a JSON API).

## Transport and headers

- **SPRING-SEC-13: Every filter chain sets explicit response headers; never `headers().disable()`.**

  | Header | API chain | Chain that serves the SPA (BFF, SPRING-SEC-08) |
  |---|---|---|
  | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (Spring's default; `preload` only by decision of the domain owner) | same |
  | `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | the nonce-based policy of NG-SEC-05; nonce delivery and `index.html` caching: NG-SEC-06 |
  | `X-Content-Type-Options` | `nosniff` | `nosniff` |
  | `Referrer-Policy` | `no-referrer` | `no-referrer` |
  | `Cache-Control` | `no-store` on authenticated responses | `no-store` on `index.html`; hashed assets cacheable |
  | `Permissions-Policy` | not needed | deny every feature the app does not use, for example `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
  | `Cross-Origin-Opener-Policy` | not needed | `same-origin` |
  | `Cross-Origin-Resource-Policy` | `same-origin` | `same-origin` |

  The SPA chain also names a CSP report destination: a `Reporting-Endpoints` header plus `report-to` and, as fallback, `report-uri`, pointing at a BFF endpoint (for example `POST /csp-reports`). That endpoint is a public path, limited in body size and rate, and logs each report scrubbed (directive, blocked origin, document path without query string) as a metric and a log line, so the report-only phase of NG-SEC-05 can be judged clean.
  *Why:* Spring Security adds cache-control, content-type options and HSTS (HTTPS only) by default, but not CSP, Referrer-Policy, Permissions-Policy or the cross-origin policies.
- **SPRING-SEC-14: TLS everywhere outside the developer machine, with the versions of SEC-CRY-01.** TLS ends at a managed proxy or in the service; plain HTTP is never reachable from outside. Connections to the database and to Kafka use TLS in every non-local environment. Forwarded headers: SPRING-SEC-12.

## Input

- **SPRING-SEC-15: Request limits are configured, not defaulted:** header size (`server.max-http-request-header-size`), multipart limits (`spring.servlet.multipart.*`), form posts (`server.tomcat.max-http-form-post-size`), a **body-size limit for JSON**, Jackson read constraints, and length/size constraints on every string and collection in a request DTO (Bean Validation, SPRING-API-04). Boot and Tomcat have no general limit for request bodies; the form-post and multipart limits do not apply to `application/json`. So the body size is limited at the reverse proxy or gateway (for example nginx `client_max_body_size`) and, in the service, by a servlet filter in `adapter.in.rest` that answers 413 when `Content-Length` exceeds the limit or the stream reads past it. Jackson's `StreamReadConstraints` (nesting depth, document, string and number length) are set through `spring.jackson.factory.constraints.read.*` on Boot 4.1 (for example `max-nesting-depth`; check the other names in the property reference) or a customizer.
  *Why:* unbounded input is a resource-exhaustion hole (ASVS V2, Top 10 A10).
- **SPRING-SEC-31: Queries and commands receive user-influenced values only as bind parameters.** SQL, JPQL, HQL and native queries are never built by concatenating or formatting values: `JdbcClient` with `.param(...)`, named parameters in `@Query`, the Criteria API. Identifiers that cannot be bound (the column of an `ORDER BY`, the sort direction, a table name) come from an allow-list in the adapter that maps API values to fixed SQL fragments; a Spring Data `Sort` built from a request is checked against the same allow-list. `LIKE` patterns escape `%` and `_`. No process execution (`ProcessBuilder`, `Runtime.exec`) with user-influenced input; where a process is unavoidable, it is a fixed command started with an argument list (no shell), its arguments checked against an allow-list, in one named adapter. The same holds for LDAP filters, XPath and template engines.
  *Why:* `JdbcClient` and native SQL are promoted (SPRING-DB-13), so string-built queries are one keystroke away (Top 10:2025 A05, ASVS V1). SAST reports the patterns (FindSecBugs `SQL_INJECTION_*`, `COMMAND_INJECTION`; Semgrep), the template's architecture test forbids process execution.

## Authorization and tokens

- **SPRING-SEC-16: Objects are authorized by owner or tenant inside the use case, and a test proves that user A cannot read or change user B's resource.** Missing object-level checks are the most common API flaw (BOLA/IDOR, ASVS V8, A01). Every use case that takes an id from the caller has such a test, tagged `@Tag("cross-user")`. The architecture test template fails when a use-case service is not referenced by a tagged test and is not listed there as taking no caller-supplied id.
- **SPRING-SEC-17: The JWT decoder validates `iss`, `aud` and `exp`, and the allowed algorithms are explicit** (SPRING-SEC-03 sets `issuer-uri`; add the audience validator). Token validation failures are logged as security events (SPRING-SEC-22). A test signs tokens with a test key and asserts 401 for a wrong `aud`, a wrong `iss`, an expired token, `alg=none` and an algorithm outside the list.
- **SPRING-SEC-34: Request records carry only what the caller may set.** Owner, tenant, role and permission fields, ids of new aggregates and audit fields (`createdBy`, `createdAt`) are never fields of a request record; they come from the `Caller`, the use case or the server. Status changes are explicit commands (`CancelOrder`), not a writable `status` field. Request records map to commands field by field; request JSON is never bound onto entities or domain objects ([mapping-between-boundaries.md](../mapping/mapping-between-boundaries.md)). The architecture test template forbids the usual field names (`ownerId`, `tenantId`, `role`, `roles`, `permissions`, `createdBy`, `createdAt`) in `adapter.in.rest`.
  *Why:* mass assignment turns a profile update into a privilege escalation (ASVS V8, A01).
- **SPRING-SEC-35: A multi-tenant product takes the tenant only from the `Caller`** (a token claim mapped by the REST adapter), never from a path, query parameter or body. Every query port for tenant-owned data takes the tenant, and every adapter query filters by it, or the database enforces it with row-level security set per transaction. Cache keys and outgoing calls include the tenant. Each use case that takes an id has a cross-tenant test, tagged like the cross-user test (SPRING-SEC-16). Whether the product is multi-tenant and how tenants are isolated (column, schema, database) is an ADR.
- **SPRING-SEC-36: An object the caller may not see answers 404, as if it did not exist; 403 only when the caller may know the object but lacks the permission for this action** (may read an order, may not cancel it). The use case reports missing and foreign objects the same way, so the response body cannot tell them apart. The cross-user test asserts the status.
  *Why:* a 403 for a foreign id confirms that the id exists and makes enumeration cheap.

## Errors and data handling

- **SPRING-SEC-18: Responses never contain stack traces, SQL, class names or exception messages.** `server.error.include-*` stay `never`; unknown errors become a generic `ProblemDetail` with the correlation id as the extension member `traceId` (SPRING-OBS-10; extends SPRING-REST-07); the handler fails closed (deny on error).
- **SPRING-SEC-19: Outbound HTTP to a destination that users or data influence is restricted:** an allow-list of hosts, no redirects to other hosts, and Boot's `InetAddressFilter` (Boot 4.1+, `org.springframework.boot.http.client`; for example `InetAddressFilter.externalAddresses()`), either as a bean, which Boot applies to every auto-configured client builder, or per client through `HttpClientSettings.withInetAddressFilter(...)`. Nothing is filtered without it, and clients built outside Boot's builders do not get it. With a proxy that resolves hosts the filter does not apply; restrict at the proxy.
- **SPRING-SEC-20: No Jackson default typing and no open polymorphism;** polymorphic types are closed (`@JsonSubTypes` or sealed types). Kafka listeners deserialize into the explicit target type of the listener parameter, without type headers, so no trusted-packages list is involved (SPRING-MSG-04).

## Abuse protection

- **SPRING-SEC-21: Abuse protection by rate limiting returns 429 and sits at the gateway or reverse proxy by default.** Bucket4j in the service only for business limits (password-reset or invitation requests per account, exports, expensive searches); login throttling belongs to the IdP. Redis only when counters must be shared across instances. Client identity is never taken from an unvalidated `X-Forwarded-For`.

## Audit logging

- **SPRING-SEC-22: Security events are logged as structured audit events:** login, logout, denied access, token validation failure, permission change, administrative action, key destruction (SEC-CRY-04). Each carries the pseudonymous user id and the correlation id and no other personal or sensitive data (SPRING-LOG-08), and at least one test asserts each event type (SPRING-LOG-09). Storage, retention and alerting: SEC-AUD-01..03 ([vulnerability-management.md](vulnerability-management.md)).

## Configuration and operations

- **SPRING-SEC-23: Deployed environments (no `local` profile, CFG-04) have no debug flags, no devtools, no H2 console, no Compose dependency (SPRING-DEV-02), and no OpenAPI UI unless it is protected.** A check of the release build fails when the packaged application contains `spring-boot-devtools`, `h2` or `spring-boot-docker-compose`, and a test with the deployed profile asserts that `/h2-console` answers 404 and the OpenAPI UI 404 or 401.

## Browser sessions (BFF, SPRING-SEC-08/09)

- **SPRING-SEC-24: The BFF session cookie is `HttpOnly; Secure; SameSite=Lax`** (Strict where the flows allow), prefixed `__Host-` where possible. Lifetimes and logout: SPRING-SEC-32/33.
- **SPRING-SEC-25: CSRF protection for the SPA uses `csrf.spa()` or an equivalent handler:** cookie `XSRF-TOKEN` readable by the SPA, header `X-XSRF-TOKEN` on unsafe requests, session cookie HttpOnly. The Angular side is NG-SEC-07.
- **SPRING-SEC-32: BFF sessions have explicit lifetimes, and the tokens stay server-side.** Defaults: idle timeout 30 minutes, absolute lifetime 12 hours, and never longer than the IdP session; a product sets other values in configuration with the reason in `docs/security/requirements.md`. The idle timeout is the session store's timeout; the absolute lifetime is checked against the session's creation time, because the session store has only an idle timeout. The session id is rotated on login (session-fixation protection stays on). The BFF refreshes access tokens shortly before expiry; refresh tokens live only in the server-side session store (encrypted at rest when the store is shared, SEC-CRY-03), are replaced when the IdP rotates them, and end with the session. A failed refresh ends the session (401 to the SPA, NG-SEC-08). Tests: a session id from before login is rejected after login, and a session past its idle or absolute limit is rejected (fixed `Clock` or short test timeouts).
- **SPRING-SEC-33: Logout ends the session in the BFF and at the IdP.** `POST /logout` (CSRF-protected) invalidates the server session, deletes the session cookie, revokes the refresh token where the IdP supports revocation (RFC 7009), and redirects to the IdP's end-session endpoint (OIDC RP-Initiated Logout; Spring Security `OidcClientInitiatedLogoutSuccessHandler`). The BFF accepts OIDC Back-Channel Logout (Spring Security `oidcLogout().backChannel(...)`), so a logout or account lock at the IdP ends the user's BFF sessions; the session store can find sessions by the IdP's `sid`. Tests assert that the old session id is rejected after logout and after a back-channel logout token for its `sid`.

## Uploads

- **SPRING-SEC-26: Uploads are limited and stored, scanned and served so that a file cannot attack the server or other users:**
  - limited by size and count (SPRING-SEC-15) and by type, detected from the content, not from the extension or the client's `Content-Type`;
  - stored under a server-generated name outside the web root or in object storage; the client's file name is kept only as escaped metadata;
  - scanned for malware by a capability the product names (a scanning service, or the storage platform's scanning) before anyone else can download the file; until then it is quarantined;
  - archives are not unpacked, or only with limits on entry count, total uncompressed size and compression ratio, and with entry paths checked (no `..`, no absolute paths, no links);
  - downloads are authorized per object like any other read (SPRING-SEC-16, SPRING-SEC-36);
  - served with `Content-Disposition: attachment` and a safe file name, `X-Content-Type-Options: nosniff` and the content type stored at upload; active content (HTML, SVG, PDF shown inline) is served only from a separate origin without the session cookie, or not inline at all.

## Database, Kafka and images

- **SPRING-SEC-27: The application's database role has DML rights only;** Flyway runs at start-up with a separate DDL role through `spring.flyway.user`, a `lock_timeout` and default privileges for the DML role (SPRING-REL-01..03, [07-deployment-view/spring-delivery.md](../../07-deployment-view/spring-delivery.md)); no superuser; TLS to the database; `scram-sha-256` authentication.
- **SPRING-SEC-28: Kafka in non-local environments uses TLS and SASL authentication, ACLs per service for topics and consumer groups, and no auto-created topics.**
- **SPRING-SEC-29: The image meets the image requirements as a security capability: OCI, runs as non-root, minimal base pinned by digest, no build tools, sources or secrets in any layer, an SBOM from the build (SEC-CI-03).** How it is built: SPRING-LIB-13 and [REL-IMG-01/02](../../07-deployment-view/container-runtime.md) (Buildpacks by default; a Dockerfile multi-stage build or Jib without an ADR when the customer platform dictates it, recorded in chapter 7). Deployments reference the image by digest. Scanning: SEC-CI-06 with a replaceable reference scanner, thresholds in the gate table of [secure-pipeline.md](secure-pipeline.md); findings handled per SEC-VUL-01/02.

## Cryptography

- **SPRING-SEC-30: Cryptography follows SEC-CRY-01..05 with platform libraries only:** JCA or Bouncy Castle, `SecureRandom`, and, if passwords ever exist, a `DelegatingPasswordEncoder` whose encoder for new hashes is Argon2id (`Argon2PasswordEncoder`, needs Bouncy Castle) so existing hashes keep working when the default changes. No custom crypto, no MD5 or SHA-1 for security purposes.

Items to confirm in the first project: [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Agent checklist

- [ ] New chain or header change: header table of SPRING-SEC-13 kept, nothing disabled, CSP reports reach the endpoint?
- [ ] New endpoint that takes an id: owner/tenant check, 404 for foreign objects, `cross-user` tagged test (SPRING-SEC-16, SPRING-SEC-35/36)?
- [ ] New request record: no owner, tenant, role or audit fields (SPRING-SEC-34); size and length limits; JSON body size limited at the proxy and by the filter (SPRING-SEC-15)?
- [ ] New query: bind parameters only, sort and identifiers from an allow-list, no process execution with user input (SPRING-SEC-31)?
- [ ] New outbound call to a variable URL: allow-list and address filter (SPRING-SEC-19)?
- [ ] No exception text, stack trace or SQL in a response (SPRING-SEC-18)?
- [ ] New polymorphic JSON or Kafka payload: closed types (SPRING-SEC-20)?
- [ ] Security-relevant action: audit event and test (SPRING-SEC-22)?
- [ ] BFF session change: lifetimes, rotation, logout at the IdP and their tests (SPRING-SEC-32/33)?
- [ ] New upload: name, scan, archive limits, download authorization, separate origin for active content (SPRING-SEC-26)?
- [ ] New dependency: reviewed (JAVA-TOOL-05)?

## Sources

OWASP ASVS 5.0 (V1, V2, V3, V4, V5, V7, V8, V9, V11, V12, V13, V15, V16), OWASP REST Security Cheat Sheet, OWASP Content Security Policy Cheat Sheet, OWASP SQL Injection Prevention, OS Command Injection Defense, Mass Assignment, File Upload and Session Management Cheat Sheets, Spring Security reference (headers, CSRF with SPAs, OIDC logout, password storage), Spring Boot reference (`InetAddressFilter`, HTTP client settings), OpenID Connect RP-Initiated Logout 1.0 and Back-Channel Logout 1.0, RFC 7009 (token revocation), W3C Reporting API, Jackson 3.0 migration notes, Spring Boot Maven plugin (build-image).
