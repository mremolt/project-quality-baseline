# Project kickoff prompt

A prompt for starting an unattended agentic implementation in a product repository that has just synced the baseline. Not synced to projects: copy the block below into the agent session in the project.

Before using it:

- Decide the product's stacks and write them to `.baseline.json` at the project root (for example `{ "stacks": ["spring", "angular"] }`; known stacks: `baseline-stacks.json`). In a new repository there are no component folders to detect them from, so without the file the sync copies every stack's skills and `AGENTS.md` lines ([declared stacks](../docs/baseline/08-crosscutting-concepts/development/agent-skills.md#declared-stacks)).
- Sync the baseline into the project (see the [README](../README.md#bringing-the-baseline-into-a-project)).
- Replace the placeholders:
  - `<PLANNING_DOCS>`: the product's requirement or planning documents (folder or files)
  - `<PLAN>`: the document that gives the implementation order; if there is none, ask the agent to derive one from `<PLANNING_DOCS>` first
- Remove or adjust the "Working mode: unattended" section if someone will review each step.

```
We're building the product described in <PLANNING_DOCS>. Don't load all of it at once: follow its own reading guide (AGENTS.md or README) if it has one; otherwise read the overview and <PLAN> first, and for each step only the parts that step needs. The implementation order is <PLAN>.

The technical specification for this product is our quality baseline: docs/baseline/ (synced; AGENTS.md is your entry point). It is binding. On anything technical it wins over the planning docs, over skills and over your own habits. If the planning docs expect a separate technical specification or architecture from another team, the baseline is that specification.

## Working mode: unattended

I'm away most of the time, and one goal of this project is to test whether the baseline alone is enough to guide you. So work unattended:
- Don't stop for confirmation, reviews or progress reports between steps. Keep going through the plan.
- When you face a choice, decide it yourself: the baseline first, then the planning docs, then the most conservative sensible default. Record the decision (ADR for architecture, docs/architecture/ for product concepts) and record open business assumptions in docs/architecture/open-questions.md (question, assumption you made, impact if wrong). Then continue.
- Stop and ask me only for a blocking decision: an answer you cannot derive or reasonably assume, where a wrong guess would mean substantial rework or lose business intent; anything irreversible or outward-facing (pushing, publishing, external accounts, real credentials); or a red build you cannot fix without breaking rule 6. Before stopping, finish all work that doesn't depend on the answer.
- Commit after each completed step (and at sensible points within large steps) with a message naming the step and the rule IDs it applies, so I can review the history afterwards. Don't push.

## Rules

1. Before any work: read AGENTS.md and follow its "How to read" steps (rule indexes first, full docs only for the topics a task touches; TOOL-SKL-10). Load the entry skills from AGENTS.md "Read by stack" before writing code for that stack, and the task skills (`baseline-tdd`, `baseline-security`, `baseline-i18n`, …) whenever a task touches their area.
2. Don't write a separate technical specification. Document only what is specific to this product, as the baseline requires:
   - docs/architecture/ (arc42): this product's context, building blocks, domain model and its product-specific technical concepts (whatever the planning docs flag as hard or special), linking to docs/baseline/ instead of repeating it,
   - an ADR in docs/adr/ for every choice the baseline leaves open, and for any deviation from it,
   - docs/security/requirements.md, a first docs/security/threat-model.md, and docs/data-protection/ (processing record, deletion concept) if the product handles personal data,
   - the repository layout per the decision guide (REPO-LAY-02); decide it and record the decision.
3. Where the planning docs describe a technical solution that differs from the baseline, the baseline applies. Example: a plan describing its own password login, lockout and reset emails becomes login through the external OIDC identity provider via the BFF, with those policies as identity-provider configuration. Map the plan's business intent onto the baseline's solution and record each mapping in docs/architecture/.
4. Open business questions and preparation tasks in the planning docs: don't wait for them. Use the planning docs' stated assumptions where they exist, otherwise a conservative default. Log each in docs/architecture/open-questions.md. Create any demo or test data the plan needs yourself, fictitious only (DP-ENV-01).
5. Implement step by step, following <PLAN>. Finish a step's screens before you start the next step's backend; never let the backend run ahead of the UI. For each step:
   - work test-first with the test type each architecture element requires (testing-by-architecture-element.md),
   - meet both the plan's own completion criteria and the baseline's rules (hexagonal boundaries and architecture tests, generated OpenAPI clients, WCAG 2.2 AA asserted by tests, timeouts, i18n where the product is multilingual, audit trail where required),
   - check every data-loading change for N+1, choose a strategy, and note it in the commit message (API-N1-01),
   - update docs/architecture/ in the same change when the architecture changes,
   - run the full build and all tests before committing; a step isn't done while anything is red.
   Completion criteria that need a person (stakeholder review, sign-off, demo) are deferred: list them per step in docs/architecture/open-questions.md.
6. Never weaken or delete a test, architecture rule, lint rule or security or accessibility check to get green. Never take an architectural shortcut silently; if one seems unavoidable, write the ADR draft, take the compliant path if there is one, and otherwise treat it as a blocking decision.

## Baseline feedback

We're also test-driving the baseline itself. Keep a running log in baseline-feedback.md at the repo root of every place where the baseline was unclear, contradictory, missing something the plan needed, impractical, or where a skill disagreed with it. Also log every decision you had to make because the baseline didn't answer it, even when the decision was easy. For each entry, give the doc or rule ID, what happened, and what you did instead. Keep it factual and short. Commit it along with the steps.

When you finish the plan or hit a blocking decision, end with a short report: steps completed, the commit range, open questions, and the number of baseline-feedback entries.
```
