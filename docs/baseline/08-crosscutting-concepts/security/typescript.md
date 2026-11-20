# TypeScript: Browser Security

Framework-independent rules for code that runs in a browser (TypeScript in Angular, or any other frontend), and for the npm supply chain. Angular specifics: [angular.md](angular.md). Shared process: [security-requirements.md](security-requirements.md). Remember: everything shipped to the browser is public.

## Rules

- **TS-SEC-01: No tokens, session ids or personal data in `localStorage`, `sessionStorage`, IndexedDB or URLs.** Any script on the page can read them. Browser apps authenticate through the BFF cookie (SPRING-SEC-08).
- **TS-SEC-02: No `eval`, `new Function`, string-argument `setTimeout`/`setInterval`, `document.write`.** `innerHTML`, `outerHTML` and `insertAdjacentHTML` only receive static literals. ESLint enforces it (`no-eval`, `no-implied-eval`, `no-new-func`, `no-restricted-syntax`).
- **TS-SEC-03: Navigation targets and redirects that come from user input are checked against an allow-list of internal paths.** `target="_blank"` carries `rel="noopener noreferrer"`. `postMessage` checks `event.origin` and uses an explicit target origin, never `"*"`.
- **TS-SEC-04: Nothing secret is in the bundle or in environment files.** Frontend configuration is public by definition: no API keys with write power, no credentials.
- **TS-SEC-05: Production builds publish no source maps;** mechanism and the hidden-map case: [NG-OBS-06](../observability/angular.md).
- **TS-SEC-06: Client logging and error reporting scrub tokens, personal data and form values;** reports carry ids.
- **TS-SEC-07: Third-party scripts, tags and fonts are avoided or self-hosted.** An external script that can't be avoided is loaded with the per-response nonce or by an already trusted (nonced) script, and has Subresource Integrity. With `'strict-dynamic'` (NG-SEC-05), browsers ignore host lists in `script-src`, so listing a script host there allows nothing. Host lists only matter in the other directives: `connect-src`, `img-src`, `font-src`, `frame-src`.
- **TS-SEC-08: API data is validated at the adapter** (generated zod schemas, TS-API) and never evaluated as code or inserted as HTML.

Supply chain and scanning: [TS-TOOL-11..16](../development/typescript-tooling.md).

## Agent checklist

- [ ] No storage, URL or log line with a token or personal data?
- [ ] No `eval`-like call, no `innerHTML` with data, no unchecked redirect target?
- [ ] No secret in `environment` files, no new third-party script without nonce (or trusted loader) and SRI; its other hosts in `connect-src`/`img-src`/`font-src`?
- [ ] Error reports and client logs scrubbed?

## Sources

OWASP ASVS 5.0 V3 (Web Frontend Security), V14, V15; OWASP DOM based XSS Prevention Cheat Sheet; OWASP HTML5 Security Cheat Sheet; MDN Subresource Integrity; CSP Level 3 `'strict-dynamic'` (w3.org/TR/CSP3).
