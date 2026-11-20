<!-- Baseline PR template (synced once, then project-owned). Rule IDs refer to docs/baseline/. -->

## What and why

<!-- What changes and why. Link the issue. Cite rule IDs for design decisions (e.g. ARCH-UC-05). -->

## Done

<!-- Tick what applies; write "n/a" with a short reason for the rest. -->

- [ ] Tests written first, of the type each changed architecture element requires (TEST-ARCH-06)
- [ ] Bug fix: a test that would have caught it (TEST-ARCH-11)
- [ ] `docs/architecture/` updated for a new component, adapter, external system, deployment target or quality requirement (DOC-ARC-06)
- [ ] New decision or shortcut: ADR in `docs/adr/` and linked in chapter 9 (ARCH-SC-02, DOC-ARC-03)
- [ ] UI change: WCAG 2.2 AA, axe and keyboard test for the changed path (A11Y-05)
- [ ] API change: spec committed, clients regenerated, breaking-change check green (API-CON-04)
- [ ] No architecture test, compiler check, static-analysis or lint rule, security or accessibility check weakened, skipped or made advisory (SEC-REV-02)
- [ ] Personal data added, moved or sent somewhere new: `docs/data-protection/` updated and flagged for DPO review (DP-INV-03)
- [ ] Release-relevant change: Conventional Commits title; breaking change marked `!` and described for the release notes (REL-BR-03, REL-VER-04)
- [ ] New schema, API or event change works with the previous release still running; migration lint green or flagged statement justified (REL-ZD-03, REL-DB-06)
- [ ] Pipeline, image or runtime setting changed: delivery platform mapping in chapter 7 updated (REL-CD-06)

## N+1 check (API-N1-01/02)

<!-- Required when the change loads data across a REST boundary (backend endpoint or frontend feature).
     Otherwise write "Not affected". Rules: docs/baseline/08-crosscutting-concepts/api/avoiding-n-plus-one.md -->

```text
N+1 check
- Data loaded: <list of X, plus Y per X>
- Risk: <N+1 / waterfall / none>, expected N in production: <…>
- Recommended: <S#> because <…>
- Alternatives considered: <S#: why not>
- Decided by the developer: <S#>, reason: <…>
- Tests: <request-count budget / batch assertion / query count>
```

## Security (SEC-REV-01)

<!-- Required when the change touches authentication, authorization, input handling, outbound calls,
     deserialization, file handling, headers, security configuration or personal data. "Not affected" is a valid
     answer per row. Rules per area: docs/baseline/08-crosscutting-concepts/security/security-review.md -->

| Area | Answer |
|---|---|
| Access control: new endpoints authenticated and authorized; owner/tenant checked, foreign ids answer 404; no owner, tenant or role field in request records; 401/403 and `cross-user` tests? | |
| Input and injection: size, length and type limits; bind parameters only, sort and identifiers from an allow-list, no process execution with user input; closed types for polymorphic JSON; uploads named, scanned, served safely? | |
| Configuration: actuator exposure, debug features, forwarded-header strategy unchanged or tightened? | |
| Output and errors: no stack traces or internals in responses, no sensitive data in logs? | |
| Outbound: calls to user-influenced URLs allow-listed and address-filtered; timeouts set? | |
| Browser and session: no `bypassSecurityTrust*`, `innerHTML`, tokens in browser storage; CSP and headers still strict; CSRF, CORS, session lifetimes and logout unchanged or tightened? | |
| Abuse: rate limits for expensive or abusable endpoints; abuse cases tested? | |
| Cryptography and secrets: TLS, hashing, encryption at rest and keys per SEC-CRY-01..05; no credential in code, config, fixtures or logs (SEC-INC-01)? | |
| Audit trail: security-relevant actions write an audit event with a pseudonymous id, tested? | |
| Dependencies: new dependency reviewed (maintainer, age, licence, install scripts)? | |
| Personal data: inventory and deletion concept updated, retention covered, export/erasure extended, nothing personal in logs, telemetry or URLs (DP-INV-03, DP-RET-02, DP-DSR-02, DP-TEL-01/02)? | |
| Design: new entry point, outbound call, role or personal data → threat model below (SEC-TM-02)? | |
| Pipeline: gates, thresholds and permissions unchanged or tightened (SEC-CI-02, SEC-REV-02)? | |

### Threat model (SEC-TM-02, only if needed)

1. What are we working on?
2. What can go wrong?
3. What will we do about it?
4. Did we do a good job?
