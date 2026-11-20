# Taking Shortcuts Consciously

Shortcuts are sometimes the economical choice, but only when they are **deliberate, documented and reversible**. Undocumented shortcuts work like broken windows: each one makes the next feel acceptable.

## Broken windows

Once something looks neglected, people care less about making it worse. In code: a codebase full of violations, hacks and shortcuts invites more of them. That's why

- **ARCH-SC-01: Projects start clean.** No shortcuts in the initial structure, architecture tests in place from the beginning ([enforcing-boundaries.md](enforcing-boundaries.md)).
- **ARCH-SC-02: Every shortcut taken on purpose is recorded as an Architecture Decision Record (ADR)**, stating context, decision, consequences and the trigger that should make us remove it.
  *Why:* our future selves and our successors need to know it was deliberate. A documented shortcut also doesn't act as a broken window.
- **ARCH-SC-03 (default D6): ADRs live in `docs/adr/NNNN-short-title.md`** in the consuming project, in Michael Nygard's format (Title, Status, Context, Decision, Consequences).

## Catalogue of known shortcuts

| Shortcut | Effect | Acceptable when | Remove when |
|---|---|---|---|
| **Sharing input/output models between use cases** | The use cases share a reason to change and are coupled. | They are functionally bound and *should* change together. | The use cases start to evolve separately. Split the models, even if they look identical at first. |
| **Domain entity as port input/output** | The entity gets new reasons to change (fields added for one use case, data that belongs to another context). | Simple create/update use cases where the entity is exactly the data to persist. | The use case gains real domain logic. Introduce a dedicated command/result. |
| **Skipping incoming ports** (adapter calls service directly) | Entry points into the core are no longer explicit. Architecture tests can't enforce "adapters only call ports". | Small app with a single incoming adapter where the whole control flow is easy to grasp. **Requires an ADR (default D1).** | A second adapter appears, or the app grows. |
| **Skipping application services** (outgoing adapter implements the incoming port for CRUD) | No place for domain logic in the core; logic starts to grow in the adapter. Needs a shared model between incoming and outgoing adapter. | Pure CRUD pass-through. | The use case needs to do anything beyond create/read/update/delete. Introduce the service then. |
| **No mapping** between rings | See [mapping-between-boundaries.md](mapping-between-boundaries.md). | Default for persistence and queries while models are identical. | Ring-specific concerns leak into the core. |

## Rules

- **ARCH-SC-04: The team agrees on explicit criteria for when a CRUD use case has "grown up"** (e.g. it gains a business rule, touches more than one aggregate, or has a second caller). When a criterion is met, the shortcut is removed.
- **ARCH-SC-05: Some use cases stay CRUD forever.** Keeping their shortcuts is fine. The ADR records that.
- **ARCH-SC-06: Agents MUST NOT introduce a shortcut silently.** If a task seems to need one, the agent proposes it and drafts the ADR, and a human decides.

## Agent checklist

- [ ] Does my change take one of the shortcuts above?
- [ ] If yes: is there an existing ADR covering it, or did I draft one and flag it for review?
- [ ] Does my change meet a "grown up" criterion that requires removing an existing shortcut?

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 11 (Taking Shortcuts Consciously). ADRs: Michael Nygard, "Documenting Architecture Decisions" (2011).
