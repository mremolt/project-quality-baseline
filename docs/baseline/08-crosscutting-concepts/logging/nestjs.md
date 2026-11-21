# NestJS: Logging

How a NestJS backend logs: library, format, correlation, and what is logged where. Probes, metrics and traces: [../observability/nestjs.md](../observability/nestjs.md). Personal data in telemetry: [../data-protection/data-protection.md](../data-protection/data-protection.md) (DP-TEL-01).

## Rules

### Setup

- **NEST-LOG-01: pino through `nestjs-pino` is the only logger** (NEST-D11). `LoggerModule.forRoot(…)` (or `forRootAsync` with a `useFactory` that calls `loadConfig`, [../configuration/nestjs.md](../configuration/nestjs.md)) sits in `app.module.ts`; `create-app.ts` passes `{ bufferLogs: true }` to `NestFactory.create` and calls `app.useLogger(app.get(Logger))`, so Nest's own start-up lines are JSON too. Adapters log with Nest's `Logger` (`private readonly log = new Logger(OrdersController.name)` from `@nestjs/common`), which then writes through pino with `context` set to the class name. No `console.*` (ESLint `no-console`), no Winston, no `process.stdout.write` for log lines. Uncaught exceptions and unhandled rejections end the process (NODE-ARCH-11).
- **NEST-LOG-02: Logs are JSON lines on stdout in every environment**, one object per line with `level`, `time`, `msg`, `context`. No pino transport in deployed code (transports run in worker threads and add a failure mode), no file output, no branch on `NODE_ENV`. Readable logs locally come from piping the output through `pino-pretty` (`npm run start:dev | npx pino-pretty`; `pino-pretty` is a dev dependency, [../../07-deployment-view/nestjs-local-development.md](../../07-deployment-view/nestjs-local-development.md)).
- **NEST-LOG-03: Every line written inside a request, message or job carries `traceId` and `spanId`** through a pino `mixin` that reads the active OpenTelemetry span. The same `traceId` is returned in error responses ([../observability/nestjs.md](../observability/nestjs.md)), so it is the correlation id (OBS-11). The OpenTelemetry pino instrumentation stays disabled: it writes `trace_id`/`span_id` and also forwards every line to the OpenTelemetry logs SDK.

```ts
// app.module.ts (excerpt)
LoggerModule.forRoot({
  pinoHttp: {
    level: logging.LOG_LEVEL,                                   // NEST-LOG-04
    mixin() {
      const span = trace.getActiveSpan()?.spanContext();          // @opentelemetry/api
      return span && isSpanContextValid(span) ? { traceId: span.traceId, spanId: span.spanId } : {};
    },
    serializers: {                                                // NEST-LOG-05
      req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, path: req.url.split('?')[0] }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    // Nest mounts pino-http as middleware: req.url is '/' there, originalUrl holds the path
    autoLogging: { ignore: (req) => ['/livez', '/readyz'].includes((req as { originalUrl?: string }).originalUrl ?? req.url ?? '') },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.email', 'email'],
      censor: '[redacted]',
    },
  },
}),
```

- **NEST-LOG-04: The level is configuration:** `LOG_LEVEL` (`z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])`, default `info`) in the logging schema of `src/platform/config`. `debug` and `trace` are not used in deployed environments except for a bounded diagnosis, set and reset through the deployment.

### Content

- **NEST-LOG-05: Request lines contain method, path, status and duration, nothing else from the request.** pino-http logs every request by default with all headers and the client address (personal data). The serializers above reduce `req` to id, method and path (query string dropped: it may carry search terms or e-mail addresses) and `res` to the status code; probe requests are not logged. The redaction paths are a second line of defence for code that logs headers or objects anyway; extend them with the personal-data field names of the product (DP-INV-03).
- **NEST-LOG-06: Values go into the object argument, the message is a constant text:** `this.log.log({ orderId: order.id }, 'Order placed')` (fields are merged into the JSON line), never `` `Order ${id} placed` `` or string concatenation. The message stays searchable and the fields stay queryable.
- **NEST-LOG-07: Where logging happens:**
  - `domain`, `ports` and `application` do not log. The dependency-cruiser allow-list (NODE-ARCH-04) allows no logger there, and a Nest `Logger` would bring the framework into the core. Behaviour is visible through return values and errors.
  - The incoming adapter logs the outcome of a use case where it is worth an audit trail (state changes, decisions), from the result it got back. Security and audit events go through the audit mechanism of [../security/nestjs-hardening.md](../security/nestjs-hardening.md).
  - Adapters log technical events: retries, opened circuits, rejected calls, dead letters, failed external calls, rejected requests.
- **NEST-LOG-08: An error is logged once, where it is handled:** in the global problem-details filter ([../api/nestjs-rest.md](../api/nestjs-rest.md)), the message consumer's error handling, or the scheduled job's wrapper. Never log and rethrow. Business errors (4xx) are logged at `info` or `warn` without a stack; unexpected errors at `error` with the error object as `err` (`this.log.error({ err }, 'Unhandled error')`), which pino serializes with type, message and stack.
- **NEST-LOG-09: Never log secrets, tokens, passwords, session contents, full request or response bodies, or personal data.** Pseudonymous ids are fine; names, e-mail addresses, IP addresses and free text are not (DP-TEL-01, SEC-INC-01). `Secret` values print as `***` ([../configuration/nestjs.md](../configuration/nestjs.md)), but are not logged at all.

### Tests

- **NEST-LOG-10: Logs are asserted only where they matter:** security and audit events are present, and personal data of use cases that handle it is absent (DP-TEST-02). The test module gets `LoggerModule.forRoot({ pinoHttp: [options, stream] })` with an in-memory stream (`{ write: (line) => lines.push(line) }`), drives the request, and asserts on the parsed lines.

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Logging".*
