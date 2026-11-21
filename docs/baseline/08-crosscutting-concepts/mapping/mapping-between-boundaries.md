# Mapping Between Boundaries

Whether each ring has its own model, and who maps between them. There is no global "always map" or "never map" rule. Choose **per use case and per boundary**, following the defaults below, and change the choice as the use case evolves.

## The four strategies

| Strategy | How it works | Pros | Cons | Fits |
|---|---|---|---|---|
| **No mapping** | Ports use the annotation-free domain types; all rings share them. Adapters still keep their own annotated types (ORM entity, DTO) inside the adapter (ARCH-ADP-01, ARCH-ADP-12). | No mapping layer in the core, fast to evolve. | Domain types collect ring-specific fields, so they have several reasons to change. | Simple CRUD where all rings need exactly the same data. |
| **Two-way** | Each adapter has its own model and maps to/from the domain model at its port. | Clean domain model; each ring shapes its model freely; simple, clear responsibilities. | Lots of mapping code; the domain model still crosses the port boundaries. | Persistence or web concerns differ from the domain shape. |
| **Full** | Each operation has its own input (and possibly output) model: commands, queries, results. | Very explicit contract per use case; per-use-case validation; no unused fields. | Most mapping code. | **Incoming adapter → application for state-changing use cases.** Not worth it between application and persistence. |
| **One-way** | All rings' models implement a shared read-only "state" interface; each ring maps only what it *receives*. | Little mapping when models are similar; outer rings can't mutate domain objects. | Mapping spread over rings is harder to understand. | Models across rings are very similar, e.g. read-heavy paths. |

## Default guidelines (D3)

- **ARCH-MAP-01: State-changing use case, incoming adapter → application: use *full* mapping** (dedicated command per use case).
  *Why:* use cases stay decoupled from each other and get crisp per-use-case validation.
- **ARCH-MAP-02: State-changing use case, application ↔ persistence: start with *no mapping*.** Switch to *two-way* as soon as persistence concerns (lazy loading, ORM-required constructors, DB-driven relationships) show up in application or domain code. Stack docs may tighten this default when their persistence technology brings those concerns from the start; Spring services always use two-way mapping, because the JPA entity is never the domain model: *no mapping* is not available there (SPRING-ARCH-10); NestJS services likewise (NEST-DB-06).
- **ARCH-MAP-03: Queries: start with *no mapping* across all boundaries.** Switch the affected boundary to *two-way* as soon as web or persistence concerns leak into the core.
- **ARCH-MAP-04: Mixing strategies in one codebase is expected, not untidy.** Picking a worse strategy for the sake of uniformity is the mistake.
- **ARCH-MAP-05: Revisit the strategy when a use case grows.** Many use cases start as CRUD and grow into real business logic. That is the moment to introduce stronger mapping.
- **ARCH-MAP-06: The team keeps these guidelines visible and revises them together.** Following the defaults above needs no ADR; deviations from them are recorded (ADR, see [11-risks-and-technical-debt/conscious-shortcuts.md](../../11-risks-and-technical-debt/conscious-shortcuts.md)).

> Note: technology-specific docs may tighten the defaults. For example, if a framework forces compromises on the domain model (such as mandatory no-arg constructors), two-way mapping at that boundary becomes the default. Check the tech doc for your stack.

## Mapping code: practical rules

- **ARCH-MAP-07: The outer ring maps.** Adapters map into the core's models and back. The core only knows its own models.
- **ARCH-MAP-08: Mapping code is explicit and tested.** Prefer plain, debuggable mapping code. Reflection-heavy mapping frameworks hide errors; if one is used, its mappings must be covered by adapter integration tests.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Mapping Between Boundaries".*
