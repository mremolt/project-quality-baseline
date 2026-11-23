# Java

Rules for every Java project, framework-independent. Spring Boot additions are in [stacks/spring.md](spring.md). They implement the shared docs and may tighten them, never contradict them. Defaults (`JAVA-D*`): [04-solution-strategy/java.md](../04-solution-strategy/java.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [java](../rule-index/java.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/java.md](../05-building-block-view/java.md) | Package layout, visibility, records, ArchUnit, build modules, the `Clock` bean | `JAVA-ARCH-*` |
| [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) | JDK, Maven and wrapper, compiler checks (Error Prone, NullAway), Spotless, SpotBugs, JaCoCo, dependency scanning, reproducible builds, standard commands | `JAVA-TOOL-*` |

Configuration, observability, resilience, messaging, data protection and delivery have shared rules (`CFG-*`, `OBS-*`, `RES-*`, `MSG-*`, `DP-*`, `REL-*`) and Spring implementations; the Spring pages are listed in [stacks/spring.md](spring.md). A plain Java project applies the shared rules directly.

## Skills for Java work

The `baseline-spring` skill loads these for you in Spring Boot projects. For plain Java, load them by task:

| Skill | For |
|---|---|
| `baseline-tdd` (own) | Test-first workflow |
| `java-hibernate-jpa` | Hibernate/JPA problems in persistence adapters (N+1, lazy loading, equals/hashCode) |

**Where a skill and these docs disagree, the docs win** (TOOL-SKL-01). Known conflicts are listed in the "Skill overrides" table in [stacks/spring.md](spring.md#skill-overrides).
