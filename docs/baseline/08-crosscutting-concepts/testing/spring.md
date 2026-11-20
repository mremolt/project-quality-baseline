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
- **SPRING-TEST-05: Persistence tests run against a real PostgreSQL with the real migrations** (SPRING-ARCH-15, SPRING-DB-14). `@DataJpaTest` tests flush and clear the persistence context before asserting reads, otherwise they pass on the first-level cache.
- **SPRING-TEST-06: Statement counts are asserted** for query and batch ports (SPRING-ARCH-16, API-N1-05), through a JDBC-level proxy (`datasource-proxy`/`datasource-assert`), which is independent of the Hibernate version.
- **SPRING-TEST-07: A test that starts a container or a full application context (`@SpringBootTest`) is an `*IT` and runs in Failsafe; everything else is a `*Test` in Surefire** (JAVA-TOOL-19). Slices without a container (`@WebMvcTest`, `@JsonTest`, `@RestClientTest`) are `*Test`; `@DataJpaTest`, `@JdbcTest` and Kafka tests on Testcontainers are `*IT`. So `./mvnw test` needs no Docker and stays the fast loop; `./mvnw verify` runs both.
- **SPRING-TEST-08: Keep contexts cacheable.** No `@DirtiesContext` (fix the leaking test instead) and containers shared (SPRING-TEST-04). The number of distinct `@MockitoBean`/property combinations per suite SHOULD stay small.
- **SPRING-TEST-09: Asynchronous behaviour is awaited with Awaitility**, not `Thread.sleep` (SPRING-LIB-14).
- **SPRING-TEST-10: Architecture tests are part of every service** (JAVA-ARCH-07): the template in `.agents/skills/baseline-spring/templates/test/ArchitectureTest.java`, extended per [05-building-block-view/spring.md](../../05-building-block-view/spring.md#architecture-test-template). The architecture test is a plain `*Test`; the OpenAPI spec test (SPRING-API-08) starts the full context and is an `*IT`.
- **SPRING-TEST-11: `@Autowired` fields are allowed in test classes;** production code uses constructor injection (SPRING-ARCH-06). The ArchUnit field-injection rule analyses production classes only.

## Agent checklist

- [ ] Test type per element from the element table, setup from the table above; no Spring context for domain and use cases?
- [ ] Boot 4 imports and `*-test` starters; `@MockitoBean`; Testcontainers 2 names?
- [ ] Persistence test against real PostgreSQL with migrations; statement count asserted for query ports?
- [ ] No `@DirtiesContext`, no `Thread.sleep`, no H2?
- [ ] Test that starts a container or `@SpringBootTest` named `*IT` (SPRING-TEST-07)?
- [ ] `./mvnw verify` green (unit and integration tests)?

## Sources

Spring Boot testing reference (docs.spring.io/spring-boot/reference/testing), Spring Boot 4.0 Migration Guide (modular test starters), Testcontainers for Java 2.x (java.testcontainers.org), Spring Framework 7 testing (`MockMvcTester`, `RestTestClient`). Package names read from the Boot 4.1.3 artifacts.
