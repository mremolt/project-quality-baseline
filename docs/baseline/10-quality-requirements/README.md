# 10. Quality Requirements

The quality goals of chapter 1 as a tree with testable scenarios. Each scenario names the rules that secure it. A product's chapter 10 adds its own scenarios and fills in the numbers of the operability scenarios below.

## Quality tree

| Quality | Scenario | Secured by |
|---|---|---|
| Changeability | Replacing the persistence technology of one aggregate touches only its outgoing adapter and wiring | ARCH-DEP, ARCH-ADP, ArchUnit / dependency-cruiser (D4) |
| Changeability | A new use case can be added without changing other use cases | ARCH-UC, ARCH-MAP-01 |
| Testability | Domain and use-case tests start no framework context (no Spring or Nest context, no `TestBed` or rendered component), and each runs in under 100 ms | TEST-ARCH-01/02, SPRING-TEST table, NEST-TEST-04 |
| Testability | A refactoring that changes no port and no observable behaviour changes no test assertion; only renames and moves touch test files | TEST-ARCH-08 |
| Testability | The pull-request E2E tier finishes within the product's wall-clock budget, and no test passes only on retry without a ticket | TS-TEST-30, TS-TEST-31 |
| Test strength | If the product adopts mutation testing, the nightly mutation score of `domain` and `application` is reported and its trend reviewed, never gated | TEST-ARCH-12 |
| Confidence to ship | Every production bug gets a test that would have caught it | TEST-ARCH-11 |
| Contract safety | A breaking API change fails CI before merge | API-CON-04, SPRING-API-09, NEST-API-10 |
| Performance | A screen loads its data in a bounded number of requests and statements | API-N1, SPRING-TEST-06, NEST-DB-12 |
| Accessibility | Every changed main path passes axe and a keyboard-only journey | A11Y-05, [accessibility.md](accessibility.md) |
| Accessibility | Every release has a recorded L6 checklist run for every screen reader pair, with no open task-blocking failure | A11Y-24 |
| Responsiveness | Every main screen works at every viewport of the matrix and reflows at 320 px without horizontal scrolling | A11Y-13, A11Y-17, TS-TEST-17..21 |
| Internationalization (multilingual products) | A missing or broken translation fails CI, and every main screen passes axe and the overflow check in each locale and the pseudo-locale | TOOL-I18N-03, TEST-I18N-03/04 |
| Security | Every endpoint rejects unauthenticated (401) and unauthorized (403) calls, proven by tests | SPRING-SEC-10, NEST-SEC-14 |
| Security | A request for another user's resource is rejected, proven by a cross-user test | SPRING-SEC-16, NEST-SEC-08 |
| Security | A script injected through user data does not execute; CSP and security headers are present | NG-SEC-01/05/12, REACT-SEC-01/04/09, NEXT-SEC-03/08, NODE-BFF-09, SPRING-SEC-13, NEST-SEC-20 |
| Security | A high or critical dependency finding fails the pull request and is fixed within the SLA | SEC-CI-01, SEC-VUL-02 |
| Consistency | Agents and developers use the same commands per stack (`./mvnw verify`, `npm run verify`) | JAVA-TOOL-20, TS-TOOL-10 |

## Operability scenarios (products fill in the numbers)

The baseline fixes the scenario; each product states the target in its own chapter 10 (`<…>` placeholders) and how it is measured. A scenario without a number is not done.

| Quality | Scenario | Measure (product sets the value) | Secured by |
|---|---|---|---|
| Availability | A rolling deployment of a new version causes no failed user requests | failed requests during rollout ≤ `<0>`; old and new version run side by side | SPRING-DB-05, NEST-DB-20, REPO-API-02, REL-ZD-01..03, OBS-03/04 |
| Availability | The service is reachable during business hours | monthly availability ≥ `<99.5 %>`, measured by `<monitoring>` | product infrastructure (chapter 7) |
| Availability | A failing downstream system degrades one feature, not the whole application | features independent of `<system>` stay usable; the failing call returns within `<timeout>` | RES-TMO-01..03, RES-CAP-01..04 |
| Recoverability | After a crash the instance restarts and serves traffic again without manual steps | back to ready within `<2 min>` | OBS-01..03, REL-DB-01..05 |
| Recoverability | Data is restored after loss or corruption | recovery point (RPO) ≤ `<24 h>`, recovery time (RTO) ≤ `<4 h>`, restore tested `<yearly>` | product infrastructure (chapter 7), incident runbook (SEC-INC-02) |
| Recoverability | A faulty release is rolled back | previous version running again within `<15 min>`, without a database rollback | SPRING-DB-05/NEST-DB-20 (expand/contract), REL-RB-01..03 |
| Performance | A main screen is usable quickly on the reference device and network | LCP ≤ `<2.5 s>`, INP ≤ `<200 ms>`, CLS ≤ `<0.1>` at the 75th percentile | **Not yet secured** by a baseline rule: bundle budgets (NG-TOOL-05, REACT-TOOL-13, NEXT-TOOL-08) and request budgets (TS-TEST-14) limit causes but don't measure it. The product states its lab or field measurement ([chapter 11](../11-risks-and-technical-debt/README.md)) |
| Performance | An API call answers within its budget under expected load | p95 ≤ `<300 ms>` at `<N>` requests/s with `<data volume>` | API-N1, SPRING-TEST-06, NEST-DB-12, load test before release |

## Documents in this chapter

| Doc | Covers | Rule IDs |
|---|---|---|
| [accessibility.md](accessibility.md) | WCAG 2.2 AA (AAA where possible), test layers | `A11Y-*` |
