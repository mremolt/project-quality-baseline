# Spring Boot: Hexagonal Architecture

The standard structure and wiring for Spring Boot services. It builds on [../java/architecture.md](../java/architecture.md) and the shared docs in [../shared/architecture/](../shared/architecture/).

## Package structure (team standard)

Below the application's base package (where the `@SpringBootApplication` class lives):

```
+- adapter
| +- in
| | +- rest
| | | +- v1
| | +- kafka
| +- out
|   +- kafka
|   +- s3
|   +- jpa
+- application   // business logic; sub-packages by a sensible functional cut
+- domain        // domain objects, including business exceptions
+- ports
  +- in
  +- out
```

*(Proposal from our Java team. The technologies listed are the common ones. Add or omit sub-packages per service.)*

### What goes where

| Package | Contents | May depend on |
|---|---|---|
| `domain` | Entities, value objects (records), domain services, **business exceptions** | nothing else in the app; no Spring, JPA or Jackson |
| `ports.in` | Use-case interfaces (`TransferFundsUseCase`, `GetBalanceQuery`) and their commands/queries/results | `domain` |
| `ports.out` | Interfaces the core needs from the outside (`LoadAccountPort`, `PublishOrderPlacedPort`, `StoreDocumentPort`) | `domain` |
| `application` | One service per use case implementing a `ports.in` interface; `@Transactional` boundary | `domain`, `ports` |
| `adapter.in.rest.v1` | `@RestController`s sliced per use case, package-private request/response records, mapping | `ports.in`, `domain` |
| `adapter.in.rest` | `@RestControllerAdvice` mapping business exceptions to `ProblemDetail` (shared by all versions) | `domain` |
| `adapter.in.kafka` | `@KafkaListener`s: deserialize → map to command → call `ports.in`; error/DLT handling | `ports.in`, `domain` |
| `adapter.out.kafka` | Producers implementing `ports.out`; message schemas/DTOs stay here | `ports.out`, `domain` |
| `adapter.out.s3` | S3 client adapter implementing `ports.out`; no AWS SDK types leave the package | `ports.out`, `domain` |
| `adapter.out.jpa` | `@Entity` classes, Spring Data repositories, mapper, adapter class implementing `ports.out` | `ports.out`, `domain` |
| base package | `@SpringBootApplication` class = composition root | everything |

## Rules

### Structure

- **SPRING-ARCH-01: New services use the package structure above.** Adapter sub-packages are named after the technology. Versioned REST APIs get one package per version (`v1`, `v2`) with their own DTOs (ARCH-ORG-03).
- **SPRING-ARCH-02: There is no separate `config` package.** `@Configuration` classes live next to what they configure (e.g. `adapter.out.jpa.JpaConfiguration`, `adapter.in.kafka.KafkaConsumerConfiguration`), so they can reach package-private classes.
- **SPRING-ARCH-03: Business exceptions live in `domain`** and never extend Spring exceptions (e.g. `ResponseStatusException`). The REST adapter translates them centrally to RFC 9457 `ProblemDetail`. The Kafka adapter decides on retry vs dead-letter.

### Wiring

- **SPRING-ARCH-04: Core beans are found by component scanning using custom stereotype annotations** that make the architecture visible: `@UseCase` (in `application`), `@WebAdapter` / `@MessagingAdapter` / `@PersistenceAdapter` (in `adapter`), each meta-annotated with `@Component`. Scanned classes stay **package-private** (Spring instantiates them reflectively).
- **SPRING-ARCH-05: Feature annotations go on the adapter's own `@Configuration`, never on the main class** (`@EnableJpaRepositories`, `@EntityScan`, `@EnableKafka`, …).
  *Why:* test slices and partial contexts can start without pulling in every infrastructure piece.
- **SPRING-ARCH-06: Constructor injection only** (final fields, single constructor). No field injection.
  *Why:* every class can be instantiated in a plain unit test with mocks.

### Use cases and transactions

- **SPRING-ARCH-07: `@Transactional` goes on application services** (class or use-case method), **never on adapters or controllers** (ARCH-ADP-11). Read-only queries use `@Transactional(readOnly = true)`.
- **SPRING-ARCH-08: Commands are records in `ports.in`** with validation in the compact constructor (JAVA-ARCH-03). If Bean Validation is used on request DTOs in the REST adapter (`@Valid`), it only checks that the request **can be mapped** to the command. It does not duplicate command validation.

### Persistence (JPA)

- **SPRING-ARCH-09: JPA entities and Spring Data repositories are package-private inside `adapter.out.jpa`** and never appear in a port signature.
- **SPRING-ARCH-10: Mapping with JPA (applies D3):**
  - CRUD-style contexts may use *no mapping* (the JPA entity is the domain model), as allowed by [mapping-between-boundaries.md](../shared/architecture/mapping-between-boundaries.md).
  - **Rich domain models use two-way mapping from the start.** JPA's needs (no-arg constructor, mutable fields, proxies, lazy loading) are exactly the persistence concerns that trigger the switch.
- **SPRING-ARCH-11: Keep JPA simple.** Avoid bidirectional associations and cascades that the domain doesn't need. Use one persistence adapter per aggregate. Use plain SQL/JDBC (`JdbcClient`) for ports where JPA adds nothing (ARCH-ADP-13).
- **SPRING-ARCH-16: Query and batch ports load related data in a bounded number of queries** (fetch joins, entity graphs, `IN` queries, or a dedicated `JdbcClient` query), never one query per item (API-N1-05). Persistence tests for these ports assert the number of executed statements (e.g. Hibernate statistics or a datasource proxy).

### REST contract

- **SPRING-ARCH-17: The OpenAPI spec is generated from the controllers, committed and checked in CI.** Details: [openapi.md](openapi.md).

### Messaging & storage

- **SPRING-ARCH-12: Kafka listeners are incoming adapters and producers are outgoing adapters.** Neither contains business logic. Event payload classes (Avro/JSON) stay in their adapter package; the core publishes domain-level events through a port.
- **SPRING-ARCH-13: If an event must be consistent with a database write, don't publish it to Kafka directly inside the use case.** Decide on a pattern such as a transactional outbox and record it as an ADR.
- **SPRING-ARCH-14: Third-party SDK types (AWS S3, HTTP clients) never leave their adapter package.**

## Testing

Implements [testing-by-architecture-element.md](../shared/testing/testing-by-architecture-element.md):

| Element | Spring test setup |
|---|---|
| Domain, application services | Plain JUnit 5 + AssertJ (+ Mockito for ports). **No Spring context.** |
| `adapter.in.rest` | `@WebMvcTest(controllers = XyzController.class)` + `@MockitoBean` for the incoming port (`@MockBean` is deprecated) |
| `adapter.out.jpa` | `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + Testcontainers with `@ServiceConnection` (production DB engine) + `@Import` of the adapter and mapper |
| `adapter.in/out.kafka` | Integration test with a Kafka Testcontainer (or `@EmbeddedKafka`) |
| `adapter.out.s3` | Integration test against LocalStack (Testcontainers) |
| System tests | `@SpringBootTest(webEnvironment = RANDOM_PORT)` with a real HTTP client and Testcontainers. Stub only third-party systems, at their outgoing ports. |

- **SPRING-ARCH-15: Never use H2 or another in-memory DB as a stand-in for the production database** (TEST-ARCH-04).

## Architecture test template

Copy into `src/test/java/<base-package>/ArchitectureTest.java` and adjust the base package and adapter list:

```java
@AnalyzeClasses(packages = "com.example.orders", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule hexagonal = Architectures.onionArchitecture()
        .domainModels("..domain..")
        .domainServices("..ports..")          // ports may only depend on domain
        .applicationServices("..application..")
        .adapter("rest", "..adapter.in.rest..")
        .adapter("kafka-in", "..adapter.in.kafka..")
        .adapter("kafka-out", "..adapter.out.kafka..")
        .adapter("s3", "..adapter.out.s3..")
        .adapter("jpa", "..adapter.out.jpa..")
        .withOptionalLayers(true);            // not every service has every adapter

    @ArchTest
    static final ArchRule adaptersCallPortsNotServices = noClasses()
        .that().resideInAPackage("..adapter..")
        .should().dependOnClassesThat().resideInAPackage("..application..");

    @ArchTest
    static final ArchRule coreIsFrameworkFree = noClasses()
        .that().resideInAnyPackage("..domain..", "..ports..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "org.springframework..", "jakarta.persistence..", "com.fasterxml.jackson..",
            "org.apache.kafka..", "software.amazon..",
            "io.swagger..", "org.springdoc..");   // SPRING-API-07

    // org.springframework.transaction.annotation.Transactional
    @ArchTest
    static final ArchRule noTransactionalAdapterClasses = noClasses()
        .that().resideInAPackage("..adapter..")
        .should().beAnnotatedWith(Transactional.class);

    @ArchTest
    static final ArchRule noTransactionalAdapterMethods = noMethods()
        .that().areDeclaredInClassesThat().resideInAPackage("..adapter..")
        .should().beAnnotatedWith(Transactional.class);

    // jakarta.persistence.Entity. Remove this rule in services without JPA:
    // with failOnEmptyShould it fails when no @Entity exists.
    @ArchTest
    static final ArchRule jpaEntitiesStayInAdapter = classes()
        .that().areAnnotatedWith(Entity.class)
        .should().resideInAPackage("..adapter.out.jpa..")
        .andShould().notBePublic();
}
```

> `onionArchitecture()` lets adapters see `application`. The second rule closes that gap, so adapters reach the core only through `ports.in` (default D1).

## Agent checklist

- [ ] New class in the right package from the table?
- [ ] Stereotype annotation instead of plain `@Component`; class package-private?
- [ ] `@Transactional` only on application services?
- [ ] No JPA/Kafka/AWS/Jackson types in `domain` or `ports`?
- [ ] Test type per the testing table; DB tests use Testcontainers?
- [ ] `ArchitectureTest` green and unchanged (or the change discussed)?

## Related skills

The `springboot-patterns`, `springboot-tdd` and `springboot-verification` skills cover general Spring Boot practice. Where they disagree with this doc on structure or layering, **this doc wins**.

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 5, 6, 7, 9, 10. Package structure: proposal from our Java team. Updated for current Spring (constructor injection, `@MockitoBean`, `@ServiceConnection`, `ProblemDetail`).
