# Spring Boot: Observability and Operability

How a Spring Boot service implements [observability.md](observability.md) (`OBS-*`): probes, graceful shutdown, metrics, tracing. Libraries: `spring-boot-starter-actuator` and `spring-boot-starter-opentelemetry` (SPRING-LIB-10). Logging and log correlation: [logging/spring.md](../logging/spring.md) (SPRING-LOG-03). Actuator exposure: SPRING-SEC-07.

## Rules

### Probes and the management port

- **SPRING-OBS-01: Probes are served on the main port; everything else of actuator runs on a separate management port** (OBS-19, realisation a). `management.endpoint.health.probes.add-additional-paths=true` serves the liveness and readiness groups as `/livez` and `/readyz` on the server port, so the probe goes through the same connector and thread pool as user traffic; the ingress does not route these two paths (the product's chapter 7 states where they are blocked). Probe groups are on by default (`management.endpoint.health.probes.enabled=true`). All other actuator endpoints run on the management port (`management.server.port`, for example `8081`), which the ingress does not route; web exposure stays the allow-list `health,info` (SPRING-SEC-07).
  *Why:* Boot's reference warns that with a separate management port a probe can succeed while the main server no longer accepts connections.
  Realisation (b), only where the platform cannot keep `/livez` and `/readyz` away from the internet: the platform probes `/actuator/health/liveness` and `/actuator/health/readiness` on the management port and also checks the server port (load-balancer target check or TCP probe), recorded in chapter 7.
- **SPRING-OBS-02: Probes stay reachable despite `anyRequest().authenticated()`** (SPRING-SEC-01) through one dedicated `SecurityFilterChain` for actuator and the probe paths, ordered before the API chain, in `adapter.in.rest`. With the management port of SPRING-OBS-01 the chain matches two things: the probe paths on the server port (`EndpointRequest.toAdditionalPaths(WebServerNamespace.SERVER, …)`, equivalent to plain matchers for `/livez` and `/readyz`) and the actuator endpoints on the management port (`EndpointRequest.toAnyEndpoint()`, which never matches on the server port):

```java
@Bean
@Order(1)
SecurityFilterChain actuatorChain(HttpSecurity http) throws Exception {
  RequestMatcher probesOnServerPort = EndpointRequest.toAdditionalPaths(WebServerNamespace.SERVER, HealthEndpoint.class);
  return http
      .securityMatchers(matchers -> matchers.requestMatchers(EndpointRequest.toAnyEndpoint(), probesOnServerPort))
      .authorizeHttpRequests(auth -> auth
          .requestMatchers(probesOnServerPort).permitAll()                                    // /livez, /readyz
          .requestMatchers(EndpointRequest.to(HealthEndpoint.class, InfoEndpoint.class)).permitAll()
          // only where the platform pulls metrics (SPRING-LIB-10, SPRING-SEC-07):
          // .requestMatchers(EndpointRequest.to(PrometheusScrapeEndpoint.class)).permitAll()
          .anyRequest().denyAll())
      .build();
}
```

  Every endpoint in the exposure allow-list (SPRING-SEC-07) has a matching `permitAll()` line here and nothing else does: when the platform pulls Prometheus metrics, `prometheus` joins `management.endpoints.web.exposure.include` and the commented line is switched on in the same change; the management port's network restriction is then the scrape's access control, unless the platform scrapes with credentials. Never `permitAll()` on `/actuator/**`, never `exposure.include=*`. Health details stay hidden (`management.endpoint.health.show-details` keeps its default `never`). Whether the main security filter chain also applies on a separate management port is open (see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)); the dedicated chain makes the outcome the same either way, and SPRING-OBS-11 tests it.
- **SPRING-OBS-03: The liveness group keeps its default (`livenessState`) and gets no other contributor** (OBS-02). The readiness group is `readinessState` plus `db` only where OBS-03 says so: `management.endpoint.health.group.readiness.include=readinessState,db`. Custom `HealthIndicator`s live in the adapter they check, answer within a fixed timeout, and are only added to readiness with a stated reason.

### Graceful shutdown

- **SPRING-OBS-04: Graceful shutdown stays on, and the budget is the sum of the shutdown phases** (OBS-04). `server.shutdown` defaults to `graceful`; never set `immediate`. `spring.lifecycle.timeout-per-shutdown-phase` is a limit **per lifecycle phase**, and the stages that wait for in-flight work run in different phases: Kafka listener containers stop first (phase `Integer.MAX_VALUE - 100`, Spring Kafka's `AbstractMessageListenerContainer.DEFAULT_PHASE`), the web server's graceful shutdown later (phase `SmartLifecycle.DEFAULT_PHASE - 1024`, `WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE`). Each may use the full timeout. Defaults:

| Value | Default |
|---|---|
| `spring.lifecycle.timeout-per-shutdown-phase` | `20s`, set explicitly (Boot's default is `30s`) |
| Pre-stop delay on the platform (drain time for the load balancer) | `5s` |
| Budget | phases with in-flight work × phase timeout + pre-stop delay + `5s` margin: HTTP only 20 + 5 + 5 = 30 s; HTTP and Kafka listeners 2 × 20 + 5 + 5 = 50 s |
| Platform termination grace period | at least the budget, recorded in chapter 7: `40s` for HTTP only, `60s` with Kafka listeners (Kubernetes example: `terminationGracePeriodSeconds`; its default of 30 s is too short for both) |

  Boot switches readiness to refusing traffic when the context starts to close, so the readiness probe fails before connections close; the pre-stop delay covers the time until the load balancer stops sending.
- **SPRING-OBS-05: Kafka listeners finish their current poll on shutdown:** `spring.kafka.listener.immediate-stop` stays `false` (default: the container stops after the records of the previous poll are processed). `max.poll.records` times the worst-case processing time of one record fits into one shutdown phase (SPRING-OBS-04). Records that are not committed are redelivered, so consumers are idempotent (MSG-IDM-01).

### Metrics

- **SPRING-OBS-06: Business metrics go through an outgoing port** in `ports.out` (`OrderMetricsPort.orderPlaced(channel)`), implemented in `adapter.out.metrics` with `MeterRegistry`. The use case's London-style test verifies the port call; the adapter test asserts the meter. A use case that needs its own timer or span uses the Observation API (`ObservationRegistry`, or `@Observed` with `spring-boot-starter-aspectj`) in `application` only. `io.micrometer..` and `io.opentelemetry..` are forbidden in `domain` and `ports`; add both to the ArchUnit rule `domainAndPortsAreFrameworkFree` (OBS-09).

```java
// adapter/out/metrics/MicrometerOrderMetrics.java
@MetricsAdapter // stereotype (SPRING-ARCH-04)
class MicrometerOrderMetrics implements OrderMetricsPort {
  private final MeterRegistry registry;
  MicrometerOrderMetrics(MeterRegistry registry) { this.registry = registry; }

  @Override
  public void orderPlaced(SalesChannel channel) {
    Counter.builder("orders.order.placed")
        .description("Orders accepted by the system")
        .tag("channel", channel.name()) // closed enum: low cardinality (OBS-08)
        .register(registry)
        .increment();
  }
}
```

- **SPRING-OBS-07: Common attributes come from configuration, not code.** `spring.application.name` names the service; the deployment adds the environment as a resource attribute (`management.opentelemetry.resource-attributes.*`; whether the starter also reads `OTEL_RESOURCE_ATTRIBUTES` is open, see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)). `management.metrics.tags.*` only for tags the platform requires on every meter.

### Tracing and correlation

- **SPRING-OBS-08: Export endpoints and sampling are set per environment through environment variables** (CFG-03): `management.opentelemetry.tracing.export.otlp.endpoint`, `management.otlp.metrics.export.url`, `management.opentelemetry.logging.export.otlp.endpoint`, `management.tracing.sampling.probability` (default `0.1`; set it explicitly, OBS-13). Propagation keeps its default (W3C); B3 only if a consumer requires it, with an ADR. Export is off in `application.yaml` (`management.otlp.metrics.export.enabled`, `management.tracing.export.enabled` and `management.logging.export.enabled` set to `false`). An environment that has a collector enables export together with its endpoint, and these keys and the sampling probability are listed in `configuration-keys.yaml` (CFG-12). Without this, the OpenTelemetry starter pushes metrics to `localhost:4318` every minute and logs a warning with a stack trace on every attempt, in every installation that has no collector.
- **SPRING-OBS-09: Outbound calls and messages carry the trace.** HTTP clients are built from the auto-configured `RestClient.Builder` or HTTP Service Clients (SPRING-LIB-06), never `RestClient.create()` (enforced by the ArchUnit rule `noUnconfiguredHttpClients`, SPRING-RES-01). Kafka observation is switched on in the producer and listener configuration of SPRING-MSG-03. JDBC spans are not a default (they need an extra instrumentation library; add one with an ADR when query-level traces are needed).
- **SPRING-OBS-10: Error responses return the trace id.** The `@RestControllerAdvice` (SPRING-REST-07) adds the current trace id as the `ProblemDetail` extension member `traceId` to every error response; this is the correlation id SPRING-SEC-18 requires. Nothing else from the trace (span ids, baggage) goes into a response. Incoming `traceparent` from the internet is removed at the ingress in front of the BFF (OBS-12); the product's chapter 7 states where. A BFF that has nothing in front of it (a Compose installation, a single host) removes `traceparent`, `tracestate` and `baggage` from browser requests itself: a servlet filter in `adapter.in.rest`, ordered before the observation filter (`ServerHttpObservationFilter`), wraps the request without these headers. Otherwise anyone can choose the trace id that ends up as the correlation id in the security event log, and can force sampling.

### Tests

- **SPRING-OBS-11: Operability is tested:**

| What | How |
|---|---|
| Probes and exposure (OBS-05, OBS-19) | `*IT` with `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `management.server.port=0`, `@LocalServerPort`, `@LocalManagementPort`: `/livez` and `/readyz` on the server port 200 without a token; `/actuator/env`, `/actuator/configprops`, `/actuator/heapdump` on the management port not 200 without a token; the server port does not serve `/actuator/**`; every exposed endpoint (SPRING-SEC-07) answers without a 401/403 |
| Readiness on shutdown | Optional `*IT`: publish `AvailabilityChangeEvent` with `ReadinessState.REFUSING_TRAFFIC` and assert the readiness group returns 503 |
| Business metric | Adapter test with `SimpleMeterRegistry`: name, tags, count; use-case test verifies the port call |
| Tag cardinality (OBS-08) | Same adapter test: drive the meter with every constant of its tag enum and assert one series per constant and the exact tag keys (example below) |
| `traceId` in errors | `@WebMvcTest` of the advice with a test tracer (`micrometer-tracing-test`): problem+json contains `traceId` |
| Architecture | ArchUnit `domainAndPortsAreFrameworkFree` includes Micrometer and OpenTelemetry |

```java
// MicrometerOrderMetricsTest.java: tag cardinality is bounded by the enum (OBS-08)
@Test
void ordersPlacedHasOneSeriesPerChannel() {
  var registry = new SimpleMeterRegistry();
  var metrics = new MicrometerOrderMetrics(registry);

  for (SalesChannel channel : SalesChannel.values()) {
    metrics.orderPlaced(channel);
    metrics.orderPlaced(channel);
  }

  Collection<Counter> counters = registry.find("orders.order.placed").counters();
  assertThat(counters).hasSize(SalesChannel.values().length);
  assertThat(counters).allSatisfy(counter -> {
    assertThat(counter.getId().getTags()).extracting(Tag::getKey).containsExactly("channel");
    assertThat(counter.count()).isEqualTo(2.0);
  });
}
```

## Open points

Items to confirm in the first service (SPRING-OBS-02, SPRING-OBS-07) are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Skill overrides (`spring-observability`)

| Skill says | Our rule |
|---|---|
| `exposure.include: health,info,prometheus` in the quick start | `health,info`; `prometheus` only if the platform requires pull, then also permitted in the actuator chain (SPRING-SEC-07, SPRING-OBS-02, SPRING-LIB-10) |
| Probes at `/actuator/health/liveness` on the management port | `/livez`, `/readyz` on the server port (SPRING-OBS-01, OBS-19) |
| `show-details: when-authorized` | Default `never`; details visible on dashboards, not on the probe (SPRING-OBS-02) |
| Readiness group includes `db` as the example | Only where OBS-03 applies, with a reason (SPRING-OBS-03) |
| `Observation` and `MeterRegistry` used inside an `@Service` | Business metrics through an outgoing port; Observation API only in `application` (SPRING-OBS-06) |
| Developer console dependency (BootUI) | Not used; Compose profile `observability` (SPRING-DEV-03) |

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Observability and Operability".*
