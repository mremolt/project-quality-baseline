# Enforcing Architecture Boundaries

Architecture erodes when nothing stops it. Code review and good intentions are not enforcement. **A broken boundary must fail the build.** "Enforcing a boundary" means making sure every dependency points in the allowed direction (see the table in [code-organization.md](code-organization.md)).

## Three tools, combined

| Tool | What it catches | Limits |
|---|---|---|
| **1. Language visibility** (package-private, non-exported modules, barrel files) | Accidental use of adapter internals and service implementations, already at compile time. | Usually stops at one package/folder level; sub-packages often force things to be public. |
| **2. Automated architecture tests** in the regular test suite / CI (ArchUnit, dependency-cruiser, eslint boundary rules, …) | Wrong-direction dependencies between any packages/folders, including public ones. | Must be maintained alongside the code. A typo or rename can make the test check nothing. |
| **3. Separate build modules** (Maven/Gradle modules, workspace packages, libraries) | Illegal dependencies become impossible: classes aren't even on the classpath. No cycles allowed. Every dependency is declared explicitly. | Build overhead; more mapping between modules. Only worth it once the architecture is stable. |

## Rules (default D4)

- **ARCH-ENF-01: Every project MUST have automated architecture tests from day one** that check the dependency rule for the reference layout.
- **ARCH-ENF-02: Architecture tests MUST fail if they match no classes/files.**
  *Why:* a renamed package or a typo otherwise produces a green test that checks nothing.
- **ARCH-ENF-03: Use the narrowest visibility the language offers** for adapter internals and service implementations.
- **ARCH-ENF-04: Adapters MUST NOT depend on each other**, and the architecture tests check this as well. It is the rule most often broken by accident.
- **ARCH-ENF-05: Cyclic dependencies between packages/modules are forbidden** and should be checked.
- **ARCH-ENF-06: Consider build-module splits once the architecture is stable.** Typical cuts, from coarse to fine:
  1. configuration | adapters | application (incl. domain)
  2. one module per adapter
  3. a separate ports/API module, so adapters can't reach domain internals or services (this rules out "no mapping")
  4. ports split into in and out; domain separate from application services, so other apps can reuse the domain
  The finer the cut, the stronger the control and the more mapping is required.
- **ARCH-ENF-07: Adding an inter-module dependency is a reviewed decision**, never a quick fix for a compile error.

## Agent checklist

- [ ] Do architecture tests exist and run in CI?
- [ ] Did my change require loosening an architecture test? Then stop and raise it, or record an ADR. Don't silently relax the rule.
- [ ] Are new adapter classes as hidden as the language allows?

## Tech-specific implementation

- Java: ArchUnit + package-private, Maven/Gradle modules: [java/architecture.md](../../java/architecture.md)
- Spring Boot: ArchUnit template for our layout: [spring/architecture.md](../../spring/architecture.md)
- TypeScript frontend: dependency-cruiser / ESLint boundaries, `index.ts` public APIs: [typescript/frontend-architecture.md](../../typescript/frontend-architecture.md)

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 10 (Enforcing Architecture Boundaries), ch. 1 (shortcuts in layered architectures).
