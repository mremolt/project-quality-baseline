# Solution Strategy: Spring Boot

The key technology decisions for Spring Boot components. They tighten the shared strategy in [04-solution-strategy/README.md](README.md) and never contradict it. Navigation and skills for this stack: [stacks/spring.md](../stacks/spring.md).

## Stack at a glance

Java 25 · Maven (wrapper) · Spring Boot 4.1 (Spring Framework 7, Jackson 3, Hibernate 7) · Spring MVC with virtual threads · Spring Security as OAuth2 resource server · PostgreSQL 18 + Flyway · Spring Data JPA + `JdbcClient` · Kafka · springdoc-openapi 3 (code-first spec) · Micrometer + OpenTelemetry · JUnit Jupiter + AssertJ + Mockito + Testcontainers 2 · ArchUnit · Spotless (palantir) · Error Prone + NullAway · SpotBugs + FindSecBugs · Buildpacks (default image build).


## Defaults

These tighten the shared and Java defaults:

| # | Topic | Default | Defined in |
|---|---|---|---|
| SPRING-D1 | Boot line | 4.1.x. Move to 4.2.x once every pinned library in [spring-libraries.md](spring-libraries.md#versions-of-the-reference-build) supports it, as a reviewed change. Supported means an official release built against the new Boot minor (`resilience4j-spring-boot4` and ShedLock included); a passing smoke test alone is not enough. Boot 4.2 waits for the Springwolf release on swagger-core 3 | [04-solution-strategy/spring-libraries.md](spring-libraries.md) |
| SPRING-D2 | Web stack | Spring MVC + virtual threads; WebFlux only with an ADR | [04-solution-strategy/spring-libraries.md](spring-libraries.md) |
| SPRING-D3 | JSON | Jackson 3, records as DTOs, wire format from the shared REST conventions (API-REST-*: ISO-8601, decimals as strings through `ApiDecimal`) | [08-crosscutting-concepts/api/spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md), [rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md) |
| SPRING-D4 | Database | PostgreSQL; Spring Data JPA for aggregates plus `JdbcClient` for reads and bulk work (SPRING-DB-15); Flyway forward-only migrations at start-up with a separate DDL user (SPRING-REL-01); `ddl-auto=validate`, `open-in-view=false` | [08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md) |
| SPRING-D5 | Auth | Resource server validating JWTs from an external IdP; authorization on a framework-free `Caller` | [08-crosscutting-concepts/security/spring.md](../08-crosscutting-concepts/security/spring.md) |
| SPRING-D6 | Browser login | Backend-for-frontend with session cookie (project ADR) | [08-crosscutting-concepts/security/spring.md](../08-crosscutting-concepts/security/spring.md) |
| SPRING-D7 | API versioning | Version packages and `/vN` path; Spring's native versioning is not used | [08-crosscutting-concepts/api/spring-rest.md](../08-crosscutting-concepts/api/spring-rest.md) |
| SPRING-D8 | Outbound REST | Client generated from the provider's OpenAPI spec when one exists | [04-solution-strategy/spring-libraries.md](spring-libraries.md) |
| SPRING-D9 | Resilience | Spring 7 built-ins; Resilience4j only for a circuit breaker; inbound rate limits per SPRING-SEC-21 | [04-solution-strategy/spring-libraries.md](spring-libraries.md) |
| SPRING-D10 | Logging | SLF4J + Logback, structured JSON outside local development | [08-crosscutting-concepts/logging/spring.md](../08-crosscutting-concepts/logging/spring.md) |
| SPRING-D11 | Local services | Docker Compose in `backend/compose.yaml` | [07-deployment-view/spring-local-development.md](../07-deployment-view/spring-local-development.md) |
| SPRING-D12 | Images | OCI image meeting SPRING-LIB-13; Buildpacks (`spring-boot:build-image`) by default, Dockerfile or Jib when the customer platform dictates it (recorded in chapter 7) | [04-solution-strategy/spring-libraries.md](spring-libraries.md) |
