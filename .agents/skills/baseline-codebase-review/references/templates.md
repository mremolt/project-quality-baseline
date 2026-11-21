# Templates for the codebase review

## Severity

| Severity | Meaning |
|---|---|
| `critical` | Exploitable from outside or causes data loss or corruption now; fix before the next release |
| `high` | A real security weakness, broken core behaviour, a WCAG A/AA failure on a main journey, or a design flaw that blocks most changes in its area |
| `medium` | Likely to cause bugs, incidents or growing cost; a rule violation without immediate impact |
| `low` | Local smell, missing hardening with little exposure, inconsistency |

Confidence: `high` (verified in code and, where possible, by running it), `medium` (verified in code, impact inferred), `low` (pattern seen, impact uncertain).

## Finding schema (steps 1 and 2)

Subagents return one block per finding; the working files use the same form.

```markdown
### <ID>: <one-line title>
- Severity: critical | high | medium | low   · Confidence: high | medium | low
- Dimension: architecture | security | api | frontend-ux-a11y | quality-testing | operability-data
- Rules: <rule IDs; step 2 only; "accepted deviation (ADR-nnnn)" if recorded> · New rule: yes | no
- Locations: `path/to/file.ts:42`, `path/other.java:10-31` (all occurrences of a systemic pattern, or the first five plus a count)
- Evidence: <short excerpt or command output that shows the problem>
- Why it matters: <consequence, attack or failure scenario>
- Fix: <the change, concrete enough to implement>
- Effort: S (< 1 h) | M (up to one day) | L (one to two days with agents; more is split into several packages)
```

## Gap report (step 3): `proposals/review-<target-name>-<YYYY-MM-DD>.md`

```markdown
# Review of <target-name>: gaps in the baseline

Status: proposed <date> · Target: <name> (stacks: <stacks>; synced baseline <age or "none">) · Working files: <absolute paths>

## Summary
<3–6 sentences: what the target is, overall quality, the most important gaps in our docs.>

| | critical | high | medium | low |
|---|---|---|---|---|
| Independent review (IND) | | | | |
| Baseline review (BL) | | | | |

| Class | Count |
|---|---|
| covered (no gap) / enforcement gap / clarity gap / coverage gap / conflict / product / questionable rule | |

## Gap table
| IND/BL | Title | Class | Existing rule | Proposal |
|---|---|---|---|---|

## Proposals
### P1: <title>
- Gap: enforcement | clarity | coverage | questionable rule · Evidence: IND-03, IND-11, BL-07
- Target: `docs/baseline/<path>` (section) · Rule ID: <new or changed ID> · Keyword: MUST | SHOULD
- Proposed text: <the rule as it will read, with its *Why:*>
- Enforcement: <architecture test, lint rule, CI gate, test, PR checklist line, or "review only">
- Also update: <stack index, checklist, PR template, skill, AGENTS.md, ARCHITECTURE.md>
- Needs decision: no | D<n>

## Open decisions
### D1: <question>
- Context: <what the review found, which rule it touches>
- Options: A (recommended) <…>, B <…>, C <…> with trade-offs
```

## Target report (step 5): `docs/reviews/<YYYY-MM-DD>-architecture-review.md`

Written for a coding agent. Every item must be actionable without the conversation that produced it: file paths, rule IDs, acceptance criteria that can be checked by a command, a test or a search.

````markdown
# Architecture review <YYYY-MM-DD>: refactoring plan

Reviewed commit: <sha> · Stacks: <stacks> · Baseline synced: <baseline commit sha> on <date> · Findings: <n> (<c> critical, <h> high, <m> medium, <l> low)

## How to work through this report
Paste this into the agent session in this repository:

```
Work through docs/reviews/<file>.md. Read AGENTS.md and its "Always read" docs first and load the entry skills for this repository's stacks before writing code.
- Take the work packages in order. Within one, write the listed tests first (they must fail), then change the code until they and the full verify command pass.
- Never weaken a test, architecture rule, lint, security or accessibility check to get green (SEC-REV-02).
- Items under "Decisions for the team" are not yours to decide: implement what doesn't depend on them, then stop and ask.
- If a fix needs a shortcut or a deviation from the baseline, draft an ADR in docs/adr/ and ask.
- Update docs/architecture/ when the architecture changes (DOC-ARC-06).
- Run every new test against the unchanged code first and keep it only if it fails; say in the commit message whether the red step was observed, and when tests were written after the code, say that in the status.
- After each work package: set its status in this report, commit with a message naming the work package and rule IDs. Don't push.
```

## Baseline changes that matter here
<The sync's MANUAL steps, and new or changed rules since the target's previous baseline that produce findings below.>

## Work packages
| WP | Title | Findings | Priority | Depends on | Effort | Status |
|---|---|---|---|---|---|---|
| WP-01 | | F-01, F-04 | critical | – | M | open |

### WP-01: <title>
- Goal: <the state after this package>
- Findings: F-01, F-04 · Rules: <IDs>
- Tests first: <test type per testing-by-architecture-element.md, what it asserts, where it goes>
- Consumers: <for a contract change (API, schema, event): the generated client, adapters, pages, i18n, stubs and docs that must follow, here or in the package named in Depends on>
- Steps: <ordered, concrete>
- Done when: <checkable criteria: commands, tests, searches that return nothing; each one verified to fail on the reviewed commit>

## Findings
### F-01: <title>
- Severity: · Rules: <IDs or "expert finding"> · Source: IND-nn, BL-nn
- Locations: `path:line`, …
- Problem: <what is wrong and the consequence>
- Required change: <what to do>
- Acceptance: <how to verify>

## Decisions for the team
| # | Question | Options | Blocks |
|---|---|---|---|

## Accepted deviations
| Finding | ADR | Note |
|---|---|---|
````
