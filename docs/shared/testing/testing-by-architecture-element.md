# Testing by Architecture Element

Which kind of test covers which part of the hexagonal architecture. This is the *what* of testing. The *how and when* (test-first, London/Chicago style per element) is in [tdd.md](tdd.md).

## Test types (as used in this baseline)

| Type | Scope | Collaborators |
|---|---|---|
| **Unit test** | One unit (usually one class/module) through its public interface. | Dependencies replaced by mocks/fakes. |
| **Integration test** | A network of units across **one** boundary, e.g. adapter + framework, or adapter + database. | Real framework / real infrastructure on one side. Mocks beyond the boundary. |
| **System test** | The whole application, through its real external interface. | Everything real, except third-party systems that can't run in tests: stub those at their outgoing ports. |
| **End-to-end** (frontend) | System tests driven through the UI. | Two tiers: backend stubbed at the network boundary (every pull request) and a smoke suite against the real backend. See [typescript/testing.md](../../typescript/testing.md). |

Follow the test pyramid: many cheap, fast, stable unit tests; fewer integration tests; a small number of system tests for the most important paths.

## Rules

- **TEST-ARCH-01: Domain entities → unit tests.** Build the entity in a known state, call a behaviour method, assert the resulting state. No mocks needed.
- **TEST-ARCH-02: Use cases (application services) → unit tests with mocked/faked outgoing ports.**
  Verify **only the important interactions**, not every call. Over-specified interaction tests break on every refactoring.
- **TEST-ARCH-03: Incoming adapters → integration tests inside the real framework** (routing, serialization, validation, error mapping), with the incoming port mocked.
  *Why:* a plain unit test of a controller misses everything the framework does around it.
- **TEST-ARCH-04: Outgoing adapters → integration tests against the real technology.** Persistence adapters test against **the same database engine as production** (e.g. via containers), not an in-memory substitute.
  *Why:* mocked or substitute databases give the same line coverage but miss SQL dialect issues and mapping errors. A single engine also means a single set of migration scripts.
- **TEST-ARCH-05: Main user paths → system tests.** Combine several use cases into realistic scenarios. Hide technical details behind helper methods so the test reads like a domain-specific language that domain experts can follow.
- **TEST-ARCH-06: Tests are written while implementing**, not afterwards. Each new element comes with the test type above in the same change.
- **TEST-ARCH-07: Narrow ports make mocking easy.** If a test needs many mocks, or it's unclear what to mock, treat that as an architecture warning (broad port, broad service) and fix the design, not the test.
- **TEST-ARCH-08: Tests must not break on pure refactorings.** If adding a field means an hour of fixing tests, the tests depend too much on structure.

## Measuring "enough" (default D5)

- **TEST-ARCH-09: Line coverage is not the success metric.** Any target below 100% says nothing about *which* code is covered, and even 100% doesn't prove correctness. Coverage reports are still useful to *find* untested areas.
- **TEST-ARCH-10: The measure is confidence to ship.** The team should be willing to release after a green build. The more often you ship, the faster that trust builds.
- **TEST-ARCH-11: For every production bug, answer "Why didn't our tests catch this?"**, record the answer (e.g. in the bug ticket), and add a test that would have caught it.

> If a project's quality gate enforces a coverage floor (to be defined in a separate tooling doc), it is a safety net, not the goal.

## Summary table

| Element | Test type | Mocks |
|---|---|---|
| Domain entity / value object | Unit | none |
| Application service (use case) | Unit | outgoing ports |
| Incoming adapter (REST, messaging, UI) | Integration (with framework) | incoming port |
| Outgoing adapter (DB, messaging, S3, API client) | Integration (with real tech / container / HTTP stub) | nothing in the adapter |
| Main user scenarios | System | only external third-party systems |

## Agent checklist

- [ ] Every new domain/application/adapter element has the matching test type?
- [ ] Use case tests verify only the essential interactions?
- [ ] Persistence tests run against the production DB engine?
- [ ] Bug fix comes with a regression test?

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 7 (Testing Architecture Elements). Test pyramid: Mike Cohn, *Succeeding with Agile* (2009).
