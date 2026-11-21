# Security Requirements

<!-- SEC-REQ-01..05, SEC-CRY-01..05. Baseline rules: ../baseline/08-crosscutting-concepts/security/security-requirements.md.
     Keep this file true: every change that adds personal data, a role or an entry point checks it. -->

## ASVS level

| | Value |
|---|---|
| Target level (ASVS 5.0) | L2 <!-- default (D14); L1 only with an ADR: no login and no personal data --> |
| Minimum release gate | L1 |
| ADR for a deviation | <link or "none"> |

## Data classification

<!-- Every kind of data the product handles, its class and where it is stored (SEC-REQ-01).
     Personal data is not repeated here: it is the inventory in docs/data-protection/processing-record.md (DP-INV-01),
     retention periods are in docs/data-protection/deletion-concept.md. Encryption at rest follows the class (SEC-CRY-03). -->

| Data | Class | Stored in |
|---|---|---|
| Personal data | personal | see [processing-record.md](../data-protection/processing-record.md) |
| <e.g. order totals> | confidential | <e.g. PostgreSQL `order`> |
| <e.g. product catalogue> | public | <…> |

Classes: **personal** (relates to an identifiable person), **confidential** (internal or customer business data), **public**.

## Unmet requirements

<!-- Requirements of the target level that are not met yet, each tracked as an issue with an owner (SEC-REQ-02).
     Unmet L1 requirements block a release. -->

| ASVS requirement | Issue | Owner | Level |
|---|---|---|---|
| | | | |

## Session lifetimes (SPRING-SEC-32, NODE-BFF-07)

| | Value | Reason if not the default |
|---|---|---|
| Idle timeout | 30 min (default) | |
| Absolute lifetime | 12 h (default) | |

## Penetration tests (SEC-REQ-04)

| Date | Scope | By | Report / issues |
|---|---|---|---|
| <before first go-live> | <…> | <external party> | <link> |

## Cyber Resilience Act (SEC-REQ-05)

<!-- Decided with legal; do not guess. -->

| | Value |
|---|---|
| CRA applies? | <yes / no / TBD (legal)> |
| Reason | <e.g. we ship installable software on the EU market / pure SaaS, no product with digital elements> |
| Decided by, date | <name, YYYY-MM-DD> |

If yes, the Art. 14 clock applies from 2026-09-11 to actively exploited vulnerabilities and severe incidents: early warning within 24 h, notification within 72 h, final report within 14 days after a fix is available (severe incident: within one month), through the ENISA single reporting platform. The incident runbook names who reports.

## Other compliance

<!-- ISO 27001, customer audits, sector rules, and how they tighten the fix times (SEC-VUL-02), the SBOM duty (SEC-CI-03)
     or disclosure (SEC-INC-02). Ask legal; "none known" is a valid answer. -->

- <duty>: <what it changes>
