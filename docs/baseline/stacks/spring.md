# Spring Boot

Rules for Spring Boot services. They implement the shared docs and the Java docs ([stacks/java.md](java.md)) and may tighten them, never contradict them. Stack at a glance and defaults (`SPRING-D*`): [04-solution-strategy/spring.md](../04-solution-strategy/spring.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [java](../rule-index/java.md), [spring](../rule-index/spring.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/spring.md](../05-building-block-view/spring.md) | Package structure, wiring, transactions, persistence mapping, messaging, ArchUnit template | `SPRING-ARCH-*` |
| [04-solution-strategy/spring-libraries.md](../04-solution-strategy/spring-libraries.md) | Approved and rejected libraries, Boot 4 starter names, versions | `SPRING-LIB-*` |
| [08-crosscutting-concepts/api/spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md) | Controllers, JSON, errors, pagination, status codes, versioning; implements the shared [rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md) | `SPRING-REST-*`, `API-REST-*` |
| [08-crosscutting-concepts/api/spring-openapi.md](../08-crosscutting-concepts/api/spring-openapi.md) | Producing, committing and checking the OpenAPI contract (springdoc) | `SPRING-API-*` |
| [08-crosscutting-concepts/security/spring.md](../08-crosscutting-concepts/security/spring.md) | OAuth2 resource server, `Caller`, CORS/CSRF, actuator, security tests, IdP provisioning and account linking | `SPRING-SEC-01..12`, `SPRING-SEC-39`, `SPRING-SEC-41`, `SPRING-SEC-44` |
| [08-crosscutting-concepts/security/spring-hardening.md](../08-crosscutting-concepts/security/spring-hardening.md) | Headers, TLS, limits, object-level access, errors, SSRF, deserialization, audit events, BFF cookie, DB/Kafka/image hardening, injection, BFF session lifecycle, session store and logout, confidential OIDC client, mass assignment, tenancy, 404 vs 403, session serialization, numbers from untrusted text | `SPRING-SEC-13..38`, `SPRING-SEC-40`, `SPRING-SEC-42/43` |
| [08-crosscutting-concepts/security/](../08-crosscutting-concepts/security/) shared docs | ASVS level, threat modelling, cryptography, vulnerability management, audit trail, secure pipeline, review checklist | `SEC-*` (incl. `SEC-CRY-*`, `SEC-AUD-*`) |
| [08-crosscutting-concepts/i18n/spring.md](../08-crosscutting-concepts/i18n/spring.md) | Error codes, localized ProblemDetail, `MessageSource`, localized emails (shared rules: [i18n.md](../08-crosscutting-concepts/i18n/i18n.md)) | `SPRING-I18N-*`, `I18N-*` |
| [08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md) | PostgreSQL, Flyway, Hibernate settings, migration rules, JPA vs `JdbcClient` | `SPRING-DB-*` |
| [08-crosscutting-concepts/configuration/spring.md](../08-crosscutting-concepts/configuration/spring.md) | `@ConfigurationProperties` records, no `@Value`, environment variables, mounted secrets, SPA runtime config (shared: [configuration.md](../08-crosscutting-concepts/configuration/configuration.md)) | `SPRING-CFG-*`, `CFG-*` |
| [08-crosscutting-concepts/observability/spring.md](../08-crosscutting-concepts/observability/spring.md) | Management port, probes, graceful shutdown, business metrics, tracing, `traceId` in errors (shared: [observability.md](../08-crosscutting-concepts/observability/observability.md)) | `SPRING-OBS-*`, `OBS-*` |
| [08-crosscutting-concepts/resilience/spring.md](../08-crosscutting-concepts/resilience/spring.md) | Timeouts, transactions vs remote calls, Hikari, bulkheads, retries, circuit breakers, `Idempotency-Key`, `@Scheduled` with ShedLock, caching (shared: [resilience.md](../08-crosscutting-concepts/resilience/resilience.md)) | `SPRING-RES-*`, `RES-*` |
| [08-crosscutting-concepts/messaging/spring.md](../08-crosscutting-concepts/messaging/spring.md) | Kafka settings, Jackson 3 serialization, error handler and dead letters, outbox, inbox, AsyncAPI, tests (shared: [messaging.md](../08-crosscutting-concepts/messaging/messaging.md)) | `SPRING-MSG-*`, `MSG-*` |
| [08-crosscutting-concepts/data-protection/spring.md](../08-crosscutting-concepts/data-protection/spring.md) | Retention jobs, erasure across tables and topics, personal-data tests (shared: [data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md)) | `SPRING-DP-*`, `DP-*` |
| [08-crosscutting-concepts/logging/spring.md](../08-crosscutting-concepts/logging/spring.md) | SLF4J/Logback, structured logs, what to log where | `SPRING-LOG-*` |
| [08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md) | Boot 4 test setup, Testcontainers, slices, security and query-count tests | `SPRING-TEST-*` |
| [07-deployment-view/spring-local-development.md](../07-deployment-view/spring-local-development.md) | Docker Compose, profiles, JDK, running against local services | `SPRING-DEV-*` |
| [07-deployment-view/container-runtime.md](../07-deployment-view/container-runtime.md) | Image build (Buildpacks default), frontend bundle in the BFF image, container runtime contract (shared) | `REL-IMG-*`, `REL-FE-*`, `REL-RUN-*` |
| [07-deployment-view/spring-delivery.md](../07-deployment-view/spring-delivery.md) | Flyway at start-up or as a pre-deploy job with a DDL user, `lock_timeout`, release version injected at deploy, migrate-only mode, embedding the frontend bundle (shared: [delivery-and-release.md](../07-deployment-view/delivery-and-release.md)) | `SPRING-REL-*`, `REL-*` |

## Skills for Spring work

Load these when creating or editing Spring code (the `baseline-spring` skill does this for you):

| Skill | For |
|---|---|
| `baseline-spring` (own) | Entry point: docs to read, skills to load, overrides, workflow, project templates |
| `baseline-tdd` (own) | Test-first workflow |
| `spring-boot-testing` | Boot 4 test slices, Testcontainers, Failsafe, `MockMvcTester`, `RestTestClient` |
| `baseline-security` (own) | Security rules by task, review checklist, Top 10:2025 / ASVS mapping |
| `baseline-i18n` (own) | Multilingual products: error codes, bundles, per-locale tests |
| `spring-security` | Security 6/7: filter chain, resource server, CSRF/CORS, security tests |
| `spring-observability` | Actuator, Micrometer, OpenTelemetry, structured logging |
| `java-hibernate-jpa` | N+1, lazy loading, mapping and query problems inside `adapter.out.jpa` |

**Where a skill and these docs disagree, the docs win** (TOOL-SKL-01).

## Skill overrides

| Skill habit | Baseline rule |
|---|---|
| `spring-boot-testing`: "aim for 80%+ coverage", Jacoco as the target | No coverage target; confidence to ship (D5, TEST-ARCH-09) |
| `spring-boot-testing`: Gradle alternatives, `@SpringBootTest` as the general fallback | Maven only (JAVA-TOOL-02); the test type per architecture element ([08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md)) |
| `spring-boot-testing`: `@Autowired` fields in tests | Allowed in test classes only; production code uses constructor injection (SPRING-ARCH-06) |
| `spring-boot-testing`: container-backed slice tests named `*Test` | Anything that starts a container or a full context is `*IT` in Failsafe; `./mvnw test` stays Docker-free (SPRING-TEST-07) |
| `spring-security`: `@EnableMethodSecurity` + `@PreAuthorize` on services as the default | Authorization on a framework-free `Caller` in the use case; `@PreAuthorize` only for coarse role checks (SPRING-SEC-02) |
| `spring-security`: default CSP `default-src 'self'` for an API, `headers().disable()` to silence a header problem | CSP `default-src 'none'` on the API chain, headers never disabled (SPRING-SEC-13) |
| `spring-security`: `SecurityConfig` wherever convenient | In `adapter.in.rest`, next to what it configures (SPRING-ARCH-02, SPRING-SEC-01) |
| `spring-observability`: suggests adding a developer console dependency (BootUI) | No extra dev dependency without review (TOOL-SKL-03 spirit); Compose profile `observability` instead |
| `spring-observability`: `management.endpoint.health.show-details: when-authorized` | Default `never`; probes stay minimal (SPRING-OBS-02) |
| `spring-observability`: probes at `/actuator/health/liveness` on the management port | `/livez`, `/readyz` on the server port, not routed from outside (SPRING-OBS-01, OBS-19) |
| `spring-observability`: Prometheus scrape as the example | OTLP export through `spring-boot-starter-opentelemetry` ([04-solution-strategy/spring-libraries.md](../04-solution-strategy/spring-libraries.md)); Prometheus only if the platform requires it |
| `java-hibernate-jpa`: entity design advice as if the entity were the domain model | The entity lives in `adapter.out.jpa`, never crosses a port and is never the domain model (SPRING-ARCH-09/10); domain types are separate |
| Any skill: bare `@Retryable`, Resilience4j `@Retry` | Spring 7 `@Retryable` on outgoing adapters only, with explicit `includes`, backoff and `timeout` (SPRING-RES-08, SPRING-LIB-07) |
| `spring-security`: default `logout()` that ends only the local session | Logout at the BFF and the IdP (JSON `redirectUri` for the SPA's XHR, `303` for a form), back-channel logout (SPRING-SEC-33) |
| Any skill: `BigDecimal`/`double` in a request or response record | `ApiDecimal` (API-REST-01, SPRING-REST-04) |
| Any skill: `Result`/`Either` return types for business errors | Business exceptions by category; results only for expected alternative outcomes (ARCH-UC-10/13) |
| Any skill: `ApplicationEventPublisher` between use cases | Domain events through an outgoing port and the outbox (ARCH-UC-14) |
| Any skill: `RestClient.create()` | Clients from the auto-configured builder with explicit timeouts (SPRING-RES-01, `noUnconfiguredHttpClients`) |
| Any skill: `@Value("${…}")` | `@ConfigurationProperties` records, `@Validated` (SPRING-CFG-01/03) |
| Any skill: `IllegalArgumentException` for invalid input, mapped to 400 | `DomainValidationException` from `domain`, mapped in REST and Kafka (JAVA-ARCH-12, SPRING-ARCH-18) |
| Any skill: `@Service`, `@Component`, `@Repository` | Stereotypes `@UseCase`, `@WebAdapter`, `@PersistenceAdapter`, `@MessagingAdapter`, `@HttpClientAdapter`, `@MailAdapter`, `@FileAdapter`, `@SchedulingAdapter`, `@MetricsAdapter` (SPRING-ARCH-04) |
| Any skill: `ResponseEntity<ApiError>` with a custom error body | `ProblemDetail`, business exceptions in `domain` (SPRING-ARCH-03, SPRING-REST-07) |
| Any skill: `@MockBean`, `spring-boot-starter-web`, Jackson 2 imports | `@MockitoBean`, `spring-boot-starter-webmvc`, `tools.jackson` (SPRING-LIB-01) |
| Any skill: package by feature, `controller/service/repository` | Ring layout `adapter / application / domain / ports` (SPRING-ARCH-01, ARCH-ORG-01) |
| Any skill: Lombok (`@Data`, `@Builder`, `@Slf4j`) | Records, explicit loggers (JAVA-D3, SPRING-LOG-01) |
| Any skill: scaffolding with its own layout | `baseline-spring` templates ([05-building-block-view/spring.md](../05-building-block-view/spring.md#new-service)) |
