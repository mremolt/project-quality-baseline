# Agent checklists: react

The agent checklists of the react docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Solution Strategy: React

[04-solution-strategy/react.md](../04-solution-strategy/react.md)

- [ ] New code uses the libraries above; a different router, state library, UI kit, form library or client mode has an ADR?
- [ ] SPA-only defaults (REACT-D1, D2, D9, the SPA part of D7) replaced only in a Next.js project, as its defaults say?
- [ ] Versions taken from the `baseline-react` template, not from memory or `latest`?

## React: Architecture and Project Structure

[05-building-block-view/react.md](../05-building-block-view/react.md)

- [ ] File in the right ring and folder; kebab-case file, role suffix, `.tsx` only with JSX?
- [ ] Function components; no manual `useMemo`/`useCallback`/`memo()` without a measured reason?
- [ ] No `useEffect` that loads data, derives state or handles an event?
- [ ] Use cases plain; adapters and use cases created by the factory in `<feature>.api.tsx` in a lazy `useState` initializer; one context, the use-case object type and selector hooks in `<feature>.tokens.ts`?
- [ ] Commands as `useMutation` calling the use case, invalidation in `onSuccess`, errors through `toErrorKey`; no thunk for a command?
- [ ] No `fetch` or generated client outside `adapter/out/http`; data loaded through a query hook calling a use case?
- [ ] Form validated with the command's zod schema via `standardSchemaResolver`; submit builds the command through its factory; `Controller` passes `ref` as `inputRef`, not inside a spread `field`?
- [ ] Routes file exports only route options with a lazy component; search params validated with zod?
- [ ] Another feature's use cases only via its `<Feature>ApiProvider`; nothing in `src/app` imports a feature's `index.ts` at runtime?
- [ ] Render errors reach a boundary that reports and shows the generic message?
- [ ] N+1 check done, including per-row queries and dependent-query waterfalls?
- [ ] `npm run check:arch` and the canary green, rules not loosened?
- [ ] Time from the platform `clock`, business date from `businessDate()`, zone declared once (REACT-ARCH-25)?

## React: Generated API Clients

[08-crosscutting-concepts/api/react-openapi-clients.md](../08-crosscutting-concepts/api/react-openapi-clients.md)

- [ ] `client: 'fetch'` with the `customFetch` mutator, `includeHttpResponseReturnType: false`, `urlEncodeParameters: true`?
- [ ] No query-library client, no hand-written request in a feature, no `customFetch` call outside generated code?
- [ ] Adapter passes `{ signal: signal ?? null }`, parses with the generated PascalCase zod schema, maps problems in one mapper, reports the `TechnicalError`s it creates (and only those)?
- [ ] No `Authorization` header, no absolute URL, no retry in the mutator?
- [ ] Plain `fetch` only in the platform's config loader and reporting sender, each with a timeout?
- [ ] Several features: tag sets in `orval.config.ts` disjoint, other features' operations used through their published API (REACT-API-13)?
- [ ] Adapter and mutator tests against MSW with `onUnhandledFrame: 'error'`, covering success, malformed body, 5xx, problem codes, time-out and abort?

## React: Runtime Configuration

[08-crosscutting-concepts/configuration/react.md](../08-crosscutting-concepts/configuration/react.md)

- [ ] No `--mode`, `.env.<environment>` file or `VITE_*` per-environment value; `define` only for constants identical everywhere (REACT-CFG-01)?
- [ ] New value: added to `RuntimeConfig`, the schema, its test and the BFF's frontend configuration; public only (REACT-CFG-03/05)?
- [ ] Read through `useRuntimeConfig()` or `createPlatform`, handed to use cases by the feature's factory, never read in the core (REACT-CFG-04)?
- [ ] Tests provide the platform or stub `/config.json`; `dist/` has no `config.json` (REACT-CFG-06)?

## React: Tooling

[08-crosscutting-concepts/development/react-tooling.md](../08-crosscutting-concepts/development/react-tooling.md)

- [ ] React plugin set in place with `warnAsError()`, `@eslint-react` hooks duplicates off, accessibility rules as errors (REACT-TOOL-01..04)?
- [ ] `fetch` only in `adapter/out/http`, (React SPA) no `process` in `src/`, HTML-writing syntax banned (REACT-TOOL-05)?
- [ ] New or upgraded lint plugin proven to fire with a probe file (REACT-TOOL-06)?
- [ ] tsconfig deviations limited to REACT-TOOL-08; TypeScript inside typescript-eslint's peer range (REACT-TOOL-09)?
- [ ] React Compiler output present after a build-tool upgrade (REACT-TOOL-10)?
- [ ] `sourcemap: 'hidden'`, browser target of TS-TOOL-02, no release version or environment value in `define` (REACT-TOOL-11)?
- [ ] `npm run verify` green, including `check:bundle`; a raised budget reviewed with its reason (REACT-TOOL-12/13)?
- [ ] Wall-clock selectors banned outside the platform composition and tests (REACT-TOOL-15)?

## React: Internationalization

[08-crosscutting-concepts/i18n/react.md](../08-crosscutting-concepts/i18n/react.md)

- [ ] Every new user-visible string, including `aria-label`, `title`, MUI `label`/`helperText` and the route title, uses a key in the source catalog with context (REACT-I18N-03/06)?
- [ ] Slices, mutation hooks and error mappers return keys or codes only (REACT-I18N-04)?
- [ ] Keys typed through `AppConfig`; no `as` casts on keys (REACT-I18N-05)?
- [ ] Plurals and variables through ICU placeholders (REACT-I18N-07)?
- [ ] Money through `formatMoney` on the decimal string; dates through `useFormatter()`; locale passed in, nothing cached by value (REACT-I18N-10)?
- [ ] `<html lang>`, `dir`, MUI strings and `Accept-Language` follow the active locale (REACT-I18N-09)?
- [ ] Component tests with the real `en` catalog; two-locale tests for formatting; language-switch test (REACT-I18N-14/15)?
- [ ] Layout checked in the pseudo-locale; logical properties only (REACT-I18N-13)?

## React: Error Reporting and Correlation

[08-crosscutting-concepts/observability/react.md](../08-crosscutting-concepts/observability/react.md)

- [ ] New error path: ends in `ReportErrorUseCase` through a boundary, the route `errorComponent`, the `window` listeners or the mutator; no direct SDK call (REACT-OBS-01/02)?
- [ ] New HTTP adapter: calls through the mutator, problem `code`s mapped to domain errors, the `TechnicalError`s it creates reported once, those it receives passed on unreported (REACT-OBS-04, TS-ARCH-18)?
- [ ] Reporting reached through `useReportError()` or the platform composition only (REACT-OBS-02)?
- [ ] Report fields: route template and ids only, no personal data (REACT-OBS-05)?
- [ ] Build change: `sourcemap: 'hidden'` kept, maps uploaded and removed, `check:bundle` still checks (REACT-OBS-06)?

## React: Security

[08-crosscutting-concepts/security/react.md](../08-crosscutting-concepts/security/react.md)

- [ ] No `dangerouslySetInnerHTML`, no `innerHTML`-like write, no DOM write through a ref (REACT-SEC-01/03)?
- [ ] URLs from data go through the URL helper; `target="_blank"` has `rel="noopener noreferrer"` (REACT-SEC-02)?
- [ ] CSP change: nonce in `script-src` and `style-src`, no `'unsafe-inline'`, `trusted-types 'none'` or a reviewed named policy, `index.html` uncached, Emotion cache still nonced (REACT-SEC-04/05)?
- [ ] New schema module or dependency: still no violation under Trusted Types (zod jitless first, strict execution order kept) (REACT-SEC-05)?
- [ ] Mutating calls go through the mutator, relative URLs, XSRF header kept, no token or persisted cache in the browser (REACT-SEC-06)?
- [ ] Route checks treated as UX; the backend enforces the rule (REACT-SEC-07)?
- [ ] Error UI generic, no `error.message` on screen (REACT-SEC-08)?
- [ ] E2E violation fixture still active and security specs updated (REACT-SEC-09)?

## React: Testing

[08-crosscutting-concepts/testing/react.md](../08-crosscutting-concepts/testing/react.md)

- [ ] Spec in the right Vitest project: core specs in `node`, everything else in `jsdom` (REACT-TEST-01)?
- [ ] Screen rendered with `renderWithProviders`; an object of mocked use cases in the feature's context, not the store, hooks or HTTP (REACT-TEST-05/06)?
- [ ] Commands verified by value, value-object queries stubbed with `matches` (REACT-TEST-07)?
- [ ] axe on main states, dialogs scanned outside the container (REACT-TEST-08)?
- [ ] Announcements on the mocked `Announcer`; form errors via `toBeInvalid`, accessible description and focus; focus after dialogs (REACT-TEST-09/10/11)?
- [ ] Slice tests through the store and selectors; every error class of a command covered in the page test, unexpected ones reported (REACT-TEST-12/13)?
- [ ] (React SPA) Route options tested with a memory router; route-change handler tested with several navigations (REACT-TEST-14/15)?
- [ ] HTTP adapter specs with Orval handlers, `onUnhandledFrame: 'error'`, every documented problem code (REACT-TEST-16)?
- [ ] Architecture canary green and still failing on its fixtures (REACT-TEST-17)?
- [ ] E2E against the built app behind the CSP server, zero CSP violations, stubs typed by `operationId`, T1 projects in `npm run e2e`, tags `@responsive`/`@theme`/`@shell` on main screens (REACT-TEST-18..21)?

## React UI: Material UI and Material Design

[08-crosscutting-concepts/ui/react-mui.md](../08-crosscutting-concepts/ui/react-mui.md)

- [ ] MUI component used where one exists; gap components in `shared/ui` with a keyboard test (REACT-UI-01/02)?
- [ ] Only theme tokens in `sx`/`styled`; no generated class names, no `!important`, logical properties (REACT-UI-03/05/22)?
- [ ] Theme with `cssVariables` and both color schemes; AAA contrast kept after palette changes (REACT-UI-04/07)?
- [ ] Density, focus outline, reduced motion respected (REACT-UI-08..10)?
- [ ] Emotion cache with the CSP nonce (React SPA); fonts and icons self-hosted (REACT-UI-12/13)?
- [ ] Breakpoints are the size classes; `useWindowSize()` only for structure, never in slices or query keys (REACT-UI-14/17..19)?
- [ ] `TextField` with visible label, `type`, `autoComplete`, `inputMode`; errors in `helperText` (REACT-UI-26)?
- [ ] Status through a visible region or the `Announcer`; route `titleKey`; focus only on path changes; no extra route announcement (REACT-UI-29/30)?
- [ ] Snackbars polite and never the only channel; progress and tables labelled (REACT-UI-31)?
- [ ] Dialog labelled by its title; focus restored when the trigger can vanish (REACT-UI-32)? Dirty form guards `onClose`; unchangeable control `readOnly` with a reason (REACT-UI-36)?
- [ ] Loading, empty and error states from `src/shared/ui/states/` (REACT-UI-33)?
- [ ] Role-based component tests; theme projects cover the screen (REACT-UI-34/35)?

## React: State Management with Redux Toolkit and TanStack Query

[08-crosscutting-concepts/ui/react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md)

- [ ] Slice in `adapter/in/ui/<feature>.slice.ts`, injected in the composition, typed `interface`, selector with `?? initialState` (REACT-STATE-01/02/05)?
- [ ] Commands as `useMutation` in `<feature>.queries.ts` calling the use case; no thunk for a command; slice imports no adapters, services, generated code, other slices; nothing non-serializable in state or payloads (REACT-STATE-03)?
- [ ] Slice holds only view state several components share; command status in the mutation; server data in the query cache (REACT-STATE-04)?
- [ ] Errors mapped once per feature with `toErrorKey`; unexpected errors reported in the mutation's `onError` (REACT-STATE-07)?
- [ ] Query hook in `<feature>.queries.ts`, keys from `<feature>Keys`, `queryOptions`, `signal` passed to the use case (REACT-STATE-10/11)?
- [ ] Every command invalidates the affected keys in `onSuccess`; `staleTime` default unless reasoned (REACT-STATE-11)?
- [ ] No per-row queries, no `useQueries` over ids; N+1 check stated and request budget asserted (REACT-STATE-12)?
- [ ] No RTK Query, no Orval query client, no `useEffect` fetch (REACT-STATE-09)?
- [ ] Retry only transient technical errors, with jitter (REACT-STATE-15)? Full-screen error only without data; failed refetch is an inline alert (REACT-STATE-19)?
- [ ] Rapid saves on one item share a mutation `scope`; cache writes use an updater on the current data; page test with an out-of-order response (REACT-STATE-20)?
- [ ] Slice tests with the real store; commands, error keys and reporting covered by the page test with mocked use cases (REACT-STATE-13)?
