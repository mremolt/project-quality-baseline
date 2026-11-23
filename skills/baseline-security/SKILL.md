---
name: baseline-security
description: Security entry point for any project that uses the quality baseline - authentication and authorization, input limits, headers and CSP, error handling, outbound calls, deserialization, secrets, injection, BFF sessions, logout and XSRF, cryptography and keys, audit trail, personal data, Angular and React XSS and Trusted Types, Next.js server actions and proxy.ts, npm and CI supply chain, dependency and image scanning, threat modelling and security review of pull requests. Routes to the baseline's security docs by task, cites rule IDs and OWASP ASVS 5.0 / Top 10:2025 references. Use it when a change touches a security-relevant area, or when asked for a security review.
---

# Security in the quality baseline

The baseline docs are the rules; skills supply know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). Target: ASVS 5.0 level 2, level 1 as minimum gate (D14). Paths are relative to the project root; bare file names below are in `docs/baseline/08-crosscutting-concepts/security/`, other paths start at `docs/baseline/08-crosscutting-concepts/`. Read only the rows and rule IDs of the project's own stacks (`.baseline.json`).

## 1. Read the docs for the task

| Task | Read |
|---|---|
| Any security-relevant change, review | The PR template's security section (questions), `security-review.md` (area → rules, Top 10:2025 map) |
| New project, new entry point, outbound call, role, personal data | `security-requirements.md` (SEC-REQ incl. pen test and CRA applicability, SEC-TM), the project's `docs/security/requirements.md` and `threat-model.md` |
| Personal data: new field, store, recipient, retention, export/erasure, logs and telemetry, breach | `data-protection/data-protection.md` (DP-*), `data-protection/spring.md` (SPRING-DP-*) or `data-protection/nestjs.md` (NEST-DP-*), the project's `docs/data-protection/` |
| TLS, password hashing, encryption at rest, keys, random values | `security-requirements.md` (SEC-CRY-01..05), `spring-hardening.md` (SPRING-SEC-30) or `nestjs-hardening.md` (NEST-SEC-42) |
| Project security artefacts | The sync creates them from templates once: `docs/security/{requirements,threat-model,exceptions,incident-runbook}.md`, `SECURITY.md`, the PR template with the SEC-REV-01 checklist (at the host's path; without a known host in `docs/pull-request-template.md`, answered per change until the project has one), `frontend/public/.well-known/security.txt`. Without an issue tracker, unmet ASVS items (SEC-REQ-02) are tracked in `docs/security/requirements.md`. If one is missing, re-run the sync or copy it from the baseline's `templates/`; fill in the placeholders, never invent contacts or dates |
| Auth, `Caller`, CORS, CSRF, actuator / probes, IdP provisioning and account linking (SPRING-SEC-44) | Spring: `spring.md`; NestJS: `nestjs.md` |
| Headers, limits, injection, object-level access, mass assignment, tenancy, errors, SSRF, JSON, uploads, audit events, DB, Kafka, images, BFF session, session store, OIDC client and logout | Spring: `spring-hardening.md`; NestJS: `nestjs-hardening.md` (also prototype pollution, ReDoS, process hardening); Node BFF (NestJS or Next.js): `node-bff.md` |
| Browser code, storage, redirects, bundle, third-party scripts, sign-out (TS-SEC-10) | `typescript.md` |
| Angular templates, CSP, Trusted Types, XSRF, SSR, security E2E | `angular.md` |
| React JSX and DOM safety, CSP nonce, Trusted Types, zod jitless, XSRF, security E2E | `react.md` (REACT-SEC-*) |
| Next.js: BFF wiring, `proxy.ts` CSP and headers, server actions as endpoints, secrets in client props | `nextjs.md` (NEXT-SEC-*), `node-bff.md` (NODE-BFF-*) |
| Scanner, DAST, pen-test or reported finding, suppression, leaked secret, audit trail, incident | `vulnerability-management.md`, the project's `docs/security/incident-runbook.md` |
| CI gates and thresholds, pipeline permissions, SBOM, provenance, image scans, DAST, security dates | `secure-pipeline.md` |
| npm config, lint security rules, dependency review | `development/typescript-tooling.md` (TS-TOOL-11..16), `development/angular-tooling.md` (NG-TOOL-07/08), `development/react-tooling.md` (REACT-TOOL-05), `development/java-tooling.md` (JAVA-TOOL-05), `development/node-tooling.md` (NODE-TOOL-05/08) |

## 2. Skills to combine

`spring-security` (Spring Boot; NestJS has no adopted security skill), `angular-developer` and `playwright-best-practices` (`security-testing`) for Angular, `playwright-best-practices` for React and Next.js, `baseline-tdd` for abuse-case tests.

## 3. Overrides you will hit

| Skill habit | Baseline rule |
|---|---|
| Custom JWT filter, JJWT, `@PreAuthorize` as default | Resource server, authorization on a `Caller` (SPRING-SEC-02/03) |
| `@nestjs/passport`, `jsonwebtoken`, `@Roles` as the only check | One `jose` guard, authorization on a `Caller` in the use case (NEST-SEC-02/03/05) |
| Bearer token in an Angular interceptor or React fetch wrapper, token in `localStorage` | BFF session cookie, no tokens in the browser (SPRING-SEC-08, NEST-SEC-12, TS-SEC-01, NG-SEC-08, REACT-SEC-06) |
| API CSP `default-src 'self'`, `headers().disable()` | `default-src 'none'`, headers never disabled (SPRING-SEC-13, NEST-SEC-20) |
| `bypassSecurityTrust*` to make a binding work | Forbidden by lint; an exception needs a code comment with reason and trusted source plus pull-request approval (NG-SEC-02) |
| `<meta>` CSP, CDN-cached nonce, `base-uri 'none'` | BFF sets the CSP per request, `base-uri 'self'`, Trusted Types incl. `angular#components` (NG-SEC-05/06) |
| String-built SQL/JPQL, `ORDER BY` from a request parameter | Bind parameters, identifiers from an allow-list (SPRING-SEC-31, NEST-SEC-25) |
| Binding request JSON onto an entity, `ownerId` in a request body | Request records and schemas carry only what the caller may set (SPRING-SEC-34, NEST-SEC-27) |
| 403 for another user's object | 404 (SPRING-SEC-36, NEST-SEC-29) |
| In-memory servlet session in a Spring BFF; `client-authentication-method: none` outside local | Spring Session JDBC (SPRING-SEC-37); confidential client with PKCE (SPRING-SEC-38) |
| `dangerouslySetInnerHTML`, `innerHTML` in React | Banned by lint; rich text only by ADR through one sanitizing component (REACT-SEC-01..03) |
| Next.js server action trusting bound arguments, or without a session and input check | Every action is a public endpoint: session, authorization in the use case, zod parsing (`nextjs.md`) |
| `NEXT_PUBLIC_*` for environment values, secrets in props of client components | Runtime configuration from the server, public subset only (`configuration/nextjs.md`, `nextjs.md`) |
| Angular `autoCsp` (hash-based meta CSP) | Banned everywhere; nonce-based header from the BFF (NG-SEC-10) |
| Allowing third-party scripts by listing their host in `script-src` | Ignored with `'strict-dynamic'`; nonce or trusted loader plus SRI (TS-SEC-07) |
| Raising a scanner threshold, disabling an architecture test, lint, compiler or accessibility check to go green | Raise it; time-boxed exception in `docs/security/exceptions.md` (SEC-REV-02, SEC-VUL-03); thresholds live only in the gate table (SEC-CI-01) |

## 4. Workflow

1. **Classify** the change by the areas of `security-review.md`: access control, input and injection, output and errors, outbound, browser and session, headers, abuse, deserialization, cryptography, secrets, audit trail, dependencies, design, personal data, pipeline.
2. **Threat model** if it adds an entry point, outbound call, role or personal data (SEC-TM-02): the four questions in the PR template's threat-model section; update `docs/security/threat-model.md` on architecture changes (SEC-TM-01). Write abuse cases as tests (SEC-TM-03).
3. **Apply the rules** of the matching docs, test first (`baseline-tdd`): `cross-user` tagged test (SPRING-SEC-16 / NEST-SEC-08), 401/403 (SPRING-SEC-10 / NEST-SEC-14), token rejection (SPRING-SEC-17 / NEST-SEC-04), session rotation and logout (SPRING-SEC-32/33 / NODE-BFF-07/08), XSS, header and deep-link E2E (NG-SEC-12 / REACT-SEC-09 / NEXT-SEC-09), personal data absent from logs (SPRING-DP-07 / NEST-DP-09).
4. **Review**: answer the security section of the PR template (SEC-REV-01); cite rule ID plus ASVS/Top 10 reference (SEC-REV-03). Reachability decides severity.
5. **Never** weaken a check to pass a build (SEC-REV-02); raise it. Propose shortcuts and draft an ADR (ARCH-SC-06).
6. **Finish** with the stack's verify command green (`./mvnw verify`, `npm run verify`).
