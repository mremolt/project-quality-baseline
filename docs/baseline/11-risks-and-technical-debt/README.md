# 11. Risks and Technical Debt

## Conscious shortcuts

| Doc | Covers | Rule IDs |
|---|---|---|
| [conscious-shortcuts.md](conscious-shortcuts.md) | Broken windows, ADRs for shortcuts, shortcut catalogue | `ARCH-SC-*` |

A product's chapter 11 lists its shortcut ADRs and known technical debt (DOC-ARC-04).

## Known open points of the baseline

| Topic | Status |
|---|---|
| Spring Boot 4.2 | Upgrade parked until springdoc supports 4.2 and 4.2.1 is out ([spring-libraries.md](../04-solution-strategy/spring-libraries.md#versions-of-the-reference-build)) |
| Spring template | Not exercised yet: Kafka listener/producer, optional Compose profiles, security with a real IdP, springdoc + OpenAPI Generator in the template. The product templates have no `configuration-keys.yaml` example (CFG-12) and no `Secret.java` (SPRING-CFG-11) yet |
| BFF decision | A project ADR template for component vs. filter chain (SPRING-SEC-09) is not written yet. `skills/baseline-spring` has no BFF serving example yet (resource handler for the embedded bundle, `index.html` controller with CSP nonce, REL-FE-03, NG-SEC-06) |
| Rules written from documentation | Security hardening, CI gates, operability (configuration, observability, resilience, messaging, delivery), data protection and i18n rules have not yet been run in a product. Concrete checks are in [Verify before first use](#verify-before-first-use); the first product confirms or corrects them |
| Legal confirmation | To be confirmed with legal before a product relies on it: CRA scope for SaaS and remote data processing, the Art. 14 deadlines and the ENISA reporting platform (SEC-REQ-05); EAA/BFSG scope per product, micro-enterprise exemption, statement content, response-time duty, EN 301 549 v3.2.1 vs v4.1.1 (A11Y-26); Weblate's GPL-3.0 covers the software, not the stored catalogs (TOOL-I18N-01) |
| Data protection confirmation | To be confirmed with the DPO: controller/DPO split and the processor path (DP-INC-01), audit trail kept under its own retention and not erased on request (SEC-AUD-02), per-user monitoring for security alerts (SEC-AUD-03) |
| Other compliance (ISO 27001, sector rules) | Open per product; may tighten SLAs, SBOM and disclosure ([security-requirements.md](../08-crosscutting-concepts/security/security-requirements.md)) |
| Performance | Not covered yet: load and performance testing (tool, when, budgets), Core Web Vitals targets and Lighthouse CI or real-user monitoring, `@defer`/preloading guidance, JVM container memory and startup (Buildpacks memory calculator, CDS/AOT). The chapter 10 Web Vitals scenario is marked "not yet secured" until these rules exist |
| Frontend error and UX policy | Not covered yet: global HTTP error handling (403, 5xx, offline, timeout, retry), session-expiry UX beyond the timeout warning (A11Y-29), unsaved-changes guard, offline/PWA stance. Loading, empty and error states: NG-UI-35. Browser support matrix: TS-TOOL-02 |
| Team workflow | No single Definition of Done yet (the PR template's "Done" list is the interim entry point); PR size and review rules. Commit convention: REL-BR-03 |
| API lifecycle | Deprecation headers are defined (API-REST-12); the removal timeline for an old major and consumer notification are not written; events: MSG-CON. Cursor paging has no shared cursor encoding yet (API-REST-08) |
| Smaller gaps | Multi-tenancy beyond SPRING-SEC-35 (if a product needs it), `Clock` injection in production code (assumed by SPRING-DP-01; tests: TEST-TDD-16), audit logging of business events |

## Verify before first use

Rules that depend on tool or library behaviour the baseline could not confirm against a running system. The rule text applies as written; the first product that uses it runs the check and corrects the rule if needed. Stack files link here instead of keeping their own lists.

| Item | Rule | How to confirm |
|---|---|---|
| ArchitectureTest template on a real Boot 4 service (so far run only against sample classes) | SPRING-ARCH-04/18, ARCH-ORG-01/09, ARCH-DEP-05, ARCH-ENF-05 | `./mvnw verify` on the first service |
| New template rules compile and find what they should: `secretsUseSecretType`, `noRawNumbersInRestRecords` | SPRING-CFG-11, SPRING-REST-04 | Compile the template; a `*Properties` record with `String password`; a REST record with `BigDecimal` |
| Template builds with the configuration processor path and `project.build.outputTimestamp`; the jar is reproducible | JAVA-TOOL-23, SPRING-CFG-04 | `./mvnw verify` twice, compare the jar hashes |
| `engine-strict=true` makes `npm ci` fail when `engines.npm` does not match | TS-TOOL-14 | `npm ci` with npm 10 against `engines.npm >=11.10.0` |
| Main security filter chain on a separate management port; `EndpointRequest.toAnyEndpoint()` covers the additional probe paths | SPRING-OBS-02 | `*IT` against the management port and `/livez`, `/readyz` |
| `spring-boot-starter-opentelemetry` reads `OTEL_RESOURCE_ATTRIBUTES` | SPRING-OBS-07 | Set the variable in a test, check the exported resource |
| Boot 4.2: Kafka listeners, security with a real IdP, `resilience4j-spring-boot4` 2.4.0 | SPRING-D1, [spring-libraries.md](../04-solution-strategy/spring-libraries.md#versions-of-the-reference-build) | Run the template against 4.2.x |
| springdoc 3 `replaceWithSchema` plus `@JsonValue` on `ApiDecimal` give `type: string, format: decimal` under Jackson 3 | SPRING-REST-04 | `@JsonTest` and the `OpenApiSpecIT` output |
| `spring.jackson.default-property-inclusion=non_absent` binds under Boot 4 / Jackson 3 | SPRING-REST-08 | `@JsonTest` |
| Orval zod schema names: camelCase (`listOrdersResponse`) vs PascalCase with status code | TS-API-05 | Generated `*.zod.ts` in the first project |
| Per-group timeout keys with generated HTTP Service Clients | SPRING-RES-01 | Group config plus a WireMock delay test |
| `CannotCreateTransactionException` is thrown on pool timeout | SPRING-RES-05 | `*IT` with pool size 1 and a held connection |
| Resilience4j 2.4.0 on Boot 4.1/4.2 | SPRING-RES-07 | First circuit-breaker `*IT` |
| `@Retryable` `timeout` is checked between attempts and does not interrupt a running call | SPRING-RES-08 | Spring Framework `RetryPolicy` source or a WireMock test |
| `lock_timeout`/`statement_timeout` cancels a speculative-insert wait with SQLSTATE `57014` | SPRING-RES-10 | `*IT` with two concurrent transactions |
| ShedLock 7.x with Boot 4 `JdbcTemplate`; relay throughput under ShedLock | SPRING-RES-12, SPRING-MSG-07 | Concurrency `*IT` (SPRING-RES-13); load test |
| Nested-cause classification through `ListenerExecutionFailedException`; backoff sizing against `max.poll.interval.ms` | SPRING-MSG-05 | Validation-case `*IT` (SPRING-MSG-12); Spring Kafka "Handling Exceptions" docs |
| Springwolf 2.x with Boot 4.1 and the export test; `asyncapi diff` as breaking-change check | SPRING-MSG-11, MSG-CON-05 | First AsyncAPI export `*IT`; AsyncAPI CLI in CI |
| `spring.jackson.factory.constraints.read.*` property names besides `max-nesting-depth` | SPRING-SEC-15 | Boot property reference |
| `__Host-` cookie prefix and SameSite with the chosen session store | SPRING-SEC-24 | First BFF |
| Absolute session lifetime with an idle-only session store; `oidcLogout().backChannel()`; session lookup by `sid` | SPRING-SEC-32/33 | Spring Security and Spring Session reference; first BFF |
| `Argon2PasswordEncoder` needs Bouncy Castle | SPRING-SEC-30, SEC-CRY-02 | Spring Security docs |
| PostgreSQL role setup and default privileges; Kafka ACL commands | SPRING-SEC-27/28, SPRING-REL-03 | First project |
| Non-root default of the chosen Buildpacks builder | SPRING-SEC-29 | Builder docs or image config |
| Pipeline tools: Trivy options, attestation or cosign commands, Semgrep CE rule-pack licence, gitleaks action licence on organisation repositories, ZAP inputs and fail behaviour | SEC-CI-01 gate table, SEC-CI-03/06/07 | Tool documentation; first pipeline |
| Boot 4 JSON log formats include key-value pairs | SPRING-LOG-03 | First service |
| Final status of EDPB Guidelines 01/2025 | [data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md) sources | edpb.europa.eu |
| Material icons render under enforced Trusted Types with `angular#components` | NG-SEC-05/12 | E2E check in the first app |
| Route focus after back/forward: `focus({ preventScroll: true })` plus `scrollPositionRestoration` keeps the scroll position; `afterNextRender` runs after the routed `h1` | A11Y-21, NG-UI-31, TS-TEST-26 | Real-browser E2E |
| axe in Chromium with `forcedColors: 'active'` gives no false contrast findings | TS-TEST-28 | Spike run |
| Transloco stable line (8.x until 9.x is stable), zoneless behaviour, testing helper names | NG-I18N-01, TEST-I18N-01 | Spike app; Transloco releases |
| Own `Intl` pipes and `DateAdapter.setLocale` on a language switch with the chosen Material date adapter; `Intl.NumberFormat` with decimal-string input | NG-I18N-07/08, TEST-I18N-08 | Language-switch component test; E2E in all three engines |
| Locale Hibernate Validator uses under the current Boot line | SPRING-I18N-06 | `@WebMvcTest` with an invalid body and a non-source `Accept-Language` |
| Weblate import path for `context.json`; how it marks changed source strings | TOOL-I18N-07 | Weblate docs and a test component |
| npm package for the pseudo-locale and the pseudo-RTL locale (licence, maintenance) | TOOL-I18N-04, TEST-I18N-02 | Package review |
| release-please (or equivalent) with prefixed component tags (`backend/v1.4.0`) and one release pull request per deployable | REL-VER-03 | Manifest docs (`tag-separator`, `include-component-in-tag`); dry run in the first product |
| Validate-only `FlywayMigrationStrategy` fails on pending migrations; the migrate-only runner exits cleanly | SPRING-REL-07 | Integration test in the first product that uses the pre-deploy variant |
| PR template locations for Azure DevOps (`.azuredevops/`) and Bitbucket (no template file) | `sync-baseline --host` | Azure Repos and Bitbucket docs |
| Kafka listener and producer, the `tools`, `auth`, `mail` and `observability` Compose profiles and their pinned images | SPRING-DEV-03/04 | First service that uses them |
| The image carries the previous release's hashed files; the one-time reload after a failed chunk load | REL-FE-04, NG-ARCH-20 | First BFF product, during a rolling deployment |
| The Paketo image-labels buildpack is part of the Java builder used | REL-RUN-07 | `pack inspect` on the built image |
