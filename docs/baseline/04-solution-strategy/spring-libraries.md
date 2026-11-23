# Spring Boot: Libraries

Which libraries a service uses for which job, and which it does not. Version policy, Boot 4 starter names, and the reasons for rejections. Persistence, security, logging, REST and test specifics have their own docs.

## Rules

- **SPRING-LIB-01: Spring Boot's BOM manages versions.** Managed artifacts get no explicit version. Starters use the Boot 4 names:

| Boot 3 name | Boot 4 name |
|---|---|
| `spring-boot-starter-web` | `spring-boot-starter-webmvc` |
| `spring-boot-starter-oauth2-resource-server` | `spring-boot-starter-security-oauth2-resource-server` |
| `spring-boot-starter-json` | `spring-boot-starter-jackson` |
| `spring-boot-starter-aop` | `spring-boot-starter-aspectj` |
| (Flyway came with `flyway-core`) | `spring-boot-starter-flyway` **and** `org.flywaydb:flyway-database-postgresql`. Without the starter, migrations silently do not run |
| `spring-boot-starter-test` alone | plus one `*-test` starter per technology (`-webmvc-test`, `-data-jpa-test`, `-kafka-test`, …); `spring-boot-testcontainers` |

  The BOM also overrides the *transitive* versions of libraries it manages, and dependency convergence still passes. A library that fails after being added (veraPDF with JAXB 4 instead of the 2.3 it needs: "flavour not supported") is first checked with `./mvnw dependency:tree -Dverbose` against Boot's overrides; the fix is a pin of the affected artifacts in the narrowest scope, with a comment naming the library and the reason.

- **SPRING-LIB-02: Spring MVC with virtual threads** (`spring.threads.virtual.enabled=true`). WebFlux needs an ADR that names the signal (streaming, reactive-only dependency).
- **SPRING-LIB-03: `spring-boot-starter-validation` is present in every service with request bodies.** Without a validator on the classpath, `@Valid` is silently ignored and invalid bodies are accepted.
- **SPRING-LIB-04: Jackson 3 (`tools.jackson.*`)** through the Boot starters. Jackson annotations still come from `com.fasterxml.jackson.annotation`. Neither package may appear in `domain` or `ports` (ArchUnit template). `spring-boot-jackson2` is a migration aid, not for new code. springdoc 3.x still brings `jackson-databind` 2 onto the compile classpath, so the ArchUnit rule `noJackson2` forbids `com.fasterxml.jackson.databind..` and `com.fasterxml.jackson.core..` in all production code (annotations stay allowed).
- **SPRING-LIB-05: springdoc-openapi 3.x produces the spec** ([08-crosscutting-concepts/api/spring-openapi.md](../08-crosscutting-concepts/api/spring-openapi.md)). The line follows the Boot minor: 3.0.x ↔ Boot 4.0, 3.1/3.2.0 ↔ Boot 4.1, 3.2.1 ↔ Boot 4.2 (3.2.1 moves to swagger-core 3 / Jackson 3 and cannot run beside Springwolf 2.x, SPRING-MSG-11). springdoc 2.x does not start on Boot 4. Pin the exact version; check its release notes on every bump.
- **SPRING-LIB-06: Outgoing REST calls live in `adapter.out.http`** and use `RestClient` or `@HttpExchange` HTTP Service Clients; never `RestTemplate` (formally deprecated for removal in Spring Framework 7.1, which Boot 4.2 ships; Boot 4.2 also deprecates `RestTemplateBuilder` and `TestRestTemplate`; forbidden by the ArchUnit rule `noRestTemplate`) (`@ImportHttpServices`, `spring.http.serviceclient.<group>.*`). When the provider has an OpenAPI spec, the client and its DTOs are **generated** from it (OpenAPI Generator, `restclient` library) into `adapter.out.http.generated`, wrapped by a hand-written adapter that maps to ports (AGENTS.md: clients are never hand-written; API-CON-08). A hand-written HTTP Service Client is allowed only for providers without a spec, with a comment saying so. Generated code is excluded from Spotless, SpotBugs and Error Prone (JAVA-TOOL-09). `RestClient.Builder` is auto-configured only with `spring-boot-starter-restclient` (Boot 4's modular starters; `spring-boot-starter-webmvc` alone does not bring it), and the ArchUnit rule `noUnconfiguredHttpClients` forbids `RestClient.create()`/`builder()`, so a service with an outgoing HTTP adapter adds that starter first.
- **SPRING-LIB-07: Resilience uses Spring Framework 7's built-ins** (`@Retryable`, `@ConcurrencyLimit`, `RetryTemplate`, switched on with `@EnableResilientMethods`), only in adapters, except the `RetryTemplate` around an optimistic-lock conflict in the application service (SPRING-RES-03). `@ConcurrencyLimit` always with the `REJECT` policy, `@Retryable` always with a `timeout`. Their defaults differ from spring-retry and are traps; usage rules and the required attributes are in [resilience/spring.md](../08-crosscutting-concepts/resilience/spring.md) (SPRING-RES-06, SPRING-RES-08). **Resilience4j is added only for a circuit breaker** (`resilience4j-spring-boot4`, not managed by Boot: pin it). Call timeouts come from the client configuration (SPRING-RES-01), not from a time limiter; inbound rate limits follow SPRING-SEC-21 (gateway by default, Bucket4j for business limits).
- **SPRING-LIB-08: Mapping code is hand-written** (ARCH-MAP-08). Mapping frameworks (MapStruct, ModelMapper, Dozer) are not used: they hide errors and make mappings harder to debug and review. A project that wants MapStruct records an ADR; it then stays in adapters and every mapping is covered by an adapter test. Reflection-based mappers are never allowed.
- **SPRING-LIB-09: Null-safety uses JSpecify** ([08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md), JAVA-TOOL-07/08). The legacy `org.springframework.lang.Nullable` and `javax.annotation` variants are not used.
- **SPRING-LIB-10: Observability uses `spring-boot-starter-actuator` and `spring-boot-starter-opentelemetry`** (Micrometer inside). By default, metrics and traces are exported over OTLP and logs go to stdout as structured JSON (SPRING-LOG-02), as the observability decision table says ([observability.md](../08-crosscutting-concepts/observability/observability.md)). Only where the platform demands it: OTLP log export, or Prometheus pull instead of OTLP metrics (then `micrometer-registry-prometheus` and the `prometheus` endpoint, SPRING-SEC-07, SPRING-OBS-02), recorded in the product's chapter 7. OTLP log export is not automatic: Boot configures the exporter once `management.opentelemetry.logging.export.otlp.endpoint` is set, but the OpenTelemetry Logback appender is not part of Boot and must be added, declared in `logback-spring.xml` and installed at start-up. The OpenTelemetry Java agent is not combined with the starter (duplicate spans).
- **SPRING-LIB-11: Messaging uses `spring-boot-starter-kafka`** (SPRING-ARCH-12/13). Choices in short; the detail is in [messaging/spring.md](../08-crosscutting-concepts/messaging/spring.md):

| Topic | Choice | Detail |
|---|---|---|
| Version | Spring Kafka at least 4.1.1 (CVE in the dead-letter recoverer factory) | SPRING-MSG-05 |
| Payload format | JSON as strings, read and written with Boot's Jackson 3 `JsonMapper`; the type comes from the envelope (SPRING-MSG-04). Spring Kafka's JSON serializers and message converters are not used. Avro only with an ADR | SPRING-MSG-04 |
| Consistency with a database write | Transactional outbox with a relay is the default; change data capture (for example Debezium) needs an ADR | MSG-PUB-01/02, SPRING-ARCH-13, SPRING-MSG-07 |
| Share groups (Kafka queues, KIP-932) | Only with an ADR, for work-queue cases: share consumers have no dead-letter topic integration and no `CommonErrorHandler`, which bypasses our retry and dead-letter handling | SPRING-MSG-05 |
| Spring Modulith | Not a default: it treats each top-level package as a module, which does not fit the ring layout. It can fit a multi-context layout (`com.example.<context>.…`) with an ADR; ArchUnit stays | SPRING-ARCH-01 |

- **SPRING-LIB-12: Spring Data types do not cross ports.** `Page`, `Pageable`, `Sort` stay in `adapter.out.jpa`; ports use own `PageRequest`/`PageResult` records (ARCH-DEP, SPRING-ARCH-09).
- **SPRING-LIB-13: The service ships as an OCI image that meets the image requirements; Buildpacks is the default way to build it.** Requirements: an OCI image that runs as non-root, on a minimal base image pinned by digest ([REL-IMG-01/02](../07-deployment-view/container-runtime.md)), with no build tools, sources or secrets in its layers, and an SBOM produced by the build (scanning and pinning in deployment: SPRING-SEC-29). Default: Buildpacks (`./mvnw spring-boot:build-image`), which needs a Docker-compatible daemon on the build runner. A Dockerfile-based multi-stage build or Jib (daemonless, `jib-maven-plugin`) is allowed without an ADR when the customer platform dictates it (no daemon on the runners, a mandated base image or image build service); the product records the build method and the reason in its chapter 7 (delivery platform mapping). Any other way needs an ADR. Where the service is the BFF, the image also carries the frontend bundle, which the pipeline passes to the image build as an artifact (REL-FE-01/02, SPRING-REL-08).
- **SPRING-LIB-14: Awaitility** for asynchronous test assertions; no `Thread.sleep` in tests.
- **SPRING-LIB-15: Spring Session JDBC (`spring-boot-starter-session-jdbc`) holds BFF sessions** on the product's PostgreSQL (SPRING-SEC-37); Redis-backed Spring Session needs an ADR.

### Not used

| Library | Reason |
|---|---|
| MapStruct, ModelMapper, Dozer | Hand-written mapping is explicit and debuggable (SPRING-LIB-08, ARCH-MAP-08); MapStruct only with an ADR |
| Lombok | Records, no setters, no builders (JAVA-ARCH-03/04/06); banned by the enforcer (JAVA-TOOL-06) |
| H2, HSQLDB, embedded Postgres | TEST-ARCH-04 |
| springfox | Dead; springdoc replaces it |
| OpenAPI Generator for our own server stubs | Contract-first conflicts with D8 |
| Spring HATEOAS | No requirement; adds media-type complexity |
| spring-retry | Archived; superseded by Spring 7 built-ins |
| Resilience4j retry, rate limiter, time limiter, bulkhead | Spring 7 built-ins, client timeouts (SPRING-RES-01) and SPRING-SEC-21 cover them; Resilience4j only for a circuit breaker (SPRING-LIB-07) |
| `RestTemplate`, `TestRestTemplate` | Deprecated in Spring Framework 7.1 / Boot 4.2; `RestClient` / HTTP Service Clients and `RestTestClient` replace them (SPRING-LIB-06, SPRING-TEST-03) |
| JJWT, hand-written JWT filters | The resource server validates tokens (SPRING-SEC-06) |
| Log4j2, `java.util.logging` | Logback is the Boot default (SPRING-LOG-01) |
| OWASP dependency-check as a required gate | JAVA-TOOL-16 |

## Versions of the reference build

Boot 4.1.3 brought these (read from the resolved dependencies of a validated template build); newer patch versions are expected:

| Component | Version |
|---|---|
| Spring Framework | 7.0.x |
| Hibernate ORM | 7.4.x |
| Jackson | 3.1.x |
| Flyway | 12.4 |
| Kafka clients | 4.2 |
| Testcontainers | 2.0.5 |
| JUnit Jupiter | 6.0.x |

Not managed by Boot, pinned in the build: springdoc-openapi 3.2.0, ArchUnit 1.5.1, resilience4j-spring-boot4 2.4.0, OpenAPI Generator 7.27, ShedLock 7.x (`shedlock-spring`, `shedlock-provider-jdbc-template`, SPRING-RES-12), Springwolf 2.x (`springwolf-kafka`, SPRING-MSG-11).

**Boot 4.2.0 was released on 2026-11-19** (OSS support to 2027-12-31; 4.1 runs to 2027-07-31). **The upgrade is parked** (SPRING-D1) until the pinned libraries officially support Boot 4.2 and the reference template builds green on 4.2.x; a first patch release is not a precondition. *Supported* means that every pinned third-party library, `resilience4j-spring-boot4` and ShedLock included, has an official release built against the new Boot minor; a passing smoke test alone is not enough. Boot 4.2 waits for the Springwolf release on swagger-core 3 (no split upgrade without Springwolf); the upgrade skill is written once that release is out. Status 2026-11-21: springdoc 3.2.1 supports 4.2, but Springwolf 2.9.0 (swagger-core 2 / Jackson 2) fails at start-up beside it with a `VerifyError`; the Springwolf release on swagger-core 3 is merged but not released. `resilience4j-spring-boot4` 2.4.0 and ShedLock 7.11 publish no 4.2 statement; they passed a smoke test on 4.2.0, which does not count as support. What is still to confirm before the upgrade is listed in [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use). When upgrading, decide on the opt-in OpenTelemetry semantic conventions (they rename metrics and spans, so dashboards change) and re-check SPRING-SEC-12.

*Agent checklist in [checklists/spring.md](../checklists/spring.md) and sources in [sources.md](../sources.md), section "Spring Boot: Libraries".*
