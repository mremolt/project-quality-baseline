# Spring Boot: REST and JSON Conventions

How a Spring Boot service implements the shared [REST conventions](rest-conventions.md) (API-REST-*), so that every API in every project feels the same and generated clients (TS-API, SPRING-LIB-06) stay simple. The contract itself (springdoc, committed spec, breaking-change check) is in [08-crosscutting-concepts/api/spring-openapi.md](spring-openapi.md). Controller structure: [05-building-block-view/spring.md](../../05-building-block-view/spring.md), ARCH-ADP-03/04.

## Rules

### Structure

- **SPRING-REST-01: DTOs are package-private records in `adapter.in.rest.vN`**, one request and one response record per use case, with names unique per API version (SPRING-API-02). No entity or domain type is serialized directly (ARCH-MAP-01/03). Mapping between DTO and command is hand-written in the controller package.
- **SPRING-REST-02: URLs are plural nouns in kebab-case with the version prefix from the version package** (`/v1/orders`). Verbs only for explicit command resources, named after the use case and matching its `operationId` (`POST /v1/orders/{id}/cancel`).
- **SPRING-REST-03: Versioning is by version package and path prefix** (default SPRING-D7). Spring Framework 7's native `version` mapping attribute and `spring.mvc.apiversion.*` are not used, so there is one mechanism and the springdoc groups match the packages.

### JSON

The wire format is defined by the shared [REST conventions](rest-conventions.md) (API-REST-*); the rules below implement them in Spring.

- **SPRING-REST-04: Decimals and money use the `ApiDecimal` type, never `BigDecimal`, `double` or `float` in a REST record** (API-REST-01). `ApiDecimal` is one small public record in `adapter.in.rest`, shared by all version packages: it serializes as a JSON string and maps to the spec as `type: string, format: decimal`. The ArchUnit rule `noRawNumbersInRestRecords` in the [architecture test template](../../05-building-block-view/spring.md#architecture-test-template) forbids the raw types in `adapter.in.rest`. The controller maps `ApiDecimal` to the domain's value type and back. Identifiers are `String` or `UUID`.

```java
// adapter/in/rest/ApiDecimal.java: the one decimal type on the wire (API-REST-01)
public record ApiDecimal(BigDecimal value) {

    public ApiDecimal {
        Objects.requireNonNull(value, "value");
    }

    @JsonCreator
    static ApiDecimal parse(String text) {
        return new ApiDecimal(new BigDecimal(text)); // NumberFormatException → 400 through the advice
    }

    @JsonValue
    String toJson() {
        return value.toPlainString(); // "12.50", never "1.25E+1"
    }
}

// adapter/in/rest/OpenApiConfiguration.java: the spec shows a string, not the record's structure
static {
    SpringDocUtils.getConfig()
        .replaceWithSchema(ApiDecimal.class, new StringSchema().format("decimal").example("12.50"));
}
```

- **SPRING-REST-05: Date and time** (API-REST-02): `Instant` for instants, `LocalDate` for dates, `Duration` for durations; Jackson 3 writes them as ISO 8601 by default (no timestamps). `LocalDateTime` is never used for an instant.
- **SPRING-REST-06: Enums are Java enums whose constant names are the wire values** (API-REST-03). An open enum is documented as such in `@Schema(description = …)`; the consumer maps unknown values to a fallback.
- **SPRING-REST-07: Errors are `ProblemDetail` (API-REST-05/06/07)**, produced by one `@RestControllerAdvice` in `adapter.in.rest` that extends Spring's `ResponseEntityExceptionHandler` and maps business exceptions from `domain` (SPRING-ARCH-03), including the domain validation exception (400, SPRING-ARCH-18). The status for each exception follows the table in API-REST-06; the advice sets the extension members `code` (SPRING-I18N-02) and `traceId` (SPRING-OBS-10), and `errors` for validation failures. Spring-specific mappings: an optimistic-lock failure from Hibernate (`ObjectOptimisticLockingFailureException`) is 409 (SPRING-DB-10); `CannotCreateTransactionException` from an exhausted pool and `InvocationRejectedException` from a concurrency limit (SPRING-RES-05/06) are 503 with `Retry-After`; a request parameter that fails conversion is 400.
- **SPRING-REST-08: Optional fields are omitted when empty** (API-REST-04): `spring.jackson.default-property-inclusion=non_absent`. Required fields carry `@NotNull` (SPRING-API-03).
- **SPRING-REST-09: Unknown request properties are ignored** (Boot default, API-REST-04). Mandatory fields are declared with Bean Validation on the request record (SPRING-ARCH-08).
- **SPRING-REST-10: Jackson is configured with `spring.jackson.*` properties first.** A customizer bean in `adapter.in.rest` only for what properties cannot express. No hand-built `JsonMapper`/`ObjectMapper` in application code.

### Collections and updates

- **SPRING-REST-11: Collection endpoints are paged with a hard maximum page size, or bounded by a documented upper limit that the query enforces** (API-REST-08, API-N1-07). The JSON shape is our own `PageResponse<T>` record (`items`, `page`, `size`, `totalElements`), mapped in the controller; Spring Data's `Page` is neither in ports (SPRING-LIB-12) nor in the contract. `page`, `size` and `sort` are bound to request parameters and validated in the controller (`@Max` on `size`; `sort` against the endpoint's allow-list, API-REST-09); filters bind to a request record (API-REST-10). The command or query carries the port's own `PageRequest`.
- **SPRING-REST-12: Update endpoints implement optimistic concurrency as API-REST-11 describes.** The command carries the expected version. The use case (or the persistence adapter) compares it with the version of the loaded aggregate and throws a conflict exception from `domain` on a mismatch. The application never sets the entity's `@Version` field: Hibernate checks the version it loaded, not one handed in. The advice maps the conflict to 409 when the expected version came from the body and to 412 when it came from `If-Match`; a missing required `If-Match` is 428 (API-REST-06). A concurrent write between load and commit still fails Hibernate's own check (SPRING-DB-10) and is a 409. A deprecated operation is annotated `@Deprecated` (springdoc marks it `deprecated: true`) and sets the `Deprecation` and `Sunset` headers in the controller (API-REST-12).
- **SPRING-REST-14: Errors produced by the security filter chain follow the problem-details contract (API-REST-05).** For the API paths a custom `AuthenticationEntryPoint` writes 401 with `code: UNAUTHENTICATED` and a custom `AccessDeniedHandler` writes 403 with `ACCESS_DENIED`, or `CSRF_INVALID` for a `CsrfException`, both as `application/problem+json` with `traceId`. Neither falls through to Boot's `/error` JSON or an empty body. Framework 4xx outside validation get their own codes (`METHOD_NOT_ALLOWED`, `NOT_ACCEPTABLE`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `MALFORMED_BODY`), never `VALIDATION_FAILED`. The 401/403 tests of SPRING-SEC-10 assert the content type and the code.
  *Why:* an expired session or CSRF token must reach the SPA as a distinguishable error; a generic body makes the client show "validation failed" or nothing.

### Tests

- **SPRING-REST-13: Controller tests assert status, headers and JSON body** with `@WebMvcTest` and `MockMvcTester` ([08-crosscutting-concepts/testing/spring.md](../testing/spring.md)), including the problem+json shape of each documented error. DTO serialization edge cases (dates, decimals, enums, absent fields) are covered with `@JsonTest`.

## Agent checklist

- [ ] New endpoint follows URL, status and error conventions; `operationId` set?
- [ ] DTOs are package-private records with unique names; no entity or domain type in the body?
- [ ] Decimals as `ApiDecimal`, instants as `Instant`, enums as strings (SPRING-REST-04..06)?
- [ ] Collection paged or bounded in the query, sort and filters allow-listed; update carries a version (SPRING-REST-11/12)?
- [ ] Error cases documented as problem+json and tested; 401/403 from the filter chain are problem+json with a code (SPRING-REST-14)?

## Sources

RFC 9457 (Problem Details), RFC 3339 / ISO 8601, springdoc-openapi (`SpringDocUtils.replaceWithSchema`), Spring MVC reference (docs.spring.io/spring-framework/reference/web/webmvc.html), Jackson 3 (github.com/FasterXML/jackson-3), Microsoft REST API Guidelines (money and date conventions).
