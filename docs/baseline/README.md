# Quality Baseline: Reference Architecture (arc42)

How we structure, build and test software, written as an **arc42 reference architecture**. Every product repository gets this folder through the sync script (replaced as a whole) and documents its own system in `docs/architecture/` (arc42, project-owned) and `docs/adr/` (decisions). The project's chapters link to these chapters instead of repeating them ([architecture-documentation.md](08-crosscutting-concepts/development/architecture-documentation.md)).

Shared rules apply to **every project, regardless of language or framework**. Stack-specific files (`java`, `spring`, `node`, `nestjs`, `typescript`, `angular`, `react`, `nextjs` in their names) add to them and may tighten them, but never contradict them. A project reads the shared docs and only the docs of its own stacks (declared in its `.baseline.json`).

## Chapters

| # | Chapter | Contents | Rule IDs |
|---|---|---|---|
| 1 | [Introduction and goals](01-introduction-and-goals/README.md) | Purpose of the baseline, quality goals, stakeholders | — |
| 2 | [Architecture constraints](02-architecture-constraints/README.md) | Technical and organisational constraints every project inherits | — |
| 3 | [Context and scope](03-context-and-scope/README.md) | The baseline, consuming projects, agents, skill sources | — |
| 4 | [Solution strategy](04-solution-strategy/README.md) | Hexagonal architecture, baseline defaults D1–D17, stack strategies, Spring and NestJS libraries | `ARCH-DEP-*`, `SPRING-LIB-*`, `NEST-LIB-*` |
| 5 | [Building block view](05-building-block-view/README.md) | Code organisation, use cases, adapters; per-stack package and folder structure | `ARCH-ORG/UC/ADP-*`, `JAVA-ARCH-*`, `SPRING-ARCH-*`, `NODE-ARCH-*`, `NEST-ARCH-*`, `TS-ARCH-*`, `NG-ARCH-*`, `REACT-ARCH-*`, `NEXT-ARCH-*` |
| 6 | [Runtime view](06-runtime-view/README.md) | Typical request, message and login flows through the rings | — |
| 7 | [Deployment view](07-deployment-view/README.md) | Repository and component layout, CI, local development environment, delivery and release | `REPO-*`, `SPRING-DEV-*`, `NEST-DEV-*`, `NEXT-DEV-*`, `REL-*`, `SPRING-REL-*`, `NEST-REL-*`, `NEXT-REL-*` |
| 8 | [Cross-cutting concepts](08-crosscutting-concepts/README.md) | API, security, configuration, observability, resilience, messaging, data protection, persistence, logging, mapping, testing, UI, development tooling, architecture enforcement | most rule prefixes |
| 9 | [Architecture decisions](09-architecture-decisions/README.md) | ADR conventions; where the baseline records its own decisions | — |
| 10 | [Quality requirements](10-quality-requirements/README.md) | Quality tree and scenarios, accessibility | `A11Y-*` |
| 11 | [Risks and technical debt](11-risks-and-technical-debt/README.md) | Conscious shortcuts, known open points of the baseline, checks to run before first use | `ARCH-SC-*` |
| 12 | [Glossary](12-glossary/README.md) | Terms used throughout the baseline | — |

## By stack

Each stack page lists its files across the chapters, the skills to load and the known skill conflicts:

| Stack | Page |
|---|---|
| Java (any) | [stacks/java.md](stacks/java.md) |
| Spring Boot | [stacks/spring.md](stacks/spring.md) |
| Node.js (backend) | [stacks/node.md](stacks/node.md) |
| NestJS | [stacks/nestjs.md](stacks/nestjs.md) |
| TypeScript (frontend) | [stacks/typescript.md](stacks/typescript.md) |
| Angular | [stacks/angular.md](stacks/angular.md) |
| React (SPA; base of Next.js) | [stacks/react.md](stacks/react.md) |
| Next.js | [stacks/nextjs.md](stacks/nextjs.md) |

## Conventions for these docs

- Rules have stable IDs (`PREFIX-AREA-NN`). Reference them in reviews, commits and ADRs. Never renumber existing IDs; deprecate instead. Moving a file to another chapter never changes its IDs.
- **MUST** = mandatory; deviations need an ADR. **SHOULD** = default; deviate with a stated reason.
- A rule without a keyword is a **MUST**, unless its wording says *prefer*, *default* or *consider*; then it is a SHOULD.
- Each rule doc ends with an agent checklist and its sources.
- New docs go into the arc42 chapter that matches their content (DOC-ARC-08). Cross-cutting topics get a folder in chapter 8 (`08-crosscutting-concepts/<topic>/`), with shared rules in a topic-named file and stack rules in `<stack>.md`. Stack files in other chapters are named `<stack>.md` or `<stack>-<topic>.md`.
