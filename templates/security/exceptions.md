# Security Exceptions (Accepted Risks)

<!-- SEC-VUL-03: every accepted risk has an owner, a reason and an expiry date, approved by the tech lead.
     Tool suppressions (OSV-Scanner ignore, @SuppressFBWarnings, // eslint-disable, Semgrep nosemgrep) point at
     the entry id or carry the reason inline. Expired entries fail the security date check (SEC-CI-08); renew with a new reason or fix.
     Baseline rules: ../baseline/08-crosscutting-concepts/security/vulnerability-management.md -->

| ID | Finding (tool, CVE / rule) | Where | Reason (not reachable, mitigated, …) | Owner | Approved by | Expires |
|---|---|---|---|---|---|---|
| EX-001 | <e.g. OSV GHSA-xxxx-xxxx-xxxx in lib 1.2.3> | <backend/pom.xml> | <vulnerable function not called; reachability checked on YYYY-MM-DD> | <name> | <tech lead> | <YYYY-MM-DD> |

## Expired or closed

<!-- Move entries here when fixed or expired, with the date and the outcome. -->

| ID | Closed | Outcome |
|---|---|---|
| | | |
