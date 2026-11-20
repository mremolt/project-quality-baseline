# 1. Introduction and Goals

## Purpose

The quality baseline is the shared set of rules, defaults and agent skills our products are built with. It answers "how do we build software here?" once, so that each product only documents what is specific to it. Coding agents (Claude Code, Codex, Copilot, …) follow the same rules through `AGENTS.md` and the baseline's skills.

The baseline is not a framework or a library: projects **copy** it in with the sync script and commit the result. Nothing in it is needed at build or run time.

## Quality goals

The baseline optimises for these goals, in this order. Chapter 10 turns them into scenarios.

| # | Goal | What it means here |
|---|---|---|
| 1 | Changeability | Business logic is independent of frameworks and infrastructure; dependencies point inward ([hexagonal-architecture.md](../04-solution-strategy/hexagonal-architecture.md)) |
| 2 | Testability and confidence to ship | Every element has its test type, written first; a green build means "releasable" ([testing](../08-crosscutting-concepts/testing/testing-by-architecture-element.md)) |
| 3 | Accessibility | WCAG 2.2 AA, AAA where possible, asserted by tests ([accessibility.md](../10-quality-requirements/accessibility.md)) |
| 4 | Security | Secure defaults, no secrets in code, authentication and authorization designed in ([security-requirements.md](../08-crosscutting-concepts/security/security-requirements.md)) |
| 5 | Consistency across products and agents | The same structure, names and commands in every repository, so people and agents don't have to guess |
| 6 | Operability | The application can be configured, deployed, observed and shut down safely without code changes; the infrastructure itself is the product's ([scope](../03-context-and-scope/README.md#scope)) |

## Stakeholders

| Who | Expects from the baseline |
|---|---|
| Developers | Clear rules with reasons, ready-made templates, commands that work the same everywhere |
| Architects | Defaults that can be deviated from with an ADR, stable rule IDs to reference |
| Reviewers | Rule IDs and agent checklists to review against |
| Coding agents | Precise, machine-followable rules; skills that point at those rules (TOOL-SKL-06) |
| Product teams | A sync that only touches baseline-owned files, and room for project decisions |
