# Implementing Use Cases

How to build the application core: one use case at a time, with its own input and output models, and with clear places for validation.

## Anatomy of a use case

1. **Take input.** A command (state-changing) or query object, received through an incoming port.
2. **Check business rules.** Together with the domain entities.
3. **Change model state.** Call domain behaviour, then hand the new state to outgoing ports.
4. **Return output.** A use-case-specific result, as small as possible.

Input validation is deliberately **not** a step of the use case. It happens before the use case runs (see below).

## Rules

### Slicing

- **ARCH-UC-01: One application service per use case.** Classes like `UserService` that serve many use cases are not allowed.
  *Why:* narrow services have few dependencies, are easy to find and test, and avoid merge conflicts when people work in parallel.
- **ARCH-UC-02: Each use case is reachable only through its incoming port** (an interface/contract in `ports/in`). See D1 in [conscious-shortcuts.md](conscious-shortcuts.md) for the only exception.
- **ARCH-UC-03: Keep queries separate from commands.** Read-only operations get their own query port and query service (Command-Query Separation). They may skip steps 2–3.

### Input and output models

- **ARCH-UC-04: Every use case has its own input model** (`SendMoneyCommand`, `RegisterAccountCommand`). Use cases MUST NOT share input models unless they share the same requirement and must change together.
  *Why:* shared models gain optional/null fields "for the other use case", which blurs validation and couples the use cases.
- **ARCH-UC-05: Input models validate themselves when constructed and are immutable.** An invalid command cannot exist, so the use case never re-checks syntax.
  *Why:* every incoming adapter benefits automatically, and none can forget the checks. This forms a thin anti-corruption screen around the core.
- **ARCH-UC-06: Prefer complete constructors (or the language's equivalent) over builders for input models.**
  *Why:* when a field is added, the compiler/type-checker points to every call site. A builder fails only at runtime.
- **ARCH-UC-07: Output models are use-case specific and minimal.** Return only what the caller actually needs. When in doubt, return less. Avoid returning domain entities (they then change for UI reasons).
- **ARCH-UC-08: `null` is not a valid "not applicable" value in an input model.** If a field is meaningless for a use case, the use case needs its own model.

### Validation placement

| Kind | Question | Where |
|---|---|---|
| **Input validation** (syntactic) | Can it be checked *without* the current model state? (not null, positive amount, format) | Constructor of the input model in `ports/in` |
| **Business rule** (semantic) | Does it need the *current model state*? (account not overdrawn, target exists) | Preferably in the **domain entity** that owns the state. Otherwise in the use case, before it changes anything. |

- **ARCH-UC-09: Use the question above to decide where a rule goes.** It makes rules easy to place now and easy to find later.
- **ARCH-UC-10: Business-rule violations raise a dedicated business exception (in `domain`) or return an explicit result.** Adapters decide how to show it to the outside.
- **ARCH-UC-11: Transaction boundaries are set per use case** (the application service), never in adapters. See [adapters.md](adapters.md).

### Domain model style

- **ARCH-UC-12 (default D2): Use a rich domain model for logic-heavy domains.** Entities expose behaviour methods that enforce invariants and are created only through constructors/factories that produce a valid state. The use case then only states the user's intent and orchestrates entity calls.
- An **anemic** model (data holders, logic in services) is acceptable for CRUD-style contexts. Both styles fit the architecture. Decide per bounded context and document it.

## Example (pseudocode, language-neutral)

```text
ports/in/TransferFundsCommand(source: AccountId, target: AccountId, amount: Money)
    constructor: require source, target, amount present; require amount > 0

ports/in/TransferFundsUseCase.transfer(cmd: TransferFundsCommand): TransferResult

application/TransferFundsService implements TransferFundsUseCase
    uses ports/out/LoadAccountPort, ports/out/SaveAccountPort
    transfer(cmd):                          // one transaction
        source = loadAccount(cmd.source)
        target = loadAccount(cmd.target)
        source.withdraw(cmd.amount, target.id)   // domain enforces "no overdraft"
        target.deposit(cmd.amount, source.id)
        saveAccount(source); saveAccount(target)
        return TransferResult.ok()
```

## Anti-patterns

- `validate(cmd)` blocks at the start of every service method (input validation inside the use case).
- One `AccountDto` used as input for create, update and patch.
- Returning the full updated entity "in case the client needs it".
- Builders for commands that let a new mandatory field be silently forgotten.
- Generic names (`CreateX`, `UpdateX`) when the business has a more precise verb.

## Agent checklist

- [ ] New use case → new incoming port + new service + own command/query + own result?
- [ ] Input model immutable and self-validating?
- [ ] Each rule placed per the validation table?
- [ ] Output minimal and not a domain entity?
- [ ] Transaction boundary on the service?

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 4 (Implementing a Use Case), ch. 6 (transactions), ch. 11 (sharing models).
