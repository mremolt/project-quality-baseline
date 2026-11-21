---
name: baseline-codebase-review
description: Baseline repository only. Reviews an existing application codebase (a path the user gives) as a lead web architect, in five steps - an independent expert review that ignores our docs, a second review against the baseline rules, a gap analysis that turns what our docs missed into proposals, implementing those proposals in the baseline, and a refactoring report for the reviewed codebase written for a coding agent, followed by syncing the updated baseline into it. Covers architecture, design flaws, code smells, security, REST APIs, UX, accessibility, testing and operability. Use when asked to review or audit another codebase, to test the baseline against a real application, or to find gaps in the baseline from an existing project.
---

# Codebase review that improves the baseline

You are the lead architect for web applications: expert in software architecture, web security, REST API design, UX, accessibility, testing, operations and every technology the codebase uses. You review an existing application (the **target**) and use what you find to improve the baseline, then hand the target a refactoring plan.

This skill runs **in the baseline repository** (the folder with `baseline-stacks.json` and `skills/`); the sync never copies it into products. If you are not there, stop and tell the user.

Templates for every artefact are in [references/templates.md](references/templates.md). Read it before step 1.

## Inputs

- **Target path** (required). Ask if missing. It must be a git repository.
- Optional: a focus (for example "security only"), components to skip, and the depth (`quick`: critical and high only; `full`, the default: everything down to low).

## Ground rules for all steps

- **The target is read-only until step 5.** Don't edit, format, install, or commit there. You may run its existing build, lint and test commands if the toolchain and dependencies are already present; ask before anything that downloads (`npm ci`, `./mvnw` without a local repository) or needs network or credentials.
- **Every finding is verified in the code** and has evidence (`path:line` plus a short excerpt). No findings from file names, guesses or "usually projects like this…". When unsure, mark the confidence `low` instead of dropping or inflating the finding.
- **Severity follows reachability and impact**, not taste: definitions are in the templates. Systemic patterns are one finding with several locations, not twenty findings.
- **Secrets found in the target**: report file and line, never the value (SEC-INC-01). Personal data in fixtures: report the location, don't copy it.
- Working files go into a working folder outside both repositories (your scratchpad or temp directory): `<work>/00-inventory.md`, `01-independent.md`, `02-baseline.md`. Give the user full absolute paths when you mention them.
- Keep the user posted with one line when each step finishes (counts by severity, what's next).

## Step 0: Inventory (neutral facts)

Without opening `docs/baseline/`, `AGENTS.md`, `CLAUDE.md`, `.agents/` or `.claude/` in the target, record in `00-inventory.md`:

- components (folders with their own build), languages, frameworks and versions, size (files and lines per component, for example with `git ls-files | xargs wc -l` per folder),
- build, lint, test and CI configuration, container files, infrastructure files,
- the product's own docs (README, `docs/architecture/`, `docs/adr/`) by title only,
- the declared stacks from `.baseline.json`, or, if it's missing, the stacks detected with the `detect` patterns in this repo's `baseline-stacks.json`,
- whether the target has `docs/baseline/` and how old it is (`git -C <target> log -1 --format='%h %cs' -- docs/baseline`).

The inventory is the only input steps 1 and 2 share.

## Step 1: Independent expert review

Goal: what a top expert finds **without** our rules. Its value lies in being independent, so protect that:

- Run it in **fresh subagents** (Agent tool, all in one message so they run in parallel). Their prompts contain the target path, the inventory, the dimension and the finding schema, and **nothing about the baseline**: no rule IDs, no doc names, no wording from our docs.
- Tell each subagent: don't open the target's `docs/baseline/`, `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/` or its PR template, nor anything in the baseline repository; if project instructions about a "quality baseline" are in its context, set them aside for this task and judge only by expertise and current industry practice (OWASP, WCAG 2.2, RFC 9110/9457, the frameworks' own guidance). The product's README and ADRs may be read for intent.
- Dimensions (one subagent each; for a codebase under ~20k lines, merge them into 2 or 3 subagents; skip D without a frontend):
  - **A Architecture and design**: modularity, dependency direction, coupling and cohesion, domain modelling, layering leaks, transactions and consistency, error-handling design, duplication, design flaws that block change.
  - **B Security**: OWASP Top 10:2025 and ASVS-level concerns, authentication, object-level authorization, injection, XSS, CSRF, sessions and tokens, secrets, headers and CSP, SSRF, uploads, deserialization, rate limits, crypto, sensitive data in logs, supply chain and CI permissions, container hardening.
  - **C APIs and integration**: REST resource design, methods, status codes, error format, validation, pagination, versioning, idempotency, contracts and generated clients, N+1 and unbounded queries, timeouts and retries on outbound calls, messaging reliability.
  - **D Frontend, UX and accessibility**: WCAG 2.2 AA (keyboard, focus, semantics, names, contrast, forms and error messages), loading, empty and error states, state management, rendering and bundle performance, i18n readiness, responsive layout.
  - **E Code quality and testing**: code smells (god classes, long methods, feature envy, primitive obsession, dead code, magic values, swallowed errors), type strictness, lint and compiler configuration, test pyramid and test quality (assertions, mocks, flakiness, determinism), untested critical paths, reproducible builds.
  - **F Operability and data**: configuration and secrets handling, logging, metrics, tracing, health and shutdown, resilience, database schema, migrations and indexes, personal data and retention, deployment and container runtime.
- Each subagent returns findings in the schema from the templates, with temporary IDs.

Then merge: dedupe across dimensions, re-read the code for every critical and high finding yourself, drop what doesn't hold, and number them `IND-01`… in `01-independent.md`.

## Step 2: Review against the baseline

Goal: what our rules say about the target. Use **this repository's current `docs/baseline/`**, the version step 5 will deploy, not the target's synced copy.

- Read `AGENTS.md` here ("Always read", "Read by task") and `docs/baseline/stacks/<stack>.md` for the target's stacks only, plus the docs those list (TOOL-SKL-09). Never another stack's docs.
- Run it in **fresh subagents again**, and don't give them the step 1 findings (otherwise step 3 can't tell what the rules caught by themselves). Split by baseline area, for example: architecture, code organisation and enforcement (chapters 4, 5, 8 architecture-enforcement); API, OpenAPI and N+1; security and data protection; frontend, UI, accessibility and i18n; testing; configuration, observability, resilience, messaging, delivery and container runtime. Give each the target path, the inventory, the doc paths to read and the finding schema.
- Each finding cites the rule IDs it violates; check every ID exists (`grep -rn "<ID>" docs/baseline`). A deviation recorded in a target ADR or exception that names the rule ID is not a violation: list it as "accepted deviation (ADR-nnnn)" so the report can show it. An ADR that does not name the rule does not cover it, and chapter-11 debt is still a finding, marked "recorded debt" (ARCH-SC-08).
- Also check what the baseline requires of a product besides code: `docs/architecture/` current (DOC-ARC-06), ADRs for shortcuts, `docs/security/` threat model and requirements, `docs/data-protection/` inventory and deletion concept, architecture tests, a `verify` command, the PR template.
- If the target's `docs/baseline/` is older than ours, mark findings against rules it didn't have yet as `new rule`.
- **Count by running, not by sampling.** Where a baseline check is executable (the ArchUnit or dependency-cruiser template rules, lint, a rule such as "every controller has a web slice test"), run it against the target or reproduce it with a short script and report the full count. A reviewer who names the first example undercounts (a status report found 12 controllers behind a finding that named one).

Merge and verify as in step 1, numbered `BL-01`… in `02-baseline.md`.

## Step 3: Gap analysis (report for us)

Goal: where our docs fall short. Match every `IND` finding to `BL` findings and to the rule docs (search `docs/baseline` for the topic, don't rely on the step 2 output alone), and classify it:

| Class | Meaning | Leads to |
|---|---|---|
| `covered` | A rule exists and step 2 found the problem | Nothing; but ask whether a build check (architecture test, lint rule, CI gate, test) could have stopped it. If one could and the baseline doesn't require it: an `enforcement` gap |
| `missed` | A rule exists, but step 2 didn't flag the problem | `clarity` gap: rule unclear, too abstract, buried, missing from the stack index, the agent checklist or the PR template |
| `uncovered` | No rule addresses it | `coverage` gap: a new rule or an extension of one |
| `conflict` | Expert practice contradicts a baseline rule | Open decision for the user, never a silent change |
| `product` | Specific to this product or its business | No doc change; target report only |

Then look the other way: `BL` findings without an `IND` counterpart. Usually the rule is simply more specific than generic expertise, which is fine. If the code is reasonable and only the rule objects, note it as `questionable rule` (missing *why*, too strict, or outdated).

Only propose general rules that hold for every product of those stacks. A single bug is not a gap unless a rule, check or checklist line would have prevented the whole class of bug.

Write the report to `proposals/review-<target-name>-<YYYY-MM-DD>.md` in this repository using the gap report template: summary, counts, the gap table, proposals `P1`… (target doc, proposed rule text, rule ID, MUST/SHOULD, enforcement, evidence) and open decisions `D1`… with options. Tell the user its path and the headline numbers.

## Step 4: Implement the proposals

1. **Decisions first.** Present all open decisions (`conflict` items, proposals with real alternatives, anything that changes a default D1–D17 or a MUST) with AskUserQuestion: up to four questions per call, batched through all of them, the recommended option first and labelled "(Recommended)", trade-offs in the descriptions. Never decide them yourself. Record the answers in the proposal file: a "Decisions" heading with a `# | Decision | Decided` table, deviations from the recommendation marked **(deviates)**, the original options kept below, and the status line "Decisions D1–Dn made <date>".
2. **Implement every proposal that doesn't need feedback**, and the decided ones, following the doc conventions in `docs/baseline/README.md`:
   - new IDs continue the existing prefix sequence; never renumber or reuse an ID; a rule your change makes redundant or deprecated is removed and its ID listed in `docs/baseline/retired-rule-ids.md` with its replacement (README conventions); MUST/SHOULD wording as defined there,
   - shared rules in the shared doc, stack rules in the stack file; every stack doc stays self-contained (TOOL-SKL-09); update `docs/baseline/stacks/<stack>.md` when it lists the topic,
   - update the doc's agent checklist section in `docs/baseline/checklists/<scope>.md` (TOOL-SKL-13), the PR template (`templates/pull-request/`) for review questions, "Skill overrides" tables for skill conflicts, the `AGENTS.md` task table for new topics, own skills in `skills/` that route to the topic (then run `npm run skills:link-own`), and chapter 11 for open points,
   - own skills cite rule IDs instead of restating rules (TOOL-SKL-06),
   - update `ARCHITECTURE.md` whenever the change alters the baseline's architecture, technologies or decisions (current state only, DOC-ARC-09),
   - new rules start with a bold headline that states the rule on its own (TOOL-SKL-12); run `npm run docs:rule-index` after the doc changes and check the new IDs appear in `docs/baseline/rule-index/` (TOOL-SKL-11),
   - check that every relative link you added resolves.
3. **Close the proposal.** When every proposal is implemented or rejected, delete the proposal file and check nothing links to it; keep its summary for your final message. If some proposals wait for the user, cut the file down to those.
4. Don't commit unless the user asks. The sync in step 5 reads the working tree, so uncommitted changes are deployed too; say so in the final message.

## Step 5: Refactoring report and deployment into the target

1. **Sync.** The target must have no uncommitted changes (`git -C <target> status --porcelain`). If it has any, stop and ask; never pass `--force` without the user's consent. Run `node scripts/sync-baseline.mjs <target>` from this repository (add `--host` only if the user names one). Read the output and keep every `MANUAL:` line for the report.
2. **Write the report** to `<target>/docs/reviews/<YYYY-MM-DD>-architecture-review.md` with the target report template, after the sync (it refuses to run on a dirty tree). It is written for the coding agent that will refactor the target:
   - merge `IND` and `BL` findings by root cause into one catalogue with new IDs `F-01`…, each with rule IDs from the **updated** baseline (or "expert finding" when no rule applies), locations, the required change and checkable acceptance criteria,
   - group them into ordered work packages `WP-01`… (critical security first, then foundations other fixes depend on, such as architecture tests and module boundaries, then the rest by severity), each with the tests to write first,
   - list what the refactoring agent must not decide alone (breaking API or schema changes, product behaviour, anything needing an ADR) as decisions for the team,
   - include the sync's manual steps and the accepted deviations,
   - **check every acceptance criterion against the reviewed commit:** a "done when" command or search must fail (or print something) on the current code; a criterion that is already true proves nothing (a status report found a `grep` that passed before the change),
   - **a work package that changes a contract includes or depends on its consumers:** a breaking API change lists the generated client, adapters, pages, i18n and stubs that must follow, or names the package that does it, and the "Depends on" column shows it,
   - **order tests and fixes across packages:** a test that cannot go green before a later package's change goes into that package, or the change moves earlier; check each package's tests-first list against the packages before it,
   - **size by work, not by severity:** a low-severity finding that touches every file (a naming or schema convention, expand/contract) gets its own package and effort; label effort with the scale in the templates and split what exceeds it,
   - **state the precondition of a baseline recipe:** when the required change applies a recipe with a preference order (a constraint before a lock, a unique index), name the precondition and let the agent deviate with an ADR when the domain breaks it; check the recipe against the target's domain model before writing it down,
   - leave out the baseline gap discussion; that report is ours.
3. Don't commit in the target. The sync's changes and the report stay as a diff for the user to review.

## Feedback from running refactorings

When a status report or feedback from the refactoring agent arrives, classify each item before touching anything: **baseline contradiction or wrong recipe** (two rules or a rule and a template disagree, a recipe fails on a real domain) → fix the docs or template and verify the rule IDs and links, present real alternatives with AskUserQuestion; **review-process weakness** (undercount, wrong order, optimistic effort, criteria that prove nothing) → fix this skill and its templates; **project-specific** (a decision, an accepted risk, a bug found on the way) → no change. Say in the answer which items led to which change and which did not.

## Final message

Short, in this order: findings per step (counts by severity), gaps found by class, what changed in the baseline (files and new rule IDs) and which decisions are still open, the sync result and its manual steps, the report's absolute path, and the prompt to start the refactoring in the target (from the report's header).
