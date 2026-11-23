# Implementing Adapters

Adapters translate between one technology and the application core. They contain **no business logic**.

## Incoming (driving) adapters

Examples: REST controllers, message listeners, scheduled jobs, CLI commands, UI components.

### Responsibilities (in this order)

1. Accept the external request (HTTP, message, UI event) and deserialize it.
2. Authenticate, turn the principal into a framework-free caller, and apply coarse checks per route (authenticated, has a role). Object-level authorization is the use case's job (ARCH-UC-15).
3. Check that the external input **can be turned into** the use case's input model. Don't repeat the use case's own validation.
4. Map to the command/query and call the **incoming port**, passing the caller.
5. Map the result (or a business exception) back to the protocol: response body, HTTP status, ack/nack, UI state.

### Rules

- **ARCH-ADP-01: Protocol details MUST NOT leak into the core.** No HTTP types, message headers, UI types or serialization annotations in `ports`, `application` or `domain`.
  *Why:* the same use case must stay callable from any other adapter. Writing the use case first, before the adapter, makes this boundary come naturally.
- **ARCH-ADP-02: Incoming adapters call incoming ports only**, never application services or outgoing ports directly.
- **ARCH-ADP-03: Slice incoming adapters narrowly.** Prefer one controller/handler per use case (or small cohesive group) over one controller per resource.
  *Why:* small classes are easier to understand and test, they tempt nobody to reuse one "bucket" DTO for all operations, and they avoid merge conflicts.
- **ARCH-ADP-04: Each handler owns its request/response models**, kept private to its package where the language allows. Sharing models across handlers is a conscious decision, not a default.
- **ARCH-ADP-05: Translate errors centrally per adapter.** Business exceptions from `domain` are mapped to protocol errors in one place per adapter (e.g. an HTTP error handler), by error category (ARCH-UC-13).
- **ARCH-ADP-06: If the core must actively push to an incoming adapter** (websocket, server-sent events), define an *outgoing* port that the adapter implements. An adapter may be both incoming and outgoing.

## Outgoing (driven) adapters

Examples: database/ORM, message producers, object storage (S3), third-party API clients, email.

### Responsibilities

1. Receive input through the outgoing port, using the port's model (which lives in the core).
2. Map it to the technology's format (ORM entity, SQL, message payload, API DTO).
3. Call the technology.
4. Map the answer back to the port's output model.

### Rules

- **ARCH-ADP-07: Port input and output models live in the core** (`domain` or `ports/out`), never in the adapter.
  *Why:* the adapter can be refactored or replaced without touching the core.
- **ARCH-ADP-08: Outgoing ports are narrow (Interface Segregation).** Prefer `LoadAccountPort` and `UpdateAccountStatePort` over one `AccountRepository` with twenty methods. Bundle methods only when they are always used together.
  *Why:* each service depends only on what it uses. Tests know exactly what to mock, with no "which methods do I need to stub?" research.
- **ARCH-ADP-09: Slice outgoing adapters freely.** One adapter class may implement several ports. A good default is one persistence adapter **per aggregate**. Using different technologies for different ports (ORM for some, plain SQL for others) is allowed.
- **ARCH-ADP-10: Bounded contexts don't share outgoing adapters.** Each context has its own persistence adapter(s). Cross-context access: ARCH-ORG-09.
- **ARCH-ADP-12: Technology-specific models (ORM entities, API DTOs) stay inside their adapter**, with the narrowest visibility possible.
- **ARCH-ADP-13: SHOULD: choose the simplest technology that fits.** A full ORM is not mandatory. Use plain SQL or a lighter mapper when it serves the port better.
- **ARCH-ADP-14: An outgoing adapter does what its port method promises and nothing more.** A port method `save(user)` stores that user. It does not also update another table as a side effect, it applies no business rule (defaults, "if the state changed, rewrite the current period"), and it reads no wall clock (ARCH-UC-20). A value derived from time-versioned facts (the "current" state of a history, a running total) is either computed on read or written by the use case that changes the facts. It is never a denormalised copy that the adapter keeps in sync on every save. A rule that has to happen on save belongs in the use case, where its unit test and its audit entry can see it.
  *Why:* every caller of `save` runs a hidden rule the use cases cannot see or test. In a reviewed product, a profile save silently rewrote a person's dated history, which changed past and locked figures without an audit entry.

## Anti-patterns

- A controller that calls a repository "because it only updates one field".
- A `@Transactional`/transaction scope on an adapter method.
- One generic `XxxRepository` port used by all services.
- Adapter returning ORM entities through a port.
- An HTTP status exception thrown from the application layer.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Implementing Adapters".*
