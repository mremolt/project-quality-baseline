# React: Security

React rules on top of [typescript.md](typescript.md) (`TS-SEC-*`). Decisions: the BFF serves the SPA from the same origin, creates the per-response CSP nonce and sets the security headers ([REL-FE-01/03](../../07-deployment-view/container-runtime.md)); the browser holds no tokens; route checks are UX only. Rules marked "(React SPA)" describe the Vite build; Next.js replaces them in [security/nextjs.md](nextjs.md). Framework know-how comes from `vercel-react-best-practices` and the MUI skills; their conflicting habits are listed under Skill overrides.

## JSX and DOM

- **REACT-SEC-01: Data reaches the DOM only through JSX text and attribute bindings, which React escapes; `dangerouslySetInnerHTML` is banned by lint.** `@eslint-react/dom-no-dangerously-set-innerhtml` and `dom-no-dangerously-set-innerhtml-with-children` are `error` (part of `@eslint-react` `strict-type-checked`, [development/react-tooling.md](../development/react-tooling.md)). A product that needs user-supplied rich text records an ADR and renders it in one shared component with DOMPurify, plus server-side sanitizing, a named Trusted Types policy for that component (REACT-SEC-05) and a test that a payload does not execute. API data is never evaluated or inserted as HTML (TS-SEC-08).
  *Why:* JSX escaping is React's XSS defence; `dangerouslySetInnerHTML` switches it off for the whole subtree.
- **REACT-SEC-02: URL attributes (`href`, `src`, `action`, `formAction`) receive only relative paths or `https:` URLs.** Literal `javascript:` URLs fail lint (`@eslint-react/dom-no-script-url`, error). A URL that comes from data or user input passes one helper in `src/shared/ui/` that accepts relative paths and an allow-list of `https:` origins and returns `undefined` for everything else (TS-SEC-03); lint cannot see dynamic values, so review checks it. `target="_blank"` carries `rel="noopener noreferrer"` (`@eslint-react/dom-no-unsafe-target-blank`, `sonarjs/link-with-target-blank`, both error).
- **REACT-SEC-03: No direct DOM writes through refs.** Refs are used for focus, measuring and mounting a third-party widget in a reviewed adapter, never to write markup or attributes React owns. `innerHTML`, `outerHTML` and `insertAdjacentHTML` are banned by `no-restricted-syntax` (TS-SEC-02); this selector set is verified with the React lint set:

  ```ts
  'no-restricted-syntax': ['error',
    { selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: 'TS-SEC-02' },
    { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'TS-SEC-02' }],
  ```

  `react-hooks/refs` (error, React Compiler rules) reports refs read or written during render. `findDOMNode`, `ReactDOM.render` and `hydrate` are banned by `@eslint-react/dom-no-find-dom-node`, `dom-no-render`, `dom-no-hydrate`.

## CSP and Trusted Types

- **REACT-SEC-04: (React SPA) The app ships with a strict, nonce-based CSP and no `'unsafe-inline'`** (`{n}` is the per-response nonce):

  ```
  default-src 'self'; script-src 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}';
  connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none';
  report-to csp; report-uri /csp-reports
  ```

  The mechanism has three parts:
  1. `vite.config.ts` sets `html: { cspNonce: 'CSP_NONCE_PLACEHOLDER' }`. The build then emits `<meta property="csp-nonce" nonce="CSP_NONCE_PLACEHOLDER">` and puts the same `nonce` on the entry `<script>` and every `<link rel="modulepreload">` in `index.html`.
  2. The BFF creates a fresh nonce per response, sends it in the `Content-Security-Policy` header and replaces every occurrence of the placeholder in `index.html` with it. `index.html` goes out with `Cache-Control: no-store`, hashed assets stay cacheable ([REL-FE-03](../../07-deployment-view/container-runtime.md)). No `<meta http-equiv>` CSP, no CDN that caches HTML.
  3. MUI styles through Emotion, which inserts `<style>` elements at runtime. `src/app/emotion-cache.ts` creates the cache with the nonce, and the root composition wraps everything in `<CacheProvider>`:

  ```ts
  function cspNonce(): string | undefined {
    // the property, not getAttribute: browsers hide the attribute value of a nonce
    const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce;
    return nonce === undefined || nonce === '' ? undefined : nonce;
  }
  export function createEmotionCache(): EmotionCache {
    const nonce = cspNonce();
    return createCache({ key: 'mui', prepend: true, ...(nonce && { nonce }) });
  }
  ```

  `'strict-dynamic'` lets the nonced entry load the lazy route chunks and modulepreloads. `base-uri 'self'` keeps relative asset URLs working on a deep-link reload. Other hosts are added per directive, never to `script-src` (TS-SEC-07). MUI's `InitColorSchemeScript` (an inline script) is not needed in the SPA and not used. The Vite dev server sends no CSP; the policy is asserted against the built bundle (REACT-SEC-09).
  *Why:* CSP is the second line of defence against XSS; a nonce must be new for every response, and a style nonce keeps `'unsafe-inline'` out of `style-src`.
- **REACT-SEC-05: (React SPA) Trusted Types are enforced with `trusted-types 'none'`: the app creates no policy.** React 19, MUI with Emotion and the CSS-variables theme, TanStack Router (including lazy chunks and the chunk reload), React Hook Form and `@react-aria/live-announcer`'s `announce()` run without a single violation. Two things keep it that way:
  - zod 4 probes `new Function('')` when it builds an object schema, which CSP and Trusted Types report as a violation even though zod catches the error. `src/strict-csp.ts` calls `z.config({ jitless: true })` and is the first import of `main.tsx` (TS-SEC-09). Because Rolldown hoists zod and shared schemas into a shared chunk that runs before the entry's own code, `vite.config.ts` sets `build.rolldownOptions.output.strictExecutionOrder: true` (costs a few kB gzip; the bundle budget includes it).
  - Library calls that write HTML are not used: for example `clearAnnouncer()` of `@react-aria/live-announcer` assigns `innerHTML` and would violate.

  A new dependency or feature that needs a policy adds a named policy and lists it in `trusted-types` (never `'allow-duplicates'`, never a `default` policy) with a review. As in every frontend, a changed Trusted Types setup starts in `Content-Security-Policy-Report-Only` and is enforced once the reports are clean.

## Session and HTTP

- **REACT-SEC-06: The platform HTTP mutator sends the BFF's XSRF header; the browser never holds a token.** `customFetch` (the Orval mutator in `src/platform/adapter/out/http/`, [api/react-openapi-clients.md](../api/react-openapi-clients.md)) resolves every URL against `location.origin`, sends `credentials: 'same-origin'`, and on `POST`, `PUT`, `PATCH` and `DELETE` to the same origin copies the cookie `XSRF-TOKEN` into the header `X-XSRF-TOKEN`; never on `GET`/`HEAD` and never to another origin. The error-reporting adapter uses the same helper (REACT-OBS-03). No code reads or sets the session cookie, adds an `Authorization` header or stores a token (TS-SEC-01); neither the Redux store nor the TanStack Query cache is persisted to web storage. A `401` makes the mutator call `window.location.assign(loginPath)` (`loginPath` from `/config.json`, REACT-CFG-03): the full page load discards the store and the query cache.
- **REACT-SEC-07: Route checks and hidden buttons improve UX only;** the backend authorizes every call. A route that checks a role shows a "not allowed" state or redirects to an internal path from an allow-list (TS-SEC-03), never to a URL taken from the query string.
- **REACT-SEC-08: Unexpected errors show a generic message, never error details.** The root error boundary and the router's `errorComponent` render one `ErrorMessage` component (`src/platform/adapter/in/ui/`) with a translated title, text and a retry or reload button; they never render `error.message`, a stack trace or a problem body. Expected business errors are shown through the feature's mapped message keys (REACT-STATE-07). Reporting path: [REACT-OBS-01/02](../observability/react.md).

## Tests

- **REACT-SEC-09: E2E tests assert the security behaviour against the built bundle, served with the real CSP.** The stubbed tier serves `dist/` with a small Node script (`e2e/serve-dist.ts`) that stands in for the BFF: it templates a fresh nonce into `index.html`, sends the CSP of REACT-SEC-04 with `trusted-types 'none'`, `Cache-Control: no-store` for HTML and `404` for a missing `/assets/*` file. The shared Playwright fixture registers a `securitypolicyviolation` listener with `page.addInitScript` and asserts after **every** test that no violation occurred:

  ```ts
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window.cspViolations ??= []).push(`${event.effectiveDirective} ${event.blockedURI} ${event.sample}`);
      });
    });
    await use(page);
    expect(await page.evaluate(() => window.cspViolations ?? []), 'CSP / Trusted Types violations').toEqual([]);
  },
  ```

  Specs cover at least: an XSS payload in a user-controlled field is shown as text and does not execute; a deep link reloaded in the browser loads the app and its lazy chunk; the XSRF header is sent on a mutating call and not on a `GET` (Vitest on the mutator plus one E2E request assertion); a `401` leads to the login path. The full-stack tier asserts the CSP and every header the BFF sets on the real BFF; header checks run on every pull request.

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Security".*

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| `vercel-react-best-practices` `rendering-hydration-no-flicker`: inline `<script>` for client-only data | No inline scripts without the nonce; with `trusted-types 'none'` the SPA needs none (REACT-SEC-04/05); no tokens or personal data in storage (TS-SEC-01) |
| `vercel-react-best-practices` `bundle-defer-third-party`, `rendering-script-defer-async`, `rendering-resource-hints` (analytics, external origins) | Third-party scripts and fonts avoided or self-hosted; the CSP stays strict (TS-SEC-07, REACT-SEC-04) |
| `vercel-react-best-practices` `client-localstorage-schema`, `js-cache-storage` | Never tokens, session ids or personal data in web storage (TS-SEC-01, REACT-SEC-06) |
| `tanstack-query-best-practices` `persist-queries`: persist the cache to localStorage/IndexedDB | Not persisted (REACT-SEC-06); a product that needs it records an ADR covering TS-SEC-01 and data protection |
| `material-ui-theming` `InitColorSchemeScript` and Emotion `<style>` injection without a nonce | Emotion cache with the nonce from the meta tag; no `InitColorSchemeScript` in the SPA (REACT-SEC-04) |
| `material-ui-theming` colour-scheme preference in `localStorage` | Allowed (not personal data); never extended to tokens or personal data (TS-SEC-01) |
| Generic React habit: token in `localStorage` and an `Authorization` header in a fetch wrapper | BFF cookie session; the mutator adds only the XSRF header (REACT-SEC-06) |
