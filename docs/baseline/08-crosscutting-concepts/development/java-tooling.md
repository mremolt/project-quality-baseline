# Java Tooling

JDK, build, compiler checks, formatting, analysis and the standard commands for every Java project. Spring specifics (starters, test setup, local environment) are in [stacks/spring.md](../../stacks/spring.md). Editor setup: [08-crosscutting-concepts/development/ide-setup.md](ide-setup.md).

A complete, validated configuration is in `.agents/skills/baseline-spring/templates/` (`pom.reference.xml`, `mvn-jvm.config` to be copied as `.mvn/jvm.config`, `spotbugs-exclude.xml`). It builds with `./mvnw verify` on JDK 25 and Spring Boot 4.1. Versions in the template move; check them when you copy it.

## JDK and Maven (defaults JAVA-D1, JAVA-D2)

- **JAVA-TOOL-01: Java 25 (LTS).** The POM sets `java.version` to 25 (the Spring Boot parent maps it to `maven.compiler.release`). A newer JDK may run the build, but the output targets 25.
- **JAVA-TOOL-02: The Maven Wrapper is committed** (`mvnw`, `mvnw.cmd`, `.mvn/wrapper/`). Developers, agents and CI use `./mvnw` and never the system `mvn`.
  *Why:* the Maven version is part of the repository, not of the machine.
- **JAVA-TOOL-03: Maven 3.9.9 or newer** (enforcer range `[3.9.9,)`). Maven 4 is adopted after its GA release, with the POM model still on `4.0.0` so one commit builds on both. Switching is a change of `distributionUrl` and a reviewed pull request.
- **JAVA-TOOL-04: The JDK version is documented and enforced.** A `.sdkmanrc` (or `mise.toml`) names the JDK (Temurin 25) for Linux and macOS, the IDE downloads it on Windows, and `maven-enforcer-plugin` fails the build on a JDK older than 25 (range `[25,)`). Newer JDKs may run the build; the output still targets 25 (JAVA-TOOL-01).
- **JAVA-TOOL-05: Every version lives in `<properties>` or the BOM.** Dependencies managed by the Spring Boot BOM get no explicit version. A child module never re-pins a plugin the parent manages. Every additional dependency is reviewed for maintainer, age, licence and necessity before it is added (Top 10:2025 A03, as TS-TOOL-13).
  *Why:* a stray old pin silently undoes an upgrade (e.g. JaCoCo before 0.8.14 cannot read Java 25 class files).

```xml
<!-- maven-enforcer-plugin (excerpt) -->
<rules>
  <requireJavaVersion><version>[25,)</version></requireJavaVersion>
  <requireMavenVersion><version>[3.9.9,)</version></requireMavenVersion>
  <dependencyConvergence/>
  <banDuplicatePomDependencyVersions/>
  <bannedDependencies>
    <excludes>
      <exclude>org.projectlombok:lombok</exclude>
      <exclude>com.h2database:h2</exclude>
      <exclude>org.hsqldb:hsqldb</exclude>
    </excludes>
  </bannedDependencies>
</rules>
```

- **JAVA-TOOL-06: The enforcer bans what the baseline forbids:** `org.projectlombok:lombok`, `com.h2database:h2`, `org.hsqldb:hsqldb`. Do **not** ban `commons-logging`: Spring 7 depends on it again.

## Compile-time checks (default JAVA-D5)

- **JAVA-TOOL-07: Error Prone and NullAway run in every compile**, in JSpecify mode, restricted to `@NullMarked` code. Warnings fail the build (`failOnWarning`): a check is an error or it is switched off in the build file, with a reason. No warnings policy (TS-TOOL-05 applies by analogy).
- **JAVA-TOOL-08: Every package is `@NullMarked`** (`package-info.java` with `org.jspecify.annotations.NullMarked`), container packages without classes (`adapter`, `adapter.in`, `ports`) included; `@Nullable` marks the places where `null` is legal. `@SuppressWarnings("NullAway")` needs a comment with the reason. `org.jspecify` is allowed in `domain` and `ports` (annotation-only, no framework). The template's ArchUnit rule `everyPackageIsNullMarked` fails for a package with classes that has no `@NullMarked` `package-info.java`: with `-XepOpt:NullAway:OnlyNullMarked=true` (JAVA-TOOL-07), NullAway silently skips unmarked code, so a forgotten `package-info.java` turns null checking off for that package without any warning.
  *Why:* Spring Framework 7 and Boot 4 are JSpecify-annotated, so calls into the framework are checked too.
- **JAVA-TOOL-09: Generated code is excluded** from Error Prone (`-XepExcludedPaths`), Spotless and SpotBugs.

```xml
<!-- maven-compiler-plugin (excerpt) -->
<release>${java.version}</release>
<showWarnings>true</showWarnings>
<failOnWarning>true</failOnWarning>
<compilerArgs>
  <arg>-XDcompilePolicy=simple</arg>
  <arg>--should-stop=ifError=FLOW</arg>
  <arg>-Xplugin:ErrorProne -Xep:NullAway:ERROR -XepOpt:NullAway:OnlyNullMarked=true -XepOpt:NullAway:JSpecifyMode=true -XepExcludedPaths:.*/generated-sources/.*</arg>
</compilerArgs>
<annotationProcessorPaths>
  <path>com.google.errorprone:error_prone_core</path>   <!-- with ${errorprone.version} -->
  <path>com.uber.nullaway:nullaway</path>               <!-- with ${nullaway.version} -->
</annotationProcessorPaths>
```

- **JAVA-TOOL-10: `.mvn/jvm.config` carries the `--add-exports`/`--add-opens` flags** Error Prone needs on a modern JDK (file in the templates). Annotation processors you add later (e.g. `spring-boot-configuration-processor`) go into the same `annotationProcessorPaths` list.
  *Note:* this configures Maven only. The IDE compiler runs without NullAway; `./mvnw verify` is authoritative.

## Format (default JAVA-D4)

- **JAVA-TOOL-11: Spotless formats Java with palantir-java-format** (120 columns, like Prettier in the frontend), removes unused imports and orders the rest. `./mvnw spotless:apply` formats, `spotless:check` runs in `verify`. IDEs use the same formatter ([ide-setup.md](ide-setup.md), TOOL-IDE-01).
  Known limit: palantir-java-format fails on Markdown `///` doc comments on JDK 25 (palantir-java-format #1835). Use `/** */` until it is fixed.

## Bug and security analysis (default JAVA-D6)

- **JAVA-TOOL-12: SpotBugs runs with FindSecBugs in `verify`** and fails on findings reported at `threshold` `Medium` or higher. SpotBugs' threshold is the *confidence* of a finding, not its severity (that is the separate bug rank), so a high-severity bug with low confidence is not reported. The threshold comes from the gate table in [secure-pipeline.md](../security/secure-pipeline.md) (SEC-CI-01). Exclusions live in one `spotbugs-exclude.xml` per component, each with a reason in a comment; no `@SuppressFBWarnings` without a reason. The template excludes only `EI_EXPOSE_REP`/`EI_EXPOSE_REP2` (records and constructor-injected collaborators). Findings on code that writes fixed content are fixed in the code, not excluded: `SPRING_CSRF_PROTECTION_DISABLED` on the probe chain is resolved by leaving CSRF enabled (the chain serves only `GET`, so CSRF costs nothing), and `XSS_SERVLET` on the BFF's `index.html` or problem-details writers by writing bytes through the response's `OutputStream` instead of its `Writer`.
- **JAVA-TOOL-25: XML, XSL-FO, SVG and HTML built in Java are written through a writer API, never by string concatenation**, even with escaped values: StAX (`XMLStreamWriter`, which escapes text and attribute values) or a DOM, with a small element-tree helper for layouts. FindSecBugs reports every concatenated document as `POTENTIAL_XML_INJECTION`, and the fix is the writer, not an exclusion (JAVA-TOOL-12, SEC-REV-02). A test feeds a hostile name (`<b>&"'`) through the renderer and asserts it arrives as text.
- **JAVA-TOOL-13: PMD and Checkstyle are not part of the baseline.** They would duplicate Spotless, Error Prone, SpotBugs and ArchUnit. A project may add one with an ADR.
- **JAVA-TOOL-14: JaCoCo produces a report, not a gate** (D5, TEST-ARCH-09). Use version 0.8.14 or newer for Java 25.
- **JAVA-TOOL-15: Mockito is attached as an explicit agent** (`dependency:properties` plus `-javaagent:${org.mockito:mockito-core:jar}` in the Surefire and Failsafe `argLine`, after `@{argLine}`). Without it, JDK 25 prints dynamic-agent warnings, and later JDKs will refuse self-attaching.

## Dependencies and supply chain (default JAVA-D8)

- **JAVA-TOOL-16: Vulnerable dependencies are caught by a dependency scan in CI** that fails a pull request on new findings at or above the gate's threshold (SEC-CI-01 and its gate table). Reference tool (replaceable): OSV-Scanner, which needs no API key. Update pull requests come from the repository's update automation (TS-TOOL-15), which covers Maven, npm, base images, Compose images and CI plugins. OWASP `dependency-check` is advisory only: it needs an NVD API key and has had builds fail when the key is missing.
- **JAVA-TOOL-17: An SBOM is produced in `verify` or the release job** (`cyclonedx-maven-plugin`).
- **JAVA-TOOL-18: Dependency updates are deliberate** (merged after review, not automatically): `./mvnw versions:display-dependency-updates` for an overview, Boot upgrades one minor at a time following the release notes.

- **JAVA-TOOL-23: Builds are reproducible.** The POM sets `project.build.outputTimestamp` to a fixed value (the template uses a constant; release tooling may set the commit time), which fixes the jar entry times and `build-info`'s `build.time`. CI builds with the committed wrapper (JAVA-TOOL-02) on the documented JDK (JAVA-TOOL-04) in a build image pinned by digest, and the image builder is pinned by digest too (SEC-CI-02). Consider `./mvnw artifact:check-buildplan` (maven-artifact-plugin) to list plugins that break reproducibility.
  *Why:* the same commit then gives the same artifact, which makes the SBOM and the promoted digest (REL-CD-01) checkable by a rebuild.

SAST next to FindSecBugs: JAVA-TOOL-21 under [Security tooling](#security-tooling).

## Test execution

- **JAVA-TOOL-19: Unit tests are `*Test` (Surefire), integration tests `*IT` (Failsafe).** A test that starts a container or a full application context is an integration test (SPRING-TEST-07), so `./mvnw test` runs without Docker. Failsafe must be declared in `<build><plugins>` (not only `pluginManagement`), otherwise `*IT` classes are silently skipped. `./mvnw verify` runs both.

## Standard commands

- **JAVA-TOOL-20: Every Java component offers the same commands**, run from the component folder (REPO-TOOL-03), so humans, agents and CI don't have to guess:
- **JAVA-TOOL-24: Before the commit, all gate findings are collected in one run, without ignoring any.** Maven stops a single-module build at the first failing execution (`-fae` only continues *other* modules), so `./mvnw verify` shows formatting, compiler, SpotBugs and test findings one run at a time. The component ships `verify-all.sh`/`.cmd` (template in `baseline-spring/templates/scripts/`), which runs three independent invocations and fails at the end if any failed: `spotless:check`; `compile spotbugs:check` (Error Prone, NullAway, SpotBugs on the main classes); `verify -Dspotless.check.skip=true -Dspotbugs.skip=true` (tests, ArchUnit, ITs, the remaining checks). Each invocation fails on its own findings; `testFailureIgnore`, `spotbugs.failOnError=false` or a lowered threshold are never used to collect output (SEC-REV-02). CI keeps running `./mvnw verify`.
  *Why:* a product needed seven closing `verify` runs in one step because each run revealed only the next kind of finding.

| Command | Does |
|---|---|
| `./mvnw verify` | The component's local gate: enforcer, compile with Error Prone/NullAway, unit and integration tests, ArchUnit, Spotless check, SpotBugs, JaCoCo report. No security scans, no E2E |
| `./mvnw test` / `./mvnw test -Dtest=Class` | The inner loop: all `*Test` classes including ArchUnit, or one class, no Docker needed. Run it after every change and `verify` once before the commit |
| `./mvnw verify -Dit.test=Class` | One integration test (`*IT`, needs Docker), after the unit tests and checks |
| `./mvnw spotless:apply` | Format |
| `./verify-all.sh` (`verify-all.cmd`) | Every gate of `verify`, all failures reported in one run, non-zero exit if any failed (JAVA-TOOL-24); the local run before the commit |
| `./mvnw verify -Dopenapi.update=true` | Regenerate the committed OpenAPI spec (`OpenApiSpecIT`, SPRING-API-08) |
| `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` | Run with the `local` profile against the services in `compose.yaml` (SPRING-DEV-02, [07-deployment-view/spring-local-development.md](../../07-deployment-view/spring-local-development.md)) |
| `./mvnw versions:display-dependency-updates` | Update overview |

`-q` hides the compiler's warning text: under `-Werror` a quiet run fails with only "warnings found", so diagnose a compile failure without `-q`.

`./mvnw verify` is what the component's CI job runs (REPO-CI-01); the security job and the E2E tiers are separate pipeline jobs, listed in the pipeline jobs table ([REPO-CI](../../07-deployment-view/repository-layout.md#ci)).

> Maven prints `Could not transfer metadata … flyway-community-db-support … 401` warnings from Flyway's POM repositories. They are harmless.

## Security tooling

- **JAVA-TOOL-21: A SAST tool runs in CI next to FindSecBugs** with an agreed rule set (SEC-CI-01, [secure-pipeline.md](../security/secure-pipeline.md); reference tool, replaceable: Semgrep CE); suppressions carry a reason or point at `docs/security/exceptions.md` (SEC-VUL-03).
*Agent checklist in [checklists/java.md](../../checklists/java.md) and sources in [sources.md](../../sources.md), section "Java Tooling".*
