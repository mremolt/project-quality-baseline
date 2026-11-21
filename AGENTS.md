<!-- baseline:start (managed by scripts/sync-baseline; edit in the baseline repo, project notes go below the end marker) -->
# Project Quality Baseline: Agent Guide

This repository is a shared quality baseline that our projects import. It defines how we structure, build and test software across all technologies. Follow these documents when working in any project that includes this baseline.

## How the docs are organized

- `docs/baseline/`: the baseline as an **arc42 reference architecture** (chapters `01-…` to `12-…`), synced from the baseline repository. Shared rules apply to every project; stack files (`java`, `spring`, `node`, `nestjs`, `typescript`, `angular`, `react`, `nextjs` in the name) add to them and may tighten them, but never contradict them. `docs/baseline/stacks/<stack>.md` maps one stack's docs; `docs/baseline/rule-index/` lists every rule ID with its headline (generated). **Read only the stacks this project uses** (listed below; declared in `.baseline.json`); never load another stack's docs or skills.
- `docs/architecture/`: this product's own arc42 documentation (project-owned), linking to the baseline. `docs/adr/`: this product's decisions.
- Agent skills (`.agents/skills/`, `.claude/skills/`) supply framework know-how. If a skill, a tech doc or a generic habit disagrees with these docs, **the docs win**. Stack docs list known conflicts in their "Skill overrides" tables.

## How to read (token budget, TOOL-SKL-10)

The docs are too large to hold at once. **Never load every doc a stack page lists.** Read in steps:

1. **Start of every task:** the rule index of the shared rules, [rule-index/shared.md](docs/baseline/rule-index/shared.md), and of each of this project's stacks (`rule-index/<stack>.md`, see "Read by stack"). One line per rule ID, so you know every rule exists. Also [hexagonal-architecture.md](docs/baseline/04-solution-strategy/hexagonal-architecture.md) (dependency rule, vocabulary), [code-organization.md](docs/baseline/05-building-block-view/code-organization.md) (where code goes) and the defaults D1–D17 in [04-solution-strategy/README.md](docs/baseline/04-solution-strategy/README.md).
2. **Topics the task touches:** the docs from "Read by task" below, or from the entry skill's task table. Nothing else.
3. **A rule from a doc you have not read:** search the doc for its ID and read that bullet before implementing against it.
4. **Before finishing:** the agent checklist sections of the docs you used; each doc's last line points to its section in `docs/baseline/checklists/`.

## Read by task

| Task | Docs |
|---|---|
| Adding or changing a use case | [05-building-block-view/use-cases.md](docs/baseline/05-building-block-view/use-cases.md), [08-crosscutting-concepts/mapping/mapping-between-boundaries.md](docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md) |
| Adding a controller, listener, UI, DB, messaging or API client | [05-building-block-view/adapters.md](docs/baseline/05-building-block-view/adapters.md) |
| Designing or consuming a REST API | [08-crosscutting-concepts/api/rest-conventions.md](docs/baseline/08-crosscutting-concepts/api/rest-conventions.md), [08-crosscutting-concepts/api/openapi-contracts.md](docs/baseline/08-crosscutting-concepts/api/openapi-contracts.md), [08-crosscutting-concepts/api/avoiding-n-plus-one.md](docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md) |
| Writing tests | [08-crosscutting-concepts/testing/tdd.md](docs/baseline/08-crosscutting-concepts/testing/tdd.md), [08-crosscutting-concepts/testing/testing-by-architecture-element.md](docs/baseline/08-crosscutting-concepts/testing/testing-by-architecture-element.md) (element → test type table) |
| Multilingual product: user-visible text, translations, locales, language switch, localized errors or emails | [08-crosscutting-concepts/i18n/i18n.md](docs/baseline/08-crosscutting-concepts/i18n/i18n.md), skill `baseline-i18n` |
| Building or changing UI | [10-quality-requirements/accessibility.md](docs/baseline/10-quality-requirements/accessibility.md) | <!-- stack:typescript -->
| Security-relevant change (auth, input, headers, secrets, crypto, audit trail, dependencies, CI), security review, threat model | [08-crosscutting-concepts/security/security-review.md](docs/baseline/08-crosscutting-concepts/security/security-review.md), [security-requirements.md](docs/baseline/08-crosscutting-concepts/security/security-requirements.md), skill `baseline-security` |
| Configuration, environment variables, secrets, profiles, frontend runtime config | [08-crosscutting-concepts/configuration/configuration.md](docs/baseline/08-crosscutting-concepts/configuration/configuration.md) and its stack file |
| Health probes, graceful shutdown, metrics, tracing, frontend error reporting, SLOs and alerts | [08-crosscutting-concepts/observability/observability.md](docs/baseline/08-crosscutting-concepts/observability/observability.md) and its stack file |
| Outbound calls, timeouts, retries, idempotency, scheduled jobs, caching | [08-crosscutting-concepts/resilience/resilience.md](docs/baseline/08-crosscutting-concepts/resilience/resilience.md) and its stack file |
| Events, message listeners and producers, outbox, dead letters | [08-crosscutting-concepts/messaging/messaging.md](docs/baseline/08-crosscutting-concepts/messaging/messaging.md) and its stack file |
| Personal data: new fields, storage, retention, data subject requests, test data, third-party services | [08-crosscutting-concepts/data-protection/data-protection.md](docs/baseline/08-crosscutting-concepts/data-protection/data-protection.md) |
| Release, versioning, branching, deployment, migrations at deploy time, feature flags | [07-deployment-view/delivery-and-release.md](docs/baseline/07-deployment-view/delivery-and-release.md) |
| Container image, frontend delivery in the BFF, runtime settings (resources, read-only filesystem, termination) | [07-deployment-view/container-runtime.md](docs/baseline/07-deployment-view/container-runtime.md) |
| Backend: auth, logging, database/migrations, JSON/REST conventions, libraries, local services | [stacks/spring.md](docs/baseline/stacks/spring.md) and the doc it lists for the topic | <!-- stack:spring -->
| Backend: auth, logging, database/migrations, JSON/REST conventions, libraries, local services | [stacks/nestjs.md](docs/baseline/stacks/nestjs.md) and the doc it lists for the topic | <!-- stack:nestjs -->
| Next.js server: BFF login and session, `proxy.ts`, server actions, route handlers, image and deployment | [stacks/nextjs.md](docs/baseline/stacks/nextjs.md) and the doc it lists for the topic | <!-- stack:nextjs -->
| Touching architecture tests, modules or visibility | [08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md](docs/baseline/08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md) |
| Tempted to skip a layer or share a model | [11-risks-and-technical-debt/conscious-shortcuts.md](docs/baseline/11-risks-and-technical-debt/conscious-shortcuts.md) |
| Architecture change (new component, adapter, external system, deployment target), new project | [08-crosscutting-concepts/development/architecture-documentation.md](docs/baseline/08-crosscutting-concepts/development/architecture-documentation.md); update the affected chapter in `docs/architecture/` |
| New project, project plan, repository setup or CI pipeline | [07-deployment-view/repository-layout.md](docs/baseline/07-deployment-view/repository-layout.md) |
| Adding/updating agent skills | [08-crosscutting-concepts/development/agent-skills.md](docs/baseline/08-crosscutting-concepts/development/agent-skills.md) |
| IDE configuration | [08-crosscutting-concepts/development/ide-setup.md](docs/baseline/08-crosscutting-concepts/development/ide-setup.md), skill `baseline-ide-setup` |

## Read by stack

At the start of a task read the rule index of every stack in the chain (plus `shared.md`). The stack page maps its docs by topic; open them by task, never all at once.

| Stack | Rule index | Doc map | Skills to load |
|---|---|---|---|
| Java (any) | [java](docs/baseline/rule-index/java.md) | [stacks/java.md](docs/baseline/stacks/java.md) | `baseline-tdd` | <!-- stack:java -->
| Spring Boot | [java](docs/baseline/rule-index/java.md) + [spring](docs/baseline/rule-index/spring.md) | [stacks/spring.md](docs/baseline/stacks/spring.md) | **`baseline-spring` before any backend code** (it loads `spring-boot-testing`, `spring-security`, `spring-observability`, `java-hibernate-jpa`, `baseline-tdd`) | <!-- stack:spring -->
| Node.js (any backend) | [node](docs/baseline/rule-index/node.md) | [stacks/node.md](docs/baseline/stacks/node.md) | `baseline-tdd`, `vitest` | <!-- stack:node -->
| NestJS | [node](docs/baseline/rule-index/node.md) + [nestjs](docs/baseline/rule-index/nestjs.md) | [stacks/nestjs.md](docs/baseline/stacks/nestjs.md) | **`baseline-nestjs` before any backend code** (it loads `baseline-tdd`, `vitest`, `baseline-security`) | <!-- stack:nestjs -->
| TypeScript frontend (any) | [typescript](docs/baseline/rule-index/typescript.md) | [stacks/typescript.md](docs/baseline/stacks/typescript.md) | `baseline-tdd`, `vitest`, `playwright-best-practices` | <!-- stack:typescript -->
| Angular | [typescript](docs/baseline/rule-index/typescript.md) + [angular](docs/baseline/rule-index/angular.md) | [stacks/angular.md](docs/baseline/stacks/angular.md) | **`baseline-angular` before any Angular code** (it loads `angular-developer`, `ngrx-signals`, `angular-material-design`, `orval`, `accessibility`) | <!-- stack:angular -->
| React (SPA, and the base of Next.js) | [typescript](docs/baseline/rule-index/typescript.md) + [react](docs/baseline/rule-index/react.md) | [stacks/react.md](docs/baseline/stacks/react.md) | **`baseline-react` before any React code** (it loads `vercel-react-best-practices`, `tanstack-query-best-practices`, `material-ui-theming`, `material-ui-styling`, `orval`, `accessibility`) | <!-- stack:react -->
| Next.js | [typescript](docs/baseline/rule-index/typescript.md) + [react](docs/baseline/rule-index/react.md) + [nextjs](docs/baseline/rule-index/nextjs.md) | [stacks/nextjs.md](docs/baseline/stacks/nextjs.md) | **`baseline-nextjs` before any Next.js code** (it loads the React skills and routes to the Next.js docs) | <!-- stack:nextjs -->

## Non-negotiables for agents

- Dependencies point inward. Never import adapters or frameworks into `domain` / `ports`.
- Never weaken or delete an architecture test, compiler check, static-analysis rule, lint rule, security check (header, scanner gate, security test) or accessibility check to make a build pass. Raise it instead (SEC-REV-02).
- Security-relevant changes answer the security checklist (SEC-REV-01); new entry points, outbound calls, roles or personal data get a threat model in the PR (SEC-TM-02). Secrets never enter git, logs or images (SEC-INC-01).
- Never introduce an architectural shortcut silently. Propose it and draft an ADR (`docs/adr/`).
- Keep `docs/architecture/` (arc42) current: architecture changes update the affected chapter in the same change ([DOC-ARC-06](docs/baseline/08-crosscutting-concepts/development/architecture-documentation.md)).
- New code comes with the test type its architecture element requires, written test-first.
- Every outbound call has explicit timeouts ([RES-TMO-01](docs/baseline/08-crosscutting-concepts/resilience/resilience.md)); every message consumer is idempotent ([MSG-IDM-01](docs/baseline/08-crosscutting-concepts/messaging/messaging.md)).
- New personal data updates the product's inventory and deletion concept ([DP-INV-03](docs/baseline/08-crosscutting-concepts/data-protection/data-protection.md)); production personal data never enters non-production environments (DP-ENV-01).
- **Check every data-loading change for N+1 requests** and recommend a strategy; the developer decides ([API-N1-01](docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md)).
- UI must meet WCAG 2.2 AA (AAA where possible), asserted by tests. <!-- stack:typescript -->
- REST clients and DTO types are generated from the OpenAPI spec, never hand-written.
- **Check every new project or project plan against the repository decision guide** and advise: one repo per product is the default, separate repos need a signal and an ADR; the team decides ([REPO-LAY-02](docs/baseline/07-deployment-view/repository-layout.md)).
- In a product repo, run stack commands from the component folder (`backend/`, `frontend/`) (REPO-TOOL-03).
- Cite rule IDs (e.g. `ARCH-UC-05`) when explaining design decisions in reviews or PRs.
<!-- baseline:end -->

## This repository (the baseline itself)

- **"Deploy the baseline to `<folder>`"** means the sync followed by the IDE setup, without asking in between:
  1. `node scripts/sync-baseline.mjs <folder>` (add `--host` only if the user names one). It refuses a target with uncommitted changes: stop and ask; never pass `--force` without consent.
  2. In `<folder>`, follow the `baseline-ide-setup` skill (`skills/baseline-ide-setup/SKILL.md`): run `.agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh .` from the target's root (`.cmd` on Windows), resolve its `MANUAL:` lines and review the diff.
  3. Report the `MANUAL:` lines of both steps and the one-time per-developer IDE steps. Don't commit in the target.
- **Reviewing another codebase** to test or improve the baseline: load the skill `baseline-codebase-review`. It is listed under `baselineOnly` in `baseline-stacks.json`, so the sync never copies it.
- **Keep [ARCHITECTURE.md](ARCHITECTURE.md) current.** Every change to `docs/baseline/`, the skills, templates or sync that alters the baseline's architecture, technologies or decisions updates `ARCHITECTURE.md` in the same change. The file shows the current state only: no changelog, no dates of changes, no superseded or reverted decisions ([DOC-ARC-09](docs/baseline/08-crosscutting-concepts/development/architecture-documentation.md)).
