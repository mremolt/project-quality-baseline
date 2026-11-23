---
name: baseline-spring
description: Entry point for any Java or Spring Boot backend work in a project that uses the quality baseline - creating or editing use cases, ports, controllers, security configuration, JPA adapters, Flyway migrations, Kafka adapters, logging, OpenAPI, Maven/pom.xml, Docker Compose for local services, ArchUnit and backend tests, and creating a new Spring Boot service. Loads the right skills (spring-boot-testing, spring-security, spring-observability, java-hibernate-jpa, baseline-tdd) and applies the baseline's rules, which override those skills. Use it before writing or changing any backend code.
---

# Spring Boot in the quality baseline

The baseline docs are the rules; skills supply framework know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). All paths below are relative to the project root; stack commands run from the component folder, usually `backend/` (REPO-TOOL-03).

## 1. Read the rules for the task

Never read every doc of the stack up front (TOOL-SKL-10). At the start: the rule index in `docs/baseline/rule-index/` (`shared.md`, `java.md`, `spring.md`), one line per rule ID, and `docs/baseline/05-building-block-view/spring.md`, `docs/baseline/05-building-block-view/java.md`. Then only the docs of the rows below that match the task; for a rule from a doc you have not read, search the doc for its ID and read that bullet.

| Task | Also read |
|---|---|
| Use case, port, command, domain type | `docs/baseline/05-building-block-view/use-cases.md`, `docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md` |
| Controller, DTO, JSON, errors, pagination, sorting, filtering | `docs/baseline/08-crosscutting-concepts/api/rest-conventions.md`, `docs/baseline/08-crosscutting-concepts/api/spring-rest.md`, `docs/baseline/08-crosscutting-concepts/api/spring-openapi.md`, `docs/baseline/08-crosscutting-concepts/api/openapi-contracts.md` |
| Anything that loads data | `docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md`, `docs/baseline/08-crosscutting-concepts/persistence/spring.md` |
| Authentication, authorization, CORS, actuator, user provisioning in the IdP | `docs/baseline/08-crosscutting-concepts/security/spring.md` |
| Headers, limits, errors, SSRF, JSON, uploads, audit events, DB/Kafka/image hardening | `docs/baseline/08-crosscutting-concepts/security/spring-hardening.md`, `security-review.md` |
| Database, JPA or `JdbcClient` adapter, migration | `docs/baseline/08-crosscutting-concepts/persistence/spring.md`, `docs/baseline/07-deployment-view/spring-delivery.md` |
| Library choice | `docs/baseline/04-solution-strategy/spring-libraries.md`, `docs/baseline/05-building-block-view/adapters.md` |
| Kafka listener, producer, outbox (also mail after commit without a broker), dead letters, AsyncAPI | `docs/baseline/08-crosscutting-concepts/messaging/spring.md` (shared: `messaging/messaging.md`) |
| Outbound HTTP client, timeouts, retries, `@ConcurrencyLimit`, `Idempotency-Key`, `@Scheduled` jobs, caching | `docs/baseline/08-crosscutting-concepts/resilience/spring.md` (shared: `resilience/resilience.md`) |
| CSV, Excel or PDF export, file download | `docs/baseline/08-crosscutting-concepts/exports/file-exports.md`, `api/spring-openapi.md` (SPRING-API-15), `05-building-block-view/spring.md` (`@FileAdapter`) |
| Demo or seed data | `docs/baseline/05-building-block-view/spring.md` (SPRING-ARCH-20) |
| Configuration properties, environment variables, secrets | `docs/baseline/08-crosscutting-concepts/configuration/spring.md` (shared: `configuration/configuration.md`) |
| Health, probes, shutdown, metrics, tracing | `docs/baseline/08-crosscutting-concepts/observability/spring.md` (shared: `observability/observability.md`) |
| Migrations at deployment, DB roles, release version | `docs/baseline/07-deployment-view/spring-delivery.md` (shared: `delivery-and-release.md`) |
| Personal data, retention, erasure, data subject requests | `docs/baseline/08-crosscutting-concepts/data-protection/spring.md` (shared: `data-protection/data-protection.md`) |
| Logging | `docs/baseline/08-crosscutting-concepts/logging/spring.md` |
| Localized errors, `MessageSource`, localized emails (only if the project ADR says i18n is in scope, I18N-01) | `docs/baseline/08-crosscutting-concepts/i18n/i18n.md`, `i18n/spring.md` |
| Tests | `docs/baseline/08-crosscutting-concepts/testing/tdd.md`, `docs/baseline/08-crosscutting-concepts/testing/spring.md` |
| pom.xml, compiler checks, formatting, CI commands | `docs/baseline/08-crosscutting-concepts/development/java-tooling.md` |
| Local services, running the app | `docs/baseline/07-deployment-view/spring-local-development.md` |
| New service | `docs/baseline/05-building-block-view/spring.md#new-service`, `docs/baseline/07-deployment-view/repository-layout.md` |

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Tests | `baseline-tdd`, `spring-boot-testing` |
| Security configuration or tests | `baseline-security`, `spring-security` |
| JPA entities, mappings, queries, N+1 | `java-hibernate-jpa` |
| Metrics, health, tracing, logging setup | `spring-observability` |
| Multilingual product (error codes, bundles, localized mail) | `baseline-i18n` |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

Full table: `docs/baseline/stacks/spring.md#skill-overrides`.

| Skill habit | Baseline rule |
|---|---|
| 80% coverage target | No coverage target (D5) |
| `@PreAuthorize` on services, config anywhere | Authorization on a `Caller` in the command; config in `adapter.in.rest` (SPRING-SEC-01/02) |
| `@Service`/`@Component`, package by feature | Stereotypes in `<base>.stereotype`, ring layout (SPRING-ARCH-01/04) |
| Entity returned from the service, `JpaRepository` in a port, entity as domain model | Entities and repositories package-private in `adapter.out.jpa`, always two-way mapping (SPRING-ARCH-09/10) |
| `IllegalArgumentException` for invalid input | `DomainValidationException` from `domain`; 400 in REST, not retryable in Kafka (JAVA-ARCH-12, SPRING-ARCH-18) |
| `Result`/`Either` for every failure, or one generic business exception | Exceptions per error category with a stable code; results only for expected alternative outcomes (ARCH-UC-10/13, JAVA-ARCH-13) |
| `ApplicationEventPublisher` between services | Domain event to an outgoing port and the outbox (ARCH-UC-14, MSG-PUB-02) |
| Bare `@Retryable`, Resilience4j `@Retry` | `@Retryable` on outgoing adapters with explicit `includes` and backoff (SPRING-RES-08, SPRING-LIB-07) |
| `@Value("${…}")` | `@ConfigurationProperties` records (SPRING-CFG-01/03) |
| `ResponseEntity<ApiError>` | `ProblemDetail` (SPRING-REST-07) |
| `BigDecimal` or `double` in a request/response record | `ApiDecimal`, a JSON string (API-REST-01, SPRING-REST-04) |
| `@MockBean`, `spring-boot-starter-web`, Jackson 2 | `@MockitoBean`, `-webmvc`, Jackson 3 (SPRING-LIB-01/04) |
| Lombok, `@Slf4j` | Records, explicit logger (JAVA-D3, SPRING-LOG-01) |
| System `mvn`, Gradle | `./mvnw` from `backend/` (JAVA-TOOL-02) |
| Coverage-driven or `@SpringBootTest` everywhere | Test type per element (SPRING-TEST) |
| Container-backed test named `*Test` | Container or full context → `*IT` in Failsafe; `./mvnw test` stays Docker-free (SPRING-TEST-07) |
| Hand-written REST client for a provider with a spec | Generated client in `adapter.out.http.generated` (SPRING-LIB-06) |

## 4. Workflow

1. **Place it.** Decide the ring and package for every new class (ARCH-ORG-01, SPRING-ARCH-01); stereotype annotation, package-private (SPRING-ARCH-04). `application` uses only the allowed framework types (`applicationUsesOnlyAllowedTypes`); another bounded context only through its incoming port (ARCH-ORG-09). The use case authorizes with the `Caller` (ARCH-UC-15) and raises errors by category (ARCH-UC-13).
2. **N+1 check** for anything that loads data (API-N1-01): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: London for use cases and adapters' ports, Chicago for domain; test type per element from `docs/baseline/08-crosscutting-concepts/testing/spring.md`.
4. **Security and data**: new endpoint → 401/403/success tests (SPRING-SEC-10) and a cross-user test if it takes an id (SPRING-SEC-16), answer the security checklist (SEC-REV-01); new table or column → expand/contract migration (SPRING-DB-05); new personal-data field → inventory and deletion concept (DP-INV-03).
5. **Integration**: new outbound client → connect and read timeouts set (SPRING-RES-01); no remote call inside `@Transactional` (SPRING-RES-03); new Kafka consumer → idempotent (SPRING-MSG-08), dead-letter topic named and owned (SPRING-MSG-05).
6. **Contract**: changed controller → regenerate the spec with `./mvnw verify -Dopenapi.update=true` (`OpenApiSpecIT`) and commit it with the change (SPRING-API-08).
7. **Shortcuts**: if you need one (e.g. skipping a use case for trivial CRUD), propose it and draft an ADR; never take it silently (ARCH-SC-06).
8. **Finish** with `cd backend && ./mvnw verify` green, and no architecture test, compiler check, SpotBugs rule or formatter setting loosened. On a red gate run `./mvnw spotless:apply` first and hand-fix only what remains (TOOL-SKL-15).
9. **Self-review** against the agent checklist sections of the docs you used (`docs/baseline/checklists/`, TOOL-SKL-13).

## 5. New service

Follow `docs/baseline/05-building-block-view/spring.md#new-service`. The templates are in this skill's `templates/` folder (`.agents/skills/baseline-spring/templates/` in a project):

| File | Goes to |
|---|---|
| `pom.reference.xml` | `backend/pom.xml` (build section, properties; starters as needed) |
| `mvn-jvm.config` | `backend/.mvn/jvm.config` (renamed) |
| `spotbugs-exclude.xml` | `backend/spotbugs-exclude.xml` |
| `sdkmanrc` | `backend/.sdkmanrc` (renamed) |
| `compose.yaml` | `backend/compose.yaml` (rename project and database) |
| `dev/keycloak/orders-realm.json` | `backend/dev/keycloak/<realm>-realm.json` for the `auth` profile (rename realm and clients; SPRING-DEV-11/12) |
| `application.yaml`, `application-local.yaml` | `backend/src/main/resources/` |
| `stereotype/*.java` | `backend/src/main/java/<base>/stereotype/` |
| `test/ArchitectureTest.java` | `backend/src/test/java/<base>/ArchitectureTest.java` |
| `scripts/new-use-case.mjs` | `tools/new-use-case.mjs` (set the base package and the slice test's security import; generates each new use case, `--with-controller` adds controller and web slice test, SPRING-ARCH-19) |
| `scripts/verify-all.sh`, `scripts/verify-all.cmd` | `backend/` (all gate findings in one run before the commit, JAVA-TOOL-24) |
| `test/support/*.java` | `backend/src/test/java/<base>/support/` (`InMemoryRepository`, `People`, `Transactions`; adapt `People.caller(...)` to the `Caller` record, SPRING-TEST-14) |

Generate the skeleton with start.spring.io using fixed parameters (no piped installers): `type=maven-project`, `language=java`, `javaVersion=25`, `bootVersion=<pinned 4.1.x>`, the dependency ids from the doc, then apply the templates. Check that the repository layout decision was made first (REPO-LAY-02).
