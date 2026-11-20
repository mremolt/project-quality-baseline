# Solution Strategy: Java

The key technology decisions for Java components. They tighten the shared strategy in [04-solution-strategy/README.md](README.md) and never contradict it. Navigation and skills for this stack: [stacks/java.md](../stacks/java.md).

## Defaults

These tighten the shared defaults ([04-solution-strategy/README.md](README.md)) for Java:

| # | Topic | Default | Defined in |
|---|---|---|---|
| JAVA-D1 | Language level | Java 25 (LTS), `release` = 25, enforced by the build | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D2 | Build | Maven 3.9+ through the committed wrapper (`./mvnw`) | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D3 | Model types | Records; no Lombok | [05-building-block-view/java.md](../05-building-block-view/java.md), [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D4 | Format | Spotless with palantir-java-format (120 columns) | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D5 | Compile-time checks | Error Prone + NullAway in JSpecify mode, warnings fail the build | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D6 | Bug and security analysis | SpotBugs with FindSecBugs; no PMD, no Checkstyle | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
| JAVA-D7 | Tests | JUnit Jupiter + AssertJ + Mockito, ArchUnit | [08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md), [05-building-block-view/java.md](../05-building-block-view/java.md) |
| JAVA-D8 | Dependency vulnerabilities | Dependency scanning and update automation; reference tools (replaceable): OSV-Scanner, Dependabot/Renovate; OWASP dependency-check only advisory | [08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md) |
