# Spring Boot: Logging

How services log: API, backend, format, correlation, and what is logged where. Observability beyond logs (probes, metrics, traces) uses `spring-boot-starter-opentelemetry` (SPRING-LIB-10) and is described in [observability/spring.md](../observability/spring.md).

## Rules

### Setup

- **SPRING-LOG-01: SLF4J is the API, Logback the backend** (Boot default). Loggers are `private static final Logger log = LoggerFactory.getLogger(X.class)`; no Lombok `@Slf4j`. No `System.out`/`System.err`, no `printStackTrace()`, no `java.util.logging`, no Log4j2. ArchUnit enforces this with `GeneralCodingRules` (`NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS`, `NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING`), see the template.
- **SPRING-LOG-02: Outside local development, logs are structured JSON** through Boot's built-in support: `logging.structured.format.console=ecs` (or `logstash` if the platform needs it): one JSON object per line with `@timestamp`, `log.level`, `service.name`, `message`. No `logstash-logback-encoder`. The `local` profile keeps plain text (`application.yaml` template). Structured logging is on from the first deployment, so log queries work before the first incident.
- **SPRING-LOG-03: Correlation comes from tracing.** With `spring-boot-starter-opentelemetry`, `traceId` and `spanId` are put into the MDC automatically, so every log line carries the id that also appears in the trace. The trace id is also returned in error responses (SPRING-OBS-10, OBS-11). Business context **SHOULD** be added with SLF4J's fluent API (`log.atInfo().addKeyValue("orderId", id).log("Order placed")`). Whether Boot 4's JSON formats include key-value pairs by default: see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).
- **SPRING-LOG-04: Levels are configuration:** `logging.level.*` per profile; `DEBUG` is off outside local development.

### Content

- **SPRING-LOG-05: Parameterized messages only** (`log.info("Order {} placed", id)`), never string concatenation.
- **SPRING-LOG-06: Where logging happens:**
  - `domain` and `ports` do not log (ArchUnit forbids `org.slf4j..` there). Behaviour is visible through return values and exceptions.
  - `application` **SHOULD** log sparingly: state changes and decisions worth an audit trail.
  - Adapters log technical events: retries, dead letters, failed external calls, rejected requests.
- **SPRING-LOG-07: An exception is logged once, where it is handled** (the REST `@RestControllerAdvice`, the Kafka error handler). Never log and rethrow. Business exceptions (4xx) log at `INFO`/`WARN` without a stack trace; unexpected exceptions at `ERROR` with it.
- **SPRING-LOG-08: Never log secrets, tokens, passwords, full request/response bodies or personal data.** Pseudonymous identifiers are fine; e-mail addresses, names and free text are not ([data-protection.md](../data-protection/data-protection.md), DP-TEL-01).
- **SPRING-LOG-09: Logs are asserted in tests only where they matter,** with Boot's `OutputCaptureExtension`: security and audit events are present (SPRING-SEC-22), and personal data of use cases that handle it is absent (SPRING-DP-07, DP-TEST-02).

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Logging".*
