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
- [ ] Cross-feature imports only via `index.ts`; another feature's use cases only through its published API provider (TS-ARCH-19)?
- [ ] Routes only in `<feature>.routes.ts`, loaded with a dynamic `import()` from the app routes (TS-ARCH-20)?
- [ ] HTTP errors mapped to domain errors in the adapter; the `TechnicalError`s it creates reported once, those it receives passed on unreported; no status codes above it (TS-ARCH-18)?
- [ ] dependency-cruiser green with `tsPreCompilationDeps: true`, rules not loosened?

## Generated API Clients (Orval)

[08-crosscutting-concepts/api/typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md)

- [ ] Client and types generated, nothing hand-written for a specced API?
- [ ] Generated code used only inside `adapter/out/http`?
- [ ] Response parsed with the generated zod schema, mapped to domain types?
- [ ] N+1 check done; batching/caching as decorator if chosen?
- [ ] Adapter tests use the generated MSW handlers, including an error and a malformed response?
- [ ] `urlEncodeParameters: true` in the Orval config (TS-API-09); `@faker-js/faker` a dev dependency when MSW mocks are generated?
- [ ] File downloads through the adapter, not hand-built URLs in `<a download>` (TS-API-10)?

## TypeScript Tooling

[08-crosscutting-concepts/development/typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md)

- [ ] No `any`, no unexplained `as`, no new `eslint-disable` without a reason?
- [ ] `npm run check` after every change, `npm run verify` green before finishing? (E2E for changed screens runs separately.) (TS-TOOL-18)
- [ ] No script that relies on a `pre*`/`post*` hook (TS-TOOL-10)?
- [ ] No unused dependency, export or file (`npm run check:unused`, TS-TOOL-17)?
- [ ] npm 11.10 or newer, `engines` and `engine-strict` in place (TS-TOOL-14)?
- [ ] No compiler check or lint rule loosened?

## TypeScript: Browser Security

[08-crosscutting-concepts/security/typescript.md](../08-crosscutting-concepts/security/typescript.md)

- [ ] No storage, URL or log line with a token or personal data?
- [ ] No `eval`-like call, no `innerHTML` with data, no unchecked redirect target?
- [ ] No secret in `environment` files, no new third-party script without nonce (or trusted loader) and SRI; its other hosts in `connect-src`/`img-src`/`font-src`?
- [ ] Error reports and client logs scrubbed?
- [ ] zod configured jitless by the entry's first import, bundler keeps the execution order (TS-SEC-09)?

## TypeScript E2E: Matrix, Responsive, Themes, Screen Readers

[08-crosscutting-concepts/testing/typescript-e2e.md](../08-crosscutting-concepts/testing/typescript-e2e.md)

- [ ] New main screen or state: in the inventory (A11Y-27), spec tagged `@responsive`, and `@theme` where it scans a state?
- [ ] New project in `playwright.config.ts` changes only one dimension from the default cell, and sits in the tier of TS-TEST-18?
- [ ] Reflow and text-spacing checks on `@responsive` screens; resize-transition test for shells and list-detail screens?
- [ ] Target size asserted at `compact`; `target-size` proven to have run?
- [ ] Status messages, route title and focus (link, back, query-only change) and form errors asserted (TS-TEST-23/24/26); shell and screen ARIA snapshots (TS-TEST-25)?
- [ ] No new retries or timeouts to hide a flaky test; pull-request tier within its time budget?
- [ ] `e2e:fast` at milestones, the full matrix once before the commit that closes a part (TS-TEST-33)?
- [ ] Shared fixture fails on unstubbed API calls, page errors, `console.error` and missing translations (TS-TEST-32)?

## TypeScript Testing

[08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md)

- [ ] Doubles via `mock<Contract>()`; no `vi.mock` of our own modules?
- [ ] Component tests query by role; every component spec runs axe on its main states?
- [ ] E2E: axe fixture on new screens/states, keyboard journey, request budget as an upper bound?
- [ ] Responsive, theme and screen reader checks as in [typescript-e2e.md](typescript.md)?
- [ ] Contract change → stubs still compile (typed by `operationId`)?
