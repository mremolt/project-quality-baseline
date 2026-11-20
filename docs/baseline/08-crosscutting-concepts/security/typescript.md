# TypeScript: Browser Security

Framework-independent rules for code that runs in a browser, whatever the frontend framework, and for the npm supply chain. Each frontend stack adds its own security file (Per stack line at the end). Shared process: [security-requirements.md](security-requirements.md). Remember: everything shipped to the browser is public.

## Rules

- **TS-SEC-01: No tokens, session ids or personal data in `localStorage`, `sessionStorage`, IndexedDB or URLs.** Any script on the page can read them. Browser apps authenticate through the BFF cookie (SPRING-SEC-08).
- **TS-SEC-02: No `eval`, `new Function`, string-argument `setTimeout`/`setInterval`, `document.write`.** `innerHTML`, `outerHTML` and `insertAdjacentHTML` only receive static literals. ESLint enforces it (`no-eval`, `no-implied-eval`, `no-new-func`, `no-restricted-syntax`).
- **TS-SEC-03: Navigation targets and redirects that come from user input are checked against an allow-list of internal paths.** `target="_blank"` carries `rel="noopener noreferrer"`. `postMessage` checks `event.origin` and uses an explicit target origin, never `"*"`.
- **TS-SEC-04: Nothing secret is in the bundle or in environment files.** Frontend configuration is public by definition: no API keys with write power, no credentials.
- **TS-SEC-05: Production builds publish no source maps;** mechanism and the hidden-map case: the stack's observability rules.
- **TS-SEC-06: Client logging and error reporting scrub tokens, personal data and form values;** reports carry ids.
- **TS-SEC-07: Third-party scripts, tags and fonts are avoided or self-hosted.** An external script that can't be avoided is loaded with the per-response nonce or by an already trusted (nonced) script, and has Subresource Integrity. With `'strict-dynamic'` (the stack's CSP rule), browsers ignore host lists in `script-src`, so listing a script host there allows nothing. Host lists only matter in the other directives: `connect-src`, `img-src`, `font-src`, `frame-src`.
- **TS-SEC-08: API data is validated at the adapter** (generated zod schemas, TS-API) and never evaluated as code or inserted as HTML.
- **TS-SEC-09: zod runs jitless in the browser.** zod 4 probes `new Function('')` when a schema is **constructed** (`z.object()`) to decide whether to compile parsers. Under a CSP without `'unsafe-eval'` (the stack's strict CSP) or with Trusted Types enforced, the probe is a CSP violation: zod catches the error, but the browser still reports it, so every page load floods the report endpoint and hides real violations. The entry point's **first import** is a small module that runs `z.config({ jitless: true })` before any other module creates a schema. The bundler must keep that order: a bundler that hoists shared modules (zod, platform schemas) into a chunk that runs before the entry's body defeats the first import, so the stack sets its bundler's execution-order guarantee (per stack). The E2E tests assert that a page load produces no `securitypolicyviolation` event (the stack's CSP assertion).

```ts
// src/strict-csp.ts: imported first by the entry point, before anything that defines a schema (TS-SEC-09)
import { z } from 'zod';

z.config({ jitless: true });
```

Supply chain and scanning: [TS-TOOL-11..16](../development/typescript-tooling.md).

## Agent checklist

- [ ] No storage, URL or log line with a token or personal data?
- [ ] No `eval`-like call, no `innerHTML` with data, no unchecked redirect target?
- [ ] No secret in `environment` files, no new third-party script without nonce (or trusted loader) and SRI; its other hosts in `connect-src`/`img-src`/`font-src`?
- [ ] Error reports and client logs scrubbed?
- [ ] zod configured jitless by the entry's first import, bundler keeps the execution order (TS-SEC-09)?

## Sources

OWASP ASVS 5.0 V3 (Web Frontend Security), V14, V15; OWASP DOM based XSS Prevention Cheat Sheet; OWASP HTML5 Security Cheat Sheet; MDN Subresource Integrity; CSP Level 3 `'strict-dynamic'` (w3.org/TR/CSP3); zod 4 `z.config({ jitless: true })` (zod.dev).

Per stack: Angular ([stacks/angular.md](../../stacks/angular.md)), React ([stacks/react.md](../../stacks/react.md)), Next.js ([stacks/nextjs.md](../../stacks/nextjs.md)).
