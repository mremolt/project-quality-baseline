# Spring Boot: Testing

The Spring Boot 4 specifics of [08-crosscutting-concepts/testing/testing-by-architecture-element.md](testing-by-architecture-element.md) and [08-crosscutting-concepts/testing/tdd.md](tdd.md): which annotation and which container for which element. Test type, style and doubles per element come from the [element table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element); the table below adds only the setup. The test-first workflow is the `baseline-tdd` skill; framework detail comes from `spring-boot-testing` (overrides in [stacks/spring.md](../../stacks/spring.md#skill-overrides)).

## Element to test setup

| Element | Test setup | Suffix (SPRING-TEST-07) |
|---|---|---|
| Domain, application services | Plain JUnit + AssertJ (+ Mockito for ports). **No Spring context.** | `*Test` |
| `adapter.in.rest` | `@WebMvcTest(controllers = X.class)` + `@MockitoBean` for the incoming port, assertions with `MockMvcTester`; `@JsonTest` for DTO serialization | `*Test` |
| `adapter.out.jpa` | `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + Testcontainers PostgreSQL with `@ServiceConnection` + `@Import` of the adapter; real Flyway migrations | `*IT` |
| `adapter.out.jdbc` | `@JdbcTest` + `@AutoConfigureTestDatabase(replace = NONE)` + the same PostgreSQL container and migrations | `*IT` |
| `adapter.in/out.kafka` | Integration test with a Kafka Testcontainer (`KafkaContainer`, `apache/kafka`) covering success, validation failure → dead-letter topic, and a transient failure that is retried (SPRING-MSG-12) | `*IT` |
| `adapter.out.http` | `@RestClientTest` with `MockRestServiceServer`, or WireMock for generated clients (real HTTP: status codes, headers, timeouts, retries); one WireMock test with a delayed response proves the read timeout (SPRING-RES-02) | `*Test` (in-process WireMock); `*IT` if WireMock runs as a container |
| Security | `@WebMvcTest` with the `jwt()` post-processor: 401 / 403 / success (SPRING-SEC-10) | `*Test` |
| System tests (TEST-ARCH-05), OpenAPI spec test | `@SpringBootTest(webEnvironment = RANDOM_PORT)` with `RestTestClient` and Testcontainers; stub only third-party systems at their outgoing ports | `*IT` |

## Rules

- **SPRING-TEST-01: Tests use JUnit Jupiter, AssertJ and Mockito from Boot's BOM.** Boot 4.1 manages JUnit Jupiter 6 (same `org.junit.jupiter.api` annotations as 5). Mocks of beans use `@MockitoBean`/`@MockitoSpyBean` (`org.springframework.test.context.bean.override.mockito`), never `@MockBean`. Mockito is attached as an agent (JAVA-TOOL-15).
- **SPRING-TEST-02: Each technology has its own `*-test` starter** (`spring-boot-starter-webmvc-test`, `-data-jpa-test`, `-flyway-test`, `-kafka-test`, `-validation-test`, `-security-oauth2-resource-server-test`, …) plus `spring-boot-testcontainers`. A slice annotation that does not compile usually means the starter is missing. Slice and helper annotations moved to modular packages in Boot 4:

| Annotation | Package |
|---|---|
| `@WebMvcTest`, `@AutoConfigureMockMvc` | `org.springframework.boot.webmvc.test.autoconfigure` |
| `@DataJpaTest` | `org.springframework.boot.data.jpa.test.autoconfigure` |
| `@AutoConfigureTestDatabase` | `org.springframework.boot.jdbc.test.autoconfigure` |
| `@JsonTest` | `org.springframework.boot.test.autoconfigure.json` |
| `@AutoConfigureRestTestClient` | `org.springframework.boot.resttestclient.autoconfigure` |
| `@ServiceConnection` | `org.springframework.boot.testcontainers.service.connection` |
| `@SpringBootTest` | `org.springframework.boot.test.context` |
| `@EntityScan` (main code) | `org.springframework.boot.persistence.autoconfigure` |

- **SPRING-TEST-03: Web assertions use `MockMvcTester`** (AssertJ style); system tests use `RestTestClient`. `TestRestTemplate` (deprecated from Boot 4.2) and classic `MockMvc` matchers are not used in new tests.
- **SPRING-TEST-04: Testcontainers 2.x.** Artifacts and packages carry the module name (`testcontainers-postgresql` → `org.testcontainers.postgresql.PostgreSQLContainer`, `testcontainers-kafka` → `org.testcontainers.kafka.KafkaContainer`); the constructor takes an explicit image. Containers are beans of one shared `@TestConfiguration` annotated with `@ServiceConnection`, so every test class reuses them. The images match production: PostgreSQL in the same major version (SPRING-DB-01). The same `@TestConfiguration` declares a `DynamicPropertyRegistrar` bean that sets `app.resilience.transaction-guard=fail` (SPRING-RES-04).
- **SPRING-TEST-05: Persistence tests run against a real PostgreSQL with the real migrations** (TEST-ARCH-04, SPRING-DB-14). `@DataJpaTest` tests flush and clear the persistence context before asserting reads, otherwise they pass on the first-level cache.
- **SPRING-TEST-06: Statement counts are asserted** for query and batch ports (API-N1-05), through a JDBC-level proxy (`datasource-proxy`/`datasource-assert`), which is independent of the Hibernate version.
- **SPRING-TEST-07: A test that starts a container or a full application context (`@SpringBootTest`) is an `*IT` and runs in Failsafe; everything else is a `*Test` in Surefire** (JAVA-TOOL-19). Slices without a container (`@WebMvcTest`, `@JsonTest`, `@RestClientTest`) are `*Test`; `@DataJpaTest`, `@JdbcTest` and Kafka tests on Testcontainers are `*IT`. So `./mvnw test` needs no Docker and stays the fast loop; `./mvnw verify` runs both.
- **SPRING-TEST-08: Keep contexts cacheable.** No `@DirtiesContext` (fix the leaking test instead) and containers shared (SPRING-TEST-04). The number of distinct `@MockitoBean`/property combinations per suite SHOULD stay small.
- **SPRING-TEST-09: Asynchronous behaviour is awaited with Awaitility**, not `Thread.sleep` (SPRING-LIB-14).
- **SPRING-TEST-10: Architecture tests are part of every service** (JAVA-ARCH-07): the template in `.agents/skills/baseline-spring/templates/test/ArchitectureTest.java`, extended per [05-building-block-view/spring.md](../../05-building-block-view/spring.md#architecture-test-template). The architecture test is a plain `*Test`; the OpenAPI spec test (SPRING-API-08) starts the full context and is an `*IT`.
- **SPRING-TEST-11: `@Autowired` fields are allowed in test classes;** production code uses constructor injection (SPRING-ARCH-06). The ArchUnit field-injection rule analyses production classes only.
- **SPRING-TEST-12: An architecture test fails when a `@RestController` in `adapter.in.rest` is not covered by a web slice test.** A controller is covered when a test class names it in `@WebMvcTest(controllers = …)` (grouped test classes that cover several controllers are fine) or is called `<Controller>Test`; a bare `@WebMvcTest` without `controllers` covers nothing, because it loads every controller. The test reads the annotation from the compiled test classes (ArchUnit over the test sources, template `ArchitectureTest.everyControllerHasAWebSliceTest`). The web slice test is where the 401/403/success cases of SPRING-SEC-10 and the problem+json assertions of SPRING-REST-13 live, so a new controller cannot skip them unnoticed. Reviews count uncovered controllers by running this test, not by sampling.
- **SPRING-TEST-13: Integration tests control background work and reset state in one place.** Scheduling is switched off in tests by a property on the `@EnableScheduling` configuration (`@ConditionalOnProperty(name = "app.scheduling.enabled", matchIfMissing = true)`, set to `false` by the shared test infrastructure), and tests call the job's incoming port directly (RES-JOB-01). Database state between ITs is reset by one shared helper that truncates all application tables (`TRUNCATE … CASCADE` over the tables from `information_schema`, without the Flyway history table), not by DELETE lists per test class. Migrations are structure only: they insert no reference or default rows, because `TRUNCATE … CASCADE` also empties tables that cascade from a truncated table and a test would then depend on rows the helper just deleted. Rows the application needs in every environment come from an idempotent bootstrap runner (an `ApplicationRunner`), which tests start or replace with fixtures. A product that keeps seed rows in a migration records an ADR naming this rule, and the helper re-inserts exactly those rows after the truncate.
  *Why:* a job running in the background of a shared test context races with the assertions; hand-kept DELETE lists break in order-dependent ways when a table is added.
- **SPRING-TEST-14: Use case tests share three fakes.** They live in `src/test/java/<base>/support` (templates in `baseline-spring/templates/test/support/`): `InMemoryRepository<K, T, S>` (S is the fake itself, so `with` chains) as the base of in-memory fakes for outgoing ports that are pure collections (Chicago style, TEST-TDD-10); `People` with one fictitious caller per role and fixed UUIDs (DP-ENV-01), whose "user A"/"user B" pair drives the cross-user tests (SPRING-SEC-16); `Transactions.immediate()`, a `TransactionTemplate` that runs the callback at once for services with programmatic transactions. Commit, rollback and database constraints are proven by the adapter ITs, not by the fakes.
  *Why:* every product rebuilt the same three helpers by hand, each slightly differently.

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Testing".*
