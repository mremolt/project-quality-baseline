<!-- baseline:start (managed by scripts/sync-baseline; edit in the baseline repo, project notes go below the end marker) -->
# Project Quality Baseline: Agent Guide

This repository is a shared quality baseline that our projects import. It defines how we structure, build and test software across all technologies. Follow these documents when working in any project that includes this baseline.

## How the docs are organized

- `docs/shared/`: rules that apply to **every** project. Always read the relevant ones.
- `docs/<technology>/`: additions for one stack. They implement the shared rules and may tighten them, but never contradict them.
- Agent skills (`.agents/skills/`, `.claude/skills/`) supply framework know-how. If a skill, a tech doc or a generic habit disagrees with these docs, **the docs win**. Stack docs list known conflicts in their "Skill overrides" tables.

## Always read

1. [docs/shared/README.md](docs/shared/README.md): index, baseline defaults (D1–D12), doc conventions
2. [docs/shared/architecture/hexagonal-architecture.md](docs/shared/architecture/hexagonal-architecture.md): dependency rule and vocabulary
3. [docs/shared/architecture/code-organization.md](docs/shared/architecture/code-organization.md): where code goes

## Read by task

| Task | Docs |
|---|---|
| Adding or changing a use case | [use-cases.md](docs/shared/architecture/use-cases.md), [mapping-between-boundaries.md](docs/shared/architecture/mapping-between-boundaries.md) |
| Adding a controller, listener, UI, DB, messaging or API client | [adapters.md](docs/shared/architecture/adapters.md) |
| Designing or consuming a REST API | [openapi-contracts.md](docs/shared/api/openapi-contracts.md), [avoiding-n-plus-one.md](docs/shared/api/avoiding-n-plus-one.md) |
| Writing tests | [tdd.md](docs/shared/testing/tdd.md), [testing-by-architecture-element.md](docs/shared/testing/testing-by-architecture-element.md) |
| Building or changing UI | [wcag.md](docs/shared/accessibility/wcag.md) |
| Touching architecture tests, modules or visibility | [enforcing-boundaries.md](docs/shared/architecture/enforcing-boundaries.md) |
| Tempted to skip a layer or share a model | [conscious-shortcuts.md](docs/shared/architecture/conscious-shortcuts.md) |
| New project, project plan, repository setup or CI pipeline | [repository-layout.md](docs/shared/repository/repository-layout.md) |
| Adding/updating agent skills | [agent-skills.md](docs/shared/tooling/agent-skills.md) |
| IDE configuration | [ide-setup.md](docs/shared/tooling/ide-setup.md), skill `baseline-ide-setup` |

## Read by stack

| Stack | Docs | Skills to load |
|---|---|---|
| Java (any) | [docs/java/architecture.md](docs/java/architecture.md) | `baseline-tdd` |
| Spring Boot | [docs/java/architecture.md](docs/java/architecture.md) + [docs/spring/architecture.md](docs/spring/architecture.md) + [docs/spring/openapi.md](docs/spring/openapi.md) | `baseline-tdd` |
| TypeScript (any) | [docs/typescript/README.md](docs/typescript/README.md) and the docs it lists | `baseline-tdd`, `vitest`, `playwright-best-practices` |
| Angular | everything for TypeScript + [docs/angular/README.md](docs/angular/README.md) and the docs it lists | **`baseline-angular` before any Angular code** (it loads `angular-developer`, `ngrx-signals`, `angular-material-design`, `orval`, `accessibility`) |

## Non-negotiables for agents

- Dependencies point inward. Never import adapters or frameworks into `domain` / `ports`.
- Never weaken or delete an architecture test, lint rule or accessibility check to make a build pass. Raise it instead.
- Never introduce an architectural shortcut silently. Propose it and draft an ADR (`docs/adr/`).
- New code comes with the test type its architecture element requires, written test-first.
- **Check every data-loading change for N+1 requests** and recommend a strategy; the developer decides ([API-N1-01](docs/shared/api/avoiding-n-plus-one.md)).
- UI must meet WCAG 2.2 AA (AAA where possible), asserted by tests.
- REST clients and DTO types are generated from the OpenAPI spec, never hand-written.
- **Check every new project or project plan against the repository decision guide** and advise: one repo per product is the default, separate repos need a signal and an ADR; the team decides ([REPO-LAY-02](docs/shared/repository/repository-layout.md)).
- In a product repo, run stack commands from the component folder (`backend/`, `frontend/`) (REPO-TOOL-03).
- Cite rule IDs (e.g. `ARCH-UC-05`) when explaining design decisions in reviews or PRs.
<!-- baseline:end -->
