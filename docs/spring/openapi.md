# Spring Boot: Producing the OpenAPI Contract (code-first)

How a Spring Boot service produces the spec required by [openapi-contracts.md](../shared/api/openapi-contracts.md) (default D8: code-first). Controllers stay hand-written and sliced per use case (ARCH-ADP-03/04, SPRING-ARCH-01); the spec is generated from them with springdoc-openapi, committed, and checked in CI.

## Setup

- `springdoc-openapi-starter-webmvc-api` (or `-ui` if the Swagger UI is wanted in non-production profiles), in the version line that matches the Spring Boot major.
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

- **SPRING-API-01: Every operation has an explicit, stable `operationId` named after the use case** (`@Operation(operationId = "cancelOrder", summary = "…")`). Generated clients use it as the method name (API-CON-05).
- **SPRING-API-02: Request and response records have names that are unique per API version** (`CancelOrderRequest`, `OrderHistoryResponse`), or an explicit `@Schema(name = "…")`.
  *Why:* springdoc names schemas by simple class name. Two nested `Request` records in different controllers would collide in the spec. The records stay package-private in their controller's package (ARCH-ADP-04).
- **SPRING-API-03: Required means required.** Mandatory fields carry `@NotNull` (or `@Schema(requiredMode = REQUIRED)`); everything else is optional in the spec. The generated TypeScript types and zod schemas depend on it.
- **SPRING-API-04: Bean Validation constraints on request records are part of the contract** (`@Size`, `@Pattern`, `@Min`, …) and show up as schema constraints, so clients validate the same way. They still only check mappability (SPRING-ARCH-08); the command validates itself.
- **SPRING-API-05: Errors are documented as `application/problem+json`** with `ProblemDetail` for every business error status the controller can produce (SPRING-ARCH-03).
- **SPRING-API-06: Schemas carry examples** (`@Schema(example = "…")` or `@ExampleObject`), which feed the generated mocks in the frontend (API-CON-11).
- **SPRING-API-07: springdoc and swagger annotations stay in `adapter.in.rest`.** They never appear in `domain`, `ports` or `application` (ArchUnit, see below).

### Exporting and checking the spec

- **SPRING-API-08: A test exports the spec and fails if the committed file is stale** (API-CON-03). It needs no running server and works with Maven and Gradle:

```java
// src/test/java/com/example/orders/adapter/in/rest/OpenApiSpecTest.java
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiSpecTest {

    private static final Path SPEC = Path.of("openapi/orders-v1.yaml");

    @Autowired
    MockMvc mvc;

    @Test
    void committedSpecMatchesTheCode() throws Exception {
        String generated = mvc.perform(get("/v3/api-docs.yaml/orders-v1"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        if (Boolean.getBoolean("openapi.update")) {
            Files.writeString(SPEC, generated); // ./mvnw test -Dopenapi.update=true
        }
        assertThat(SPEC).hasContent(generated);
    }
}
```

  Developers regenerate with `-Dopenapi.update=true` and commit the diff together with the code change.
- **SPRING-API-09: CI checks for breaking changes** against the target branch, e.g.:

```bash
# from the backend folder; git show needs the path from the repo root (backend/openapi/… in a product repo, REPO-LAY-01)
git show origin/main:backend/openapi/orders-v1.yaml > /tmp/base.yaml
oasdiff breaking /tmp/base.yaml openapi/orders-v1.yaml --fail-on ERR
```

  A breaking change needs a new version package and group (`v2`) or an explicit decision (API-CON-04).
- **SPRING-API-10: Consumers get the spec file, not a URL.** Frontends in the same repository generate from `backend/openapi/` directly; consumers in other repositories copy the committed spec (API-CON-08, REPO-API-01). The `/v3/api-docs` endpoints are disabled in production profiles unless the API is public.

### Endpoint design

- **SPRING-API-11: New read endpoints are checked for N+1 usage by their consumers** (API-N1-01). Screen-shaped views get their own query use case and controller (API-N1 S1); generic lookups get batch endpoints (S2). Both load related data without persistence N+1 (SPRING-ARCH-16).

## ArchUnit

The `coreIsFrameworkFree` rule of the [architecture test template](architecture.md#architecture-test-template) includes `io.swagger..` and `org.springdoc..` (SPRING-API-07).

## Agent checklist

- [ ] New/changed endpoint: `operationId`, unique schema names, `@NotNull` on required fields, problem+json errors, examples?
- [ ] Spec regenerated (`-Dopenapi.update=true`) and committed in the same change?
- [ ] Breaking change? New version or explicit decision?
- [ ] N+1 check done for read endpoints?

## Sources

springdoc-openapi (springdoc.org), OpenAPI 3.x, RFC 9457, oasdiff (github.com/oasdiff/oasdiff).
