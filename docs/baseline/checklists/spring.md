# Agent checklists: spring

The agent checklists of the spring docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Spring Boot: Libraries

[04-solution-strategy/spring-libraries.md](../04-solution-strategy/spring-libraries.md)

- [ ] Starter and artifact names are the Boot 4 ones; no explicit version for a managed dependency?
- [ ] No Lombok, Jackson 2 imports, `@MockBean`, H2?
- [ ] Spring Data types stay in the JPA adapter; Spring and framework annotations stay out of `domain`/`ports`?
- [ ] New outbound REST call: generated from a spec if one exists?
- [ ] Resilience4j only for a circuit breaker (SPRING-LIB-07)?
- [ ] Image build: Buildpacks, or the platform-dictated method recorded in chapter 7 (SPRING-LIB-13)?
- [ ] Outgoing HTTP adapter: `spring-boot-starter-restclient` present, client built from the injected `RestClient.Builder` (SPRING-LIB-06)?
- [ ] A library that fails after being added checked against the versions Boot's BOM overrides; pins narrow and commented (SPRING-LIB-01)?

## Spring Boot: Hexagonal Architecture

[05-building-block-view/spring.md](../05-building-block-view/spring.md)

- [ ] New class in the right package from the table? New use case from the generator (SPRING-ARCH-19)?
- [ ] No JPA entity used as domain model (SPRING-ARCH-10); invalid input throws the domain validation exception, mapped in REST and Kafka (SPRING-ARCH-18)?
- [ ] Stereotype annotation instead of plain `@Component`; class package-private?
- [ ] `@Transactional` only on application services, and not around a remote call (SPRING-ARCH-07)?
- [ ] Business exceptions extend the category base types, mapped in REST and Kafka (ARCH-UC-13, SPRING-ARCH-18)?
- [ ] No JPA/Kafka/AWS/Jackson types in `domain` or `ports`, and only allowed framework types in `application`?
- [ ] Test type per [08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md); DB tests use Testcontainers?
- [ ] `ArchitectureTest` green and unchanged (or the change discussed)?
- [ ] Outgoing HTTP client marked `@HttpClientAdapter` in `adapter.out.http`, SMTP `@MailAdapter` in `adapter.out.mail`, file writers `@FileAdapter` in `adapter.out.file`; `allowEmptyShould` of a template rule removed once its first class exists (SPRING-ARCH-04, ARCH-ENF-02)?
- [ ] Demo data loaded by an `adapter.in.demo` runner under the `demo` profile that calls use cases, never by seed SQL; no deployed config sets the profile (SPRING-ARCH-20)?
- [ ] Table without aggregate invariants: `JdbcClient` adapter in `adapter.out.jdbc` is fine; aggregates stay JPA with two-way mapping (SPRING-ARCH-10)?

## Spring Boot: Delivery

[07-deployment-view/spring-delivery.md](../07-deployment-view/spring-delivery.md)

- [ ] Flyway configured with its own user, `lock_timeout` and an explicit `lock-retry-count`; application datasource is DML-only, in a delivered Compose installation too; credentials from the config tree (SPRING-REL-01)?
- [ ] Test `app-role` placeholder set by the shared Testcontainers configuration, no `application-test.yaml` (SPRING-REL-03, SPRING-CFG-05)?
- [ ] New schema object covered by the schema grant and default privileges, or granted explicitly?
- [ ] `CREATE INDEX CONCURRENTLY` in use: transactional lock off, Flyway connects directly?
- [ ] Pre-deploy migration: same image, migrate-only runner, instances validate only and hold no DDL credentials (SPRING-REL-07)?
- [ ] No version passed to the deployable's build; release version set by the deployment (SPRING-REL-06)?
- [ ] BFF: bundle embedded through the profile, served from `classpath:/frontend/` per REL-FE-03 (SPRING-REL-08)?
- [ ] SPA serving: one resource handler per pattern with its own location, `index.html` written after `HeaderWriterFilter`, IT asserts the headers on the document (SPRING-REL-09)?

## Spring Boot: Local Development

[07-deployment-view/spring-local-development.md](../07-deployment-view/spring-local-development.md)

- [ ] New infrastructure dependency added to `compose.yaml` (core: no profile; extra: profile) with pinned image?
- [ ] Production and local PostgreSQL major version equal?
- [ ] No connection settings or secrets added to the repository for local use?
- [ ] No new start-up script?
- [ ] Keycloak issuer `http://keycloak.localhost:8180` everywhere, health check and realm template in place, admin client with `kc-admin-api` (SPRING-DEV-11/12)? `compose.app.yaml` waits for healthy start-up dependencies (SPRING-DEV-10)?
- [ ] A service the app cannot work without (Keycloak for login, Mailpit for mail) starts without a Compose profile (SPRING-DEV-03)?

## Spring Boot: Producing the OpenAPI Contract (code-first)

[08-crosscutting-concepts/api/spring-openapi.md](../08-crosscutting-concepts/api/spring-openapi.md)

- [ ] New/changed endpoint: `operationId`, unique schema names, `@NotNull` on required fields, problem+json errors, examples?
- [ ] Spec regenerated (`./mvnw verify -Dopenapi.update=true`) and committed in the same change?
- [ ] Local date-times and times published with a pattern, not `format: date-time` (SPRING-API-12)?
- [ ] Breaking change? New version or explicit decision?
- [ ] N+1 check done for read endpoints?
- [ ] `servers` fixed to `/`, `ProblemDetail` schema declared, resolved parameters such as `Caller` hidden from the spec (SPRING-API-13/14)?
- [ ] Binary download declared with its media type and a `string`/`binary` schema; two request media types are one operation with two `@Content` entries (SPRING-API-15)?
- [ ] No two `*Request`/`*Response` types share a simple name (`restRecordNamesAreUnique`, SPRING-API-02)?

## Spring Boot: REST and JSON Conventions

[08-crosscutting-concepts/api/spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md)

- [ ] New endpoint follows URL, status and error conventions; `operationId` set?
- [ ] DTOs are package-private records with unique names; no entity or domain type in the body?
- [ ] Decimals as `ApiDecimal`, instants as `Instant`, enums as strings (SPRING-REST-04..06)?
- [ ] Date, month and enum parameters bound as `LocalDate`/`YearMonth`/enum, checked against the window by the shared helper (SPRING-REST-15, API-REST-16)?
- [ ] Collection paged or bounded in the query, sort and filters allow-listed; update carries a version (SPRING-REST-11/12)?
- [ ] Error cases documented as problem+json and tested; 401/403 from the filter chain are problem+json with a code (SPRING-REST-14)?
- [ ] Absent optional fields omitted, asserted in the slice test; security entry point and handler use the Boot `JsonMapper` bean (SPRING-REST-08/14)?
- [ ] `PUT`/`PATCH` answers 200 with the resource or its new version, never a bare 204 (`updatesAnswerWithTheResource`, SPRING-REST-12)?
- [ ] State transition of a singleton modelled as an action sub-resource (SPRING-REST-02)?

## Spring Boot: Configuration

[08-crosscutting-concepts/configuration/spring.md](../08-crosscutting-concepts/configuration/spring.md)

- [ ] New setting: record with `@ConfigurationProperties("app.…")`, `@Validated`, constraints, `@Valid` on nested (SPRING-CFG-01/04)?
- [ ] Record next to its adapter, enabled on that adapter's `@Configuration`; no `@Value` (SPRING-CFG-02/03)?
- [ ] No new `application-<env>.yaml`; local values only in `application-local.yaml` (SPRING-CFG-05)?
- [ ] Secret read from the config tree, typed `Secret` (SPRING-CFG-07/11, CFG-07)?
- [ ] New `app.*` key in `configuration-keys.yaml` (CFG-12, TEST-CFG-04)?
- [ ] `ApplicationContextRunner` test for valid, invalid and missing values?

## Spring Boot: Data Protection

[08-crosscutting-concepts/data-protection/spring.md](../08-crosscutting-concepts/data-protection/spring.md)

- [ ] Retention job only calls a use case; `Clock` injected; cluster lock; batched delete?
- [ ] New child table: `ON DELETE CASCADE` or listed as retained?
- [ ] Envers, history, outbox, inbox, idempotency and dead-letter stores covered by erasure and retention?
- [ ] Event payloads with personal data justified; topic retention or tombstone documented?
- [ ] Deletion `*IT` per table; log-absence test for personal data?

## Spring: Internationalization

[08-crosscutting-concepts/i18n/spring.md](../08-crosscutting-concepts/i18n/spring.md)

- [ ] No `Locale`, `MessageSource` or `LocaleContextHolder` outside `adapter.*` (SPRING-I18N-04)?
- [ ] New business error: code in the enum and the OpenAPI spec, `error.<code>.*` in every bundle (SPRING-I18N-02/07)?
- [ ] Outgoing mail or document uses the recipient's stored language (SPRING-I18N-05)?
- [ ] Contract test per locale and bundle parity test updated (TEST-I18N-05/06)?
- [ ] User-visible sorting with collation: id page through `JdbcClient` with `collate`, then one `findAllById`, statement count asserted (SPRING-I18N-08)?
- [ ] Mail subject is a bundle message with the same arguments as the body (SPRING-I18N-05)?

## Spring Boot: Logging

[08-crosscutting-concepts/logging/spring.md](../08-crosscutting-concepts/logging/spring.md)

- [ ] SLF4J logger, parameterized message, no Lombok, no `System.out`?
- [ ] No logging in `domain`/`ports`; exception logged once?
- [ ] No sensitive or personal data beyond pseudonymous ids in the message or key-values; absence tested where personal data is handled (SPRING-LOG-09)?
- [ ] New log level or format change done through configuration?

## Spring Boot: Messaging with Kafka

[08-crosscutting-concepts/messaging/spring.md](../08-crosscutting-concepts/messaging/spring.md)

- [ ] Listener in `adapter.in.kafka`, dispatches on `type` and skips unknown types, maps and calls one port; no catch-log, no manual ack (SPRING-MSG-01/02/09)?
- [ ] Producer settings `acks=all`, idempotence, `linger.ms`, `request.timeout.ms` and `delivery.timeout.ms` together; consumer `read-committed`, no auto-commit (SPRING-MSG-03)?
- [ ] Jackson 3 via Boot's `JsonMapper`; type from the envelope; no deprecated `JsonSerializer`/`JsonDeserializer`; no type headers (SPRING-MSG-04)?
- [ ] Error handler: bounded exponential backoff with jitter, validation and JSON exceptions not retryable, consumer-owned DLT name, dead-letter counter (SPRING-MSG-05/06)?
- [ ] Event tied to a DB change goes through the outbox; relay parks non-retryable rows, exposes age and count, restores the trace context; consumer deduplicates through the inbox or is naturally idempotent (SPRING-MSG-07/08)?
- [ ] AsyncAPI regenerated and committed; examples updated (SPRING-MSG-11, MSG-CON)?
- [ ] `*IT` with Kafka container covering success, unknown type, validation → DLT, transient retry; relay parking and trace id (SPRING-MSG-12)?
- [ ] Mail or other after-commit side effect without a broker: outbox row in the use case's transaction plus a ShedLock sender in the adapter, no direct send after commit (SPRING-MSG-13)?
- [ ] Rendering inside the per-row `try`; a non-transient failure parks the row; test with an unrenderable mail ahead of a good one (SPRING-MSG-13)?

## Spring Boot: Observability and Operability

[08-crosscutting-concepts/observability/spring.md](../08-crosscutting-concepts/observability/spring.md)

- [ ] Probes on the server port (`/livez`, `/readyz`), not routed by the ingress; actuator on the management port, `health,info` only, dedicated chain whose `permitAll` lines match the exposure list and `denyAll` for the rest (SPRING-OBS-01/02)?
- [ ] Nothing added to liveness; readiness additions have a reason (SPRING-OBS-03)?
- [ ] `server.shutdown` not set to `immediate`; sum of shutdown phases plus pre-stop delay fits the platform grace period (SPRING-OBS-04)?
- [ ] New Kafka listener: observation on, poll batch fits the shutdown phase (SPRING-OBS-05/09)?
- [ ] New business metric: outgoing port, adapter with `MeterRegistry`, closed-set tags, cardinality test (SPRING-OBS-06/11)?
- [ ] New HTTP client built from the injected builder (SPRING-OBS-09)?
- [ ] OTLP metric, trace and log export off by default, enabled per environment with its endpoint; keys in `configuration-keys.yaml` (SPRING-OBS-08)?
- [ ] Incoming `traceparent`/`tracestate`/`baggage` removed at the ingress, or by a BFF filter before the observation filter when nothing is in front (SPRING-OBS-10)?

## Spring Boot: Persistence with PostgreSQL

[08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md)

- [ ] New or changed table: migration file added, previous release still works (expand/contract)?
- [ ] No entity in a port, no lazy loading outside the adapter?
- [ ] Types follow SPRING-DB-08; constraints in the migration?
- [ ] JPA only where whole aggregates are loaded and changed; `JdbcClient` for reads, reports and bulk work (SPRING-DB-15)?
- [ ] Collection query paged or limited in the query itself; statement count asserted (SPRING-DB-12)?
- [ ] Migration touches a large table: lock behaviour considered, `lock_timeout` set (SPRING-DB-06, SPRING-REL-02)?
- [ ] Rule across rows enforced by a constraint, conditional write or shared lock, with a concurrency IT (SPRING-DB-16)?
- [ ] New query: index for its filter and sort columns named in the PR; foreign keys indexed (SPRING-DB-17)?
- [ ] Constraint violations mapped by constraint name, cause kept (SPRING-DB-18)?
- [ ] Privilege tests on append-only tables run as the non-superuser DML role (SPRING-DB-19)?
- [ ] Version travels in the domain record; adapter rejects a stale version; a use case that writes one aggregate twice reloads in between (SPRING-DB-10)?
- [ ] Rare change against many commands with no row to lock: shared advisory lock in the commands, exclusive in the change, both orders tested (SPRING-DB-16)?
- [ ] Pre-check for the clean error plus the constraint as race guard, both ending in the same code (SPRING-DB-16)?
- [ ] Constraint name read through Hibernate, driver runtime-only; SQLState mapping only where one constraint can fail, documented (SPRING-DB-18)?
- [ ] Optional filters appended as fragments, no `(:p IS NULL OR col = :p)`; append-only listings paged by keyset without a per-page `count(*)` (SPRING-DB-21)?
- [ ] Count-of-rows rule ("at least one admin") locked before counting (SPRING-DB-22)? Upsert only where overwriting is intended, audit with the stored id and old values (SPRING-DB-23)?
- [ ] After a violation no further statement in the aborted transaction; mapping IT runs inside a transaction (SPRING-DB-18)?

## Spring Boot: Resilience and Idempotency

[08-crosscutting-concepts/resilience/spring.md](../08-crosscutting-concepts/resilience/spring.md)

- [ ] New client: built from the injected builder, connect and read timeouts in configuration, values on the timeout ladder; WireMock delay test (SPRING-RES-01/02)?
- [ ] OIDC login or resource server: JWKS, token and userinfo clients declared with explicit timeouts, not left to Spring Security's defaults (SPRING-RES-01)?
- [ ] Remote call outside the transaction, database part in a `TransactionTemplate`; `app.resilience.transaction-guard` is `fail` in tests (SPRING-RES-03/04)?
- [ ] `maximum-pool-size` and `connection-timeout` (milliseconds) set; pool timeout maps to 503 (SPRING-RES-05)?
- [ ] `@Retryable` with explicit `includes`, backoff, jitter and `timeout`, on an adapter, not in a Kafka-driven flow (SPRING-RES-08/09)?
- [ ] `@ConcurrencyLimit` with an explicit limit and `policy = REJECT` for each remote dependency; rejection mapped to 503 or the port's error (SPRING-RES-06)?
- [ ] Retryable `POST`: `Idempotency-Key` in the command, stored first in the transaction with `on conflict do nothing`, documented in the spec (SPRING-RES-10/11)?
- [ ] `@Scheduled` in `adapter.in.scheduling`, with `@SchedulerLock` or `SKIP LOCKED` (SPRING-RES-12)?
- [ ] `@Cacheable` only in adapters, bounded, TTL set, caller in the key where needed (SPRING-RES-14)?

## Spring Boot: Hardening

[08-crosscutting-concepts/security/spring-hardening.md](../08-crosscutting-concepts/security/spring-hardening.md)

- [ ] New chain or header change: header table of SPRING-SEC-13 kept, nothing disabled, CSP reports reach the endpoint (exempt from CSRF)?
- [ ] New endpoint that takes an id: owner/tenant check, 404 for foreign objects, `cross-user` tagged test (SPRING-SEC-16, SPRING-SEC-35/36)?
- [ ] New request record: no owner, tenant, role, permission or group fields, synonyms included (SPRING-SEC-34); size and length limits; JSON body size limited at the proxy and by the filter (SPRING-SEC-15)?
- [ ] Numbers parsed from uploads or other untrusted text bounded in length, precision and exponent before `BigDecimal` conversion, with the huge-exponent test (SPRING-SEC-43)?
- [ ] New query: bind parameters only, sort and identifiers from an allow-list, no process execution with user input (SPRING-SEC-31)?
- [ ] New outbound call to a variable URL: allow-list and address filter (SPRING-SEC-19)?
- [ ] No exception text, stack trace or SQL in a response (SPRING-SEC-18)?
- [ ] New polymorphic JSON or Kafka payload: closed types (SPRING-SEC-20)?
- [ ] Security-relevant action: audit event and test (SPRING-SEC-22)?
- [ ] BFF session change: lifetimes, rotation, logout at the IdP and their tests, idle timeout published in `/config.json` (SPRING-SEC-32/33)? Logout answers `200 {redirectUri}` to a JSON request and `303` otherwise, both tested (SPRING-SEC-33)? Session attributes serialized as JSON, or logout-all on upgrade recorded in the release steps (SPRING-SEC-42)? Sessions in Spring Session JDBC (SPRING-SEC-37)? Confidential client with PKCE (SPRING-SEC-38)?
- [ ] New unauthenticated endpoint that allocates state, or new export: rate limit listed in chapter 7 (SPRING-SEC-21)?
- [ ] New upload: name, scan, archive limits, download authorization, separate origin for active content (SPRING-SEC-26)?
- [ ] New dependency: reviewed (JAVA-TOOL-05)?
- [ ] Back-channel logout ends exactly the sessions of the token's `sid` through the `idp_sessions` mapping (SPRING-SEC-40)? Admin-assigned role fields listed in `ADMIN_ASSIGNED_FIELDS` with a reason, never renamed to dodge the rule (SPRING-SEC-34)?
- [ ] Archive limits as ratio or counted caps per entry and in total; hostile files built in memory plus one real-writer fixture per format (SPRING-SEC-26)?
- [ ] Cross-user test tagged on the method that calls the use case (SPRING-SEC-16)?
- [ ] Long-open page keeps its work state on the server instead of a longer idle timeout (SPRING-SEC-32)?

## Spring Boot: Security

[08-crosscutting-concepts/security/spring.md](../08-crosscutting-concepts/security/spring.md)

- [ ] Security config only in `adapter.in.rest`; deny-by-default ends the rule list?
- [ ] No Spring Security types in `domain`/`ports`; `Caller` carried in the command, a `domain` record, never null (SPRING-SEC-39)?
- [ ] No hand-rolled token handling, no secrets in the repo, nothing sensitive logged?
- [ ] 401/403/success tests for each new endpoint?
- [ ] Actuator exposure unchanged (allow-list), every exposed endpoint permitted by name?
- [ ] New deployment target: forward-headers strategy set explicitly (SPRING-SEC-12)?
- [ ] Hardening checklist ([spring-hardening.md](../08-crosscutting-concepts/security/spring-hardening.md)) answered for headers, limits, injection, object-level access, sessions, errors?
- [ ] Resource-server chain present once a non-browser client exists; IdP named in an ADR (Keycloak when the organisation has none) (SPRING-SEC-03)?
- [ ] Admin-managed users provisioned through an outgoing port to the IdP admin API, no own password store (SPRING-SEC-41)?
- [ ] Account linking only with `email_verified` and to an unlinked row; existing IdP account adopted only when unlinked; retried invitation applies the data or answers 409; exact redirect and post-logout URIs (SPRING-SEC-44)?

## Spring Boot: Testing

[08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md)

- [ ] Test type per element from the element table, setup from the table above; no Spring context for domain and use cases?
- [ ] Boot 4 imports and `*-test` starters; `@MockitoBean`; Testcontainers 2 names?
- [ ] Persistence test against real PostgreSQL with migrations; statement count asserted for query ports?
- [ ] No `@DirtiesContext`, no `Thread.sleep`, no H2?
- [ ] Test that starts a container or `@SpringBootTest` named `*IT` (SPRING-TEST-07)?
- [ ] New controller named in a `@WebMvcTest(controllers = …)` (or `<Controller>Test`), enforced by the architecture test (SPRING-TEST-12)?
- [ ] Scheduling off in ITs, jobs called through their port, one shared database reset (SPRING-TEST-13)?
- [ ] `./mvnw verify` green (unit and integration tests)?
- [ ] Use case tests use the shared `support` fakes (`InMemoryRepository`, `People`, `Transactions`) instead of new ad-hoc helpers (SPRING-TEST-14)?
- [ ] Test fakes extend `InMemoryRepository<K, T, S>` with themselves as `S` (SPRING-TEST-14)?
