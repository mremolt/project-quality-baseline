# Hexagonal Architecture (Ports & Adapters)

Our default architecture style for applications whose main value is business logic. It keeps domain code independent of frameworks, databases, UIs and external systems. Every other architecture doc of this baseline builds on the terms defined here.

## Vocabulary

| Term | Meaning |
|---|---|
| **Domain** | Entities, value objects and business rules. The innermost ring. |
| **Application** | Use-case implementations (application services) that orchestrate the domain. |
| **Port** | An interface owned by the core. *Incoming* ports (`…UseCase`) are implemented by the application and called from outside; their input is a `…Command` or `…Query`, their output a `…Result`. *Outgoing* ports (`Load…Port`, `Save…Port`) are called by the application and implemented outside. |
| **Core** | Domain + ports + application: everything inside the adapters. Rules that say "core" mean all three rings; rules for a subset name the rings. |
| **Adapter** | Code that connects the core to one technology. *Incoming* (driving) adapters call incoming ports, e.g. REST controller, message listener, UI. *Outgoing* (driven) adapters implement outgoing ports, e.g. database, message producer, file storage, third-party API client. |
| **Configuration / composition root** | A neutral component that instantiates everything and wires adapters to ports. It is the only part allowed to know all the others. |

```
           ┌────────────────── configuration ──────────────────┐
           │  ┌─────────────── adapters ───────────────────┐   │
           │  │  in: rest, messaging, ui    out: db, s3 …  │   │
           │  │  ┌──────── ports (in / out) ─────────────┐ │   │
           │  │  │  ┌──── application (use cases) ────┐  │ │   │
           │  │  │  │  ┌──────── domain ───────────┐  │  │ │   │
           │  │  │  │  └───────────────────────────┘  │  │ │   │
           │  │  │  └─────────────────────────────────┘  │ │   │
           │  │  └───────────────────────────────────────┘ │   │
           │  └────────────────────────────────────────────┘   │
           └───────────────────────────────────────────────────┘
                  all source-code dependencies point inward
```

## Rules

- **ARCH-DEP-01: Every source-code dependency MUST point inward, toward the domain.**
  *Why:* each dependency is a possible reason to change. Domain code is the most valuable code and should only change when the business changes.
- **ARCH-DEP-02: Domain code MUST NOT depend on application, ports, adapters, configuration or infrastructure frameworks** (ORM, web, messaging, DI container).
  *Why:* this keeps business rules testable without infrastructure, and free to be modelled as the business needs rather than as a framework needs.
- **ARCH-DEP-03: When the core needs something from the outside, it MUST define an outgoing port, which an adapter implements (Dependency Inversion).**
  *Why:* this turns the dependency against the control flow, so the database or external API becomes a plugin to the core.
- **ARCH-DEP-04: Application code MUST NOT instantiate adapters. Wiring happens only in the composition root** (DI container or hand-written).
  *Why:* instantiating an adapter creates exactly the outward dependency the architecture forbids.
- **ARCH-DEP-05: Adapters MUST NOT depend on each other.** Two adapters exchange data only through the core. Architecture tests check it (ARCH-ENF-04).
  *Why:* otherwise details of one technology (e.g. a REST DTO) leak into another (e.g. persistence).
- **ARCH-DEP-06: SHOULD: design the domain first.** Domain and use cases are modelled and tested before database tables or API endpoints are designed.
  *Why:* starting from the database ("database-driven design") makes persistence concerns the base of everything and mixes ORM details into business logic.
- **ARCH-DEP-07: Read "single responsibility" as "a single reason to change"**, not as "does one thing". Use it to judge whether a class or module is cut correctly.

## Why not classic layering (web → service → persistence)?

Layers are not wrong, but on their own they let too many things go wrong:

- **Database-driven design.** Everything builds on persistence, so ORM entities become the business model. Lazy loading, flushing and transactions end up in business code.
- **Shortcuts.** Anything needed "above" gets pushed down a layer, so the bottom layer collects helpers and utilities and grows fat.
- **Layers get skipped.** Controllers talk to repositories directly, domain logic spreads into the web layer, and tests need ever more mocks.
- **Use cases are hidden.** Broad `XxxService` classes serve many use cases, so it's hard to find where a feature lives.
- **Parallel work suffers.** Work has to go bottom-up, and broad services cause merge conflicts.

Hexagonal architecture fixes this with the dependency rule plus explicit ports. That makes the safe structure the easy one.

## When to use it (and when not)

- **Use it** when domain logic is the most important part of the application, or is expected to become so. A domain-centric style is also what makes Domain-Driven Design possible in practice.
- **Don't force it** on apps that are mostly data pass-through (thin CRUD, simple proxies). There, a lighter structure is fine. Document that choice (see [11-risks-and-technical-debt/conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md)).
- **When unsure**, try it on one module first and decide from experience, not habit.

## Anti-patterns

- ORM/JPA entities or framework annotations used as the domain model. The *no mapping* strategy shares annotation-free domain types, never annotated ones ([08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md)).
- A `common`/`util` package that everything depends on and that depends on adapters.
- A service in the core that calls `new SomeRepositoryImpl()` or imports an HTTP client.
- An architecture diagram that cannot be mapped onto the folder/package structure.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Hexagonal Architecture (Ports & Adapters)".*

## Related

- [05-building-block-view/code-organization.md](../05-building-block-view/code-organization.md): how the rings map to folders/packages
- [05-building-block-view/use-cases.md](../05-building-block-view/use-cases.md), [05-building-block-view/adapters.md](../05-building-block-view/adapters.md), [08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md)
- [08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md): making the build fail on violations
