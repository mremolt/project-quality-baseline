# Java: Hexagonal Architecture

How the shared architecture rules are implemented in plain Java (Java 21+). Spring Boot specifics are in [../spring/architecture.md](../spring/architecture.md). Read the shared docs first: this file only adds Java-specific details.

Implements: [hexagonal-architecture](../shared/architecture/hexagonal-architecture.md) · [code-organization](../shared/architecture/code-organization.md) · [use-cases](../shared/architecture/use-cases.md) · [enforcing-boundaries](../shared/architecture/enforcing-boundaries.md)

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

## Visibility

- **JAVA-ARCH-01: Package-private is the default visibility.** `public` only where the architecture requires it:

| Package | Visibility |
|---|---|
| `domain` | public (used by every ring) |
| `ports.in`, `ports.out` | public: interfaces and their command/query/result types |
| `application` | services **package-private** (reachable only via `ports.in`) |
| `adapter.*` | **package-private**: reachable only through the ports they implement or the framework that calls them |

- **JAVA-ARCH-02: Sub-packages break package-private.** Java treats `a.b` and `a.b.c` as unrelated. When a package grows and gets sub-packages, the types that cross them become public. Those boundaries must then be protected by ArchUnit (JAVA-ARCH-07).

## Commands, queries and value objects

- **JAVA-ARCH-03: Commands, queries, results and value objects are `record`s** that validate in the compact constructor. An invalid instance cannot exist (ARCH-UC-05).

```java
// ports/in
public record TransferFundsCommand(AccountId source, AccountId target, Money amount) {
    public TransferFundsCommand {
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(amount, "amount");
        if (!amount.isPositive()) {
            throw new IllegalArgumentException("amount must be positive");
        }
    }
}

// domain
public record AccountId(long value) {}
```

- **JAVA-ARCH-04: No builders for commands** (ARCH-UC-06). The canonical record constructor makes the compiler flag every call site when a component is added. IDE parameter-name hints keep long argument lists readable.
- **JAVA-ARCH-05: Bean Validation (`jakarta.validation`) is optional** for declarative checks on commands. If used, validation still runs **at construction** (e.g. a small `SelfValidating` helper that validates and throws), not later in the service. Hand-written checks are fine for rules annotations can't express.
- **JAVA-ARCH-06: Domain entities protect their invariants.** No public setters. State changes go through behaviour methods (`withdraw(...)`), creation through constructors or static factories (`Account.withId(...)`, `Account.withoutId(...)`) that only produce valid objects.

## Enforcing boundaries with ArchUnit

- **JAVA-ARCH-07: Every project has an ArchUnit test class** (JUnit 5) that checks the dependency table from [code-organization.md](../shared/architecture/code-organization.md). Spring projects use the ready-made template in [../spring/architecture.md](../spring/architecture.md#architecture-test-template). Plain Java projects need at least:

```java
@AnalyzeClasses(packages = "com.example.orders", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule domainDependsOnNothingOutside = noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .resideInAnyPackage("..application..", "..ports..", "..adapter..");

    @ArchTest
    static final ArchRule portsOnlyDependOnDomain = noClasses()
        .that().resideInAPackage("..ports..")
        .should().dependOnClassesThat()
        .resideInAnyPackage("..application..", "..adapter..");

    @ArchTest
    static final ArchRule applicationDoesNotKnowAdapters = noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAPackage("..adapter..");

    @ArchTest
    static final ArchRule adaptersUsePortsNotServices = noClasses()
        .that().resideInAPackage("..adapter..")
        .should().dependOnClassesThat().resideInAPackage("..application..");

    @ArchTest
    static final ArchRule adaptersAreIndependent = slices()
        .matching("..adapter.(*).(*)..")
        .should().notDependOnEachOther();

    @ArchTest
    static final ArchRule noCycles = slices()
        .matching("com.example.orders.(*)..")
        .should().beFreeOfCycles();
}
```

- **JAVA-ARCH-08: Never disable `archRule.failOnEmptyShould`** (enabled by default in current ArchUnit versions). It makes a rule fail when it matches no classes, e.g. after a package rename (ARCH-ENF-02).

## Build modules (Maven / Gradle)

- **JAVA-ARCH-09: Start with one module, and split once the architecture is stable** (ARCH-ENF-06). Typical progression:
  1. `app-configuration` → `app-adapters` → `app-core` (application + domain + ports)
  2. one module per adapter (`adapter-rest`, `adapter-jpa`, …)
  3. separate `ports` module, so adapters can't reach services or domain internals
  4. `domain` separate from `application`
- **JAVA-ARCH-10: Dependencies between modules are declared explicitly** in the build file and reviewed (ARCH-ENF-07). Maven and Gradle reject cycles between modules by design.

## Composition root without a framework

- **JAVA-ARCH-11: A plain-Java application wires everything in one place** (e.g. `Application.main` or a `Wiring` class in the base package): create adapters, create services with ports injected through constructors, hand services to the incoming adapters.
- Downside: hand-wiring from another package forces those classes to be `public`. In that case ArchUnit is the only protection against misuse. A DI framework that can instantiate package-private classes (like Spring with component scanning) avoids this.

## Agent checklist

- [ ] New types are package-private unless they're domain, port or port model?
- [ ] Commands, results and value objects are records with compact-constructor validation?
- [ ] ArchUnit test still green, and not weakened?
- [ ] No setters on domain entities?

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 3, 4, 9, 10. The book uses Lombok and mutable getters in places; this baseline updates those parts to Java records.
