# Testing by Architecture Element

Which kind of test covers which part of the hexagonal architecture. This is the *what* of testing, including the one table of test type, TDD style and doubles per element. The *how and when* (test-first workflow, the London and Chicago styles) is in [08-crosscutting-concepts/testing/tdd.md](tdd.md).

## Test types (as used in this baseline)

| Type | Scope | Collaborators |
|---|---|---|
| **Unit test** | One unit (usually one class/module) through its public interface. | Dependencies replaced by mocks/fakes. |
| **Integration test** | A network of units across **one** boundary, e.g. adapter + framework, or adapter + database. | Real framework / real infrastructure on one side. Mocks beyond the boundary. |
| **System test** | One backend component through its real external interface (HTTP, messaging). | Its own infrastructure (database, broker) is real. Third-party systems are stubbed at their outgoing ports. |
| **Frontend system test** | The frontend through the browser; the E2E tier that runs on every pull request (TS-TEST-10). | Our own backend is stubbed at the network boundary with responses generated from the OpenAPI contract; nothing inside the frontend is stubbed. |
| **Full-stack system test** | Frontend and backend together, driven through the UI (the E2E smoke tier). | Everything of ours is real; only third-party systems that can't run in tests are stubbed. |

Follow the test pyramid: many cheap, fast, stable unit tests; fewer integration tests; a small number of system tests for the most important paths.

## Rules

- **TEST-ARCH-01: Domain entities → unit tests.** Build the entity in a known state, call a behaviour method, assert the resulting state. No mocks needed.
- **TEST-ARCH-02: Use cases (application services) → unit tests with mocked/faked outgoing ports.**
  Verify **only the important interactions**, not every call. Over-specified interaction tests break on every refactoring. Exception: a frontend use case whose whole body forwards its arguments to one outgoing port and returns its result needs no own unit test; the store or component test (with the use case mocked) and the HTTP adapter test cover the path. The test comes back with the first line of logic (a rule, a mapping, a second port, error handling).
  *Why:* a test of a one-line delegation restates the implementation (TEST-TDD-10) and catches nothing the adapter and store tests don't.
- **TEST-ARCH-03: Incoming adapters → integration tests inside the real framework** (routing, serialization, validation, error mapping), with the incoming port mocked.
  *Why:* a plain unit test of a controller misses everything the framework does around it.
- **TEST-ARCH-04: Outgoing adapters → integration tests against the real technology.** Persistence adapters test against **the same database engine as production** (e.g. via containers), not an in-memory substitute.
  *Why:* mocked or substitute databases give the same line coverage but miss SQL dialect issues and mapping errors. A single engine also means a single set of migration scripts.
- **TEST-ARCH-13: Every new value of a persisted enum, and every new kind of row in an existing table, is exercised once through the real adapter and the real migrations.** A fake cannot know a database check constraint or a column length: use case tests stay green while `template in ('TEST_MAIL')` still rejects the new value. The adapter or system test writes and reads the new value against the production engine (TEST-ARCH-04).
- **TEST-ARCH-05: Main user paths → system tests.** Combine several use cases into realistic scenarios. Hide technical details behind helper methods so the test reads like a domain-specific language that domain experts can follow. Every main path has a system test of the component that owns it (a frontend system test for UI paths, a backend system test for API-only paths); a handful of critical paths also run as full-stack system tests, which prove that frontend and backend really fit.
- **TEST-ARCH-06: Tests are written while implementing**, not afterwards. Each new element comes with the test type from the [element table](#test-type-style-and-doubles-per-element) in the same change.
- **TEST-ARCH-07: Narrow ports make mocking easy.** If a test needs many mocks, or it's unclear what to mock, treat that as an architecture warning (broad port, broad service) and fix the design, not the test.
- **TEST-ARCH-08: Tests must not break on pure refactorings.** If adding a field means an hour of fixing tests, the tests depend too much on structure.

## Measuring "enough" (default D5)

- **TEST-ARCH-09: Line coverage is not the success metric.** Any target below 100% says nothing about *which* code is covered, and even 100% doesn't prove correctness. Coverage reports are still useful to *find* untested areas.
- **TEST-ARCH-10: The measure is confidence to ship.** The team should be willing to release after a green build. The more often you ship, the faster that trust builds.
- **TEST-ARCH-11: For every production bug, answer "Why didn't our tests catch this?"**, record the answer (e.g. in the bug ticket), and add a test that would have caught it.
- **TEST-ARCH-12: Mutation testing on `domain` and `application` is optional (consider it as a test-strength signal).** If a product adopts it, it runs nightly on these two rings only, and the score is reported, never gated. Reference tools (replaceable): PIT for Java, Stryker for TypeScript.
  *Why:* coverage shows which lines ran, not whether a test would notice a wrong result; surviving mutants point at weak assertions. Adapters and system tests are too slow and too noisy for it.

> Coverage is reported, not gated (JAVA-TOOL-14 for Java; TypeScript has no coverage gate either). "Reported" means every component produces the report on each `verify` run: JaCoCo for Java, `@vitest/coverage-v8` for TypeScript (coverage enabled in the unit-test configuration, report kept as a CI artefact). A project that adds a coverage floor records it in an ADR; it is a safety net, not the goal.

## Test type, style and doubles per element

The one table for every stack. The TDD style (London or Chicago) is explained in [tdd.md](tdd.md#the-two-styles); stack docs only add the setup per element ([spring.md](spring.md), [nestjs.md](nestjs.md), [typescript.md](typescript.md), [angular.md](angular.md), [react.md](react.md), [nextjs.md](nextjs.md)).

| Element | Test type | Style | Doubles |
|---|---|---|---|
| Domain entity, value object, domain service | Unit (TEST-ARCH-01) | Chicago | none |
| Small cohesive cluster (mapper + schema, a value-object family, pure helper functions) | Unit | Chicago | none |
| Use case (application service) | Unit (TEST-ARCH-02) | London | outgoing ports |
| Incoming adapter: controller, listener, UI component, page, view-state store | Integration in the real framework (TEST-ARCH-03) | London | incoming port / use-case contract |
| Outgoing adapter: DB, messaging, object storage, API client | Integration against the real technology: container, HTTP stub, MSW (TEST-ARCH-04) | Chicago | nothing inside the adapter |
| Main user path, frontend | Frontend system test, every pull request (TEST-ARCH-05) | Outside-in acceptance test (double loop, TEST-TDD-06) | our backend stubbed from the OpenAPI contract; third-party systems |
| Main user path, backend API only | System test (TEST-ARCH-05) | Outside-in acceptance test (TEST-TDD-06) | only third-party systems |
| Critical paths across frontend and backend | Full-stack system test (TEST-ARCH-05) | Outside-in | only third-party systems |

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Testing by Architecture Element".*
