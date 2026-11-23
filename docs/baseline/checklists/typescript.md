# Agent checklists: typescript

The agent checklists of the typescript docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## TypeScript Frontend: Hexagonal Architecture

[05-building-block-view/typescript.md](../05-building-block-view/typescript.md)

- [ ] No framework/HTTP imports in `domain`, `application`, `ports` (also no `import type`)? Only `src/platform/domain/index.ts` from the platform?
- [ ] Backend DTOs mapped inside `adapter/out/http`; API client generated, not hand-written?
- [ ] Ports return `Promise` (or are explicit stream ports)?
- [ ] Tokens in `<feature>.tokens.ts`; UI injects use-case contracts, never outgoing ports; stores call use cases only (TS-ARCH-03)?
- [ ] N+1 check done for new data loading?
- [ ] Component logic limited to rendering + forwarding intent?
- [ ] Cross-feature imports only via `index.ts`; another feature's use cases only through its published API provider, which exports at most pure domain functions besides; another audience's data through an own read use case; multi-feature components in `shared/ui` with a structural input (TS-ARCH-19)?
- [ ] Routes only in `<feature>.routes.ts`, loaded with a dynamic `import()` from the app routes (TS-ARCH-20)?
- [ ] HTTP errors mapped to domain errors in the adapter; the `TechnicalError`s it creates reported once, those it receives passed on unreported; no status codes above it (TS-ARCH-18)?
- [ ] dependency-cruiser green with `tsPreCompilationDeps: true`, rules not loosened?
- [ ] A new load aborts the previous one and on destroy; superseded results dropped; results after an `await` applied to the current state; autosaves serialized per item; tested with an out-of-order response (TS-ARCH-21)?
- [ ] Time only from the platform clock; business date from the one platform function, never `toISOString().slice(0, 10)` or the browser zone; long-open pages roll over (TS-ARCH-22)?
- [ ] `catch` handles only the feature's domain errors and `TechnicalError`; anything else rethrown or passed to the global error handler; no bare `catch {}` (TS-ARCH-23)?

## Generated API Clients (Orval)

[08-crosscutting-concepts/api/typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)

- [ ] Client and types generated, nothing hand-written for a specced API?
- [ ] Generated code used only inside `adapter/out/http`?
- [ ] Response parsed with the generated zod schema, mapped to domain types?
- [ ] N+1 check done; batching/caching as decorator if chosen?
- [ ] Adapter tests use the generated MSW handlers, including an error and a malformed response?
- [ ] `urlEncodeParameters: true` in the Orval config (TS-API-09); `@faker-js/faker` a dev dependency when MSW mocks are generated?
- [ ] File downloads through the adapter, not hand-built URLs in `<a download>`; a `Blob` error body parsed as problem details, tested (TS-API-10)?

## TypeScript Tooling

[08-crosscutting-concepts/development/typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md)

- [ ] No `any`, no unexplained `as`, no new `eslint-disable` without a reason?
- [ ] `npm run check` after every change, `npm run verify` green before finishing? (E2E for changed screens runs separately.) (TS-TOOL-18)
- [ ] `check` and `verify` use the runner and report all failing steps in one run, never `&&` chains (TS-TOOL-19)?
- [ ] No script that relies on a `pre*`/`post*` hook (TS-TOOL-10)?
- [ ] No unused dependency, export or file (`npm run check:unused`, TS-TOOL-17)?
- [ ] npm 11.10 or newer, `engines` and `engine-strict` in place; after scaffolding, packages younger than the cooldown pinned (TS-TOOL-14)?
- [ ] No compiler check or lint rule loosened?
- [ ] `e2e/` and `e2e-smoke/` type-checked and linted in `verify`; stubs typed with generated types (TS-TOOL-20)?
- [ ] Wall-clock selectors (`Date.now()`, `new Date()`) banned outside the platform clock and specs (TS-TOOL-21)?

## TypeScript: Browser Security

[08-crosscutting-concepts/security/typescript.md](../08-crosscutting-concepts/security/typescript.md)

- [ ] No storage, URL or log line with a token or personal data?
- [ ] No `eval`-like call, no `innerHTML` with data, no unchecked redirect target?
- [ ] No secret in `environment` files, no new third-party script without nonce (or trusted loader) and SRI; its other hosts in `connect-src`/`img-src`/`font-src`?
- [ ] Error reports and client logs scrubbed?
- [ ] zod configured jitless by the entry's first import, bundler keeps the execution order (TS-SEC-09)?
- [ ] Sign-out expects `200 {redirectUri}` and navigates with `window.location.assign`; one use case for every sign-out path; smoke test proves the IdP session ended (TS-SEC-10)?

## TypeScript E2E: Matrix, Responsive, Themes, Screen Readers

[08-crosscutting-concepts/testing/typescript-e2e.md](../08-crosscutting-concepts/testing/typescript-e2e.md)

- [ ] New main screen or state: in the inventory (A11Y-27), spec tagged `@responsive`, and `@theme` where it scans a state?
- [ ] New project in `playwright.config.ts` changes only one dimension from the default cell, and sits in the tier of TS-TEST-18?
- [ ] Reflow and text-spacing checks on `@responsive` screens; resize-transition test for shells and list-detail screens?
- [ ] Target size asserted at `compact`; `target-size` proven to have run?
- [ ] Status messages, route title and focus (link, back, query-only change) and form errors asserted (TS-TEST-23/24/26); shell and screen ARIA snapshots (TS-TEST-25)?
- [ ] No new retries or timeouts to hide a flaky test; a flaky test fixed within a week or quarantined with its ticket; CI `workers` capped (TS-TEST-31); pull-request tier within its time budget?
- [ ] `e2e:fast` at milestones; `e2e:smoke` at the first call of a new real dependency and after security-chain, session or SPA-serving changes; the full matrix once before the commit that closes a part; the smoke runs against a freshly built image (TS-TEST-33)?
- [ ] Shared fixture fails on unstubbed API calls, page errors, `console.error` and missing translations (TS-TEST-32)?

## TypeScript Testing

[08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md)

- [ ] Doubles via `mock<Contract>()`; no `vi.mock` of our own modules?
- [ ] Component tests query by role and use user-event (`fireEvent` only for native date/time inputs, with a comment, TS-TEST-08); every component spec runs axe on its main states?
- [ ] HTTP adapters tested against MSW with the generated handlers; `HttpTestingController` only for Angular interceptors (TS-TEST-04)?
- [ ] E2E: axe fixture on new screens/states, scanning only after animations settled (TS-TEST-12), keyboard journey, request budget as an upper bound, polled, counting catch-all calls and shell reads (TS-TEST-14)?
- [ ] No `isVisible()` branches; list settled (exact row count) before acting on a row (TS-TEST-15)?
- [ ] Scenario data unique and looked up by exact name or id; shared state restored in teardown; no empty-table or fresh-stack assumption (TS-TEST-34)?
- [ ] No waiting out a business rule: state arranged through the API with past timestamps (TS-TEST-35)?
- [ ] Responsive, theme and screen reader checks as in [typescript-e2e.md](typescript.md)?
- [ ] Contract change → stubs still compile (typed by `operationId`)?
