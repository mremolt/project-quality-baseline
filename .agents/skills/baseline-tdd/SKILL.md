---
name: baseline-tdd
description: Test-driven development the way the quality baseline defines it - red, green, refactor in small vertical slices, London (mockist) style by default for use cases and adapters, Chicago (classicist) for domain and pure code. Use when implementing a feature or fixing a bug test-first, when asked for TDD or "red-green-refactor", when deciding what to mock, or when writing unit, adapter or acceptance tests in any stack (TypeScript/Angular with Vitest and vitest-mock-extended, Java/Spring with JUnit and Mockito).
---

# TDD in the quality baseline

Rules: `docs/shared/testing/tdd.md` (`TEST-TDD-*`) and `docs/shared/testing/testing-by-architecture-element.md` (`TEST-ARCH-*`), paths from the project root. Stack details: `docs/typescript/testing.md`, `docs/angular/testing.md`, `docs/spring/architecture.md#testing`. The docs win over this skill.

## Before the first test

1. Identify the architecture element you are about to change (domain, use case, incoming adapter, outgoing adapter, main path).
2. Pick the test type and style from this table (TEST-TDD-15) and say which one you use:

| Element | Test type | Style | Doubles |
|---|---|---|---|
| Domain entity / value object / pure function | Unit | Chicago | none |
| Use case | Unit | London | outgoing ports |
| Controller, listener, component, page, Signal Store | Integration in the framework | London | incoming port / use-case contract |
| Outgoing adapter (HTTP, DB, messaging) | Integration with real technology (MSW, Testcontainers) | Chicago | none inside the adapter |
| Main user path | Acceptance (system / E2E) | outside-in | third-party systems only |

3. For a feature on a main path, start with a failing acceptance test (double loop, TEST-TDD-06).
4. Write a short test list of behaviors. Don't write the tests yet (TEST-TDD-05).

## The cycle (one behavior at a time)

Show each step to the user (TEST-TDD-14):

1. **Red**: write one test for the next behavior. Run it. Show that it fails, and for the expected reason (TEST-TDD-02).
2. **Green**: write the simplest code that passes. Run the tests (TEST-TDD-03).
3. **Refactor**: with everything green, clean up code and tests: names, duplication, structure. Run the tests again (TEST-TDD-04).
4. Cross the behavior off the list; add new behaviors you discovered; continue.

## Doubles

- Mock only contracts we own: ports and use-case interfaces (TEST-TDD-07). TypeScript: `mock<Port>()` from `vitest-mock-extended`; Java: Mockito on the port interface.
- Never mock entities, value objects, concrete classes, or third-party types; wrap third-party code in a port (TEST-TDD-08).
- Stub queries (`calledWith(...).mockResolvedValue(...)`, `when(...).thenReturn(...)`), verify only commands (TEST-TDD-09).
- Too many doubles, or unclear what to mock? That's a design signal: the port or service is too broad (TEST-ARCH-07). Say so.
- A double that would just mirror the implementation → switch to Chicago (TEST-TDD-10).

## Good tests

- Expected values come from a literal, a worked example, or the spec, never recomputed like the code does (TEST-TDD-11).
- Names state behavior in domain language (TEST-TDD-12).
- Bug fix: reproduce with a failing test first (TEST-TDD-13).
- Tests must survive refactoring: no private access, no assertions on internals (TEST-ARCH-08).

## Commands

| Stack | Run |
|---|---|
| TypeScript / Angular | `npm test -- <file>` (watch mode while cycling), `npm run e2e -- <spec>` for acceptance tests |
| Java / Spring | `./mvnw test -Dtest=<Class>` or `./gradlew test --tests <Class>` |
