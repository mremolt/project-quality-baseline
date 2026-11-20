# Test-Driven Development

How and when we write tests: test first, in small red → green → refactor cycles. [testing-by-architecture-element.md](testing-by-architecture-element.md) defines *which* test type each architecture element gets. This doc defines the *workflow*, and which TDD style fits which element.

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

| Element | Style | Doubles |
|---|---|---|
| Domain entity, value object, domain service | Chicago | none (TEST-ARCH-01) |
| Use case (application service) | London | outgoing ports (TEST-ARCH-02) |
| Incoming adapter: controller, listener, UI component, view-state store | London | incoming port / use-case contract (TEST-ARCH-03) |
| Outgoing adapter | Chicago against the real technology | nothing inside the adapter (TEST-ARCH-04) |
| Small cohesive cluster (mapper + schema, a value-object family, pure helper functions) | Chicago | none |
| Main user path | Outside-in acceptance test (system / E2E) | only third-party systems (TEST-ARCH-05) |

## Rules

### The loop

- **TEST-TDD-01: Production code is written to make a failing test pass.** Exceptions: spikes (thrown away afterwards), generated code, pure configuration.
- **TEST-TDD-02: Red first, and for the right reason.** Run the new test and see it fail with the expected message before writing the implementation. A test that never failed may be testing nothing.
- **TEST-TDD-03: Green with the simplest code that passes.** No speculative features, no code for the next test.
- **TEST-TDD-04: Refactor is part of every cycle**, with all tests green: remove duplication, improve names, and also clean up the tests. Skipping it is how TDD codebases rot.
- **TEST-TDD-05: One behavior per cycle, in vertical slices.** Keep a short test list of behaviors to cover, but write the tests one at a time. Each test is a tracer bullet that responds to what the last cycle taught you.
  *Why:* writing all tests first ("horizontal slicing") tests imagined behavior and commits to a test structure before the design is understood.
- **TEST-TDD-06: For features on a main user path, use the double loop.** Start with a failing acceptance test (system or E2E) for the user-visible path, then drive the inner units with unit and integration tests until it passes.

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

### Agents

- **TEST-TDD-14: Agents work in visible cycles.** For each behavior: name it, write the test, run it and show the failure, implement, run again, refactor. Agents MUST NOT write implementation and its tests in one step and present them as test-driven.
- **TEST-TDD-15: Agents pick the style from the table above** and say so when it deviates (e.g. "Chicago here, because the mapper is a pure function").

## Anti-patterns

- Tests written after the code and then "made to fail" by breaking the code once.
- All tests of a feature written up front, then all the implementation.
- Mocking an entity or value object instead of creating a real one.
- Verifying every call on every mock, including queries.
- Mocking an HTTP client or ORM directly in a use-case test.
- Tests that read the expected value from the code under test.
- Skipping the refactor step "because it's green".

## Agent checklist

- [ ] Did I see the new test fail before implementing?
- [ ] One behavior per cycle; did I refactor while green?
- [ ] Style matches the element table (London for use cases/adapters, Chicago for domain/pure code)?
- [ ] Only owned contracts mocked; interactions verified only for commands?
- [ ] Expected values independent of the implementation?

## Sources

Kent Beck, *Test-Driven Development: By Example*, Addison-Wesley 2002. Steve Freeman, Nat Pryce, *Growing Object-Oriented Software, Guided by Tests*, Addison-Wesley 2009 (London style, double loop, "don't mock what you don't own"). Martin Fowler, "Mocks Aren't Stubs" (2007). Anti-patterns "tautological test" and "horizontal slicing" adapted from Matt Pocock's `tdd` skill (github.com/mattpocock/skills, MIT).
