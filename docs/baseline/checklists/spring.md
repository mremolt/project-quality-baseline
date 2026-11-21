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

## Spring Boot: Hexagonal Architecture

[05-building-block-view/spring.md](../05-building-block-view/spring.md)

- [ ] New class in the right package from the table?
- [ ] No JPA entity used as domain model (SPRING-ARCH-10); invalid input throws the domain validation exception, mapped in REST and Kafka (SPRING-ARCH-18)?
- [ ] Stereotype annotation instead of plain `@Component`; class package-private?
- [ ] `@Transactional` only on application services, and not around a remote call (SPRING-ARCH-07)?
- [ ] Business exceptions extend the category base types, mapped in REST and Kafka (ARCH-UC-13, SPRING-ARCH-18)?
- [ ] No JPA/Kafka/AWS/Jackson types in `domain` or `ports`, and only allowed framework types in `application`?
- [ ] Test type per [08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md); DB tests use Testcontainers?
- [ ] `ArchitectureTest` green and unchanged (or the change discussed)?

## Spring Boot: Delivery

[07-deployment-view/spring-delivery.md](../07-deployment-view/spring-delivery.md)

- [ ] Flyway configured with its own user, `lock_timeout` and an explicit `lock-retry-count`; application datasource is DML-only; credentials from the config tree?
- [ ] New schema object covered by the schema grant and default privileges, or granted explicitly?
- [ ] `CREATE INDEX CONCURRENTLY` in use: transactional lock off, Flyway connects directly?
- [ ] Pre-deploy migration: same image, migrate-only runner, instances validate only and hold no DDL credentials (SPRING-REL-07)?
- [ ] No version passed to the deployable's build; release version set by the deployment (SPRING-REL-06)?
- [ ] BFF: bundle embedded through the profile, served from `classpath:/frontend/` per REL-FE-03 (SPRING-REL-08)?

## Spring Boot: Local Development

[07-deployment-view/spring-local-development.md](../07-deployment-view/spring-local-development.md)

- [ ] New infrastructure dependency added to `compose.yaml` (core: no profile; extra: profile) with pinned image?
- [ ] Production and local PostgreSQL major version equal?
- [ ] No connection settings or secrets added to the repository for local use?
- [ ] No new start-up script?

## Spring Boot: Producing the OpenAPI Contract (code-first)

[08-crosscutting-concepts/api/spring-openapi.md](../08-crosscutting-concepts/api/spring-openapi.md)

- [ ] New/changed endpoint: `operationId`, unique schema names, `@NotNull` on required fields, problem+json errors, examples?
- [ ] Spec regenerated (`./mvnw verify -Dopenapi.update=true`) and committed in the same change?
- [ ] Local date-times and times published with a pattern, not `format: date-time` (SPRING-API-12)?
- [ ] Breaking change? New version or explicit decision?
- [ ] N+1 check done for read endpoints?

## Spring Boot: REST and JSON Conventions

[08-crosscutting-concepts/api/spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md)

- [ ] New endpoint follows URL, status and error conventions; `operationId` set?
- [ ] DTOs are package-private records with unique names; no entity or domain type in the body?
- [ ] Decimals as `ApiDecimal`, instants as `Instant`, enums as strings (SPRING-REST-04..06)?
- [ ] Collection paged or bounded in the query, sort and filters allow-listed; update carries a version (SPRING-REST-11/12)?
- [ ] Error cases documented as problem+json and tested; 401/403 from the filter chain are problem+json with a code (SPRING-REST-14)?

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

## Spring Boot: Observability and Operability

[08-crosscutting-concepts/observability/spring.md](../08-crosscutting-concepts/observability/spring.md)

- [ ] Probes on the server port (`/livez`, `/readyz`), not routed by the ingress; actuator on the management port, `health,info` only, dedicated chain whose `permitAll` lines match the exposure list and `denyAll` for the rest (SPRING-OBS-01/02)?
- [ ] Nothing added to liveness; readiness additions have a reason (SPRING-OBS-03)?
- [ ] `server.shutdown` not set to `immediate`; sum of shutdown phases plus pre-stop delay fits the platform grace period (SPRING-OBS-04)?
- [ ] New Kafka listener: observation on, poll batch fits the shutdown phase (SPRING-OBS-05/09)?
- [ ] New business metric: outgoing port, adapter with `MeterRegistry`, closed-set tags, cardinality test (SPRING-OBS-06/11)?
- [ ] New HTTP client built from the injected builder (SPRING-OBS-09)?

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

- [ ] New chain or header change: header table of SPRING-SEC-13 kept, nothing disabled, CSP reports reach the endpoint?
- [ ] New endpoint that takes an id: owner/tenant check, 404 for foreign objects, `cross-user` tagged test (SPRING-SEC-16, SPRING-SEC-35/36)?
- [ ] New request record: no owner, tenant, role or audit fields (SPRING-SEC-34); size and length limits; JSON body size limited at the proxy and by the filter (SPRING-SEC-15)?
- [ ] New query: bind parameters only, sort and identifiers from an allow-list, no process execution with user input (SPRING-SEC-31)?
- [ ] New outbound call to a variable URL: allow-list and address filter (SPRING-SEC-19)?
- [ ] No exception text, stack trace or SQL in a response (SPRING-SEC-18)?
- [ ] New polymorphic JSON or Kafka payload: closed types (SPRING-SEC-20)?
- [ ] Security-relevant action: audit event and test (SPRING-SEC-22)?
- [ ] BFF session change: lifetimes, rotation, logout at the IdP and their tests (SPRING-SEC-32/33)? Sessions in Spring Session JDBC (SPRING-SEC-37)? Confidential client with PKCE (SPRING-SEC-38)?
- [ ] New unauthenticated endpoint that allocates state, or new export: rate limit listed in chapter 7 (SPRING-SEC-21)?
- [ ] New upload: name, scan, archive limits, download authorization, separate origin for active content (SPRING-SEC-26)?
- [ ] New dependency: reviewed (JAVA-TOOL-05)?

## Spring Boot: Security

[08-crosscutting-concepts/security/spring.md](../08-crosscutting-concepts/security/spring.md)

- [ ] Security config only in `adapter.in.rest`; deny-by-default ends the rule list?
- [ ] No Spring Security types in `domain`/`ports`; `Caller` carried in the command?
- [ ] No hand-rolled token handling, no secrets in the repo, nothing sensitive logged?
- [ ] 401/403/success tests for each new endpoint?
- [ ] Actuator exposure unchanged (allow-list), every exposed endpoint permitted by name?
- [ ] New deployment target: forward-headers strategy set explicitly (SPRING-SEC-12)?
- [ ] Hardening checklist ([spring-hardening.md](../08-crosscutting-concepts/security/spring-hardening.md)) answered for headers, limits, injection, object-level access, sessions, errors?

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
