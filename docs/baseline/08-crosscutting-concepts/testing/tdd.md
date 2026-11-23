# Test-Driven Development

How and when we write tests: test first, in small red → green → refactor cycles. [08-crosscutting-concepts/testing/testing-by-architecture-element.md](testing-by-architecture-element.md) defines *which* test type, TDD style and doubles each architecture element gets, in [one table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element). This doc defines the *workflow* and the two styles.

## The two styles

| | **London** (mockist, outside-in) | **Chicago** (classicist, inside-out) |
|---|---|---|
| Unit under test | One class/module; collaborators are replaced by test doubles | A unit plus its real collaborators |
| Direction | Start at the entry point (adapter, use case) and discover the collaborators' interfaces by needing them | Start at the domain and build up |
| Assertions | Outcome **and** essential interactions with collaborators | Resulting state and return values |
| Strength | Drives narrow interfaces (ports) and keeps each test small and fast | Tests survive refactorings across collaborators; no doubles to maintain |
| Risk | Over-specified tests that break on refactoring | Larger failure radius; setup can grow |

**Our default is London, but not religiously.** London matches the hexagonal architecture: ports are exactly the contracts London-style tests mock, and needing a collaborator in a test is how a new port gets discovered. Chicago is the better fit wherever interactions are not the behavior. Mixing both in one codebase, even in one feature, is expected.

## Style per architecture element

The style per element (Chicago for domain and pure code, London for use cases and incoming adapters, Chicago against the real technology for outgoing adapters, outside-in for main paths) is part of the element table in [testing-by-architecture-element.md](testing-by-architecture-element.md#test-type-style-and-doubles-per-element).

## Rules

### The loop

- **TEST-TDD-01: Production code is written to make a failing test pass.** Exceptions: spikes (thrown away afterwards), generated code, pure configuration.
- **TEST-TDD-02: Red first, and for the right reason.** Run the new test and see it fail with the expected message before writing the implementation. A test that never failed may be testing nothing.
- **TEST-TDD-03: Green with the simplest code that passes.** No speculative features, no code for the next test.
- **TEST-TDD-04: Refactor is part of every cycle**, with all tests green: remove duplication, improve names, and also clean up the tests. Skipping it is how TDD codebases rot.
- **TEST-TDD-05: One behavior per cycle, in vertical slices.** Keep a short test list of behaviors to cover, but write the tests one at a time. Each test is a tracer bullet that responds to what the last cycle taught you.
  *Why:* writing all tests first ("horizontal slicing") tests imagined behavior and commits to a test structure before the design is understood.
- **TEST-TDD-06: For features on a main user path, use the double loop.** Start with a failing acceptance test for the user-visible path, then drive the inner units with unit and integration tests until it passes. The acceptance test is the system test of the component that owns the path: a frontend system test (backend stubbed from the contract) for a UI path, a backend system test for an API-only path (TEST-ARCH-05). Full-stack system tests are too slow for the inner loop; they are added for critical paths, not driven test by test.

### Doubles

- **TEST-TDD-07: London style mocks only contracts we own**: ports and use-case interfaces. Never mock concrete classes, value objects, domain entities or private helpers.
- **TEST-TDD-08: Don't mock what you don't own.** Third-party types (HTTP clients, SDKs, framework services) are wrapped behind a port. The port is mocked in use-case tests; the adapter is tested against the real technology.
- **TEST-TDD-09: Mock commands, stub queries.** Verify an interaction only when the interaction *is* the behavior (e.g. "the order was saved", "the event was published"). For collaborators that only return data, stub the answer and assert on the outcome; don't verify the call.
  *Why:* verifying every call couples the test to the implementation (TEST-ARCH-02, TEST-ARCH-08).
- **TEST-TDD-10: Switch to Chicago when a double would duplicate the implementation**: the collaborator is a pure function or value, the interaction carries no meaning, or the test would need more doubles than assertions (also a design warning, TEST-ARCH-07).

### Good tests

- **TEST-TDD-11: Expected values come from an independent source of truth**: a literal, a worked example, the spec. Never recompute them the way the code does.
  *Why:* a tautological test (`expect(add(a, b)).toBe(a + b)`) passes by construction and can never disagree with the code.
- **TEST-TDD-12: Test names state behavior in domain language** ("rejects a transfer that would overdraw the account"), not method names.
- **TEST-TDD-13: Every bug fix starts with a failing regression test** that reproduces the bug (TEST-ARCH-11).
- **TEST-TDD-16: Test data is explicit and deterministic.** Objects are built with test data builders (or factory functions) that give valid defaults, and each test sets only the values it is about. Time comes from an injected clock fixed in the test (production code reads it only there, ARCH-UC-20), ids from an injected generator or fixed literals; no `now()`, random values or generated UUIDs that the test cannot control. Generated data (property-based tests, fakers) uses a fixed, logged seed. Test data is synthetic, never copied from production (DP-ENV-01).
  *Why:* a test that depends on the current time, a random id or a shared fixture fails on some days, some machines or some orders, and nobody trusts a flaky suite. Builders keep the test readable and survive new mandatory fields (TEST-ARCH-08).
- **TEST-TDD-17: Fake-data libraries SHOULD be used only for volume and realism, not for the values a test asserts on.** Hand-written builders with literal defaults (TEST-TDD-16) are the default for unit, adapter and system tests. A faker is the right tool for seed data in local development and non-production environments (DP-ENV-01), for large data sets (paging, N+1 checks, API-N1, performance runs) and for layout and i18n checks with long or accented names. A builder MAY take its defaults from a seeded faker, as long as every value the test asserts on is set explicitly. Property-based tests generate inputs with a library and a fixed, logged seed (TEST-TDD-16). Reference tools (replaceable): TypeScript `@faker-js/faker` (`faker.seed(n)`) and `fast-check`; Java Datafaker (`new Faker(new Random(seed))`), Instancio (with a fixed seed) and jqwik.
  *Why:* a random value in an assertion hides which input mattered and makes a failure hard to reproduce. For volume data and realistic shapes, hand-writing values is wasted effort.

### Agents

- **TEST-TDD-14: Agents work in visible cycles.** For each behavior: name it, write the test, run it and show the failure, implement, run again, refactor. Agents MUST NOT write implementation and its tests in one step and present them as test-driven.
- **TEST-TDD-15: Agents pick the style from the [element table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element)** and say so when it deviates (e.g. "Chicago here, because the mapper is a pure function").

## Anti-patterns

- Tests written after the code and then "made to fail" by breaking the code once.
- All tests of a feature written up front, then all the implementation.
- Mocking an entity or value object instead of creating a real one.
- Verifying every call on every mock, including queries.
- Mocking an HTTP client or ORM directly in a use-case test.
- Tests that read the expected value from the code under test.
- Skipping the refactor step "because it's green".
- `new Date()`, `Instant.now()` or random ids inside the code under test, then asserting "roughly now".

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Test-Driven Development".*
