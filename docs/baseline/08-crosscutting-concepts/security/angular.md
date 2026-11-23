# Angular: Security

Angular rules on top of [typescript.md](typescript.md) (`TS-SEC-*`). Decisions: the BFF serves the SPA from the same origin and sets CSP and security headers (SPRING-SEC-08, SPRING-SEC-13; NestJS: NEST-SEC-12, NEST-SEC-51); route guards are UX only. Framework know-how comes from `angular-developer`; the `angular-security` skills found on skills.sh are not used (TOOL-SKL-05).

## Template and DOM

- **NG-SEC-01: Templates bind data with interpolation or property binding only;** user data is never concatenated into template strings, and production builds are AOT only. Angular treats all values as untrusted in four contexts (HTML, style, URL, resource URL).
- **NG-SEC-02: `bypassSecurityTrust*` is forbidden by lint.** An exception needs a code comment with the reason and the trusted source, a pull-request approval, and the call as close to the source as possible.
- **NG-SEC-03: No user-supplied HTML by default.** `[innerHTML]` receives only values Angular sanitizes. A product that needs rich text records an ADR and uses DOMPurify behind one shared pipe plus server-side sanitizing, covered by a test that a payload does not execute.
- **NG-SEC-04: No direct DOM writes** (`nativeElement`, `Renderer2.setProperty('innerHTML', …)`) outside a reviewed adapter. Values in `[href]` and `[src]` come from validated sources.

## Headers, CSP, Trusted Types

- **NG-SEC-05: The app ships with a strict, nonce-based CSP** (`{n}` is the per-response nonce):

  ```
  default-src 'self'; script-src 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}';
  connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'; trusted-types angular angular#bundler angular#components;
  require-trusted-types-for 'script'; report-to csp; report-uri /csp-reports
  ```

  Angular reads the nonce from the `ngCspNonce` attribute on the root element (or the `CSP_NONCE` token) and puts it on the `<style>` elements it renders, which is why `style-src` needs the nonce. `base-uri 'self'` keeps Angular's `<base href="/">` working; with `'none'` the browser ignores it, and relative bundle URLs and the router break on a deep-link reload. `trusted-types` lists Angular's own policies: `angular` (required when Trusted Types are enforced), `angular#bundler` (the CLI's lazy-chunk loading) and `angular#components` (Angular Material and the CDK, for example SVG icons in `MatIconRegistry`); `angular#unsafe-bypass` is added only together with an approved `bypassSecurityTrust*` exception (NG-SEC-02). Other hosts are added per directive (TS-SEC-07). Reports go to the BFF's report endpoint (`Reporting-Endpoints: csp="/csp-reports"`, SPRING-SEC-13, NEST-SEC-51). Trusted Types start in `Content-Security-Policy-Report-Only` and switch to enforcing once the reports of the report-only phase are clean. The other browser headers (`Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, HSTS) are listed in SPRING-SEC-13.
  *Why:* CSP is the second line of defence against XSS; a nonce must be new for every response.
- **NG-SEC-06: The BFF sets the CSP and the other security headers** (SPRING-SEC-13, NEST-SEC-20/51), not `<meta>` tags and not a CDN with cached nonces. Per request it creates a nonce, sends it in the header and templates it into `index.html`: the `ngCspNonce` attribute and the `nonce` attribute of every `<script>`, `<style>` and stylesheet `<link>` (the build leaves a placeholder that the BFF replaces). With `ngCspNonce="CSP_NONCE"` on the root element, the Angular CLI itself writes `nonce="CSP_NONCE"` on every tag it emits: its inline critical `<style>`, the stylesheet `<link>`, every `<link rel="modulepreload">`, the entry `<script type="module">` and its inline `<script>`. The BFF therefore replaces every `CSP_NONCE` placeholder and adds a `nonce` attribute only to a `<script>`, `<style>` or stylesheet/modulepreload `<link>` that has none; a second `nonce` attribute on the same tag makes Chrome block the script. The BFF's unit test reads the real `index.html` of a production build (or a fixture copied from one), never a hand-written stub. `index.html` is served with `Cache-Control: no-store`, because a cached copy carries a stale nonce; the hashed bundles stay cacheable. The CLI's `autoCsp` (a hash-based `<meta>` CSP) is not used in any rendering mode. An app with SSR or an edge/CDN in front revisits the nonce delivery in an ADR. The dev server cannot create a per-request nonce (`headers` in `angular.json` are static), so it sends the other security headers only; the CSP and Trusted Types are asserted against the BFF-served build in the E2E tests (NG-SEC-12).
- **TS-SEC-09 in Angular: zod runs jitless, configured by the first import of `main.ts`.** zod's JIT probe violates this CSP as well, so `main.ts` imports the module that sets `z.config({ jitless: true })` as its first import, before `bootstrapApplication` and anything that defines a schema. Whether the Angular CLI's esbuild output can hoist zod or schema modules into a chunk that runs before `main.ts`'s body (and so needs an equivalent of Rolldown's `strictExecutionOrder`) is to verify; the NG-SEC-12 E2E run (no CSP violation on load) is the check.

## Session and HTTP

- **NG-SEC-07: With the BFF, the SPA is served from the BFF's origin.** `provideHttpClient()` keeps the default XSRF interceptor (cookie `XSRF-TOKEN`, header `X-XSRF-TOKEN`); `withNoXsrfProtection()` needs an ADR. All mutating calls use relative URLs: the interceptor adds the header only to same-origin requests (it compares the resolved origin with the page's), never on GET/HEAD, so a call to another origin silently goes without it.
- **NG-SEC-08: No code reads or sets the session cookie, and no interceptor adds tokens** (the BFF holds them). A `401` redirects to the BFF login endpoint and clears client state.
- **NG-SEC-09: Route guards improve UX only;** every action is authorized by the backend (extends NG-ARCH-14).
- **NG-SEC-13: The session-timeout warning (A11Y-29) is driven by an HTTP interceptor that records every backend answer.** `activityInterceptor` in `platform/adapter/out/http` calls `SessionActivity.touch()` on each response; `SessionActivity` (a root service with a `lastAnswerAt` signal, `platform/adapter/in/ui`) and the shell's warning dialog compare it with the idle seconds from `RUNTIME_CONFIG` (NG-CFG-04), which the BFF publishes in `/config.json` from its session configuration (SPRING-SEC-32). `SessionActivity` takes the time from `CLOCK` (NG-ARCH-24) and shares `lastAnswerAt` between the app's tabs over a `BroadcastChannel`; before redirecting to login the shell asks the server for the remaining idle time (A11Y-29). Templates: `.agents/skills/baseline-angular/templates/src/platform/adapter/`. The warning's tests use fake timers and assert the dialog, its live announcement and that "extend" sends a request.
  *Why:* only requests renew the server's idle timer; a client timer from mouse movement would lie, and a hard-coded timeout drifts from the server's.
- **NG-SEC-10: An SSR server (NG-ARCH-18) restricts hosts and proxy trust and keeps the nonce CSP:** `allowedHosts` is an explicit list, `trustProxyHeaders` is set only behind a validating proxy, and the CSP stays a nonce-based header (NG-SEC-05/06), set by the server that renders the page; `autoCsp` is banned here as everywhere.
- **NG-SEC-11: A global `ErrorHandler` shows a generic message** and reports scrubbed data (TS-SEC-06); no raw server errors or stack traces in the UI. Wiring and reporting path: [NG-OBS-01/02](../observability/angular.md).

## Tests

- **NG-SEC-12: E2E tests assert the security behaviour** (`playwright-best-practices`, `security-testing`): an XSS payload in a user-controlled field does not execute (also in Trusted Types mode), the CSP and every header of SPRING-SEC-13 or NEST-SEC-20 are present with their values, a deep link reloaded in the browser (for example `/orders/42`) loads the app and its lazy chunks without a CSP violation, a page with a Material icon renders it under enforced Trusted Types, the XSRF header is sent on POST, an unauthenticated user is redirected. Header checks run on every pull request.

## Tooling

See [NG-TOOL-07/08](../development/angular-tooling.md): lint rules for the bans above and `sourceMap: false` in production builds.

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular: Security".*
