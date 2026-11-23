# Secure Pipeline

Security gates and pipeline hardening for the single CI pipeline of a product (REPO-CI-01..03). The CI system, registry and scanners are the customer's; the rules name a capability, the table names a reference tool that can be replaced by any tool with the same capability (D5). Each product records its tools in the "Delivery platform mapping" table of its chapter 7. Tool wiring per stack: [JAVA-TOOL-05/21](../development/java-tooling.md), [TS-TOOL-11..16](../development/typescript-tooling.md) (also for Node backends, [NODE-TOOL-05/08](../development/node-tooling.md)), [NG-TOOL-07/08](../development/angular-tooling.md), [REACT-TOOL-05](../development/react-tooling.md), [NEXT-TOOL-05/06](../development/nextjs-tooling.md).

## Gates

This table is the single source of the thresholds. Stack rules name the tool settings, not other thresholds.

| Gate (capability) | Reference tool (replaceable) | Runs | Fails on |
|---|---|---|---|
| Dependency scan, Java backend | OSV-Scanner (JAVA-TOOL-16) | pull request | new high or critical finding |
| Dependency scan and signatures, npm (frontend and Node backend) | OSV-Scanner on `package-lock.json`, `npm audit signatures` (TS-TOOL-12, NODE-TOOL-08) | pull request | new high or critical finding, failed signature check |
| SAST, Java backend | SpotBugs with FindSecBugs (JAVA-TOOL-12), Semgrep CE (JAVA-TOOL-21) | pull request | SpotBugs: any finding reported at confidence threshold `Medium` (a confidence, not a severity, see JAVA-TOOL-12); Semgrep: medium severity and above |
| SAST, TypeScript (frontend and Node backend) | ESLint security rules (NG-TOOL-07, REACT-TOOL-05, NEXT-TOOL-06, NODE-TOOL-05), Semgrep CE | pull request | any finding |
| Secret scan | gitleaks, plus platform push protection | pre-commit, pull request | any finding |
| Container image scan | Trivy | integration build: report only; release: gate | release: fixable high or critical |
| Re-scan of deployed images | Trivy against the registry digests | scheduled (at least daily) | does not fail a build: a new high or critical finding is triaged (SEC-VUL-01) |
| SBOM and provenance | CycloneDX; platform artifact attestation or cosign / in-toto | release | missing SBOM or provenance |
| Provenance verification | platform admission policy, `cosign verify-attestation`, or a pipeline step | deploy | unsigned or unverifiable digest |
| DAST (passive) | ZAP baseline against the Compose stack | nightly | high |
| Headers and CSP | Playwright assertions (NG-SEC-12, REACT-SEC-09, NEXT-SEC-09; BFF: NODE-BFF-10) | pull request | missing or weakened header |
| Security dates | small script in the pipeline (SEC-CI-08) | scheduled (weekly) and pull request | expired exception, overdue threat-model review, `security.txt` expiring within 30 days |

## Rules

- **SEC-CI-01: CI runs the dependency scan, the secret scan and SAST on every pull request; findings at or above the gate's threshold in the table fail the build.** One `security` job (or stage) in the single pipeline; it is covered by the always-reported merge status (REPO-CI-03).
- **SEC-CI-02: The pipeline itself is hardened.** Least-privilege tokens (read-only by default, write permission per job), third-party actions, plugins and images pinned by commit SHA or digest (this includes the Compose images that CI starts for integration and E2E tests), no secrets in builds of pull requests from forks, release credentials only in the release job.
  *Why:* the pipeline is part of the supply chain (Top 10:2025 A03, A08).
- **SEC-CI-03: Releases publish an SBOM (CycloneDX; backend JAVA-TOOL-17, frontend TS-TOOL-16) and signed build provenance stored with the artifact; target SLSA Build L2.** Provenance comes from the platform's artifact attestation where the platform has one, otherwise from cosign or in-toto in the release job, attached to the image digest in the registry. Where the customer platform can do neither, the minimum is the SBOM and the image digest in the release record (REL-CD-02), and the gap is recorded in the product's chapter 11.
- **SEC-CI-04: A passive DAST baseline scan runs nightly against a stack built from the same commit** (REPO-CI-04). Its fail threshold is set explicitly (some tools, the ZAP action among them, do not fail by default). Authenticated scans are added once a project runs a real IdP. Header and CSP checks run as E2E tests on every pull request (NG-SEC-12, REACT-SEC-09, NEXT-SEC-09).
- **SEC-CI-06: Container images are scanned at three points:** in the integration build (report only, so findings show early), in the release job (gate per the table), and on a schedule against the digests currently deployed in each environment, so a vulnerability published after the release is found. Findings of the scheduled scan go into triage (SEC-VUL-01), not into a red build.
- **SEC-CI-07: Before a deployment the digest's provenance and signature are verified** by the delivery platform (admission policy) or by a pipeline step; an unverifiable digest is not deployed. Where the customer platform deploys and offers no verification, the handover names the digest and its provenance, and the gap is recorded in chapter 11.
- **SEC-CI-08: One scheduled job checks the security dates:** expired entries in `docs/security/exceptions.md` (SEC-VUL-03), the threat model's "Next review due" (SEC-TM-01), and the `Expires` field of `security.txt` (SEC-INC-02, fails 30 days before). It runs weekly and on pull requests that touch these files; a hit fails the pull request and opens an issue from the scheduled run.
- **SEC-CI-09: A new dependency that parses untrusted input (files, archives, markup, documents), or that is large or young, gets a written dependency review before it is added.** Criteria: maintainers and release activity, advisory history, transitive size, the surface the product does not use, licence, and the cost of owning a small own implementation instead. The review is a table in the ADR that adds the dependency; a small own parser on the platform's standard library is a valid outcome. The scanner gate (SEC-CI-01) still applies to whatever is chosen.
  *Why:* scanners find known vulnerabilities in what is already chosen; they do not tell whether a hostile-input library should be chosen at all.

Tool details to confirm at adoption: [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use). Record the pinned versions in the project's pipeline definition.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Secure Pipeline".*
