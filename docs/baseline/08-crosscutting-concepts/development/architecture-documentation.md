# Architecture Documentation (arc42)

How products document their architecture (default D13): arc42, in Markdown, next to the code, linking to this baseline instead of copying it. The baseline itself is written as an arc42 reference architecture in `docs/baseline/`.

## Layout in a product repository

```
docs/
  baseline/          ← synced from the baseline, replaced as a whole (read-only for the project)
  architecture/      ← the product's arc42 documentation (project-owned)
    README.md
    01-introduction-and-goals.md … 12-glossary.md
  adr/               ← the product's decisions (D6); 0000-template.md to copy from
  security/          ← requirements, threat model, exceptions, incident runbook (SEC-REQ-01, SEC-TM-01, SEC-VUL-03, SEC-INC-02)
  data-protection/   ← processing record, deletion concept (DP-INV-01/02)
```

The sync creates these project-owned files from the baseline's templates once; after that the project owns them. What it creates and replaces: [agent-skills.md](agent-skills.md#distribution-to-consuming-projects).

## Rules

- **DOC-ARC-01: Every product has an arc42 documentation in `docs/architecture/`, one Markdown file per chapter** (`01-introduction-and-goals.md` … `12-glossary.md`), created from the template.
  *Why:* one file per chapter keeps diffs small, and agents can update exactly the chapter a change affects.
- **DOC-ARC-02: Product chapters link to the baseline instead of repeating it.** Every chapter with a baseline link in the table below (2, 4, 5, 6, 7, 8, 10, 11, 12) states only the product's specifics and its deviations from the baseline, each deviation with its ADR. Chapter 7 also holds the delivery platform mapping and the other product records the delivery rules ask for (REL-CD-06).
  *Why:* copies drift; the baseline is updated by re-syncing, the links stay valid because rule IDs and chapter folders are stable.
- **DOC-ARC-03: Decisions are ADRs in `docs/adr/`** (D6), copied from `docs/adr/0000-template.md`. Chapter 9 is an index: one line per ADR with its status and a link.
- **DOC-ARC-04: Chapter 11 lists the conscious shortcuts** (their ADRs, ARCH-SC-02) and known technical debt with the trigger that would make the team pay it back.
- **DOC-ARC-05: Diagrams are text in the Markdown file** (Mermaid; PlantUML only if Mermaid cannot express it). Context (chapter 3) and building blocks (chapter 5) use C4-style levels: system context, containers (our component folders), components.
  *Why:* diagrams as code are reviewed, diffed and updated by agents like any other text.
- **DOC-ARC-06: The documentation changes in the same pull request as the architecture.** A new adapter, external system, component, deployment target or quality requirement updates the affected chapter. Reviewers check it; agents update the chapter as part of the task.
- **DOC-ARC-07: Lean beats complete (SHOULD).** A chapter that does not apply says so in one line with the reason; it is not deleted and not padded.
- **DOC-ARC-08: The baseline follows the same structure.** New baseline docs go into the arc42 chapter of their content under `docs/baseline/`; cross-cutting topics get a folder in chapter 8. Moving a doc never changes rule IDs.
- **DOC-ARC-09: The baseline repository keeps `ARCHITECTURE.md` at its root current.** It is the summary of the baseline's architecture, technologies and decisions for human readers. A change to the baseline that alters any of these updates the file in the same change. It describes the current state only: no changelog, no dates of changes, no superseded or reverted decisions.
  *Why:* a summary that lags behind the rules, or mixes in history, misleads the readers it is written for; history is in git.
- **DOC-ARC-10: Product business rules live in chapter 8, section "Business rules"; open assumptions in `docs/architecture/open-questions.md`.** Business rules are the agreed answers the code implements (period definitions, crediting rules, the source of holidays), numbered so code, tests and ADRs can cite them. An assumption made while the answer is open goes into the open-questions log with the question, the assumption and who decides; once answered it moves to the business rules.
- **DOC-ARC-11: Product docs state only what exists; anything not built yet is marked as planned.** Every mechanism, value, table, endpoint or check that `docs/architecture/`, `docs/security/` or `docs/data-protection/` names (a timeout and its value, an `Idempotency-Key`, a health check, a lock guarantee, a scan, a table in the deletion concept, a library) exists in the code with that name and value. Otherwise the text marks it as planned or open, with its step or its question in `open-questions.md`. A pull request that changes such a mechanism, or finishes a planned one, updates the claim in the same change (DOC-ARC-06). Chapter 5 shows the current building blocks (packages, cuts, features, adapters as they are), not a changelog of what each step added. An ADR that a later one replaces is marked "Superseded by ADR-nnnn", and chapters 8, 9 and 11, the threat model and the data inventory point to the replacement. Before a release, and at the end of each planned step, the team checks the claims of the chapters it touched against the code.
  *Why:* reviewers and agents read the docs first and trust them. In one reviewed product, seven claims were false: timeouts and pool sizes, an idempotency key, a Compose health check, a lock guarantee, telemetry export, and tables in the deletion concept. Each false claim hides a missing protection, because nobody looks for what the docs say is already there.

## What goes where (product vs. baseline)

| Chapter | Product writes | Links to the baseline |
|---|---|---|
| 1 Introduction and goals | Requirements overview, top 3–5 quality goals, stakeholders | — |
| 2 Constraints | Customer, regulatory, hosting constraints | [02-architecture-constraints](../../02-architecture-constraints/README.md) |
| 3 Context and scope | Users, neighbouring systems, interfaces (business and technical context) | — |
| 4 Solution strategy | Product-specific strategy, deviations | [04-solution-strategy](../../04-solution-strategy/README.md) |
| 5 Building block view | Bounded contexts, features, adapters per component | [05-building-block-view](../../05-building-block-view/README.md) |
| 6 Runtime view | Important business scenarios | [06-runtime-view](../../06-runtime-view/README.md) for the generic flows |
| 7 Deployment view | Environments, infrastructure, delivery platform mapping, configuration keys and secret sources, rollout, recovery targets | [07-deployment-view](../../07-deployment-view/README.md) |
| 8 Cross-cutting concepts | Domain concepts, business rules (DOC-ARC-10), product-specific additions | [08-crosscutting-concepts](../README.md) |
| 9 Architecture decisions | ADR index | — |
| 10 Quality requirements | Product scenarios with numbers | [10-quality-requirements](../../10-quality-requirements/README.md) |
| 11 Risks and technical debt | Risks, shortcut ADRs, debt | [11-risks-and-technical-debt](../../11-risks-and-technical-debt/README.md) |
| 12 Glossary | Domain terms | [12-glossary](../../12-glossary/README.md) |

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Architecture Documentation (arc42)".*
