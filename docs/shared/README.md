# Shared Guidelines

Rules in this folder apply to **every project, regardless of language or framework**. Technology folders (`docs/java`, `docs/spring`, `docs/typescript`, `docs/angular`, …) add to them and may tighten them, but never contradict them.

## Architecture

| Doc | Covers | Rule IDs |
|---|---|---|
| [hexagonal-architecture.md](architecture/hexagonal-architecture.md) | Vocabulary, dependency rule, when to use the style | `ARCH-DEP-*` |
| [code-organization.md](architecture/code-organization.md) | Reference folder/package layout, allowed dependencies | `ARCH-ORG-*` |
| [use-cases.md](architecture/use-cases.md) | Use-case slicing, commands/results, validation placement, domain model style | `ARCH-UC-*` |
| [adapters.md](architecture/adapters.md) | Incoming and outgoing adapters, narrow ports, transactions | `ARCH-ADP-*` |
| [mapping-between-boundaries.md](architecture/mapping-between-boundaries.md) | Mapping strategies and defaults | `ARCH-MAP-*` |
| [enforcing-boundaries.md](architecture/enforcing-boundaries.md) | Visibility, architecture tests, build modules | `ARCH-ENF-*` |
| [conscious-shortcuts.md](architecture/conscious-shortcuts.md) | Broken windows, ADRs, shortcut catalogue | `ARCH-SC-*` |

## Testing

| Doc | Covers | Rule IDs |
|---|---|---|
| [testing-by-architecture-element.md](testing/testing-by-architecture-element.md) | Test type per architecture element, measuring "enough" | `TEST-ARCH-*` |
| [tdd.md](testing/tdd.md) | Test-first workflow, London/Chicago style per element | `TEST-TDD-*` |

## APIs

| Doc | Covers | Rule IDs |
|---|---|---|
| [openapi-contracts.md](api/openapi-contracts.md) | Code-first OpenAPI specs, versioning, generated consumers | `API-CON-*` |
| [avoiding-n-plus-one.md](api/avoiding-n-plus-one.md) | N+1 requests and waterfalls over REST: strategies and tests | `API-N1-*` |

## Repository

| Doc | Covers | Rule IDs |
|---|---|---|
| [repository-layout.md](repository/repository-layout.md) | One repo per product, component folders, subfolder tooling, CI, decision guide for separate repos | `REPO-*` |

## Accessibility

| Doc | Covers | Rule IDs |
|---|---|---|
| [wcag.md](accessibility/wcag.md) | WCAG 2.2 AA (AAA where possible), test layers | `A11Y-*` |

## Tooling

| Doc | Covers | Rule IDs |
|---|---|---|
| [agent-skills.md](tooling/agent-skills.md) | Installing, updating, reviewing and distributing agent skills | `TOOL-SKL-*` |
| [ide-setup.md](tooling/ide-setup.md) | VS Code and IntelliJ IDEA Ultimate configuration | `TOOL-IDE-*` |

## Baseline defaults

Where the sources leave a choice open, this baseline decides:

| # | Topic | Default | Defined in |
|---|---|---|---|
| D1 | Incoming ports | Required; skipping needs an ADR | conscious-shortcuts.md |
| D2 | Domain model | Rich for logic-heavy domains, anemic OK for CRUD | use-cases.md |
| D3 | Mapping | Full (adapter→app, commands); none → two-way (persistence, queries) | mapping-between-boundaries.md |
| D4 | Enforcement | Architecture tests from day one; build modules once stable | enforcing-boundaries.md |
| D5 | Coverage | Not the success metric; confidence to ship + bug post-mortems | testing-by-architecture-element.md |
| D6 | ADRs | `docs/adr/NNNN-title.md`, Nygard format | conscious-shortcuts.md |
| D7 | TDD style | London by default; Chicago for domain and pure code; mixing expected | testing/tdd.md |
| D8 | API contracts | OpenAPI, code-first; spec committed per major version; clients generated | api/openapi-contracts.md |
| D9 | N+1 over REST | Checked for every data-loading change; strategy recommended, developer decides | api/avoiding-n-plus-one.md |
| D10 | Accessibility | WCAG 2.2 AA mandatory, adopted AAA set where possible, asserted by tests | accessibility/wcag.md |
| D11 | Agent skills | Docs win over skills; third-party skills pinned and reviewed | tooling/agent-skills.md |
| D12 | Repository layout | One repo per product, backend and frontends in component folders; separate repos only for signals from the decision guide, with an ADR | repository/repository-layout.md |

Stack docs add their own defaults (e.g. TypeScript: ports return `Promise`, zod for schemas; see [typescript/README.md](../typescript/README.md)).

## Conventions for these docs

- Rules have stable IDs (`PREFIX-AREA-NN`). Reference them in reviews, commits and ADRs. Never renumber existing IDs; deprecate instead.
- **MUST** = mandatory; deviations need an ADR. **SHOULD** = default; deviate with a stated reason.
- Each doc ends with an agent checklist and its sources.
- Future topics (preferred libraries, tooling, CI, …) get their own sub-folder next to `architecture/` and `testing/`.
