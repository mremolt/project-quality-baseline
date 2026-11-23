# Implementing Use Cases

How to build the application core: one use case at a time, with its own input and output models, and with clear places for validation.

## Anatomy of a use case

1. **Take input.** A command (state-changing) or query object, received through an incoming port, together with the caller (who triggered it).
2. **Authorize.** Decide with the caller whether this caller may do this to this object (ARCH-UC-15).
3. **Check business rules.** Together with the domain entities.
4. **Change model state.** Call domain behaviour, then hand the new state to outgoing ports.
5. **Return output.** A use-case-specific result, as small as possible.

Input validation is deliberately **not** a step of the use case. It happens before the use case runs (see below). Authentication is not a step either: the incoming adapter authenticates and builds the caller ([adapters.md](adapters.md)).

### Naming

| Type | Name | Lives in |
|---|---|---|
| Incoming port | `<Verb><Noun>UseCase` (`TransferFundsUseCase`, `GetBalanceUseCase`) | `ports/in` |
| Input | `<Verb><Noun>Command` (state-changing) or `<Verb><Noun>Query` (read-only) | `ports/in` |
| Output | `<Verb><Noun>Result` | `ports/in` |
| Implementation | `<Verb><Noun>Service` | `application` |

## Rules

### Slicing

- **ARCH-UC-01: One application service per use case.** Classes like `UserService` that serve many use cases are not allowed.
  *Why:* narrow services have few dependencies, are easy to find and test, and avoid merge conflicts when people work in parallel.
- **ARCH-UC-02: Each use case is reachable only through its incoming port** (an interface/contract in `ports/in`). The only exception is ARCH-SC-07 in [conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md) (default D1).
- **ARCH-UC-03: Keep queries separate from commands.** Read-only operations get their own query port and query service (Command-Query Separation). They skip steps 3–4, never step 2.

### Input and output models

- **ARCH-UC-04: Every use case has its own input model** (`SendMoneyCommand`, `RegisterAccountCommand`). Use cases MUST NOT share input models unless they share the same requirement and must change together.
  *Why:* shared models gain optional/null fields "for the other use case", which blurs validation and couples the use cases.
- **ARCH-UC-05: Input models validate themselves when constructed and are immutable.** An invalid command cannot exist, so the use case never re-checks syntax.
  *Why:* every incoming adapter benefits automatically, and none can forget the checks. This forms a thin anti-corruption screen around the core.
- **ARCH-UC-06: Prefer complete constructors (or the language's equivalent) over builders for input models.**
  *Why:* when a field is added, the compiler/type-checker points to every call site. A builder fails only at runtime.
- **ARCH-UC-07: Output models are use-case specific and minimal.** Return only what the caller actually needs. When in doubt, return less. Avoid returning domain entities (they then change for UI reasons). Exceptions: queries that use the *no mapping* strategy return annotation-free domain types (ARCH-MAP-03); frontends follow TS-ARCH-16 ([typescript.md](typescript.md)).
- **ARCH-UC-08: `null` is not a valid "not applicable" value in an input model.** If a field is meaningless for a use case, the use case needs its own model.

### Validation placement

| Kind | Question | Where |
|---|---|---|
| **Input validation** (syntactic) | Can it be checked *without* the current model state? (not null, positive amount, format) | Constructor of the input model in `ports/in` |
| **Business rule** (semantic) | Does it need the *current model state*? (account not overdrawn, target exists) | Preferably in the **domain entity** that owns the state. Otherwise in the use case, before it changes anything. |

- **ARCH-UC-09: Use the question above to decide where a rule goes.** It makes rules easy to place now and easy to find later.
- **ARCH-UC-10: Business errors are exceptions; a result type is only for an expected alternative outcome** (default, decision D7). An expected alternative outcome is one the caller handles as normal flow, such as "no match" for a search or "already done" for a repeated request. A rule violation, a missing object or a conflict is not: it raises a business exception of one category of ARCH-UC-13. Placement: ARCH-ORG-05; translation: ARCH-ADP-05.
  *Why:* exceptions keep the happy path readable and cannot be ignored by accident; one rule for all use cases means adapters translate errors in one place instead of inspecting every result.
- **ARCH-UC-11: The use case owns the transaction.** The boundary is set per use case on the application service, never in adapters. Remote calls stay outside it: remote reads before, remote side effects after the commit through the outbox (RES-TX-01, MSG-PUB-02). Spring: SPRING-ARCH-07, SPRING-RES-03; NestJS: NEST-ARCH-08, NEST-RES-03.

### Error categories

- **ARCH-UC-13: Every error belongs to one category of the table below, and every adapter handles a category the same way.** Each business category has one base type in `domain` (Java: JAVA-ARCH-13; Node: NODE-ARCH-07) and each business exception carries a stable code (the problem `code` in REST, SPRING-I18N-02, NEST-REST-14). Adapters classify by category, never by concrete exception.

| Category | Meaning | Raised by | HTTP (incoming REST adapter) | Message consumer (MSG-ERR-01) | UI |
|---|---|---|---|---|---|
| **Validation** | The input cannot form a valid command, query or value object | Input model or value object constructor (the stack's validation exception, JAVA-ARCH-12) | 400, `errors` per field | Not retryable: dead letter at once | Message at the field (WCAG 3.3.1); the input stays |
| **Business rule** | The current state forbids the operation (overdraft, wrong status) | Domain entity or use case | 409 with the rule's `code` | Not retryable: dead letter, or acknowledge and log when expected (per listener) | Message near the action, translated from `code`; state unchanged |
| **Access denied** | The caller may know the object (or the action is not about one object) but lacks the permission for this action | Use case, during authorization (ARCH-UC-15) | 403 with `code` `ACCESS_DENIED` (or a more specific code); a security event (SEC-AUD-01) | Not retryable: dead letter at once (a system caller lacking a permission is a configuration defect) | "No permission" message near the action; the UI hides actions the caller cannot use, so this is the fallback |
| **Not found** | The addressed object does not exist, or the caller may not know that it exists (never Access denied for those, SPRING-SEC-36, NEST-SEC-29) | Use case, after a load port returned nothing | 404 | Not retryable by default; retry only where ordering lets the object arrive later (per listener) | Not-found state or page |
| **Conflict** | Concurrent change: version mismatch, optimistic lock, duplicate key | Use case or persistence adapter (via the conflict base type) | 409 with a conflict `code` | Optimistic lock: retry with backoff (RES-RTY-02); then dead letter | Explain, offer reload; never overwrite silently |
| **Technical** | Anything else: timeout, dependency down, bug | Adapters and the runtime; not a business exception | 503 + `Retry-After` when temporary, otherwise 500 with a generic body | Retry with backoff, then dead letter | Generic message with retry; the error is reported |

Status codes and the `code` catalogue in REST: API-REST-06/07 ([rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md)); Spring: SPRING-REST-07, SPRING-I18N-02; NestJS: NEST-REST-14. In a frontend the HTTP adapter turns the response into the same categories (TS-ARCH-18): 400 keeps the field codes, a business `code` selects the domain error class, 404 and 409 become not-found and conflict errors, anything else the platform `TechnicalError`, shown with a generic message key and reported once by the code that creates it: the platform HTTP stack (Angular: the interceptor; React and Next.js: the mutator) for server errors, network failures and time-outs, the feature's HTTP adapter for unknown codes and malformed bodies.

### Domain events

- **ARCH-UC-14: Domain events are immutable types in `domain`, named in the past tense (`OrderPlaced`), raised by the aggregate or the use case, and handed to an outgoing port by the use case inside its transaction.** The port's adapter maps them to the message payload and writes them to the outbox (MSG-PUB-02, SPRING-ARCH-12/13; NestJS: [messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md)). Use cases never call each other, directly or through in-process framework events (Spring `ApplicationEvent`, `@nestjs/event-emitter`; NEST-ARCH-09): a reaction in the same context is domain logic shared through `domain`, a reaction elsewhere consumes the published event through its own incoming port. In-process events between use cases need an ADR (ARCH-SC-02).
  *Why:* an in-process event is a hidden call between use cases, runs in or around a transaction the publisher does not see, and is lost on a crash; the outbox makes the reaction durable and visible.

### Authorization

- **ARCH-UC-15: The use case authorizes; the incoming adapter authenticates.** The adapter turns the authenticated principal into a framework-free caller and passes it with the command or query; it may add coarse checks per route (authenticated, has a role). The use case decides with the caller whether this caller may act on this object (ownership, tenant, state), so every adapter gets the same decision. A refusal raises the Access denied category of ARCH-UC-13 (or Not found when the caller may not know the object). Spring: SPRING-SEC-02; NestJS: NEST-SEC-02.
  *Why:* object-level checks need the loaded object, and a check that lives only in the REST adapter is skipped by the Kafka listener and the scheduled job.
- **ARCH-UC-16: A rule that depends on other rows or on concurrent requests is enforced atomically, never by check-then-write alone.** Examples: a natural key is unique, no write lands in a closed period, time ranges of one owner never overlap, at least one administrator remains, a queued item is processed once. For each such invariant the use case states how it holds under concurrency: a database constraint (unique, exclusion, check, foreign key), a conditional write whose affected-row count is checked, or a lock taken by both the check and the conflicting write (row lock, advisory lock). When the check is against something that may not exist yet (no row for an unlocked month, a first booking), there is nothing to row-lock: take a transaction-scoped advisory lock on the business key instead, shared by the commands that must see the state and exclusive for the change of the state, and prove both orders in the test. A test runs the two conflicting operations as two real transactions in a controlled order (the first held open until the second has reached the conflicting statement) and asserts that one of them is rejected or waits; it has been seen failing without the mechanism. Concurrent edits of the *same* object are covered by optimistic locking (API-REST-11). Spring: SPRING-DB-16; NestJS: NEST-DB-23.
  *Why:* under the default isolation level (READ COMMITTED) two requests can both pass the check before either writes, so the check alone guarantees nothing.
- **ARCH-UC-17: A command that may act on someone else's data carries the owner separately from the caller.** The owner defaults to the caller (own data); one place in the use case decides between "own" and "on behalf of" (e.g. an administrator's correction) and authorizes each with its own permission. A use case that assumes owner = caller cannot later be opened to support or administrators without touching every call site.
  *Why:* "who acts" and "whose data" are different facts for audit, authorization and notifications; merging them makes every correction feature a rewrite.

### Shared logic and bulk import

- **ARCH-UC-18: Logic shared by several use cases of one cut lives in package-private final helper classes that each service builds, not in a shared bean.** Examples: a period-lock check, an audit diff, a rule evaluator. A helper that grows across cuts becomes a domain service or moves into the domain model; never a `*Service` that serves many use cases (ARCH-UC-01).
  *Why:* helpers keep each service's dependencies visible and testable without creating a god class.
- **ARCH-UC-19: A bulk import of structured data (CSV, spreadsheet) follows four defaults, deviation stated in an ADR.** (1) The incoming adapter parses the file and checks its limits (SPRING-SEC-26/NEST equivalent); (2) the rows go to one use case as commands, never around it, so authorization, validation and audit apply; (3) the use case plans all rows first and writes all or nothing; (4) the result is a report per row with a stable `code`, the field and a localized message (I18N-03). Large imports run as a job with the same report. The all-or-nothing transaction has its own timeout, not the request default (the default ladder, RES-TMO-04, is sized for single commands). The planner reads the file's keys in set-based queries (API-N1-05), and an integration test imports a file of the maximum allowed size inside that timeout.
  *Why:* imports that write row by row leave half-imported data, and imports that bypass the use case skip its rules. A maximum-size file that exceeds the default transaction timeout never succeeds, and the user sees a 500 instead of a report.
- **ARCH-UC-20: Production code reads the time only from an injected clock, and the business date comes from one function in the product's time zone.** The backend injects a clock (Java `Clock`, JAVA-ARCH-14; a `Clock` port in Node) and the frontend injects one too (a clock token, TS-ARCH-22). No `now()`, `new Date()` or `Date.now()` appears outside the clock's implementation, and a build check enforces that ban (ArchUnit, ESLint). "Today", "this month" and "this week" are computed by one shared function from the instant and the product's business time zone (recorded in chapter 8). They are never computed from UTC (`toISOString().slice(0, 10)`) or from the browser's or server's default zone. A screen that stays open across midnight (a today view, a timer) recomputes its business date when that date changes. Tests fix the clock (TEST-TDD-16). A real-backend test that needs another time may use a clock hook that exists only in a test profile (TS-TEST-35).
  *Why:* a wall clock read in an adapter cannot be pinned by tests. A date taken from UTC or from the browser's zone is yesterday for an hour or two every night, so pages open the wrong day or month and bookings land on the wrong date.

### Domain model style

- **ARCH-UC-12 (default D2): Use a rich domain model for logic-heavy domains.** Entities expose behaviour methods that enforce invariants and are created only through constructors/factories that produce a valid state. The use case then only states the user's intent and orchestrates entity calls.
- An **anemic** model (data holders, logic in services) is acceptable for CRUD-style contexts. Both styles fit the architecture. Decide per bounded context and document it.

## Example (pseudocode, language-neutral)

```text
ports/in/TransferFundsCommand(source: AccountId, target: AccountId, amount: Money)
    constructor: require source, target, amount present; require amount > 0

ports/in/TransferFundsUseCase.transfer(caller: Caller, cmd: TransferFundsCommand): TransferFundsResult

application/TransferFundsService implements TransferFundsUseCase
    uses ports/out/LoadAccountPort, ports/out/SaveAccountPort
    transfer(caller, cmd):                  // one transaction
        source = loadAccount(cmd.source)    // NotFound if missing
        target = loadAccount(cmd.target)
        require caller.owns(source)         // authorization (ARCH-UC-15)
        source.withdraw(cmd.amount, target.id)   // domain enforces "no overdraft"
        target.deposit(cmd.amount, source.id)
        saveAccount(source); saveAccount(target)
        return TransferFundsResult.of(source.balance())
```

## Anti-patterns

- `validate(cmd)` blocks at the start of every service method (input validation inside the use case).
- One `AccountDto` used as input for create, update and patch.
- Returning the full updated entity "in case the client needs it".
- Builders for commands that let a new mandatory field be silently forgotten.
- Generic names (`CreateX`, `UpdateX`) when the business has a more precise verb.
- A `Result` with an error flag for a rule violation, or an exception for an outcome the caller expects.
- One use case calling another, or reacting to it through an in-process framework event.
- Authorization only in the controller.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Implementing Use Cases".*
