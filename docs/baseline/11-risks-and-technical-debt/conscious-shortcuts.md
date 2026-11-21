# Taking Shortcuts Consciously

Shortcuts are sometimes the economical choice, but only when they are **deliberate, documented and reversible**. Undocumented shortcuts work like broken windows: each one makes the next feel acceptable.

## Broken windows

Once something looks neglected, people care less about making it worse. In code: a codebase full of violations, hacks and shortcuts invites more of them. That's why

- **ARCH-SC-01: Projects start clean.** No shortcuts in the initial structure, architecture tests in place from the beginning ([08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md)).
- **ARCH-SC-02: Every shortcut taken on purpose is recorded as an Architecture Decision Record (ADR)**, stating context, decision, consequences and the trigger that should make us remove it. Defaults that the catalogue below marks "ADR needed? No" are not shortcuts.
  *Why:* our future selves and our successors need to know it was deliberate. A documented shortcut also doesn't act as a broken window.
- **ARCH-SC-03 (default D6): ADRs live in `docs/adr/NNNN-short-title.md`** in the consuming project, in Michael Nygard's format (Title, Status, Context, Decision, Consequences).

## Catalogue of known shortcuts

| Shortcut | Effect | Acceptable when | Remove when | ADR needed? |
|---|---|---|---|---|
| **Sharing input/output models between use cases** | The use cases share a reason to change and are coupled. | They are functionally bound and *should* change together. | The use cases start to evolve separately. Split the models, even if they look identical at first. | Yes |
| **Domain entity as port input/output** | The entity gets new reasons to change (fields added for one use case, data that belongs to another context). | Simple create/update use cases where the entity is exactly the data to persist. | The use case gains real domain logic. Introduce a dedicated command/result. | Yes; not for query results under *no mapping* (ARCH-UC-07) |
| **Skipping incoming ports** (adapter calls service directly) | Entry points into the core are no longer explicit. Architecture tests can't enforce "adapters only call ports". | Small app with a single incoming adapter where the whole control flow is easy to grasp. | A second adapter appears, or the app grows. | Yes (ARCH-SC-07) |
| **Skipping application services** (outgoing adapter implements the incoming port for CRUD) | No place for domain logic in the core; logic starts to grow in the adapter. Needs a shared model between incoming and outgoing adapter. | Pure CRUD pass-through. | The use case needs to do anything beyond create/read/update/delete. Introduce the service then. | Yes |
| **No mapping** between rings | See [08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md). Ports use annotation-free domain types. | Default for persistence and queries while models are identical (ARCH-MAP-02/03). | Ring-specific concerns leak into the core. | No while within ARCH-MAP-02/03; not available in Spring or NestJS services (SPRING-ARCH-10, NEST-DB-06) |
| **In-process events between use cases** | Hidden control flow; the reaction is not durable and runs in a transaction the publisher does not see. | Reactions inside one context that may be lost (e.g. cache warm-up). | The reaction matters to the business, or crosses a context. Publish through the outbox. | Yes (ARCH-UC-14) |
| **Shared kernel** between bounded contexts | Two contexts change together for the shared types. | Small, stable value objects both contexts need (money, ids). | The types start to differ per context. Give each context its own. | Yes (ARCH-ORG-09) |

## Rules

- **ARCH-SC-04: The team agrees on explicit criteria for when a CRUD use case has "grown up"** (e.g. it gains a business rule, touches more than one aggregate, or has a second caller). When a criterion is met, the shortcut is removed.
- **ARCH-SC-05: Some use cases stay CRUD forever.** Keeping their shortcuts is fine. The ADR records that.
- **ARCH-SC-06: Agents MUST NOT introduce a shortcut silently.** If a task seems to need one, the agent proposes it and drafts the ADR, and a human decides.
- **ARCH-SC-07: Incoming ports are required (default D1).** An adapter calls a use case only through its incoming port (ARCH-UC-02, ARCH-ADP-02); the architecture test checks it (Spring: `adaptersCallPortsNotServices`; NestJS: `adapters-use-ports-not-services`). Skipping incoming ports is the shortcut in the table above and needs an ADR, which also records how the test is adjusted.
- **ARCH-SC-08: An ADR or exception counts as an accepted deviation only for the rule IDs it names.** An ADR whose decision conflicts with a baseline rule names that rule in its Decision section; one that does not is a violation of that rule, however well reasoned. Debt recorded in chapter 11 with owner and trigger is not a deviation: reviews report it as a finding marked "recorded debt", so it stays visible until its trigger fires.
  *Why:* a reviewer or agent cannot match an unnamed rule to a decision, and debt that counts as accepted stops being looked at.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Taking Shortcuts Consciously".*
