# React: Error Reporting and Correlation

How a React frontend implements [observability.md](observability.md) (`OBS-*`, in particular OBS-14/15): one error path, reports without personal data, correlation with backend traces, private source maps. Browser rules: TS-SEC-05/06; the user-facing error message: [REACT-SEC-08](../security/react.md). Rules marked "(React SPA)" describe the Vite build and TanStack Router; Next.js adds its server side and replaces those in [observability/nextjs.md](nextjs.md). Real-user performance monitoring (Core Web Vitals) belongs to the performance topic, which the baseline does not cover yet ([chapter 11](../../11-risks-and-technical-debt/README.md)).

## Rules

### One error path

- **REACT-OBS-01: All unhandled errors reach one reporting use case through four entry points in `src/platform/adapter/in/ui/` and the HTTP path:**

  | Entry point | Catches | Shows |
  |---|---|---|
  | `RootErrorBoundary` (class component, `getDerivedStateFromError` + `componentDidCatch`), rendered by the root composition inside `PlatformProvider` and around store, query client and router | Render errors outside the router | The generic `ErrorMessage` with a reload button |
  | (React SPA) `RouteError` as the root route's `errorComponent` (`ErrorComponentProps`); reports in an effect | Errors in route components, and a lazy chunk that fails again after the router's one reload (REACT-ARCH-21) | `ErrorMessage` with a retry that calls `reset` |
  | `listenForGlobalErrors()`, registered once by `createPlatform`: `window` `error` and `unhandledrejection` | Errors in event handlers, timers and promises that nobody handled | Nothing (the UI keeps running) |
  | The HTTP mutator and the feature's HTTP adapter (REACT-OBS-04) | The technical errors each creates: server errors, network failures, time-outs and non-JSON bodies in the mutator; bodies that fail the contract's schema and unmappable problems in the adapter | The feature shows its own error state |

  Error boundaries do not catch errors in event handlers or async code; those are either handled by the feature (mapped to message keys, REACT-STATE-07) or reach the `window` listeners. The root boundary is the one class component (React has no hook for error boundaries). Nothing else calls `console.error` for reporting or talks to the reporting tool.
- **REACT-OBS-02: Reporting follows the rings.** The contract `ReportErrorUseCase` (`platform/ports/in`) has one method `report(error, details?)`. `ReportErrorService` (`platform/application`) builds the report, scrubs it (REACT-OBS-05), drops duplicates (same fingerprint at most once per page load) and stops after `20` reports per page load; when reporting is disabled it sends nothing. It calls the outgoing port `ErrorReportingPort` (`platform/ports/out`). The adapter `HttpErrorReporting` (`platform/adapter/out/http/`) is the only place that knows the tool or its endpoint (OBS-09, TS-ARCH-01). `createPlatform` creates the service once; components and hooks reach it with `useReportError()` from `platform.tokens.ts`, the root boundary through `static contextType = ReportErrorContext`, the mutator (through `configureHttp`) and the `window` listeners as an argument, a feature's HTTP adapter as a constructor argument from the factory in `<feature>.api.tsx`, which reads `useReportError()` in its provider (REACT-ARCH-10). The UI reports only unexpected errors, neither a feature business error nor the platform's `TechnicalError`, in the mutation hook's `onError` (REACT-STATE-07). The tool behind the endpoint is a product ADR.
- **REACT-OBS-03: Reports go to a same-origin path from the runtime configuration** (`errorReporting.path`, REACT-CFG-03), so `connect-src 'self'` (REACT-SEC-04) stays unchanged and the BFF forwards or logs them. The adapter sends a `POST` with the XSRF header (REACT-SEC-06), `keepalive: true`, `credentials: 'same-origin'` and a 5-second timeout (RES-TMO-01); a failed send is dropped, never reported. Errors before the configuration is loaded go to the console only (REACT-CFG-03).

### Correlation

- **REACT-OBS-04: Every technical failure of a backend call is reported once, by the code that creates its `TechnicalError` (TS-ARCH-18).** The HTTP mutator `customFetch` ([api/react-openapi-clients.md](../api/react-openapi-clients.md)) reads `traceId` from the problem+json body of a 5xx response and reports status and `traceId`; it reports network failures, time-outs and a 2xx body that is not JSON (with its status); then it throws the platform's `TechnicalError` (`'server'`, `'network'`, `'timeout'`, `'malformed-response'`). It does not report a `401` (redirect to login, REACT-SEC-06), a 4xx (passed on as `HttpProblem` to the feature's mapper) or a call the caller aborted (TanStack Query cancelling a query). The feature's HTTP adapter reports the `TechnicalError`s it creates: `'malformed-response'` when the body fails the generated zod schema, and `'unexpected'` when its mapper cannot map a problem (unknown `code`, unexpected status). It gets the `ReportErrorUseCase` as a constructor argument from the feature's factory (REACT-ARCH-10) and passes every `TechnicalError` it did not create on unchanged, unreported. Nothing above the adapter reports a `TechnicalError`. The browser does not create traces or send `traceparent`; the BFF starts the trace (OBS-10, OBS-12). Browser tracing with OpenTelemetry JS needs an ADR.

### Content

- **REACT-OBS-05: A report contains** error type, message and stack (scrubbed), release version (from `/config.json`, REL-VER-05, matching the uploaded source maps, OBS-15), environment, route **template**, status and `traceId` for HTTP failures. (React SPA) The route template is the `routeId` of the router's last match (`router.state.matches.at(-1)?.routeId`, for example `/orders/$orderId`), never the URL. **Never** query strings, URLs with ids, form values, request or response bodies, tokens, cookies, names or e-mail addresses (TS-SEC-06). The scrubber is a pure function in `platform/application` with Chicago-style tests; it replaces numeric and UUID path segments with `:id`, and works word by word instead of with a backtracking e-mail regex.

### Source maps

- **REACT-OBS-06: (React SPA) Production builds create hidden source maps and never ship them.** `vite.config.ts` sets `build.sourcemap: 'hidden'`: Vite writes the `*.map` files but no `sourceMappingURL` comment. `check:bundle` (part of `verify`) fails when any built chunk contains `sourceMappingURL`. The release job uploads the `*.map` files with the release version to the error-reporting tool and deletes them before the bundle is handed to the BFF's image build ([REL-FE-02](../../07-deployment-view/container-runtime.md)); a CI check fails if that artifact contains a `.map` file (TS-SEC-05, OBS-15).

## Tests

| What | How |
|---|---|
| Scrubber (REACT-OBS-05) | Vitest, Chicago style: query strings and fragments, e-mail addresses and token-like values removed, numeric and UUID path segments replaced by `:id`; ordinary text kept |
| `ReportErrorService` | Vitest, London style with a mocked `ErrorReportingPort`: scrubbed report with release, environment, route and HTTP details; dedupe; limit; nothing sent when disabled |
| Mutator (REACT-OBS-04) | Vitest with MSW: a 5xx problem+json reports its `traceId`; time-out, network failure and a non-JSON 2xx body are reported; 401, 4xx and a caller abort are not |
| Feature HTTP adapter (REACT-OBS-04) | Vitest with MSW and a mocked `ReportErrorUseCase` in the constructor: a malformed body and an unknown problem code are reported once; a known code, a 404 and a caller abort are not; a 5xx is reported only by the mutator (exactly one call) |
| Mutation hook (REACT-STATE-07) | Page test: a rejected command with an unexpected error is reported once; a domain error or a `TechnicalError` is not |
| Boundaries | Component test with a mocked `ReportErrorUseCase` in `ReportErrorContext`: a throwing child is reported once and the generic message shows |
| E2E stubbed | Playwright: a stubbed 503 with `traceId` produces one request to the configured reporting path, with route template `/orders`, `traceId`, and no query string in its body (`page.waitForRequest`) |
| Build | `check:bundle`: no `sourceMappingURL`; release job: no `.map` file in the handed-over bundle |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Error Reporting and Correlation".*

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| Error-tracking SDK snippets (`Sentry.init` in `main.tsx`, the SDK's own React error boundary, DSN to an external host) | The SDK, if chosen by ADR, lives only in the `ErrorReportingPort` adapter; reports go to the same-origin path (REACT-OBS-02/03) |
| `tanstack-query-best-practices`: error handling on HTTP status in `onError` or `retry` | The UI sees domain errors only; technical failures are reported once where they are created (REACT-OBS-04, TS-ARCH-18) |
| Vite habit: `build.sourcemap: true` for debuggable production | `'hidden'`, uploaded and removed (REACT-OBS-06) |
