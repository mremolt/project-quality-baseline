# 8. Cross-cutting Concepts

Concepts that apply across building blocks. Each topic has a folder; shared rules are in topic-named files, stack rules in `<stack>.md` or `<stack>-<topic>.md`. A product's chapter 8 links here and documents only its additions and deviations.

| Topic | Shared | Java / Spring | TypeScript / Angular |
|---|---|---|---|
| API | [rest-conventions.md](api/rest-conventions.md) (`API-REST-*`), [openapi-contracts.md](api/openapi-contracts.md) (`API-CON-*`), [avoiding-n-plus-one.md](api/avoiding-n-plus-one.md) (`API-N1-*`) | [spring-rest.md](api/spring-rest.md) (`SPRING-REST-*`), [spring-openapi.md](api/spring-openapi.md) (`SPRING-API-*`) | [typescript-openapi-clients.md](api/typescript-openapi-clients.md) (`TS-API-*`) |
| Security | [security-requirements.md](security/security-requirements.md) (`SEC-REQ/TM/CRY-*`), [vulnerability-management.md](security/vulnerability-management.md) (`SEC-VUL/AUD/INC-*`), [secure-pipeline.md](security/secure-pipeline.md) (`SEC-CI-*`), [security-review.md](security/security-review.md) (`SEC-REV-*`) | [security/spring.md](security/spring.md), [security/spring-hardening.md](security/spring-hardening.md) (`SPRING-SEC-*`) | [security/typescript.md](security/typescript.md) (`TS-SEC-*`), [security/angular.md](security/angular.md) (`NG-SEC-*`) |
| Internationalization | [i18n/i18n.md](i18n/i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`) | [i18n/spring.md](i18n/spring.md) (`SPRING-I18N-*`) | [i18n/angular.md](i18n/angular.md) (`NG-I18N-*`) |
| Configuration | [configuration/configuration.md](configuration/configuration.md) (`CFG-*`, `TEST-CFG-*`) | [configuration/spring.md](configuration/spring.md) (`SPRING-CFG-*`) | [configuration/angular.md](configuration/angular.md) (`NG-CFG-*`) |
| Observability | [observability/observability.md](observability/observability.md) (`OBS-*`) | [observability/spring.md](observability/spring.md) (`SPRING-OBS-*`) | [observability/angular.md](observability/angular.md) (`NG-OBS-*`) |
| Resilience | [resilience/resilience.md](resilience/resilience.md) (`RES-*`) | [resilience/spring.md](resilience/spring.md) (`SPRING-RES-*`) | — |
| Messaging | [messaging/messaging.md](messaging/messaging.md) (`MSG-*`) | [messaging/spring.md](messaging/spring.md) (`SPRING-MSG-*`) | — |
| Data protection | [data-protection/data-protection.md](data-protection/data-protection.md) (`DP-*`, incl. breach clocks `DP-INC-*`) | [data-protection/spring.md](data-protection/spring.md) (`SPRING-DP-*`) | — |
| Persistence | — | [persistence/spring.md](persistence/spring.md) (`SPRING-DB-*`) | — |
| Logging | — | [logging/spring.md](logging/spring.md) (`SPRING-LOG-*`) | — |
| Mapping | [mapping-between-boundaries.md](mapping/mapping-between-boundaries.md) (`ARCH-MAP-*`) | — | — |
| Testing | [testing-by-architecture-element.md](testing/testing-by-architecture-element.md) (`TEST-ARCH-*`, element → test type table), [tdd.md](testing/tdd.md) (`TEST-TDD-*`) | [testing/spring.md](testing/spring.md) (`SPRING-TEST-*`) | [testing/typescript.md](testing/typescript.md), [testing/typescript-e2e.md](testing/typescript-e2e.md) (`TS-TEST-*`), [testing/angular.md](testing/angular.md) (`NG-TEST-*`) |
| UI | — | — | [angular-material.md](ui/angular-material.md) (`NG-UI-*`), [angular-state-management.md](ui/angular-state-management.md) (`NG-STATE-*`) |
| Development tooling | [agent-skills.md](development/agent-skills.md) (`TOOL-SKL-*`), [ide-setup.md](development/ide-setup.md) (`TOOL-IDE-*`), [architecture-documentation.md](development/architecture-documentation.md) (`DOC-ARC-*`) | [java-tooling.md](development/java-tooling.md) (`JAVA-TOOL-*`) | [typescript-tooling.md](development/typescript-tooling.md) (`TS-TOOL-*`), [angular-tooling.md](development/angular-tooling.md) (`NG-TOOL-*`) |
| Architecture enforcement | [enforcing-boundaries.md](architecture-enforcement/enforcing-boundaries.md) (`ARCH-ENF-*`) | ArchUnit: [05-building-block-view/java.md](../05-building-block-view/java.md), [05-building-block-view/spring.md](../05-building-block-view/spring.md#architecture-test-template) | dependency-cruiser: [05-building-block-view/typescript.md](../05-building-block-view/typescript.md) |

Accessibility is a quality requirement: [10-quality-requirements/accessibility.md](../10-quality-requirements/accessibility.md).
