# Observability and Operability

What every component must provide so that it can be run, watched and debugged in production: health probes, graceful shutdown, metrics, traces, frontend error reports, SLOs and alerts. These rules apply to every stack; [spring.md](spring.md) and [nestjs.md](nestjs.md) add the backend stack rules; frontends: Per stack line at the end. Logging: [logging/spring.md](../logging/spring.md) (`SPRING-LOG-*`), [logging/nestjs.md](../logging/nestjs.md) (`NEST-LOG-*`); the Next.js server logs per [nextjs.md](nextjs.md) (NEXT-OBS-07..10). The monitoring platform itself (collector, storage, dashboards tool, paging) is infrastructure and product-specific (the product's chapter 7).

**Terms.** *Liveness*: the process is not stuck and needs no restart. *Readiness*: the instance can take traffic now. *SLI*: a measured indicator of what users experience (share of successful requests, share of requests faster than a threshold). *SLO*: the target for an SLI over a window. *RED*: rate, errors, duration per entry point.

## Decisions

Decided for the baseline:

| Topic | Decision |
|---|---|
| Signals | Metrics and traces through OpenTelemetry (OTLP) to the platform's collector by default; logs as structured JSON on stdout by default (SPRING-LIB-10, SPRING-LOG-02; NestJS: NEST-OBS-05, NEST-LOG-02; Next.js: NEXT-OBS-01, NEXT-OBS-07). OTLP log export or pull-based Prometheus metrics only where the platform requires them, recorded in the product's chapter 7 |
| Correlation | The W3C trace id is the correlation id; no separate correlation header |
| Trace start | The BFF (first server hop) starts the trace; browser tracing (OpenTelemetry JS for the browser is still experimental) needs an ADR |
| Probe exposure | Probes exercise the serving connector, without credentials, not routed from the internet (OBS-19). All other management endpoints on a management port that the ingress does not route; health and info only (plus the metrics scrape endpoint where the platform pulls), everything else denied (SPRING-SEC-07, NEST-SEC-10) |
| Frontend errors | A global error handler reports through an outgoing port; the tool (for example a self-hosted Sentry-compatible tracker, or a BFF endpoint that logs) is a product ADR |
| SLOs and alerts | Owned by the product team; the baseline gives the minimal set and placeholders |

## Rules

### Health and lifecycle

- **OBS-01: Every deployed component exposes a liveness and a readiness endpoint** that the platform probes. They are reachable by the platform without user credentials and are not reachable from the internet.
- **OBS-02: Liveness checks only the process itself.** It never includes the database, broker, other services or disk space of shared volumes.
  *Why:* if a shared dependency fails, a liveness check on it restarts every instance at once and turns a partial outage into a full one.
- **OBS-03: Readiness reports whether this instance can serve traffic:** startup finished, configuration valid (CFG-08), and, only where the instance can serve no request at all without it, its primary database. Optional dependencies (outbound APIs, brokers for a mostly-synchronous service) never fail readiness; their failure shows in metrics and errors. Readiness goes down when shutdown starts, unless the stack removes the instance through a pre-stop delay (OBS-04).
- **OBS-04: Shutdown is graceful.** On the termination signal the instance stops being ready (or the platform removes it from the endpoints through a pre-stop delay the stack names, e.g. NEXT-OBS-12), finishes in-flight requests and messages within a bounded time, commits or releases what it consumed, then exits. The shutdown budget is the sum of every shutdown stage that waits for in-flight work (for example message consumers, then the web server) plus the drain delay that lets the load balancer notice the instance is not ready; it is shorter than the platform's termination grace period. The stack file states the stages and numbers (Spring: SPRING-OBS-04; NestJS: NEST-OBS-04; Next.js: NEXT-OBS-12), and the product's chapter 7 records the grace period.
  *Why:* every deployment and scale-down otherwise drops requests and redelivers messages.
- **OBS-19: Probes exercise the serving connector.** A probe that passes while the port that serves users is broken is worthless, so the liveness and readiness checks reach the instance through the same connector (port, thread pool, servlet stack) that serves requests, without credentials and not routed from the internet. Two realisations are accepted: (a) default: the probe paths are served on the main port and the ingress does not route them; (b) where the platform cannot keep probe paths on the main port away from the internet: probes on the management port plus a platform health check of the serving port (a load-balancer target check or a TCP probe). The product's chapter 7 records which applies. Stack mechanism: SPRING-OBS-01, NEST-OBS-01, NEXT-OBS-11.
- **OBS-05: Probe and lifecycle behaviour is tested:** liveness and readiness reachable without credentials where the platform probes them (OBS-19), other management endpoints denied, readiness down after a dependency marked critical fails (where OBS-03 includes one).

### Metrics

- **OBS-06: Technical metrics come from the framework instrumentation** (HTTP server and client, database pool, broker clients, runtime). Code adds them only where no instrumentation exists.
- **OBS-07: Business metrics are explicit and few:** one per business event that someone watches (orders placed, payments failed), named `<product-area>.<noun>.<verb-past>` in lower-case dot notation (`orders.order.placed`), with a description and base unit.
- **OBS-08: Metric tags have low, bounded cardinality.** Allowed: values from a closed set (enum, status class, outcome, route template). Forbidden: ids, user names, e-mail addresses, raw URLs or paths with ids, free text, exception messages. High-cardinality detail goes into span attributes or logs, without personal data (SPRING-LOG-08, NEST-LOG-09). Checked by a test per custom meter: the test drives the meter with every value its tag sources allow (all enum constants, all outcomes) and asserts the exact set of tag keys and that the number of series equals the size of that closed set (Spring: SPRING-OBS-11).
  *Why:* every distinct tag value is a new time series; unbounded tags break the metrics backend and its bill.
- **OBS-09: Metrics and traces are emitted by adapters and the application ring through an observation abstraction or an outgoing port, never by `domain` or `ports`** (ARCH-DEP). Architecture tests forbid metrics and tracing libraries in `domain` and `ports`.

### Tracing and correlation

- **OBS-10: Trace context propagates with W3C Trace Context (`traceparent`, `tracestate`) from the first server hop onwards:** BFF → backend → outbound HTTP and messages. The browser does not send `traceparent`; the BFF starts the trace (decision table, OBS-12; frontend: the stack's rule). Outbound clients and producers use the instrumented builders and templates so the header is set automatically.
- **OBS-11: The trace id is the correlation id.** Logs carry it (SPRING-LOG-03, NEST-LOG-03, NEXT-OBS-08); error responses return it to the caller (SPRING-SEC-18, SPRING-OBS-10, NEST-OBS-10, NEXT-OBS-06); frontend error reports include it when an HTTP call failed (the stack's rule). No component invents a second correlation header.
- **OBS-12: Trace context from outside the trust boundary is not trusted.** The ingress or the BFF drops incoming `traceparent`/`tracestate` from the internet and starts a new trace, so clients cannot force sampling or join foreign traces.
- **OBS-13: Sampling is set explicitly per environment as configuration** (CFG-03), never left to a default nobody chose. Development and test environments may sample everything.

### Frontend errors

- **OBS-14: Frontends report unhandled errors and failed backend calls through one global handler to an error-reporting tool.** Reports carry release version, environment, route template and trace id, and no tokens, personal data or form values (TS-SEC-06).
- **OBS-15: Source maps are uploaded privately to the error-reporting tool by CI and never served publicly** (TS-SEC-05). The release version in reports matches the uploaded maps.

### SLOs, dashboards, alerts

- **OBS-16: The product team defines SLOs for its user-facing journeys** and records them as quality scenarios in its chapter 10, with the SLI, target, window and owner. Placeholders until the team decides: availability ≥ `<99.5 %>` of requests without 5xx over 28 days; latency: `<95 %>` of requests under `<500 ms>` per critical endpoint. Values without a measured baseline are marked provisional.
- **OBS-17: Every component has the minimal dashboard** (table below) before its first production release.
- **OBS-18: Alerts page on symptoms, not causes:** SLO burn rate (fast and slow window), instances not ready, consumer lag or dead-letter growth (MSG-DLT-02), outbox age (MSG-PUB-04), error-report spikes, spikes in denied access or token failures (SEC-AUD-03), CSP violation reports (SPRING-SEC-13, NODE-BFF-09). Every paging alert has an owner and a runbook link (`docs/architecture/` chapter 8 or the incident runbook, SEC-INC-02). Cause-level signals (CPU, GC, pool usage) are dashboard panels, not pages.

### Minimal dashboard and alert set

| Panel / alert | Signal | Alert? |
|---|---|---|
| RED per HTTP route | request rate, 5xx share, p95/p99 duration by route template | SLO burn rate |
| Readiness | ready instances vs desired | yes, if below desired for `<5 min>` |
| Outbound calls | rate, errors, duration per client | no (dashboard) |
| Database pool | active, pending connections, acquire time | no |
| Runtime | memory, GC pause, threads (JVM); heap and event-loop delay (Node.js) | no |
| Messaging | consumer lag per group, dead-letter count | yes: lag over `<threshold>` for `<10 min>`, any new dead letter (MSG-DLT-02) |
| Outbox relay | oldest unsent age, unsent and parked count (MSG-PUB-04) | yes: age over `<5 min>`, any parked row |
| Business metrics | OBS-07 counters | per product |
| Frontend | error reports per release, failed-call share | yes, on a spike after a release |

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Observability and Operability".*
