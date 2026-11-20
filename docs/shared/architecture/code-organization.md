# Code Organization

The folder/package structure must express the architecture, so that every box of the architecture diagram can be found in the code at a glance. This doc defines the language-neutral reference layout. Tech docs translate it into packages or folders.

## Reference layout

Below the application's root package/folder:

```
adapter
├── in
│   ├── rest
│   │   └── v1          ← versioned API
│   └── kafka           ← one sub-package per technology
└── out
    ├── kafka
    ├── s3
    └── jpa
application             ← business logic (use cases); sub-divided by a sensible functional cut
domain                  ← domain objects incl. business exceptions
ports
├── in                  ← incoming ports (use-case interfaces) + their command/query/result models
└── out                 ← outgoing ports (interfaces implemented by adapters)
```

This layout comes from our Java team (see [spring/architecture.md](../../spring/architecture.md)) and is the standard for all backend stacks. The technology names above are examples. Use the ones your app actually has.

### Several bounded contexts in one application

If an application contains more than one bounded context, repeat the layout **per context** instead of mixing them:

```
billing/  { adapter, application, domain, ports }
account/  { adapter, application, domain, ports }
```

Contexts talk to each other only through each other's **incoming ports**, never through another context's adapters or domain internals.

## Rules

- **ARCH-ORG-01: Every class/module MUST live in exactly one of `domain`, `application`, `ports/in`, `ports/out`, `adapter/in/<tech>`, `adapter/out/<tech>`, or the composition root.** A file that fits nowhere is a design smell, not a reason for a `misc` package.
- **ARCH-ORG-02: Adapters MUST be grouped by technology** (`rest`, `kafka`, `jpa`, `s3`, …) **and direction** (`in` / `out`).
  *Why:* when the team talks about "the S3 adapter", everyone knows where to look. Replacing a technology means replacing one package.
- **ARCH-ORG-03: Versioned external APIs MUST be placed in version sub-packages** (`adapter/in/rest/v1`, `v2`).
  *Why:* old and new versions can coexist and be removed separately.
- **ARCH-ORG-04: `application` is sub-divided by functional cut** (feature, use-case group or aggregate), not by technical role.
- **ARCH-ORG-05: Business exceptions belong in `domain`.** Adapters translate them into protocol-specific errors (HTTP status, dead-letter, UI message).
- **ARCH-ORG-06: Names MUST reveal use cases ("screaming architecture").** Prefer `SendMoneyService` / `SendMoneyUseCase` over `AccountService`, and `RegisterAccount` over a generic `CreateAccount` when "register" is the business term.
- **ARCH-ORG-07: Hide what isn't an entry point.** Use the language's visibility mechanisms so adapter internals and service implementations can't be referenced from outside their package/module. Ports and domain types are public by design.
- **ARCH-ORG-08: A neutral composition root wires the application.** It is the only code allowed to reference every ring. It may break single responsibility on purpose, so that everything else stays clean.

## Why this layout (and not the alternatives)

- **Package by layer** (`web`, `service`, `persistence`) gives no boundaries between features, hides use cases behind broad service names, and hides ports.
- **Plain package by feature** (`account/` containing everything flat) shows use cases, but the architecture disappears. You can't tell adapters from core, and visibility can't stop the core from importing persistence code.
- **The architecture-expressive layout** closes the "model-code gap": the diagram on the wall and the code tree match. It also forces a conscious decision about where each new class goes.

### Deviation from the book

The book nests ports under `application/port/{in,out}` and services under `application/service`. We use **top-level `ports/`**, as our Java team proposed. The dependency rule is identical either way: ports may depend only on `domain`, and `application` implements or uses ports.

## Allowed dependencies (summary)

| From \ To | domain | ports | application | adapter | composition root |
|---|---|---|---|---|---|
| **domain** | ✔ | ✘ | ✘ | ✘ | ✘ |
| **ports** | ✔ | ✔ | ✘ | ✘ | ✘ |
| **application** | ✔ | ✔ | ✔ | ✘ | ✘ |
| **adapter** | ✔ | ✔ | ✘ (only via `ports/in`) | ✘ (other adapters) | ✘ |
| **composition root** | ✔ | ✔ | ✔ | ✔ | ✔ |

[enforcing-boundaries.md](enforcing-boundaries.md) describes how to turn this table into a failing build.

## Anti-patterns

- `common`, `util`, `helper` packages shared by core and adapters.
- One adapter package per *direction only* (`adapter/out/` with everything inside), which hides the technologies.
- API DTOs of version `v1` reused by `v2` "because they're almost the same".
- Business exceptions extending framework exceptions (e.g. an HTTP status exception).

## Agent checklist

- [ ] New file placed per ARCH-ORG-01 and ARCH-ORG-02?
- [ ] Class name states the use case / business term?
- [ ] Visibility as narrow as possible?
- [ ] No new dependency that the table above marks ✘?

## Sources

Tom Hombergs, *Get Your Hands Dirty on Clean Architecture*, Packt 2019, ch. 3 (Organizing Code), ch. 9 (Assembling the Application), ch. 10 (Enforcing Architecture Boundaries). Package layout: internal proposal from our Java team.
