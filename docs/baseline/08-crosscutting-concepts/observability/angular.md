# Angular: Error Reporting and Correlation

How an Angular frontend implements [observability.md](observability.md) (`OBS-*`): one global error path, reports without personal data, correlation with backend traces, private source maps. Browser rules: TS-SEC-05/06; the user-facing error message: NG-SEC-11. Real-user performance monitoring (Core Web Vitals) belongs to the performance topic, which the baseline does not cover yet ([chapter 11](../../11-risks-and-technical-debt/README.md)).

## Rules

### One error path

- **NG-OBS-01: All unhandled errors reach one `ErrorHandler`.** `app.config.ts` provides `provideBrowserGlobalErrorListeners()` (stable; forwards the window `error` and `unhandledrejection` events to the `ErrorHandler`) and binds `{ provide: ErrorHandler, useExisting: GlobalErrorHandler }`. `GlobalErrorHandler` lives in `src/platform/adapter/in/ui/`, shows the generic message (NG-SEC-11) and calls the platform use case `ReportErrorUseCase`. Nothing else calls `console.error` for reporting or talks to the reporting tool.
- **NG-OBS-02: Reporting follows the rings.** `ReportErrorUseCase` (`platform/application`) is reached only through the `REPORT_ERROR` injection token in `platform.tokens.ts`, exported by `src/platform/index.ts`; the global handler, the interceptor and the feature HTTP adapters (NG-OBS-04) and the feature error mappers inject the token, never the class. Feature error mappers send it unexpected errors, the ones that are neither a feature business error nor the platform's `TechnicalError` (NG-STATE-09). It builds the report, scrubs it (NG-OBS-05) and drops duplicates (same fingerprint at most once per page load, at most `<20>` reports per page load); it calls the outgoing port `ErrorReportingPort` (`platform/ports/out`). The adapter (`platform/adapter/out/error-reporting/`) is the only place that knows the tool or its SDK (OBS-09, TS-ARCH-01). The tool is a product ADR (observability decisions).
- **NG-OBS-03: Reports go to a same-origin path from the runtime configuration** (`errorReporting.path` in `RUNTIME_CONFIG`, NG-CFG-04), so `connect-src 'self'` (NG-SEC-05) stays unchanged and the BFF forwards or logs them. When reporting is disabled in the configuration, the adapter does nothing. Errors before the configuration is loaded go to the console only (NG-CFG-03).

### Correlation

- **NG-OBS-04: Failed backend calls are reported with the backend's trace id.** An interceptor in `platform/adapter/out/http` reads `traceId` from the problem+json body (SPRING-OBS-10) of 5xx responses and records network failures and time-outs; it passes status, `traceId` and the route template to `ReportErrorUseCase`. Expected 4xx answers (validation, 404 for a deleted object, 409) are handled by the feature and are not reported: the feature's HTTP adapter maps problem `code` and status to its domain errors, and everything it cannot map to the platform's `TechnicalError` (`src/platform/domain`, exported by `src/platform/domain/index.ts`) (TS-ARCH-18). Every `TechnicalError` is reported once, by the code that creates it (TS-ARCH-18): the interceptor reports server errors, network failures (status 0) and time-outs; the feature's HTTP adapter injects `REPORT_ERROR` and reports the two `TechnicalError`s it creates itself, for a body that fails the generated zod schema (TS-API-05) and for a 4xx its mapper cannot map (unknown problem `code`, unexpected status). The `TechnicalError` its mapper makes from a 5xx, a status 0 or a time-out is passed on unreported, because the interceptor reported that failure; the feature's error mapper (NG-STATE-09) never reports a `TechnicalError`. The browser does not create traces or send `traceparent`; the BFF starts the trace (OBS-10, OBS-12). Browser tracing with OpenTelemetry JS (still experimental for the browser) needs an ADR.

### Content

- **NG-OBS-05: A report contains the following fields, and never the data listed after them:** error type, message and stack, release version and environment (from `RUNTIME_CONFIG`, injected at deploy time, REL-VER-05), commit (a build constant, identical in every environment, NG-CFG-01), route **template** (`/orders/:orderId`, not the URL), status and `traceId` for HTTP failures, browser family. **Never** query strings, URLs with ids, form values, request or response bodies, tokens, cookies, names or e-mail addresses (TS-SEC-06). The scrubber is a pure function in `platform/application` with Chicago-style tests.

### Source maps

- **NG-OBS-06: Production builds create hidden source maps and never ship them.** `angular.json` production configuration: `"sourceMap": { "scripts": true, "styles": false, "hidden": true }` (`hidden` omits the `sourceMappingURL` comment). The release job uploads the `*.map` files with the release version to the error-reporting tool, then deletes them before the image or bundle is packaged (TS-SEC-05, OBS-15). A CI check fails if the packaged artifact contains a `.map` file or a `sourceMappingURL` comment.

## Tests

| What | How |
|---|---|
| Scrubber (NG-OBS-05) | Vitest, Chicago style: URLs become route templates; query strings, e-mail addresses, tokens and form values are removed |
| `ReportErrorUseCase` | Vitest, London style with a mocked `ErrorReportingPort`: dedupe and limit, nothing sent when disabled |
| `GlobalErrorHandler` | Unit test with a mocked `REPORT_ERROR`: reports through the use case and shows the generic message; no rethrow |
| Interceptor (NG-OBS-04) | `HttpTestingController` (the interceptor case of TS-TEST-04: it tests the `HttpClient` pipeline, not the contract): a 5xx problem+json reports its `traceId`; a 409 is not reported |
| Feature HTTP adapter (NG-OBS-04, TS-ARCH-18) | `TestBed` with `provideHttpClient()`, MSW and `{ provide: REPORT_ERROR, useValue: mock<ReportErrorUseCase>() }`: a malformed body and an unknown problem `code` each report the `TechnicalError` the adapter rejects with exactly once (`toHaveBeenCalledExactlyOnceWith(failure)`); a known `code` and a 5xx, which the adapter passes on as the interceptor's failure, report nothing from the adapter |
| E2E stubbed | Playwright: a stubbed 500 with `traceId` produces one request to the configured reporting path, without PII in its body (`page.waitForRequest`) |
| Build | CI check: no `.map` file and no `sourceMappingURL` in the packaged artifact |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular: Error Reporting and Correlation".*
