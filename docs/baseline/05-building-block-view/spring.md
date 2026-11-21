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
|   +- metrics
+- application   // business logic; sub-packages by a sensible functional cut
+- domain        // domain objects, including business exceptions
+- ports
| +- in
| +- out
+- stereotype    // @UseCase, @WebAdapter, @PersistenceAdapter, @MessagingAdapter, @SchedulingAdapter, @MetricsAdapter
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
| `adapter.in.scheduling` | `@Scheduled` jobs (retention, purges, polling) that call `ports.in`, under a cluster lock (SPRING-RES-12, SPRING-DP-01) | `ports.in`, `domain` |
| `adapter.out.kafka` | Producers implementing `ports.out`; message schemas/DTOs stay here | `ports.out`, `domain` |
| `adapter.out.s3` | S3 client adapter implementing `ports.out`; no AWS SDK types leave the package | `ports.out`, `domain` |
| `adapter.out.http` | REST client adapters implementing `ports.out`; generated client and DTOs in `generated` (SPRING-LIB-06) | `ports.out`, `domain` |
| `adapter.out.jpa` | `@Entity` classes, Spring Data JPA repositories, mapper, adapter class implementing `ports.out`; may also run `JdbcClient` queries for the same aggregate | `ports.out`, `domain` |
| `adapter.out.jdbc` | Persistence adapters built only on `JdbcClient` (read models, reporting, bulk updates; SPRING-DB-15), row mappers | `ports.out`, `domain` |
| `adapter.out.metrics` | Business metrics: implements a metrics port from `ports.out` with Micrometer's `MeterRegistry` (SPRING-OBS-06) | `ports.out`, `domain` |
| `stereotype` | The six stereotype annotations (SPRING-ARCH-04); contains nothing else | Spring only |
| `config` | Support types shared by the properties records of several adapters (`Secret`, SPRING-CFG-11); contains nothing else | nothing |
| base package | `@SpringBootApplication` class = composition root | everything |

`stereotype` and `config` are the Spring support packages that ARCH-ORG-01 allows besides the rings; the architecture test (`everyClassHasAHome`) rejects any other package.

## Rules

### Structure

- **SPRING-ARCH-01: New services use the package structure above.** Adapter sub-packages are named after the technology. Versioned REST APIs get one package per version (`v1`, `v2`) with their own DTOs (ARCH-ORG-03).
- **SPRING-ARCH-02: `@Configuration` classes never go into a separate configuration package.** They live next to what they configure (e.g. `adapter.out.jpa.JpaConfiguration`, `adapter.in.kafka.KafkaConsumerConfiguration`), so they can reach package-private classes. The `config` support package holds only shared types such as `Secret` (SPRING-CFG-11).
- **SPRING-ARCH-03: Business exceptions never extend Spring exceptions** (e.g. `ResponseStatusException`). Placement and categories: ARCH-ORG-05, ARCH-UC-13; translation: ARCH-ADP-05, in Spring by SPRING-REST-07 and SPRING-ARCH-18.

### Wiring

- **SPRING-ARCH-04: Core beans are found by component scanning using custom stereotype annotations** that make the architecture visible: `@UseCase` (in `application`), `@WebAdapter` / `@MessagingAdapter` / `@PersistenceAdapter` / `@SchedulingAdapter` (`adapter.in.scheduling`, SPRING-RES-12) / `@MetricsAdapter` (`adapter.out.metrics`, SPRING-OBS-06) (in `adapter`), each meta-annotated with `@Component`. The annotations live in `<base>.stereotype` (templates in `.agents/skills/baseline-spring/templates/stereotype/`). Scanned classes stay **package-private** (Spring instantiates them reflectively); the architecture test checks it (`stereotypedClassesArePackagePrivate`).
- **SPRING-ARCH-05: Feature annotations go on the adapter's own `@Configuration`, never on the main class** (`@EnableJpaRepositories`, `@EntityScan`, `@EnableKafka`, …).
  *Why:* test slices and partial contexts can start without pulling in every infrastructure piece.
- **SPRING-ARCH-06: Constructor injection only** (final fields, single constructor). No field injection.
  *Why:* every class can be instantiated in a plain unit test with mocks.

### Use cases and transactions

- **SPRING-ARCH-07: The transaction boundary of ARCH-UC-11 is Spring's `@Transactional` on the application service**, on the class or on the use-case method; read-only queries use `@Transactional(readOnly = true)`. A use case that calls a remote port puts it on the method that only touches the database, not on the class, or uses a `TransactionTemplate` (SPRING-RES-03, RES-TX-01). `jakarta.transaction.Transactional` is not used.
- **SPRING-ARCH-08: Commands are records in `ports.in`** (mechanism for ARCH-UC-05/06: JAVA-ARCH-03/04). If Bean Validation is used on request DTOs in the REST adapter (`@Valid`), it only checks that the request **can be mapped** to the command. It does not duplicate command validation.

### Persistence

- **SPRING-ARCH-09: JPA entities and Spring Data repositories are package-private inside `adapter.out.jpa`** and never appear in a port signature.
- **SPRING-ARCH-10: The JPA entity is never the domain model; persistence always uses two-way mapping** (tightens D3 and ARCH-MAP-02/03 of [08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md)). The *no mapping* strategy is not available in Spring services, for CRUD contexts neither. For simple CRUD keep the domain type a small record and the mapper trivial; read-only queries may project straight into port result records in the adapter (JPQL constructor expressions, `JdbcClient` row mappers), so no entity crosses the port.
  *Why:* JPA's needs (no-arg constructor, mutable fields, proxies, lazy loading) are exactly the persistence concerns that trigger the switch in ARCH-MAP-02, and they are present from the first entity. The architecture test forbids `jakarta.persistence` in `domain`/`ports` and keeps entities in the adapter (SPRING-ARCH-09), so a shared entity model could not pass it anyway.
- **SPRING-ARCH-11: Keep JPA simple.** (Database rules: [08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md).) Avoid bidirectional associations and cascades that the domain doesn't need. Use one persistence adapter per aggregate. Use plain SQL (`JdbcClient`) for ports where JPA adds nothing (ARCH-ADP-13, SPRING-DB-15). Bounded data loading: SPRING-ARCH-16 below.

### Messaging & storage

- **SPRING-ARCH-12: Kafka listeners are incoming adapters and producers are outgoing adapters.** Neither contains business logic. Event payload classes (Avro/JSON) stay in their adapter package; the core publishes domain-level events through a port.
- **SPRING-ARCH-13: If an event must be consistent with a database write, don't publish it to Kafka directly inside the use case.** The default is a transactional outbox (MSG-PUB-02); the Spring implementation is SPRING-MSG-07 ([08-crosscutting-concepts/messaging/spring.md](../08-crosscutting-concepts/messaging/spring.md)). Change-data capture instead needs an ADR (SPRING-LIB-11).
- **SPRING-ARCH-14: Third-party SDK types (AWS S3, HTTP clients) never leave their adapter package.**

### Test database

- **SPRING-ARCH-15:** See [TEST-ARCH-04](../08-crosscutting-concepts/testing/testing-by-architecture-element.md) (no in-memory stand-in for the production database).

### Data loading

- **SPRING-ARCH-16:** See [API-N1-05](../08-crosscutting-concepts/api/avoiding-n-plus-one.md) (bounded number of queries per query or batch port) and SPRING-TEST-06 (statement-count tests).

### REST contract

- **SPRING-ARCH-17:** See [spring-openapi.md](../08-crosscutting-concepts/api/spring-openapi.md) (spec generated, committed, checked in CI) and [spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md) (URLs, JSON, errors).

### Validation errors

- **SPRING-ARCH-18: Every incoming adapter maps the error categories of ARCH-UC-13 explicitly, by their base types in `domain`.** The REST advice maps the domain validation exception (JAVA-ARCH-12) to 400 `application/problem+json` with its code and an `errors` entry, and the business exceptions to their status and `code` (SPRING-REST-07, SPRING-I18N-02). The Kafka error handler classifies the validation exception and the business-rule and not-found exceptions as not retryable (`DefaultErrorHandler.addNotRetryableExceptions(DomainValidationException.class, BusinessRuleException.class, NotFoundException.class)`, SPRING-MSG-05), so the record goes straight to the dead-letter topic; a listener for which the rejection is an expected outcome catches that one exception, acknowledges and logs instead (MSG-ERR-01). A `ConflictException` (including an optimistic-lock failure) is retried with backoff (RES-RTY-02) and then dead-lettered. Any exception that is neither the validation exception nor a business exception, including `IllegalArgumentException`, is a bug: 500 with a generic `ProblemDetail` (SPRING-SEC-18) in REST, retry with backoff and then the dead-letter topic in Kafka.
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
| `jpaEntitiesStayInAdapter` | `@Entity` only in `adapter.out.jpa`, not public (SPRING-ARCH-09). Remove in services without JPA: with `failOnEmptyShould` it fails when no `@Entity` exists |
| `stereotypedClassesArePackagePrivate` | Classes with a stereotype annotation are not public (JAVA-ARCH-01, SPRING-ARCH-04) |
| `useCasesLiveInApplication` | `@UseCase` only in `application` (SPRING-ARCH-04) |
| `everyClassHasAHome` | Every class is in a ring, an `adapter.<in\|out>.<technology>` package, the composition root, `stereotype` or `config` (ARCH-ORG-01, SPRING-ARCH-01) |
| `noFieldInjection`, `noStandardStreams`, `noJavaUtilLogging` (`GeneralCodingRules`) | SPRING-ARCH-06, SPRING-LOG-01 |
| `noJackson2` | No Jackson 2 databind/core anywhere in production code; springdoc brings it transitively (SPRING-LIB-04) |
| `noRestTemplate` | `RestClient` / HTTP Service Clients only (SPRING-LIB-06) |
| `noRawNumbersInRestRecords` | No `BigDecimal`, `double` or `float` fields in `adapter.in.rest` records except the `ApiDecimal` type (API-REST-01, SPRING-REST-04) |

> `onionArchitecture()` lets adapters see `application`. `adaptersCallPortsNotServices` closes that gap, so adapters reach the core only through `ports.in` (ARCH-SC-07).

## New service

1. Generate the skeleton from start.spring.io with fixed parameters, then apply the baseline: `type=maven-project`, `language=java`, `javaVersion=25`, the pinned Boot version (4.1.x), `dependencies=web,validation,data-jpa,postgresql,flyway,oauth2-resource-server,actuator,kafka,opentelemetry,docker-compose,testcontainers` (drop what the service does not use). The `baseline-spring` skill does this.
2. Replace the generated `pom.xml` build section with `.agents/skills/baseline-spring/templates/pom.reference.xml`; copy `spotbugs-exclude.xml`, `compose.yaml`, `application.yaml` and `application-local.yaml` from the same folder. Two template files must be **renamed** when copied (the template names have no leading dot so they are not hidden): `mvn-jvm.config` → `backend/.mvn/jvm.config`, `sdkmanrc` → `backend/.sdkmanrc`.
3. Create the ring packages with `package-info.java` (`@NullMarked`), the `stereotype` package and `ArchitectureTest` from the templates.
4. Run `./mvnw verify`; it must be green before the first feature.

*Agent checklist in [checklists/spring.md](../checklists/spring.md) and sources in [sources.md](../sources.md), section "Spring Boot: Hexagonal Architecture".*

## Related skills

The `baseline-spring` skill loads the right skills for the task (`spring-boot-testing`, `spring-security`, `spring-observability`, `java-hibernate-jpa`, `baseline-tdd`). Where they disagree with this doc on structure or layering, **this doc wins**; the known conflicts are in the [skill overrides table](../stacks/spring.md#skill-overrides).
