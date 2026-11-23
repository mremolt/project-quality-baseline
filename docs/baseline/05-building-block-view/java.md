# Java: Hexagonal Architecture

How the shared architecture rules are implemented in plain Java (Java 25, see [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md)). Spring Boot specifics are in [05-building-block-view/spring.md](spring.md). Read the shared docs first: this file only adds Java-specific details.

Implements: [hexagonal-architecture](../04-solution-strategy/hexagonal-architecture.md) · [code-organization](code-organization.md) · [use-cases](use-cases.md) · [enforcing-boundaries](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md)

## Package layout

The shared reference layout becomes packages below the base package (e.g. `com.example.orders`):

```
com.example.orders
├── adapter.in.rest.v1
├── adapter.in.kafka
├── adapter.out.jpa
├── adapter.out.s3
├── application[.<functional-cut>]
├── domain
├── ports.in
└── ports.out
```

With several bounded contexts, use `com.example.<context>.{adapter,application,domain,ports}`.

Every package has a `package-info.java` with `@NullMarked` (JAVA-TOOL-08).

## Visibility

- **JAVA-ARCH-01: Package-private is the default visibility.** `public` only where the architecture requires it:

| Package | Visibility |
|---|---|
| `domain` | public (used by every ring) |
| `ports.in`, `ports.out` | public: interfaces and their command/query/result types |
| `application` | services **package-private** (reachable only via `ports.in`) |
| `adapter.*` | **package-private**: reachable only through the ports they implement or the framework that calls them |

Checked by ArchUnit: with Spring, `stereotypedClassesArePackagePrivate` in the template; in plain Java, `adaptersCallPortsNotServices` and the ring rules below make sure that only the composition root reaches services and adapters, even where JAVA-ARCH-11 forces them to be `public`.

- **JAVA-ARCH-02: Sub-packages break package-private.** Java treats `a.b` and `a.b.c` as unrelated. When a package grows and gets sub-packages, the types that cross them become public. Those boundaries must then be protected by ArchUnit (JAVA-ARCH-07).

## Commands, queries and value objects

- **JAVA-ARCH-03: Commands, queries, results and value objects are `record`s** that validate in the compact constructor (the Java mechanism for ARCH-UC-05). Invalid input throws the domain validation exception (JAVA-ARCH-12).

```java
// ports/in
public record TransferFundsCommand(AccountId source, AccountId target, Money amount) {
    public TransferFundsCommand {
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(amount, "amount");
        if (!amount.isPositive()) {
            throw new DomainValidationException("amount", "amount.not-positive");
        }
    }
}

// domain
public record AccountId(long value) {}
```

- **JAVA-ARCH-04: ARCH-UC-06 in Java is the canonical record constructor; no builders for commands.** IDE parameter-name hints keep long argument lists readable.
- **JAVA-ARCH-05: Bean Validation (`jakarta.validation`) is optional** for declarative checks on commands. If used, validation still runs **at construction** (e.g. a small `SelfValidating` helper that validates and throws the domain validation exception, JAVA-ARCH-12), not later in the service. Hand-written checks are fine for rules annotations can't express.
- **JAVA-ARCH-06: Domain entities protect their invariants.** No public setters. State changes go through behaviour methods (`withdraw(...)`), creation through constructors or static factories (`Account.withId(...)`, `Account.withoutId(...)`) that only produce valid objects.

## Enforcing boundaries with ArchUnit

- **JAVA-ARCH-07: Every project has an ArchUnit test class** (JUnit Jupiter) that checks the dependency table from [05-building-block-view/code-organization.md](code-organization.md). Spring projects use the ready-made template in [05-building-block-view/spring.md](spring.md#architecture-test-template). Plain Java projects need at least the rules below (names as in the Spring template), plus ArchUnit's `GeneralCodingRules` for field injection, standard streams and `java.util.logging`. `domain` and `ports` get an allow-list (ARCH-DEP-02): the JDK, the own code and JSpecify; add `jakarta.validation` to `ports` if JAVA-ARCH-05 is used:

```java
@AnalyzeClasses(packages = "com.example.orders", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule domainDependsOnlyOnItself = classes()
        .that().resideInAPackage("..domain..")
        .should().onlyDependOnClassesThat()
        .resideInAnyPackage("java..", "..domain..", "org.jspecify..");

    @ArchTest
    static final ArchRule portsDependOnlyOnDomain = classes()
        .that().resideInAPackage("..ports..")
        .should().onlyDependOnClassesThat()
        .resideInAnyPackage("java..", "..domain..", "..ports..", "org.jspecify..");

    @ArchTest
    static final ArchRule applicationDoesNotKnowAdapters = noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAPackage("..adapter..");

    @ArchTest
    static final ArchRule adaptersCallPortsNotServices = noClasses()
        .that().resideInAPackage("..adapter..")
        .should().dependOnClassesThat().resideInAPackage("..application..");

    @ArchTest
    static final ArchRule adaptersAreIndependent = slices()
        .matching("..adapter.(*).(*)..")
        .should().notDependOnEachOther();

    @ArchTest
    static final ArchRule noCycles = slices()
        .matching("com.example.orders.(**)")
        .should().beFreeOfCycles();
}
```

- **JAVA-ARCH-08: Never disable `archRule.failOnEmptyShould`** (enabled by default in current ArchUnit versions). It makes a rule fail when it matches no classes, e.g. after a package rename (ARCH-ENF-02). `allowEmptyShould(true)` only on a single rule, with a comment, for the bootstrap case of ARCH-ENF-02 (the template's `jpaEntitiesStayInAdapter`, `httpClientAdaptersLiveInAdapterOutHttp` and `noServerOwnedFieldsInRequests` until their first class) or for an opt-in rule such as `secretsUseSecretType`.

## Build modules (Maven / Gradle)

- **JAVA-ARCH-09: Build modules are split once the architecture is stable, in the order of [ARCH-ENF-06](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md).** In Maven or Gradle the cuts become modules such as `app-configuration`, `adapter-rest`, `adapter-jpa`, `app-ports`, `app-core`.
- **JAVA-ARCH-10: Dependencies between modules are declared explicitly** in the build file and reviewed (ARCH-ENF-07). Maven and Gradle reject cycles between modules by design.

## Composition root without a framework

- **JAVA-ARCH-11: A plain-Java application wires everything in one place** (e.g. `Application.main` or a `Wiring` class in the base package): create adapters, create services with ports injected through constructors, hand services to the incoming adapters.
- Downside: hand-wiring from another package forces those classes to be `public`. In that case ArchUnit is the only protection against misuse. A DI framework that can instantiate package-private classes (like Spring with component scanning) avoids this.

## Validation errors

- **JAVA-ARCH-12: Invalid input throws one dedicated exception from `domain`** (the validation category of ARCH-UC-13) (e.g. `DomainValidationException extends RuntimeException`, carrying a stable error code and, where known, the field). Commands, queries, value objects and entities throw it when a business or format rule is violated; nothing in the core throws a bare `IllegalArgumentException` for invalid input. `Objects.requireNonNull` stays: a `null` there is a programming error, because the adapter checks mappability first (SPRING-ARCH-08).
  *Why:* adapters must tell "the caller sent bad data" (400, not retryable) from "our code has a bug" (500, alert). Mapping every `IllegalArgumentException` to 400 would hide bugs; mapping none would turn bad input into server errors and endless retries. Spring mapping: SPRING-ARCH-18.
- **JAVA-ARCH-13: Each business error category of ARCH-UC-13 has one abstract base type in `domain`:** `BusinessRuleException`, `NotFoundException`, `AccessDeniedException`, `ConflictException`, each extending `RuntimeException` and carrying a stable error code. Concrete business exceptions (`InsufficientFundsException extends BusinessRuleException`) extend exactly one of them. Adapters classify by base type, never by concrete class (SPRING-ARCH-18). The domain `AccessDeniedException` shares its simple name with Spring Security's; the advice imports the domain one, the security chain handles Spring's (SPRING-REST-14).

## Time

- **JAVA-ARCH-14: Time comes from one `java.time.Clock` bean, and ArchUnit bans every other source of the current time (ARCH-UC-20).** The composition root defines `Clock.systemUTC()` (in Spring, a `@Bean` in the configuration package; in plain Java, in the wiring class). Services and adapters take the `Clock` in their constructor and call `Instant.now(clock)` / `clock.instant()`, and the business date comes from one domain function such as `BusinessCalendar.dateOf(instant)` in the product's zone. The ArchUnit rule `noDirectClockAccess` in the template forbids calls to `Instant.now()`, `LocalDate.now()`, `LocalDateTime.now()`, `LocalTime.now()`, `ZonedDateTime.now()`, `OffsetDateTime.now()`, `YearMonth.now()`, `Clock.systemDefaultZone()`, `Clock.systemUTC()` and `System.currentTimeMillis()` outside the package that defines the bean (`config` in the Spring template). Tests pass `Clock.fixed(…)` (TEST-TDD-16).
  *Why:* a single `LocalDate.now()` in an adapter is enough to make a rule untestable. It also silently uses the JVM's zone instead of the business zone.

*Agent checklist in [checklists/java.md](../checklists/java.md) and sources in [sources.md](../sources.md), section "Java: Hexagonal Architecture".*
