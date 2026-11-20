# Spring Boot: Producing the OpenAPI Contract (code-first)

How a Spring Boot service produces the spec required by [08-crosscutting-concepts/api/openapi-contracts.md](openapi-contracts.md) (default D8: code-first). Controllers stay hand-written and sliced per use case (ARCH-ADP-03/04, SPRING-ARCH-01); the spec is generated from them with springdoc-openapi, committed, and checked in CI.

## Setup

- `springdoc-openapi-starter-webmvc-api` (or `-ui` if the Swagger UI is wanted in non-production profiles), in the line that matches the Spring Boot minor (SPRING-LIB-05). Pin the exact version.
- Properties in `application.yaml`: `springdoc.api-docs.enabled: false` (the endpoint is on by default; SPRING-API-10 switches it on only where needed) and `springdoc.writer-with-order-by-keys: true` (deterministic, alphabetical output, so the stale check in SPRING-API-08 does not flap).
- One `GroupedOpenApi` per API major version, matching the version packages (ARCH-ORG-03):

```java
// adapter/in/rest/OpenApiConfiguration.java (next to what it configures, SPRING-ARCH-02)
@Configuration
class OpenApiConfiguration {

    @Bean
    GroupedOpenApi ordersV1() {
        return GroupedOpenApi.builder()
            .group("orders-v1")
            .packagesToScan("com.example.orders.adapter.in.rest.v1")
            .build();
    }
}
```

## Rules

### Describing the API

- **SPRING-API-01: `operationId` (API-CON-05) is set with `@Operation(operationId = "cancelOrder", summary = "…")`** on every handler method.
- **SPRING-API-02: Request and response records have names that are unique per API version** (`CancelOrderRequest`, `OrderHistoryResponse`), or an explicit `@Schema(name = "…")`.
  *Why:* springdoc names schemas by simple class name. Two nested `Request` records in different controllers would collide in the spec. The records stay package-private in their controller's package (ARCH-ADP-04).
- **SPRING-API-03: Required means required.** Mandatory fields carry `@NotNull` (or `@Schema(requiredMode = REQUIRED)`); everything else is optional in the spec. The generated TypeScript types and zod schemas depend on it.
- **SPRING-API-04: Bean Validation constraints on request records are part of the contract** (`@Size`, `@Pattern`, `@Min`, …) and show up as schema constraints, so clients validate the same way. They still only check mappability (SPRING-ARCH-08); the command validates itself.
- **SPRING-API-05: Errors (API-CON-05, API-REST-05) are documented with `@ApiResponse(responseCode = "409", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))`** for every business error status the controller can produce, with the possible `code` values (API-REST-07) in the description.
- **SPRING-API-06: Examples (API-CON-05, API-CON-11) are set with `@Schema(example = "…")` or `@ExampleObject`.**
- **SPRING-API-07: springdoc and swagger annotations stay in `adapter.in.rest`.** They never appear in `domain`, `ports` or `application` (ArchUnit, see below).

### Exporting and checking the spec

- **SPRING-API-08: An integration test exports the spec and fails if the committed file is stale** (API-CON-03). It needs no running server, but it starts the full application context, so it needs the shared Testcontainers configuration and is an `*IT` run by Failsafe (SPRING-TEST-07):

```java
// src/test/java/com/example/orders/adapter/in/rest/OpenApiSpecIT.java
@SpringBootTest(properties = {
    "springdoc.api-docs.enabled=true",           // off in the deployed defaults (SPRING-API-10)
    "springdoc.writer-with-order-by-keys=true"   // stable ordering, so the comparison does not flap
})
@AutoConfigureMockMvc // org.springframework.boot.webmvc.test.autoconfigure (Boot 4, SPRING-TEST-02)
@Import(TestcontainersConfiguration.class) // the shared @ServiceConnection containers (SPRING-TEST-04)
class OpenApiSpecIT {

    private static final Path SPEC = Path.of("openapi/orders-v1.yaml");

    @Autowired
    MockMvcTester mvc; // AssertJ style (SPRING-TEST-03)

    @Test
    void committedSpecMatchesTheCode() throws Exception {
        MvcTestResult result = mvc.get().uri("/v3/api-docs.yaml/orders-v1").exchange();
        assertThat(result).hasStatusOk();
        String generated = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        if (Boolean.getBoolean("openapi.update")) {
            Files.writeString(SPEC, generated); // ./mvnw verify -Dopenapi.update=true
        }
        assertThat(SPEC).hasContent(generated);
    }
}
```

  Developers regenerate with `./mvnw verify -Dopenapi.update=true` (Failsafe passes the `-D` property to the test JVM) and commit the diff together with the code change. `./mvnw test` does not run this test.
- **SPRING-API-09: The breaking-change check (API-CON-04) runs `oasdiff` against the target branch**, for example:

```bash
# from the backend folder; git show needs the path from the repo root (backend/openapi/… in a product repo, REPO-LAY-01)
git show origin/main:backend/openapi/orders-v1.yaml > /tmp/base.yaml
oasdiff breaking /tmp/base.yaml openapi/orders-v1.yaml --fail-on ERR
```

  A breaking change needs a new version package and group (`v2`) or an explicit decision (API-CON-04). `oasdiff` is the reference tool; the product may use another diff tool with the same effect.
- **SPRING-API-10: Consumers get the committed spec file, not a URL** (API-CON-08, REPO-API-01). `springdoc.api-docs.enabled` is `false` in `application.yaml` and `true` only in `application-local.yaml` and in `OpenApiSpecIT`; a public API that serves its spec at runtime enables it in `application.yaml` with a note (no per-environment profiles, CFG-04).

### Endpoint design

- **SPRING-API-11: The N+1 check (API-CON-06, API-N1-01) is done for every new read endpoint;** in Spring, view endpoints are a query use case plus controller (API-N1 S1), batch lookups a batch endpoint (S2), both loading related data without persistence N+1 (SPRING-ARCH-16).

## ArchUnit

The `domainAndPortsAreFrameworkFree` rule of the [architecture test template](../../05-building-block-view/spring.md#architecture-test-template) includes `io.swagger..` and `org.springdoc..` (SPRING-API-07).

## Agent checklist

- [ ] New/changed endpoint: `operationId`, unique schema names, `@NotNull` on required fields, problem+json errors, examples?
- [ ] Spec regenerated (`./mvnw verify -Dopenapi.update=true`) and committed in the same change?
- [ ] Breaking change? New version or explicit decision?
- [ ] N+1 check done for read endpoints?

## Sources

springdoc-openapi (springdoc.org, including the properties reference), OpenAPI 3.x, RFC 9457, oasdiff (github.com/oasdiff/oasdiff).
