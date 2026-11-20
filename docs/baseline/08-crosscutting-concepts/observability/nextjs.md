# Next.js: Observability and Operability

How a Next.js app implements [observability.md](observability.md) (`OBS-*`) on its server side, and what it changes on the client side of [react.md](react.md) (`REACT-OBS-*`). The Next.js server is the first server hop and the BFF of its browser users (NEXT-D2, [security/node-bff.md](../security/node-bff.md)), so it carries what a backend carries: telemetry, structured logs, probes and a graceful shutdown. Libraries: `@opentelemetry/sdk-node` 0.301, `@opentelemetry/instrumentation-http` 0.301, `@opentelemetry/instrumentation-undici` 0.35, `@opentelemetry/exporter-trace-otlp-http` 0.301, `@opentelemetry/api` 1.10, `pino` 10.4. Configuration of the keys named here: [configuration/nextjs.md](../configuration/nextjs.md). Image and runtime: [07-deployment-view/nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md).

For Next.js this file replaces three React SPA parts of [react.md](react.md): the router `errorComponent` row of REACT-OBS-01 (NEXT-OBS-14), the router-based route template of REACT-OBS-05 (NEXT-OBS-16) and the Vite source maps of REACT-OBS-06 (NEXT-OBS-17). REACT-OBS-02..04 and the rest of REACT-OBS-01 and 05 apply unchanged.

What the Next.js reference build verified (Next 16.4, standalone server, 2026-11-20): telemetry in `instrumentation.ts` with spans in a local OTLP sink, `onRequestError` writing a pino JSON line with the error `digest`, `/livez` and `/readyz`, the SIGTERM behaviour, `instrumentation-client.ts` running before app code, no browser source maps in the build. Everything marked "to verify before first use" was not built and is listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Rules

### Telemetry setup

- **NEXT-OBS-01: OpenTelemetry starts with the plain Node SDK in `register()` of `src/instrumentation.ts`, on the Node.js runtime only.** Next.js calls `register()` once when a server instance starts, before it serves requests. It imports `src/telemetry.ts` dynamically, so the SDK never ends up in a client or edge bundle, and starts a `NodeSDK` with the HTTP instrumentation (incoming requests) and the undici instrumentation (server-side `fetch`, which the generated clients and `openid-client` use). Next.js itself emits spans through `@opentelemetry/api` once a tracer provider is registered: `render route (app) /orders`, `executing api route (app) /livez`, `resolve page components`, `start response`. `@vercel/otel` is not used; it was not tried, and choosing it needs an ADR.

```ts
// src/telemetry.ts (validated; imported only by instrumentation.ts)
export function startTelemetry(): void {
  const sdk = new NodeSDK({
    serviceName: 'orders-frontend',
    traceExporter: new OTLPTraceExporter(),          // endpoint and headers from OTEL_* (NEXT-OBS-02)
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  });
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown()); // flush on shutdown (NEXT-OBS-13)
}
```

```ts
// src/instrumentation.ts (excerpt)
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { startTelemetry } = await import('./telemetry');
  startTelemetry();
  // test stubs: NEXT-TEST-10
}
```

  `instrumentation.ts` and `telemetry.ts` are tool-level files at the root of `src/`, like `proxy.ts`; they may read `process.env` for `NEXT_RUNTIME` only, everything else comes from the validated configuration. Unit tests never import them, so tests run without telemetry; the E2E server sets `OTEL_SDK_DISABLED=true`.
- **NEXT-OBS-02: Telemetry is configured per environment through `OTEL_*` variables** (CFG-03, OBS-13), listed in `configuration-keys.yaml` (CFG-12):

| Variable | Value |
|---|---|
| `OTEL_SERVICE_NAME` | the component name (overrides `serviceName` in code) |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.version=<release>,deployment.environment.name=<env>` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | the platform's collector |
| `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` | `parentbased_traceidratio`, `0.1` (set explicitly per environment, OBS-13) |
| `OTEL_METRICS_EXPORTER` | `otlp` (NEXT-OBS-03) |
| `OTEL_LOGS_EXPORTER` | `none` (logs go to stdout, NEXT-OBS-06) |
| `OTEL_SDK_DISABLED` | `true` only in the E2E server and local runs without a collector |

  Propagation keeps its default (W3C Trace Context and baggage). Verified: the exporter sent `application/json` to a local sink with the variables above. To verify before first use: that `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` win over the `serviceName` option in code.
- **NEXT-OBS-03: Technical metrics come from the instrumentations; business metrics go through an outgoing port** (OBS-06, OBS-07, OBS-09). With a metric reader the HTTP instrumentation records `http.server.request.duration` and the undici instrumentation `http.client.request.duration`; they are the RED panels of the minimal dashboard (OBS-17). A business metric is a port in `ports/out` with an adapter in `adapter/out/metrics` that creates its instruments once from a `Meter`, with attribute values from closed sets and the cardinality test of OBS-08; `@opentelemetry/*` is never imported in `domain`, `ports` or `application` (dependency-cruiser, NEXT-ARCH-13). To verify before first use: the reference build exported traces only; that `NodeSDK` picks up a metric exporter from `OTEL_METRICS_EXPORTER` without a `metricReader` in code, and which metric names the instrumentations emit with these versions.

### Tracing and correlation

- **NEXT-OBS-04: The Next.js server starts the trace; outbound calls carry it** (OBS-10). Server components, server actions and route handlers call the backend and the IdP through `fetch` (undici), whose instrumentation adds `traceparent`; the reference build showed undici spans for the IdP discovery under the incoming request's span. The browser sends no `traceparent` (REACT-OBS-04).
- **NEXT-OBS-05: Incoming `traceparent` and `tracestate` from the internet are not trusted** (OBS-12). Verified gap: the HTTP instrumentation continues an incoming `traceparent`. Default: the ingress in front of the Next.js server removes both headers, and the product's chapter 7 says where. Where the ingress cannot, the SDK gets a propagator that injects W3C Trace Context on outbound calls but extracts nothing from incoming requests. Neither variant was built: to verify before first use, with a test that sends a `traceparent` and asserts a new trace id.
- **NEXT-OBS-06: Problem responses of the app's own route handlers carry the trace id** (OBS-11). The platform's `problemResponse(status)` adds `traceId` from `trace.getActiveSpan()?.spanContext()` when `isSpanContextValid`; nothing else from the trace goes into a response. Problem bodies the API proxy relays from the backend already carry the backend's `traceId` and are passed through unchanged (verified: status and body relayed), so the browser mutator reports them per REACT-OBS-04. The reference build's `problemResponse` has no `traceId` yet: to verify before first use.

### Logging

- **NEXT-OBS-07: pino is the only server logger.** One instance in `src/platform/adapter/out/logging/logger.ts` (`import 'server-only'`), exported through `src/platform/index.server.ts`. It writes JSON lines to stdout in every environment: no transport, no file, no branch on `NODE_ENV`; readable logs locally come from piping into `pino-pretty` ([nextjs-local-development.md](../../07-deployment-view/nextjs-local-development.md)). The level is the configuration key `LOG_LEVEL` (`fatal`, `error`, `warn`, `info`, `debug`, default `info`), set by the platform composition when it starts. Server code never calls `console.*`. Client code does not use pino; it reports through REACT-OBS-01/02.

```ts
// src/platform/adapter/out/logging/logger.ts (validated, redaction extended per NEXT-OBS-10)
import 'server-only';
import pino from 'pino';

export const logger = pino({
  level: 'info', // the platform composition sets the configured level at start
  base: { service: 'orders-frontend' },
  redact: {
    paths: ['*.authorization', '*.cookie', '*.accessToken', '*.refreshToken', '*.idToken', '*.xsrfToken', '*.sessionId'],
    censor: '[redacted]',
  },
});
```

  Next.js writes its own lines in plain text: the start-up banner (`▲ Next.js 16.4.6`, `✓ Ready`) and, for every error it catches, a `⨯ Error: …` block with the `digest` on stderr, next to the JSON line of NEXT-OBS-09. The reference build found no option to turn them off; the log platform must accept non-JSON lines from this component.
- **NEXT-OBS-08: Every line written inside a request carries `traceId` and `spanId`** through a pino `mixin` that reads the active span (`trace.getActiveSpan()?.spanContext()`, only when `isSpanContextValid`). This makes the trace id the correlation id of logs and error responses (OBS-11). To verify before first use: the mixin was not in the reference build; check that route handlers, server components and server actions see the active span.
- **NEXT-OBS-09: Unexpected server errors are logged once, by `onRequestError`.** `src/instrumentation.ts` exports `onRequestError: Instrumentation.onRequestError` (type from `next`). Next.js calls it for every error it catches while rendering a server component, running a route handler or a server action, or running `proxy.ts`. It logs one `error` line with the error object as `err` (pino serializes type, message, stack and Next's `digest`), the method, the path **without** the query string, `routePath` (the route template, for example `/orders`) and `routeType` (`render`, `route`, `action`, `proxy`). No other code logs an error and rethrows it. The `digest` is the same value the browser receives in `error.tsx` (NEXT-OBS-14), so a client report and the server log line can be matched.

```ts
// src/instrumentation.ts (excerpt, validated)
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { logger } = await import('@/platform/index.server');
  logger.error(
    { err: error, method: request.method, path: request.path.split('?')[0], routePath: context.routePath, routeType: context.routeType },
    'request failed',
  );
};
```

  Verified line: `{"level":50,…,"err":{"type":"Error","message":"Invalid Server Actions request.",…,"digest":"3115798418"},"method":"POST","path":"/orders","routePath":"/orders","routeType":"action","msg":"request failed"}`.
- **NEXT-OBS-10: What is logged where, and what never:**

| Where | Logs | Level |
|---|---|---|
| `onRequestError` (NEXT-OBS-09) | Errors Next.js caught: unexpected exceptions in pages, route handlers, server actions, `proxy.ts` | `error` |
| Outgoing adapters (session store, IdP, backend relay, generated clients' mutator) | Technical events: time-outs, failed calls, retries, a session store that is unreachable, a failed token refresh | `warn`; `error` only when the request fails because of it and the error is not rethrown |
| BFF route handlers and `proxy.ts` | Rejected requests: missing or wrong XSRF header, server action from a foreign origin, unknown session (as a count-worthy event, without the id) | `info` or `warn` |
| Security events (login, failed login, logout, session ended by refresh failure) | Through the audit mechanism of SEC-AUD-01, not as plain log lines; not built in the reference build ([security/nextjs.md](../security/nextjs.md)): to verify before first use | n/a |
| Business errors (a use case's domain error mapped to a code) | Nothing; the outcome is in the response | n/a |

  - The app writes no access log: the standalone server logs no requests, and RED comes from the HTTP spans and metrics (NEXT-OBS-03) or the ingress. Probe calls are never logged.
  - Values go into the object argument, the message is a constant text: `logger.warn({ status, durationMs }, 'backend call failed')`, never a template string.
  - `domain`, `ports` and `application` do not log (dependency-cruiser allow-list).
  - **Never** logged: tokens (access, refresh, ID, logout tokens), the session id, the whole session object, cookies, the `Authorization` header, the XSRF token, the OIDC `code`, `state`, `nonce` and PKCE verifier, request or response bodies, query strings, `Secret` values, and personal data beyond pseudonymous ids (names, e-mail addresses, IP addresses, free text; DP-TEL-01, SEC-INC-01). The redaction paths of NEXT-OBS-07 are a second line of defence; `*.name` matches one level below the logged object only, so adapters log small flat objects, never a session, a request or an error response body. A product extends the list with its personal-data field names (DP-INV-03).
  - A logger test with an in-memory destination (`pino(options, { write: (line) => lines.push(line) })`) asserts that a logged object with `accessToken`, `cookie` and `sessionId` comes out as `[redacted]`. Not built in the reference build: to verify before first use.

### Probes

- **NEXT-OBS-11: `/livez` and `/readyz` are route handlers on the server port** (OBS-19, realisation a). `src/app/livez/route.ts` and `src/app/readyz/route.ts` are one-line files (`export const GET = healthRouteHandlers.readyz`) that bind handlers from `src/platform/adapter/in/next/health-route-handlers.ts`, reached through `index.server.ts`. They need no session; `proxy.ts` gives them the API CSP and the security headers like every route handler ([security/nextjs.md](../security/nextjs.md)). The ingress does not route them (chapter 7). There is no management port; metrics are pushed over OTLP.
  - Liveness is a plain handler: `Response.json({ status: 'UP' })` with `cache-control: no-store`, independent of configuration and dependencies (OBS-02).
  - Readiness answers `{ status: 'UP' }` 200 or `{ status: 'DOWN' }` 503 with `no-store`. It is DOWN once shutdown started (a flag set on `SIGTERM`) and while the session store does not answer a `PING`: without the session store the BFF can serve no signed-in request (OBS-03, NODE-BFF-03). The backend, the IdP and the collector never join readiness. A product whose public pages work without a session states in its chapter 7 whether it keeps the session store in readiness.
  - The platform composition is created at first use (`next build` evaluates route modules without the runtime environment), so an invalid configuration makes `/readyz` fail with a 500 at the first probe. Validation at start-up: [configuration/nextjs.md](../configuration/nextjs.md) (CFG-08).
  - To verify before first use: excluding the probe paths from tracing (`ignoreIncomingRequestHook` of the HTTP instrumentation) without leaving Next's own `executing api route` spans as orphaned root spans; the reference build traced every probe.

### Graceful shutdown

- **NEXT-OBS-12: The standalone server drains in-flight requests on `SIGTERM` but cannot report "not ready" first, so the platform adds a pre-stop delay** (OBS-04, REL-RUN-06). Measured on Next 16.4.6 (`node .next/standalone/server.js`): on `SIGTERM` the listener closed at once (a new connection 0.2 s later was refused), an in-flight upload that still had 3 s to go got its response, and the process exited with code **143** right after it, 3.0 s after the signal. Next.js has no drain delay and no shutdown timeout of its own. Because the listener closes first, `/readyz` never answers DOWN to the platform; the load balancer learns about the stop only from the platform. Therefore:

| Value | Default |
|---|---|
| Pre-stop delay (platform hook before `SIGTERM`; on Kubernetes the `sleep` action, because the distroless image has no shell for an `exec` hook; NEXT-REL-12) | `10 s` |
| In-flight requests after `SIGTERM` | at most the ingress time-out of the ladder, `15 s` ([resilience/nextjs.md](../resilience/nextjs.md), NEXT-RES-03, RES-TMO-04) |
| Telemetry flush (NEXT-OBS-01) and margin | `5 s` |
| Budget | 10 + 15 + 5 = `30 s` |
| Platform termination grace period | above the budget, recorded in chapter 7: `35s` |

  The image starts `server.js` directly with node as PID 1 (distroless `CMD ["server.js"]`, never `npm start`, which does not forward signals; [nextjs-delivery.md](../../07-deployment-view/nextjs-delivery.md)). A request that runs longer than the grace period is cut off by `SIGKILL`; long work does not belong in a request.
- **NEXT-OBS-13: Code that holds resources registers its own `SIGTERM` work and never blocks the exit.** The telemetry SDK calls `sdk.shutdown()` on `SIGTERM` (NEXT-OBS-01); the readiness flag is set on `SIGTERM`. Neither listener prevented the measured exit. To verify before first use: that the last spans reach the collector before Next.js exits (the flush races the exit), whether the session store client should be closed explicitly, and the exit code when node runs as PID 1 in the container (143 was measured with a shell parent; both 0 and 143 are a normal stop).

### Client side

- **NEXT-OBS-14: `src/app/error.tsx` and `src/app/global-error.tsx` replace the router's `errorComponent` and the root boundary of REACT-OBS-01; both report.**
  - `error.tsx` (`'use client'`, props `{ error: Error & { digest?: string }; reset: () => void }`) catches errors of the pages under the root layout. It renders the platform's generic `ErrorMessage` with a retry that calls `reset`, and reports once in an effect through `useReportError()` (REACT-OBS-02), with `digest` as a report field. Segments that need their own retry scope add an `error.tsx` that renders the same component.
  - `global-error.tsx` replaces the root layout when the layout itself fails, so it renders its own `<html>` and `<body>` without the app's providers: no theme, no catalog, no context. It shows a static message in every supported language, each paragraph with its `lang`, and reports through a plain function of the reporting adapter, not through a hook.
  - In production Next.js sends a server-side error to the browser with a generic message and the `digest`; the report then contains the `digest` and never the message of a server error. Errors in event handlers and promises still go to the `window` listeners (REACT-OBS-01); the listeners are registered once by the root client providers (`src/app/providers.tsx`), which have the public configuration with the reporting path.
  - Not built in the reference build: to verify before first use, together with the reporting endpoint (a BFF route handler that logs a scrubbed report, REACT-OBS-03, NODE-BFF-01) and `global-error.tsx` under the nonce CSP.
- **NEXT-OBS-15: `src/instrumentation-client.ts` holds only what must run before any app code in the browser:** `z.config({ jitless: true })` (TS-SEC-09) and the Trusted Types `default` policy ([security/nextjs.md](../security/nextjs.md)). Verified: both take effect before the first schema is built and the first lazy chunk loads. Error reporting is not set up here, because the public configuration and the React context do not exist yet at that point.
- **NEXT-OBS-16: The route template in a client report is the App Router pattern, never the URL** (REACT-OBS-05, DP-TEL-02). The report holds the segment pattern (`/orders/[orderId]`), built by replacing each value of `useParams()` in `usePathname()` with its `[name]`, or a constant the page passes to its error component. On the server the template comes from `context.routePath` in `onRequestError` (verified). The client-side variant is to verify before first use. Replaces the router-based route template of REACT-OBS-05 for Next.js.
- **NEXT-OBS-17: Production builds ship no browser source maps.** `productionBrowserSourceMaps` stays `false` (the Next.js default; verified: no `.map` file and no `sourceMappingURL` under `.next/static`). Server source maps exist under `.next/server` and travel in the standalone output, which is not served; they help server stack traces. Uploading browser maps privately to an error-reporting tool (OBS-15) needs a build that writes maps without publishing them; that is to verify before first use and recorded with the tool's ADR. Replaces REACT-OBS-06 for Next.js.

## Tests

| What | How |
|---|---|
| Probes (OBS-05, OBS-19) | Node spec of the handlers: `livenessHandler` 200 `UP`; `createReadinessHandler` with a stub `Readiness`: 200 `UP`, 503 `DOWN` when not ready, 503 when the check throws; `no-store` on both. The E2E server waits for `/readyz` (`webServer.url`, [testing/nextjs.md](../testing/nextjs.md)) |
| Shutdown (NEXT-OBS-12) | A script against the built standalone server: in-flight request still answered after `SIGTERM`, new connections refused, exit within the budget (the reference build's measurement); rerun after each Next.js major |
| `onRequestError` (NEXT-OBS-09) | Covered by the server-action check that a foreign `Origin` produces one JSON line with `routeType` `action` and the `digest`; a unit test would need Next's request context |
| Redaction (NEXT-OBS-10) | Logger spec with an in-memory destination |
| Trace id in problems, incoming `traceparent` (NEXT-OBS-05/06) | Route handler spec with a span started on a test tracer provider; integration check with a sent `traceparent` |
| Error pages (NEXT-OBS-14) | E2E: a stubbed 5xx in a server component shows the generic message and sends one report with `digest` and route template, without query string |
| Source maps (NEXT-OBS-17) | `check:size` (or the bundle check) fails when `.next/static` contains a `.map` file or `sourceMappingURL` |

## Agent checklist

- [ ] Telemetry only in `register()` on the Node.js runtime, configured through `OTEL_*`, sampler explicit (NEXT-OBS-01/02)?
- [ ] New business metric: outgoing port, `Meter` adapter, closed-set attributes, cardinality test (NEXT-OBS-03)?
- [ ] Outbound calls through `fetch` so the trace propagates; incoming `traceparent` dropped at the ingress or by the propagator (NEXT-OBS-04/05)?
- [ ] Logging only through the platform's pino logger, values in the object, constant message, no `console.*` (NEXT-OBS-07, NEXT-OBS-10)?
- [ ] Unexpected errors left to `onRequestError`, not logged and rethrown (NEXT-OBS-09)?
- [ ] No token, session id, cookie, XSRF token, body, query string or personal data in a log line; redaction paths extended for new fields (NEXT-OBS-10)?
- [ ] `/livez` plain, `/readyz` with shutdown flag and session store only, not routed by the ingress (NEXT-OBS-11)?
- [ ] Pre-stop delay, request budget and grace period recorded in chapter 7 and adding up (NEXT-OBS-12)?
- [ ] `error.tsx` and `global-error.tsx` show the generic message and report with `digest`, never the server's message (NEXT-OBS-14)?
- [ ] `instrumentation-client.ts` holds only zod jitless and the Trusted Types policy (NEXT-OBS-15)?
- [ ] `productionBrowserSourceMaps` still `false` (NEXT-OBS-17)?

## Skill overrides

| Skill or habit | Says | Our rule |
|---|---|---|
| Next.js docs, `vercel-react-best-practices` | `registerOTel` from `@vercel/otel` in `instrumentation.ts` | Plain `@opentelemetry/sdk-node` in `register()`; `@vercel/otel` needs an ADR (NEXT-OBS-01) |
| Generic Next.js habit | `console.log` / `console.error` in server components, actions and route handlers | The platform's pino logger; errors left to `onRequestError` (NEXT-OBS-07, NEXT-OBS-09) |
| Generic habit | `try { … } catch (e) { console.error(e); throw e; }` in a server action | Log once in `onRequestError`; the action maps domain errors to codes (NEXT-OBS-09) |
| Next.js docs | `error.tsx` that renders `error.message` | Generic message, report with `digest` (NEXT-OBS-14, REACT-SEC-08) |
| Generic habit | `productionBrowserSourceMaps: true` for debuggable production | Off; private upload only per tool ADR (NEXT-OBS-17) |
| Error-tracking SDK wizards (`instrumentation-client.ts` with `Sentry.init`, DSN to an external host) | SDK in the client instrumentation file | The SDK, if chosen by ADR, lives only in the reporting adapter; reports go to the same-origin path (REACT-OBS-02/03, NEXT-OBS-15) |
| Health-check habit | `/api/health` that checks the backend and the IdP | `/livez` plain, `/readyz` with the session store only (NEXT-OBS-11) |

## Sources

Next.js 16.4 documentation: `instrumentation.ts` (`register`, `onRequestError`, `Instrumentation.onRequestError`), `instrumentation-client.ts`, OpenTelemetry guide, `error.tsx` and `global-error.tsx`, `productionBrowserSourceMaps`, self-hosting (standalone output, graceful shutdown). OpenTelemetry JS READMEs (`@opentelemetry/sdk-node` 0.301, `instrumentation-http`, `instrumentation-undici`, `exporter-trace-otlp-http`), OpenTelemetry SDK environment variable specification, W3C Trace Context, pino 10 documentation (`redact`, `mixin`, destinations), Kubernetes pod termination and `preStop` `sleep` action. Checked in the Next.js reference build on 2026-11-20 (Next 16.4.6, Node 26.1, `@opentelemetry/sdk-node` 0.301.2, pino 10.4.0): spans exported to a local OTLP sink, `onRequestError` line with `digest`, SIGTERM measurement (exit 143 after 3.0 s with one in-flight request), no browser source maps.
