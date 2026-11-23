# Agent checklists: java

The agent checklists of the java docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Java: Hexagonal Architecture

[05-building-block-view/java.md](../05-building-block-view/java.md)

- [ ] New types are package-private unless they're domain, port or port model?
- [ ] Commands, results and value objects are records with compact-constructor validation that throws the domain validation exception (JAVA-ARCH-12)?
- [ ] New business exception extends one category base type (JAVA-ARCH-13)?
- [ ] ArchUnit test still green, and not weakened?
- [ ] No setters on domain entities?
- [ ] Authorization refusals throw the domain `AccessDeniedException` (403), objects the caller may not know `NotFoundException` (JAVA-ARCH-13, ARCH-UC-13)?
- [ ] Current time only through the injected `Clock`; `noDirectClockAccess` green (JAVA-ARCH-14)?

## Java Tooling

[08-crosscutting-concepts/development/java-tooling.md](../08-crosscutting-concepts/development/java-tooling.md)

- [ ] Used `./mvnw`, from the component folder?
- [ ] No Lombok, no new `@SuppressWarnings`/`@SuppressFBWarnings` without a reason, no check switched off?
- [ ] New package, container packages included, has `@NullMarked`; `everyPackageIsNullMarked` green (JAVA-TOOL-08)?
- [ ] New dependency reviewed, version from the BOM or `<properties>` (JAVA-TOOL-05)?
- [ ] `./mvnw verify` green before finishing?
- [ ] `verify-all` green before the commit, no failure ignored to collect output (JAVA-TOOL-24)? SpotBugs findings on fixed content fixed in code, not excluded (JAVA-TOOL-12)?
- [ ] XML, FO, SVG or HTML built through StAX/DOM, never string concatenation; hostile-name test (JAVA-TOOL-25)?
- [ ] Compile failure under `-Werror` diagnosed without `-q` (JAVA-TOOL-20)?
