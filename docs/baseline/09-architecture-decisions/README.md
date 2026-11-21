# 9. Architecture Decisions

## In products

Products record their decisions as ADRs in `docs/adr/NNNN-short-title.md`, Michael Nygard's format (D6, ARCH-SC-02/03). The sync creates `docs/adr/0000-template.md` once; copy it for each new decision. Their arc42 chapter 9 is an index that links each ADR with a one-line summary (DOC-ARC-03). Deviations from a MUST in this baseline always need an ADR.

## In the baseline

The baseline records its own decisions as defaults with a reason next to the rule ("*Why:*"):

| Decisions | Where |
|---|---|
| Baseline defaults D1–D17 | [04-solution-strategy/README.md](../04-solution-strategy/README.md#baseline-defaults) |
| Stack defaults (`JAVA-D*`, `SPRING-D*`, `NODE-D*`, `NEST-D*`, `TS-D*`, `REACT-D*`, `NEXT-D*`) | [04-solution-strategy/](../04-solution-strategy/README.md#stack-strategies) |
| Libraries chosen and rejected | [spring-libraries.md](../04-solution-strategy/spring-libraries.md#not-used), [nestjs-libraries.md](../04-solution-strategy/nestjs-libraries.md#not-used) |
| Skills installed, adapted and rejected | [agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md#skill-catalogue) |

Changing a baseline decision is a reviewed pull request in the baseline repository that updates the default, its reason and every rule that depends on it.
