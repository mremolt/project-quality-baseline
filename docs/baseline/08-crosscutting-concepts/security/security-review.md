# Security Review

How pull requests and agents check security, and how findings are reported. The questions live in the PR template the sync creates; this doc maps each area to the rules that answer it.

- **SEC-REV-01: A pull request that touches authentication, authorization, input handling, outbound calls, deserialization, file handling, headers, security configuration or personal data answers the security section of the PR template in its description.** "Not affected" is a valid answer per row. The PR template is created once by the sync at the SCM host's path ([agent-skills.md](../development/agent-skills.md#distribution-to-consuming-projects)); its questions are the checklist, the table below says which rules apply.
- **SEC-REV-02: Never weaken, skip, delete or make advisory a check to make a build pass.** This covers architecture tests, compiler checks, static-analysis and lint rules, security checks (headers, CSP, scanner gates, security tests) and accessibility checks. Raise it with the developer instead; a noisy rule is tuned in a reviewed change with a reason, and an accepted risk goes through SEC-VUL-03. (Agent non-negotiable in `AGENTS.md`.)
- **SEC-REV-03: Reviews cite the rule ID and the matching ASVS 5.0 chapter or requirement, or the Top 10:2025 category**, for example "SPRING-SEC-16, ASVS V8, A01". Reachability decides severity: a pattern match is not yet a vulnerability.

## Areas and rules

The rows match the rows of the PR template's security section.

| Area | Rules |
|---|---|
| Access control | SPRING-SEC-01/02/10/16, SPRING-SEC-34..36, SPRING-SEC-44 (account linking), NEST-SEC-01/02/08/14, NEST-SEC-27..29, NG-SEC-09, REACT-SEC-07, NEXT-SEC-04 |
| Input and injection | SPRING-SEC-15, SPRING-SEC-43 (numbers from files), SPRING-SEC-31, SPRING-SEC-20 and SPRING-MSG-04 (deserialization), SPRING-SEC-26 (uploads), NEST-SEC-22..26, NEST-SEC-37 (uploads), NG-SEC-01..04, REACT-SEC-01..03, NEXT-SEC-04 (server-action input), NEXT-SEC-12 (limits), TS-SEC-02/08, TS-API-09 (path parameter encoding) |
| Configuration | SPRING-SEC-07 (actuator), SPRING-SEC-12, SPRING-SEC-23, NEST-SEC-10/11/36, NEXT-SEC-07, NEXT-SEC-13 (test stubs) |
| Output and errors | SPRING-SEC-18, SPRING-LOG-07/08, NEST-SEC-30, NEST-LOG-08/09, NG-SEC-11, REACT-SEC-08, NEXT-SEC-06 (client props), TS-SEC-06 |
| Outbound | SPRING-SEC-19, NEST-SEC-31, NODE-BFF-01 (token relay), NEXT-SEC-02 (API proxy), RES-TMO-01 |
| Browser and session | SPRING-SEC-04/05 (CSRF, CORS), SPRING-SEC-08, SPRING-SEC-13 (headers), SPRING-SEC-24/25, SPRING-SEC-32/33, SPRING-SEC-42 (session serialization), NEST-SEC-06/07, NEST-SEC-12, NEST-SEC-20/51 (headers), NEST-SEC-47..50, NODE-BFF-02..09, NG-SEC-05..08, REACT-SEC-04..06, NEXT-SEC-01..03, NEXT-SEC-05, NEXT-SEC-08, NEXT-SEC-10/11, TS-SEC-01/03/07/09/10 |
| Abuse | SPRING-SEC-21, NEST-SEC-32, NEXT-SEC-12, SEC-TM-03 |
| Cryptography and secrets | SEC-CRY-01..05, SPRING-SEC-14/30, NEST-SEC-21/42, SEC-INC-01/03, CFG-05 |
| Audit trail | SEC-AUD-01..05, SPRING-SEC-22, NEST-SEC-33 |
| Dependencies | JAVA-TOOL-05, TS-TOOL-13, NEST-SEC-43, SEC-CI-01 |
| Personal data | [DP-INV-03/04, DP-MIN-04, DP-RET-02, DP-DSR-02, DP-TEL-01/02](../data-protection/data-protection.md) |
| Design | SEC-TM-02 (new entry point, outbound call, role or personal data), NODE-BFF-10, NEXT-SEC-09 |
| Pipeline | SEC-CI-02, SEC-REV-02 |

## Top 10:2025 map

| Category | Main rules |
|---|---|
| A01 Broken Access Control | SPRING-SEC-01/02/10/16, SPRING-SEC-34..36, SPRING-SEC-04/25 (CSRF), SPRING-SEC-05 (CORS), SPRING-SEC-19 (SSRF), NEST-SEC-01/02/08/14, NEST-SEC-27..29, NEST-SEC-06/48 (CSRF), NEST-SEC-07 (CORS), NEST-SEC-31 (SSRF), NODE-BFF-06, NEXT-SEC-02/05 (CSRF), NEXT-SEC-04, NG-SEC-07/09, REACT-SEC-07 |
| A02 Security Misconfiguration | SPRING-SEC-07 (actuator), SPRING-SEC-13/14/23/29, NEST-SEC-10, NEST-SEC-20/21/36/40, NODE-BFF-09, NEXT-SEC-03/08/13, NG-SEC-05/06, REACT-SEC-04/05 |
| A03 Software Supply Chain Failures | SEC-CI-01/02/03/06/07, JAVA-TOOL-05/16/17/23, TS-TOOL-11..16 |
| A04 Cryptographic Failures | SEC-CRY-01..05, SPRING-SEC-14/30, NEST-SEC-21/42 |
| A05 Injection | SPRING-SEC-31, SPRING-SEC-15, NEST-SEC-25/26, NEST-SEC-22, NG-SEC-01..04, REACT-SEC-01..03, NEXT-SEC-04, TS-SEC-02, TS-API-09 |
| A06 Insecure Design | SEC-TM-01..03, SPRING-SEC-21 (rate limiting), SPRING-SEC-26 (uploads), NEST-SEC-32, NEST-SEC-37, NEXT-SEC-12 |
| A07 Authentication Failures | SPRING-SEC-03/08/17/24, SPRING-SEC-32/33, SPRING-SEC-44, NEST-SEC-03/04/12/47, NEST-SEC-49/50, NODE-BFF-02..08, NEXT-SEC-01/02, NG-SEC-08 |
| A08 Software or Data Integrity Failures | SPRING-SEC-20, NEST-SEC-23, NEXT-SEC-07, SEC-CI-02/03/07 |
| A09 Security Logging and Alerting Failures | SEC-AUD-01..05, SPRING-SEC-22, SPRING-LOG-08/09, NEST-SEC-33, NEST-LOG-09/10, DP-TEL-01..03, OBS-18 |
| A10 Mishandling of Exceptional Conditions | SPRING-SEC-18, SPRING-SEC-15, SPRING-SEC-43, NEST-SEC-30, NEST-SEC-22, NEST-SEC-34, NG-SEC-11, REACT-SEC-08 |

Personal data across all categories: [data-protection.md](../data-protection/data-protection.md) (DP-*).

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Security Review".*
