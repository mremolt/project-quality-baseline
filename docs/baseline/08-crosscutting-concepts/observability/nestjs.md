# NestJS: Observability and Operability

How a NestJS backend implements [observability.md](observability.md) (`OBS-*`): probes, graceful shutdown, telemetry, metrics, tracing. Libraries: `@nestjs/terminus`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@fastify/otel`, `@opentelemetry/api`. Logging and log correlation: [../logging/nestjs.md](../logging/nestjs.md).

## Rules

### Probes

- **NEST-OBS-01: `/livez` and `/readyz` are served by the application's own HTTP server on the server port** (OBS-19, realisation a), so a probe passes only if the listener that serves users works. The ingress does not route them (the product's chapter 7 says where they are blocked). Both live in `HealthController` in `src/platform/adapter/in/health`, are `@Public()` and `@ApiExcludeController()`, and answer with status only ([../security/nestjs.md](../security/nestjs.md)). There is no management port and no other operational endpoint: metrics are pushed over OTLP (NEST-OBS-06). If the platform must pull metrics, the Prometheus exporter runs on its own port that the ingress does not route, recorded with an ADR and in chapter 7.
- **NEST-OBS-02: Liveness is a plain handler without checks** (OBS-02): `@Get('livez') live() { return { status: 'ok' }; }`. It does not go through Terminus, because Terminus answers 503 for every check while the drain of NEST-OBS-04 runs, which would fail liveness during a normal shutdown.
- **NEST-OBS-03: Readiness is a Terminus check of the primary database only, and only where OBS-03 applies.** The check runs `select 1` through Kysely with a timeout and returns nothing (Terminus 12 warns that a returned value will be ignored). Outbound APIs and brokers never join readiness. Another check needs a stated reason in the code and a timeout below the probe's timeout. The check does not borrow a connection from the application pool: it uses its own one-connection pool, or a result cached for a few seconds, so a saturated pool does not make every instance unready at once and remove all of them from rotation.

```ts
// src/platform/adapter/in/health/health.controller.ts (excerpt)
@Get('readyz')
@HealthCheck()
ready() {
  return this.health.check([
    () => this.indicators.check('database')            // HealthIndicatorService from @nestjs/terminus
      .attempt(async () => { await sql`select 1`.execute(this.db); })
      .withTimeout(1000),
  ]);
}
```

  A failed or slow check answers 503 after the timeout; the problem-details filter renders it like any other error.

### Graceful shutdown

- **NEST-OBS-04: Shutdown follows Nest's hook order, with a drain before the server closes** (OBS-04). `create-app.ts` calls `app.enableShutdownHooks()`. On SIGTERM Nest runs `onModuleDestroy`, then `beforeApplicationShutdown`, then closes the HTTP server (in-flight requests finish, new connections are refused), then `onApplicationShutdown`, and re-raises the signal. The exit code is 143 in a shell and 0 when node is PID 1 in the container; both are a normal stop. The drain comes from `TerminusModule.forRoot({ gracefulShutdownTimeoutMs })`: during that time `/readyz` answers 503 while the server still serves requests, so the load balancer stops sending before connections close. What goes where:

| Hook | Work |
|---|---|
| `onModuleDestroy` | Stop message consumers (they finish the current batch, [../messaging/nestjs.md](../messaging/nestjs.md)) |
| `beforeApplicationShutdown` | Drain delay (Terminus); `@nestjs/schedule` stops cron jobs and waits for running ones that use `waitForCompletion` |
| server close | In-flight HTTP requests finish, bounded by the request budget (RES-TMO-04) |
| `onApplicationShutdown` | Close what requests still needed: database pool, undici agents, telemetry flush (NEST-OBS-05) |

  Defaults and budget:

| Value | Default |
|---|---|
| Drain (`SHUTDOWN_DRAIN_MS`, platform config schema; tests set `0`) | `5000` ms |
| In-flight HTTP | at most the request budget, `10 s` |
| Consumer stop | the bound of the messaging rules, `20 s` |
| Budget | drain + in-flight + consumer stop (where present) + `5 s` margin: HTTP only 5 + 10 + 5 = 20 s; with consumers 40 s |
| Platform termination grace period | at least the budget, recorded in chapter 7: `30s` for HTTP only, `60s` with consumers |

  The image starts `node` directly as PID 1 (exec form, never `npm start`, which does not forward signals): `node --import ./dist/instrumentation.js dist/main.js` ([../../07-deployment-view/nestjs-delivery.md](../../07-deployment-view/nestjs-delivery.md)). No platform pre-stop delay is needed; the drain is in the application.

### Telemetry setup

- **NEST-OBS-05: OpenTelemetry starts in `src/instrumentation.ts`, loaded with `--import` before any application module.** It registers the OpenTelemetry ESM loader hook (the backend is ESM, NODE-D2), starts the `NodeSDK` with the auto-instrumentations and `@fastify/otel`, and exports the SDK so `main.ts` can flush it on shutdown. Everything else is configured with standard `OTEL_*` variables (NEST-OBS-06), not code. Meters and tracers obtained before the SDK starts are no-ops, which is why the file runs first.

```ts
// src/instrumentation.ts
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { register } from 'import-in-the-middle/register-hooks.mjs';

register(); // ESM hook, in-thread via module.registerHooks (module.register is deprecated in Node 26)

const probes = new Set(['/livez', '/readyz']);

export const telemetry = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: (req) => probes.has(req.url ?? '') },
      '@opentelemetry/instrumentation-fs': { enabled: false },          // noise
      '@opentelemetry/instrumentation-dns': { enabled: false },         // noise
      '@opentelemetry/instrumentation-net': { enabled: false },         // noise
      '@opentelemetry/instrumentation-nestjs-core': { enabled: false }, // supports @nestjs/core < 12 only
      '@opentelemetry/instrumentation-pino': { enabled: false },        // correlation via the pino mixin (NEST-LOG-03)
    }),
    new FastifyOtelInstrumentation({ registerOnInitialization: true, ignorePaths: ({ url }) => probes.has(url) }),
  ],
});
telemetry.start();
```

```ts
// src/main.ts: flush after the HTTP server has closed (onApplicationShutdown)
const app = await createApp();
app.get(ShutdownCallbacks).add(() => telemetry.shutdown());   // small platform provider that runs callbacks in onApplicationShutdown
await app.listen({ port: http.HTTP_PORT, host: '0.0.0.0' });
```

  Tests never import `main.ts` or `instrumentation.ts`, so they run without telemetry. `import-in-the-middle` (the hook is imported by name) and `@opentelemetry/instrumentation` are direct dependencies. The auto-instrumentations package no longer contains a Fastify instrumentation (removed in March 2026); `@fastify/otel`, maintained by the Fastify team, adds route and handler spans with `http.route`. `@fastify/otel` 1.0 pulls its own copy of `@opentelemetry/instrumentation` (0.300.x next to the SDK's 0.301.x); check that the versions line up again on each update.
- **NEST-OBS-06: Telemetry is configured per environment through `OTEL_*` variables** (CFG-03, OBS-13), listed in `configuration-keys.yaml`:

| Variable | Value |
|---|---|
| `OTEL_SERVICE_NAME` | the component name |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.version=<release>,deployment.environment.name=<env>` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | the platform's collector |
| `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` | `otlp` |
| `OTEL_LOGS_EXPORTER` | `none` (logs go to stdout, NEST-LOG-02) |
| `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` | `parentbased_traceidratio`, `0.1` (set explicitly per environment, OBS-13) |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` unless the platform asks otherwise |

  In `configuration-keys.yaml` a variable is `required: true` where the SDK default is not the value above (`OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_LOGS_EXPORTER`, whose SDK default is `otlp`, and the two sampler variables, which OBS-13 wants explicit) and `required: false` where the default already is (`OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`, `OTEL_METRIC_EXPORT_INTERVAL`). The key-list test skips `OTEL_*` entries, since no own schema parses them (NEST-CFG-05/10). Propagation keeps its default (W3C Trace Context and baggage); B3 only with an ADR.

### Metrics

- **NEST-OBS-07: Technical metrics come from the instrumentations** (OBS-06). With NEST-OBS-05 the service emits `http.server.request.duration`, `http.client.request.duration` (undici), `db.client.operation.duration` and `db.client.connection.*` (pg pool), and the runtime metrics `nodejs.eventloop.delay.*` (min, max, mean, p50, p90, p99), `nodejs.eventloop.utilization` and `nodejs.eventloop.time`. Event-loop delay p99 and utilization are panels on the minimal dashboard (OBS-17) in place of "threads"; a sustained rise points to blocking work on the loop (NODE-ARCH-10).
- **NEST-OBS-08: Business metrics go through an outgoing port** (OBS-07, OBS-09): `OrderMetricsPort.orderPlaced(channel)` in `ports/out`, implemented in `adapter/out/metrics` with an OpenTelemetry `Meter` injected through a token (`{ provide: METER, useFactory: () => metrics.getMeter('orders') }`). Instruments are created once in the constructor. Attribute values come from closed sets only (OBS-08). The use case's test verifies the port call; the adapter test asserts the meter. `@opentelemetry/*` is never imported in `domain`, `ports` or `application` (the allow-list of NODE-ARCH-04 forbids it).

```ts
// adapter/out/metrics/otel-order-metrics.adapter.ts
@Injectable()
export class OtelOrderMetrics implements OrderMetricsPort {
  private readonly placed: Counter;
  constructor(@Inject(METER) meter: Meter) {
    this.placed = meter.createCounter('orders.order.placed', { description: 'Orders accepted by the system', unit: '{order}' });
  }
  orderPlaced(channel: SalesChannel): void {
    this.placed.add(1, { channel });   // closed union type: low cardinality (OBS-08)
  }
}
```

### Tracing and correlation

- **NEST-OBS-09: Outbound calls and messages carry the trace.** HTTP calls go through undici ([../resilience/nestjs.md](../resilience/nestjs.md)), whose instrumentation sets `traceparent`; database calls get spans from the pg instrumentation (query text with parameters as placeholders). The auto-instrumentations cover `kafkajs`, not `@platformatic/kafka`; the messaging adapter injects and extracts the trace context itself with `propagation.inject`/`extract` of `@opentelemetry/api` ([../messaging/nestjs.md](../messaging/nestjs.md)). Incoming `traceparent` from the internet is removed at the ingress in front of the BFF (OBS-12); the product's chapter 7 states where.
- **NEST-OBS-10: Error responses return the trace id.** The global problem-details filter ([../api/nestjs-rest.md](../api/nestjs-rest.md)) adds `traceId` from `trace.getActiveSpan()?.spanContext()` (when `isSpanContextValid`) to every problem+json body (OBS-11). Nothing else from the trace (span ids, baggage) goes into a response.

### Tests

- **NEST-OBS-11: Operability is tested:**

| What | How |
|---|---|
| Probes (OBS-05, OBS-19) | Controller test on the real Fastify app (`createApp()`, `app.inject` or supertest): `/livez` and `/readyz` 200 without a token, body only status; `/readyz` 503 when the database check fails (stub `Kysely` or a stopped Testcontainer) |
| Drain | `*.it.test.ts`: start the app with `SHUTDOWN_DRAIN_MS=1000`, call `app.close('SIGTERM')` without awaiting (Terminus drains only for `SIGTERM`), assert `/readyz` 503 and `/livez` 200 during the drain |
| Business metric and tag cardinality (OBS-08) | Adapter test with `MeterProvider`, `PeriodicExportingMetricReader` and `InMemoryMetricExporter` from `@opentelemetry/sdk-metrics`: drive every value of the attribute's closed set twice, `forceFlush()`, assert one data point per value, exact attribute keys and the counts (example below) |
| `traceId` in errors | Filter test with a span started on a test tracer provider: problem+json contains its `traceId` |
| Architecture | dependency-cruiser allow-list keeps `@opentelemetry/*` and `@nestjs/terminus` out of the core |

```ts
it('has one series per channel (OBS-08)', async () => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
  const metrics = new OtelOrderMetrics(new MeterProvider({ readers: [reader] }).getMeter('orders'));
  for (const c of SALES_CHANNELS) { metrics.orderPlaced(c); metrics.orderPlaced(c); }
  await reader.forceFlush();
  const placed = exporter.getMetrics()[0]!.scopeMetrics[0]!.metrics.find((m) => m.descriptor.name === 'orders.order.placed')!;
  expect(placed.dataPoints).toHaveLength(SALES_CHANNELS.length);
  for (const p of placed.dataPoints) {
    expect(Object.keys(p.attributes)).toEqual(['channel']);
    expect(p.value).toBe(2);
  }
});
```

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Observability and Operability".*
