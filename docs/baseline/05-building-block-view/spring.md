# Spring Boot: Hexagonal Architecture

The standard structure and wiring for Spring Boot services. It builds on [05-building-block-view/java.md](java.md) and the shared docs in [README.md](../README.md). Libraries, REST, security, persistence, logging, tests and local setup have their own docs, listed in [stacks/spring.md](../stacks/spring.md).

## Package structure (team standard)

Below the application's base package (where the `@SpringBootApplication` class lives):

```
+- adapter
| +- in
| | +- rest
| | | +- v1
| | +- kafka
| | +- scheduling
| +- out
|   +- kafka
|   +- s3
|   +- jpa
|   +- jdbc
|   +- http
|   +- mail
|   +- file
|   +- metrics
+- application   // business logic; sub-packages by a sensible functional cut
+- domain        // domain objects, including business exceptions
+- ports
| +- in
| +- out
+- stereotype    // @UseCase, @WebAdapter, @PersistenceAdapter, @MessagingAdapter, @HttpClientAdapter, @MailAdapter, @FileAdapter, @SchedulingAdapter, @MetricsAdapter
+- config        // support types for configuration only (Secret, SPRING-CFG-11); no @Configuration classes
```

*(Proposal from our Java team. The technologies listed are the common ones. Add or omit sub-packages per service.)*

### What goes where

| Package | Contents | May depend on |
|---|---|---|
| `domain` | Entities, value objects (records), domain services, **business exceptions** | nothing else in the app; no Spring, JPA or Jackson |
| `ports.in` | Use-case interfaces (`TransferFundsUseCase`, `GetBalanceUseCase`) and their inputs (`TransferFundsCommand`, `GetBalanceQuery`) and results (`GetBalanceResult`) | `domain` |
| `ports.out` | Interfaces the core needs from the outside (`LoadAccountPort`, `PublishOrderPlacedPort`, `StoreDocumentPort`) | `domain` |
| `application` | One service per use case implementing a `ports.in` interface; `@Transactional` boundary | `domain`, `ports` |
| `adapter.in.rest.v1` | `@RestController`s sliced per use case, package-private request/response records, mapping | `ports.in`, `domain` |
| `adapter.in.rest` | `@RestControllerAdvice` mapping business exceptions to `ProblemDetail` (shared by all versions) | `domain` |
| `adapter.in.kafka` | `@KafkaListener`s: deserialize → map to command → call `ports.in`; error/DLT handling | `ports.in`, `domain` |
| `adapter.in.demo` | Demo-data loader under the `demo` profile, calling `ports.in` (SPRING-ARCH-20) | `ports.in`, `domain` |
| `adapter.in.scheduling` | `@Scheduled` jobs (retention, purges, polling) that call `ports.in`, under a cluster lock (SPRING-RES-12, SPRING-DP-01) | `ports.in`, `domain` |
| `adapter.out.kafka` | Producers implementing `ports.out`; message schemas/DTOs stay here | `ports.out`, `domain` |
| `adapter.out.s3` | S3 client adapter implementing `ports.out`; no AWS SDK types leave the package | `ports.out`, `domain` |
| `adapter.out.http` | REST client adapters implementing `ports.out`; generated client and DTOs in `generated` (SPRING-LIB-06) | `ports.out`, `domain` |
| `adapter.out.jpa` | `@Entity` classes, Spring Data JPA repositories, mapper, adapter class implementing `ports.out`; may also run `JdbcClient` queries for the same aggregate | `ports.out`, `domain` |
| `adapter.out.jdbc` | Persistence adapters built only on `JdbcClient` (read models, reporting, bulk updates; SPRING-DB-15), row mappers | `ports.out`, `domain` |
| `adapter.out.mail` | Outgoing mail: the port implementation writes the mail outbox, a sender job delivers over SMTP (SPRING-MSG-13); templates rendered in the recipient's language (SPRING-I18N-05) | `ports.out`, `domain` |
| `adapter.out.file` | Writers of generated files (CSV, Excel, PDF) implementing `ports.out`, one sub-package per format (`file.pdf`) | `ports.out`, `domain` |
| `adapter.out.metrics` | Business metrics: implements a metrics port from `ports.out` with Micrometer's `MeterRegistry` (SPRING-OBS-06) | `ports.out`, `domain` |
| `stereotype` | The nine stereotype annotations (SPRING-ARCH-04); contains nothing else | Spring only |
| `config` | Support types shared by the properties records of several adapters (`Secret`, SPRING-CFG-11); contains nothing else | nothing |
| base package | `@SpringBootApplication` class = composition root | everything |

`stereotype` and `config` are the Spring support packages that ARCH-ORG-01 allows besides the rings; the architecture test (`everyClassHasAHome`) rejects any other package.

## Rules

### Structure

- **SPRING-ARCH-01: New services use the package structure above.** Adapter sub-packages are named after the technology. Versioned REST APIs get one package per version (`v1`, `v2`) with their own DTOs (ARCH-ORG-03).
- **SPRING-ARCH-02: `@Configuration` classes never go into a separate configuration package.** They live next to what they configure (e.g. `adapter.out.jpa.JpaConfiguration`, `adapter.in.kafka.KafkaConsumerConfiguration`), so they can reach package-private classes. The `config` support package holds only shared types such as `Secret` (SPRING-CFG-11).
- **SPRING-ARCH-03: Business exceptions never extend Spring exceptions** (e.g. `ResponseStatusException`). Placement and categories: ARCH-ORG-05, ARCH-UC-13; translation: ARCH-ADP-05, in Spring by SPRING-REST-07 and SPRING-ARCH-18.
- **SPRING-ARCH-20: Demo and seed data of a running installation are loaded by an incoming adapter that calls the use cases.** An `ApplicationRunner` in `adapter.in.demo`, registered by a `@Bean` with `@Profile("demo")` in that package's `@Configuration`, acts as a named system caller and goes through the incoming ports (master data through the product's bulk-import use case where one exists), so validation, business rules and the audit trail apply; it never writes tables directly. It skips when its data is already present, the data is synthetic (DP-ENV-01), and no deployed configuration sets the `demo` profile (a context test without the profile asserts the runner bean is absent).
  *Why:* seed SQL bypasses the rules the demo is meant to show and breaks with every migration.

### Wiring

- **SPRING-ARCH-04: Core beans are found by component scanning using custom stereotype annotations** that make the architecture visible: `@UseCase` (in `application`), `@WebAdapter` / `@MessagingAdapter` (Kafka listeners and producers) / `@HttpClientAdapter` (outgoing HTTP clients in `adapter.out.http`, SPRING-LIB-06) / `@MailAdapter` (outgoing mail over SMTP and its outbox in `adapter.out.mail`, SPRING-MSG-13) / `@FileAdapter` (adapters that write files such as CSV, Excel or PDF in `adapter.out.file`, one technology package with sub-packages per format, so the formats can share helpers without breaking ARCH-DEP-05) / `@PersistenceAdapter` / `@SchedulingAdapter` (`adapter.in.scheduling`, SPRING-RES-12) / `@MetricsAdapter` (`adapter.out.metrics`, SPRING-OBS-06) (in `adapter`), each meta-annotated with `@Component`. The annotations live in `<base>.stereotype` (templates in `.agents/skills/baseline-spring/templates/stereotype/`). Scanned classes stay **package-private** (Spring instantiates them reflectively); the architecture test checks it (`stereotypedClassesArePackagePrivate`).
- **SPRING-ARCH-05: Feature annotations go on the adapter's own `@Configuration`, never on the main class** (`@EnableJpaRepositories`, `@EntityScan`, `@EnableKafka`, …).
  *Why:* test slices and partial contexts can start without pulling in every infrastructure piece.
- **SPRING-ARCH-06: Constructor injection only** (final fields, single constructor). No field injection.
  *Why:* every class can be instantiated in a plain unit test with mocks.

### Use cases and transactions

- **SPRING-ARCH-07: The transaction boundary of ARCH-UC-11 is Spring's `@Transactional` on the application service**, on the class or on the use-case method; read-only queries use `@Transactional(readOnly = true)`. A use case that calls a remote port puts it on the method that only touches the database, not on the class, or uses a `TransactionTemplate` (SPRING-RES-03, RES-TX-01). `jakarta.transaction.Transactional` is not used.
- **SPRING-ARCH-08: Commands are records in `ports.in`** (mechanism for ARCH-UC-05/06: JAVA-ARCH-03/04). If Bean Validation is used on request DTOs in the REST adapter (`@Valid`), it only checks that the request **can be mapped** to the command. It does not duplicate command validation.

### Persistence

- **SPRING-ARCH-09: JPA entities and Spring Data repositories are package-private inside `adapter.out.jpa`** and never appear in a port signature.
- **SPRING-ARCH-10: The JPA entity is never the domain model; persistence always uses two-way mapping** (tightens D3 and ARCH-MAP-02/03 of [08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md)). The *no mapping* strategy is not available in Spring services, for CRUD contexts neither. For simple CRUD keep the domain type a small record and the mapper trivial; read-only queries may project straight into port result records in the adapter (JPQL constructor expressions, `JdbcClient` row mappers), so no entity crosses the port. A table without aggregate invariants (reference rows, markers, dated rows) may have a `JdbcClient` adapter in `adapter.out.jdbc` whose row mapper builds the domain type directly; there is no entity to map from (SPRING-DB-15). JPA with two-way mapping stays the default for aggregates with invariants and concurrent updates.
  *Why:* JPA's needs (no-arg constructor, mutable fields, proxies, lazy loading) are exactly the persistence concerns that trigger the switch in ARCH-MAP-02, and they are present from the first entity. The architecture test forbids `jakarta.persistence` in `domain`/`ports` and keeps entities in the adapter (SPRING-ARCH-09), so a shared entity model could not pass it anyway.
- **SPRING-ARCH-11: Keep JPA simple: no bidirectional associations or cascades the domain doesn't need, one persistence adapter per aggregate.** (Database rules: [08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md).) Use plain SQL (`JdbcClient`) for ports where JPA adds nothing (ARCH-ADP-13, SPRING-DB-15). Bounded data loading: API-N1-05, SPRING-TEST-06.

### Messaging & storage

- **SPRING-ARCH-12: Kafka listeners are incoming adapters and producers are outgoing adapters.** Neither contains business logic. Event payload classes (Avro/JSON) stay in their adapter package; the core publishes domain-level events through a port.
- **SPRING-ARCH-13: If an event must be consistent with a database write, don't publish it to Kafka directly inside the use case.** The default is a transactional outbox (MSG-PUB-02); the Spring implementation is SPRING-MSG-07 ([08-crosscutting-concepts/messaging/spring.md](../08-crosscutting-concepts/messaging/spring.md)). Change-data capture instead needs an ADR (SPRING-LIB-11).
- **SPRING-ARCH-14: Third-party SDK types (AWS S3, HTTP clients) never leave their adapter package.**

### Validation errors

- **SPRING-ARCH-18: Every incoming adapter maps the error categories of ARCH-UC-13 explicitly, by their base types in `domain`.** The REST advice maps the domain validation exception (JAVA-ARCH-12) to 400 `application/problem+json` with its code and an `errors` entry, the business exceptions to their status and `code` (SPRING-REST-07, SPRING-I18N-02), and the domain `AccessDeniedException` to 403 with its `code`, appending the security event (SPRING-SEC-22). The Kafka error handler classifies the validation exception and the business-rule, not-found and access-denied exceptions as not retryable (`DefaultErrorHandler.addNotRetryableExceptions(DomainValidationException.class, BusinessRuleException.class, NotFoundException.class, AccessDeniedException.class)`, SPRING-MSG-05), so the record goes straight to the dead-letter topic; a listener for which the rejection is an expected outcome catches that one exception, acknowledges and logs instead (MSG-ERR-01). A `ConflictException` (including an optimistic-lock failure) is retried with backoff (RES-RTY-02) and then dead-lettered. Any exception that is neither the validation exception nor a business exception, including `IllegalArgumentException`, is a bug: 500 with a generic `ProblemDetail` (SPRING-SEC-18) in REST, retry with backoff and then the dead-letter topic in Kafka.
- **SPRING-ARCH-19: New use cases start from the `baseline-spring` generator.** `templates/scripts/new-use-case.mjs` is copied to `tools/` with the product's base package and the security configuration the slice test imports, and run as `node tools/new-use-case.mjs <cut> <UseCase> [--with-controller]`. It creates the command record, incoming port, `@UseCase` service, test shell with a cross-user stub, with `--with-controller` also the REST controller in `adapter.in.rest.v1` and its web slice test (401, 403 from the use case's Access denied, 403 without CSRF on a BFF chain, success; SPRING-SEC-10, SPRING-TEST-12), and the printed checklist of what the architecture tests demand (`@NullMarked`, web slice test, `cross-user` test or a listed reason, spec refresh). The generated service throws until the first failing test is written (TEST-TDD-01).
  *Why:* a use case is about eight files; scaffolding them by hand drifts from the layout and the stereotypes.
  *Why:* bad input is the caller's fault and repeats identically on retry; a bug must stay visible as a server error instead of being reported as the client's mistake.

## Testing

Test type, style and doubles per element: [testing-by-architecture-element.md](../08-crosscutting-concepts/testing/testing-by-architecture-element.md#test-type-style-and-doubles-per-element); setup in [testing/spring.md](../08-crosscutting-concepts/testing/spring.md).

## Architecture test template

Copy `.agents/skills/baseline-spring/templates/test/ArchitectureTest.java` into `src/test/java/<base-package>/ArchitectureTest.java` and replace the base package `com.example.orders` (in the package, the imports and the rule patterns). Adapters need no list: every `adapter.<in|out>.<technology>` package is found automatically. Some rules have not yet run against a real service ([chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)). The template contains:

| Rule | Guards |
|---|---|
| `hexagonal` (`onionArchitecture()` with `domain`, `ports`, `application` and all adapters as one layer, optional layers) | Ring dependencies (ARCH-DEP-01) |
| `adaptersCallPortsNotServices` | Adapters reach the core only through `ports.in` (ARCH-ADP-02, ARCH-SC-07) |
| `adaptersAreIndependent` | One slice per `adapter.<direction>.<technology>`; slices do not depend on each other (ARCH-DEP-05) |
| `noCycles` | No cycle between any two packages (ARCH-ENF-05) |
| `contextsMeetOnlyAtIncomingPorts` (commented out) | With several bounded contexts: a context reaches another only from an outgoing adapter, through its `ports.in` (ARCH-ORG-09) |
| `domainAndPortsAreFrameworkFree` | No Spring, JPA, Jackson (2 and 3, including the annotations in `com.fasterxml.jackson.annotation`), Kafka, AWS, springdoc/swagger, Springwolf, SLF4J/Logback, Micrometer, OpenTelemetry in `domain` or `ports` (ARCH-DEP-02, SPRING-LIB-04, SPRING-API-07, SPRING-LOG-06, SPRING-OBS-06, SPRING-MSG-11). `org.jspecify` is allowed |
| `applicationUsesOnlyAllowedTypes` | Allow-list for `application`: the JDK, the service's own packages, `org.jspecify`, `org.springframework.transaction` (SPRING-ARCH-07), `org.springframework.security.access.prepost` (`@PreAuthorize`, SPRING-SEC-02), SLF4J (SPRING-LOG-06), `io.micrometer.observation` (SPRING-OBS-06). No `EntityManager`, `KafkaTemplate`, `RestClient` or other adapter technology (ARCH-ADP-01, ARCH-DEP-03) |
| `applicationHasNoJsonOrI18nTypes` | No Jackson, `MessageSource`, `LocaleContextHolder` or `LocaleResolver` in `application`; covered by the allow-list, kept for a precise message (SPRING-LIB-04, SPRING-I18N-04) |
| `noLocaleFieldsInCore` / `noLocaleInCoreSignatures` | No `java.util.Locale` as a field, parameter or return type in the core; `Locale.ROOT` for case conversion stays possible (SPRING-I18N-04) |
| `noTransactionalAdapterClasses` / `noTransactionalAdapterMethods` | `@Transactional` only in application services (SPRING-ARCH-07) |
| `cacheOnlyInAdapters` | `org.springframework.cache..` (`@Cacheable`, `@CacheEvict`, …) only in adapters (SPRING-RES-14) |
| `noValueFields` / `noValueMethods` / `noValueParameters` | No `@Value` on fields, methods or constructor parameters in production code; configuration is bound with `@ConfigurationProperties` (SPRING-CFG-03) |
| `secretsUseSecretType` | Secret-named fields of `*Properties` classes have the type `Secret` (CFG-07, SPRING-CFG-11) |
| `onlySpringTransactional` | `jakarta.transaction.Transactional` is not used anywhere; Spring's `@Transactional` is the one annotation (SPRING-ARCH-07) |
| `jpaEntitiesStayInAdapter` | `@Entity` only in `adapter.out.jpa`, not public (SPRING-ARCH-09). Ships with `allowEmptyShould(true)` so a new service is green; remove it with the first `@Entity` (ARCH-ENF-02). Remove the rule in services without JPA |
| `stereotypedClassesArePackagePrivate` | Classes with a stereotype annotation are not public (JAVA-ARCH-01, SPRING-ARCH-04) |
| `useCasesLiveInApplication` | `@UseCase` only in `application` (SPRING-ARCH-04) |
| `httpClientAdaptersLiveInAdapterOutHttp` | `@HttpClientAdapter` only in `adapter.out.http` (SPRING-ARCH-04); `allowEmptyShould(true)` until the first one |
| `mailAdaptersLiveInAdapterOutMail` / `fileAdaptersLiveInAdapterOutFile` | `@MailAdapter` only in `adapter.out.mail`, `@FileAdapter` only in `adapter.out.file` (SPRING-ARCH-04); `allowEmptyShould(true)` until the first one |
| `updatesAnswerWithTheResource` | No `PUT`/`PATCH` handler returns `void`, carries `@ResponseStatus(NO_CONTENT)` or calls `ResponseEntity.noContent()` (API-REST-11, SPRING-REST-12); `allowEmptyShould(true)` until the first one |
| `restRecordNamesAreUnique` | No two `*Request`/`*Response` types in `adapter.in.rest` share a simple name, which springdoc would merge into one schema (SPRING-API-02) |
| `everyClassHasAHome` | Every class is in a ring, an `adapter.<in\|out>.<technology>` package, the composition root, `stereotype` or `config` (ARCH-ORG-01, SPRING-ARCH-01). `package-info` is ignored, so container packages (`adapter`, `adapter.in`, `ports`) can be `@NullMarked` too (JAVA-TOOL-08) |
| `everyPackageIsNullMarked` | Every package that holds classes has a `@NullMarked` `package-info.java`; NullAway skips unmarked packages silently (JAVA-TOOL-08) |
| `noDirectClockAccess` | No `now()` without a `Clock`, no `Clock.system*()` and no `System.currentTimeMillis()` outside `config`, where the `Clock` bean lives (ARCH-UC-20, JAVA-ARCH-14) |
| `noFieldInjection`, `noStandardStreams`, `noJavaUtilLogging` (`GeneralCodingRules`) | SPRING-ARCH-06, SPRING-LOG-01 |
| `noJackson2` | No Jackson 2 databind/core anywhere in production code; springdoc brings it transitively (SPRING-LIB-04) |
| `noRestTemplate` | `RestClient` / HTTP Service Clients only (SPRING-LIB-06) |
| `noServerOwnedFieldsInRequests` | No owner, tenant, role, permission or audit field in `*Request` records of `adapter.in.rest`, except the reviewed `ADMIN_ASSIGNED_FIELDS` list (SPRING-SEC-34); `allowEmptyShould(true)` until the first request record |
| `everyUseCaseHasACrossUserTest` | Every `@UseCase` (or its incoming port) is called by a test method tagged `cross-user` (or a method of a tagged class) or listed in `NO_CALLER_SUPPLIED_ID` with a reason (scheduled and start-up jobs, own-row use cases, provider-initiated calls) (SPRING-SEC-16) |
| `noRawNumbersInRestRecords` | No `BigDecimal`, `double` or `float` fields in `adapter.in.rest` records except the `ApiDecimal` type (API-REST-01, SPRING-REST-04) |

> `onionArchitecture()` lets adapters see `application`. `adaptersCallPortsNotServices` closes that gap, so adapters reach the core only through `ports.in` (ARCH-SC-07).

## New service

1. Generate the skeleton from start.spring.io with fixed parameters, then apply the baseline: `type=maven-project`, `language=java`, `javaVersion=25`, the pinned Boot version (4.1.x), `dependencies=web,validation,data-jpa,postgresql,flyway,oauth2-resource-server,actuator,kafka,opentelemetry,docker-compose,testcontainers` (drop what the service does not use). The `baseline-spring` skill does this.
2. Replace the generated `pom.xml` build section with `.agents/skills/baseline-spring/templates/pom.reference.xml`; copy `spotbugs-exclude.xml`, `compose.yaml`, `application.yaml` and `application-local.yaml` from the same folder. Two template files must be **renamed** when copied (the template names have no leading dot so they are not hidden): `mvn-jvm.config` → `backend/.mvn/jvm.config`, `sdkmanrc` → `backend/.sdkmanrc`.
3. Create the ring packages with `package-info.java` (`@NullMarked`), the `stereotype` package and `ArchitectureTest` from the templates.
4. Run `./mvnw verify`; it must be green before the first feature.
5. Copy the use-case generator from `.agents/skills/baseline-spring/templates/scripts/` to `tools/` (SPRING-ARCH-19). Copy `scripts/verify-all.sh`/`.cmd` to `backend/` (JAVA-TOOL-24) and the test fakes from `test/support/` (SPRING-TEST-14).

*Agent checklist in [checklists/spring.md](../checklists/spring.md) and sources in [sources.md](../sources.md), section "Spring Boot: Hexagonal Architecture".*

## Related skills

The `baseline-spring` skill loads the right skills for the task (`spring-boot-testing`, `spring-security`, `spring-observability`, `java-hibernate-jpa`, `baseline-tdd`). Where they disagree with this doc on structure or layering, **this doc wins**; the known conflicts are in the [skill overrides table](../stacks/spring.md#skill-overrides).
