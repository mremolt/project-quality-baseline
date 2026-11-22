---
name: baseline-tdd
description: Test-driven development the way the quality baseline defines it - red, green, refactor in small vertical slices, London (mockist) style by default for use cases and adapters, Chicago (classicist) for domain and pure code. Use when implementing a feature or fixing a bug test-first, when asked for TDD or "red-green-refactor", when deciding what to mock, or when writing unit, adapter or acceptance tests in any stack (TypeScript frontends - Angular, React, Next.js - and NestJS with Vitest and vitest-mock-extended, Java/Spring with JUnit and Mockito).
---

# TDD in the quality baseline

Rules: `docs/baseline/08-crosscutting-concepts/testing/tdd.md` (`TEST-TDD-*`) and `docs/baseline/08-crosscutting-concepts/testing/testing-by-architecture-element.md` (`TEST-ARCH-*`), paths from the project root. Stack details: `docs/baseline/08-crosscutting-concepts/testing/typescript.md`, `docs/baseline/08-crosscutting-concepts/testing/typescript-e2e.md`, `docs/baseline/08-crosscutting-concepts/testing/angular.md`, `docs/baseline/08-crosscutting-concepts/testing/react.md`, `docs/baseline/08-crosscutting-concepts/testing/nextjs.md`, `docs/baseline/08-crosscutting-concepts/testing/spring.md`, `docs/baseline/08-crosscutting-concepts/testing/nestjs.md`. Read only the files of the project's stacks. The docs win over this skill.

## Before the first test

1. Identify the architecture element you are about to change (domain, use case, incoming adapter, outgoing adapter, main path).
2. Look up test type, style and doubles in the element table of `testing-by-architecture-element.md` (section "Test type, style and doubles per element", TEST-TDD-15) and say which one you use. In short: Chicago for domain, pure code and outgoing adapters (against the real technology); London for use cases and incoming adapters; outside-in for main paths. The setup per stack:

| Element | TypeScript / Angular | React / Next.js | Java / Spring | NestJS |
|---|---|---|---|---|
| Domain, pure functions | Vitest, `environment: 'node'` | Vitest project `core` (node) | JUnit + AssertJ, no Spring context | Vitest, no Nest testing module |
| Use case | Vitest + `mock<Port>()` | Vitest + `mock<Port>()` | JUnit + Mockito on the port | Vitest + `mock<Port>()`, service built with `new` |
| Controller, listener, component, page, view-state store (Signal Store, slice) | TestBed + Testing Library, use-case contract mocked | `renderWithProviders` + Testing Library, real store and `QueryClient`, use-case contexts mocked (REACT-TEST-05/06); Next.js route handlers and server actions: Node spec of the handler factory with mocked use cases (NEXT-TEST-05/06) | `@WebMvcTest` + `@MockitoBean` for the incoming port | `Test.createTestingModule` + Fastify `app.inject()`, use-case token mocked, production pipe and filter |
| Outgoing adapter (HTTP, DB, messaging) | MSW with Orval handlers | MSW with Orval handlers; Next.js session store: Redis Testcontainer | Testcontainers, WireMock / `MockRestServiceServer` | Testcontainers (`*.it.test.ts`); `node:http` stub on port 0 for HTTP |
| Main path, frontend | Frontend system test: Playwright, backend stubbed from the contract (`npm run e2e`) | Frontend system test: Playwright against the built app (`npm run e2e`; Next.js: standalone server with MSW stubs in test mode, NEXT-TEST-10) | n/a | n/a |
| Main path, API only | n/a | n/a | System test: `@SpringBootTest` + `RestTestClient`, third parties stubbed | System test: `createApp()` + `app.inject()`, Testcontainers, third parties stubbed |
| Critical path across both | Full-stack system test: Playwright smoke (`npm run e2e:smoke`) against the real backend | (same as TypeScript) | (same test) | (same test) |

3. For a feature on a main path, start with a failing acceptance test (double loop, TEST-TDD-06): the frontend system test for a UI path, the backend system test for an API-only path. Not the full-stack smoke test.
4. Write a short test list of behaviors. Don't write the tests yet (TEST-TDD-05).

## The cycle (one behavior at a time)

Show each step to the user (TEST-TDD-14):

1. **Red**: write one test for the next behavior. Run it. Show that it fails, and for the expected reason (TEST-TDD-02).
2. **Green**: write the simplest code that passes. Run the tests (TEST-TDD-03).
3. **Refactor**: with everything green, clean up code and tests: names, duplication, structure. Run the tests again (TEST-TDD-04).
4. Cross the behavior off the list; add new behaviors you discovered; continue.

## Doubles

- Mock only contracts we own: ports and use-case interfaces (TEST-TDD-07). TypeScript: `mock<Port>()` from `vitest-mock-extended` (Angular: typed `vi.fn()` fakes where a method is asserted, NG-TOOL-11); Java: Mockito on the port interface. In-memory fakes for collection ports, fictitious `People` and an immediate `TransactionTemplate` come from the Spring templates (SPRING-TEST-14).
- Never mock entities, value objects, concrete classes, or third-party types; wrap third-party code in a port (TEST-TDD-08).
- Stub queries (`calledWith(...).mockResolvedValue(...)`, `when(...).thenReturn(...)`), verify only commands (TEST-TDD-09).
- Too many doubles, or unclear what to mock? That's a design signal: the port or service is too broad (TEST-ARCH-07). Say so.
- A double that would just mirror the implementation → switch to Chicago (TEST-TDD-10).

## Good tests

- Expected values come from a literal, a worked example, or the spec, never recomputed like the code does (TEST-TDD-11).
- Names state behavior in domain language (TEST-TDD-12).
- Bug fix: reproduce with a failing test first (TEST-TDD-13).
- Test data from builders with valid defaults; clock and ids injected and fixed in the test; seeds fixed and logged; never production data (TEST-TDD-16).
- Fakers (`@faker-js/faker`, Datafaker, Instancio) only for seed data, volume and realistic shapes, always seeded; values a test asserts on are literals. Property-based tests: `fast-check`, jqwik (TEST-TDD-17).
- Tests must survive refactoring: no private access, no assertions on internals (TEST-ARCH-08).

## Commands

| Stack | Run |
|---|---|
| TypeScript / Angular | `npm test -- <file>` (watch mode while cycling), `npm run e2e -- <spec>` for acceptance tests |
| React / Next.js | `cd frontend && npx vitest <file>` while cycling (`npm test` also regenerates the API client), `npm run e2e -- <spec>` for acceptance tests (builds first) |
| Java / Spring | `cd backend && ./mvnw test -Dtest=<Class>` (unit and slice tests); `./mvnw verify` for integration tests (`*IT`) |
| NestJS | `cd backend && npm test -- <file>` (unit and adapter tests, no Docker); `npm run test:it -- <file>` for container-backed `*.it.test.ts` |
