# Data Protection (GDPR / DSGVO)

The application-side obligations every product that processes personal data has under the GDPR (DSGVO) and the German BDSG: knowing what personal data it holds, keeping as little as possible for as short as possible, serving data subject requests, keeping production data out of other environments and telemetry, and checking third parties. This doc states engineering rules. It is not legal advice: legal bases, retention periods and transfer mechanisms are decided by the controller with the data protection officer (DPO), and the team implements and documents them. Stack rules: [spring.md](spring.md).

**Terms.** *Personal data*: any information relating to an identified or identifiable person (Art. 4(1)), including IDs, IP addresses and pseudonymised data. *Pseudonymised*: no longer attributable without separately kept additional information (Art. 4(5)); it is still personal data. *Anonymous*: no longer attributable by anyone with reasonable means (Recital 26); only then does the GDPR no longer apply. *Controller*: decides purposes and means (Art. 4(7)): our company, or the customer when we build or run the product on their behalf, in which case we are a *processor* (Art. 28).

## Who does what

| Role | Owns |
|---|---|
| Controller (management, or the customer) | Purposes, legal bases, retention periods, the organisation's record of processing activities (Art. 30), contracts with processors; decides whether a data protection impact assessment (DPIA, Art. 35) is carried out, and whether a breach is notified to the authority (Art. 33) and to the people affected (Art. 34) |
| DPO (Datenschutzbeauftragte/r, Art. 37–39; in Germany mandatory from 20 people regularly processing personal data, § 38 BDSG) | Advises the controller (also on DPIA and breach notification, Art. 35(2), Art. 39), monitors compliance, reviews the product's entries, is the contact for the supervisory authority and for data subjects |
| Product team (incl. agents) | The product's data protection documents (DP-INV-01/02), implementing the rules below, flagging changes for DPO review; when we are the processor, informing the customer as the DPA says (DP-INC-01) |

Agents never invent a legal basis, a retention period or a transfer mechanism. Where one is missing they write `TBD (DPO)` and raise it.

## Rules

### Inventory and records

- **DP-INV-01: Every product keeps a personal-data inventory in `docs/data-protection/processing-record.md`**, structured like an Art. 30(1) record per processing activity: purpose, categories of data subjects, categories of personal data (marking special categories, Art. 9), recipients and processors, transfers outside the EU/EEA, retention period, and a link to the security measures (`docs/security/requirements.md`, Art. 32). The data classification in SEC-REQ-01 links here for personal data instead of repeating it. The DPO adopts these entries into the controller's (or, as processor, our Art. 30(2)) record.
  *Why:* the organisation's record can only be correct if the people who change the system keep its input current.
- **DP-INV-02: Every product keeps a deletion concept in `docs/data-protection/deletion-concept.md`**: per data category the storage locations (tables, topics, buckets, indexes, caches, dead-letter destinations, inbox and stored idempotency results, outbox, log, telemetry and audit stores, backups), retention period and its start event, the deletion mechanism (job, TTL, crypto-shredding) and statutory retention that blocks erasure. DIN 66398 is the reference structure.
- **DP-INV-03: A change that adds a personal-data field, a storage location, a purpose or a recipient updates both documents in the same pull request** (like DOC-ARC-06) and is flagged for DPO review in the pull request. New personal data also triggers the PR threat model (SEC-TM-02). A change that may need a DPIA (special categories at scale, profiling, systematic monitoring, new technology on personal data) is raised with the DPO before implementation.
- **DP-INV-04 (SHOULD): A test checks that every table of the migrated schema is named in the deletion concept or on its list of tables without personal data.** It keeps the deletion concept and the schema in step: it reads the table names from the database after the migrations ran (`information_schema.tables` of the product schema; Spring: a Testcontainers IT, NestJS: the migration test) and the table names from `docs/data-protection/deletion-concept.md` (in backticks in its storage-location column, plus a short "no personal data" list in the same file), and fails on a table missing from both and on a name that no longer exists. Framework tables (Flyway history, ShedLock, session tables) are listed like any other.
  *Why:* the documents drift as soon as the schema grows: renamed tables, a new timer or outbox table, entries for tables that were never built. An erasure or data subject request built from a stale inventory misses data, and a reviewer cannot see the gap in a pull request that adds a table without touching the documents.

### Minimisation and privacy by design (Art. 5(1)(c), Art. 25)

- **DP-MIN-01: Every personal-data field has a purpose in the inventory.** Fields without one are not collected. Forms and APIs do not ask for data "in case we need it later"; optional data is optional in the API, the schema and the UI.
- **DP-MIN-02: Personal data stays where it is needed.** Ports, events and API responses carry identifiers instead of personal data where the receiver does not need the data itself; query results (ARCH-UC-07) contain only the fields the screen shows. Events with personal data are listed in the inventory with their topic retention.
- **DP-MIN-03: Privacy-friendly defaults** (Art. 25(2)): optional processing (newsletter, analytics, profile visibility) is off until the user turns it on. Storage on the user's device that is not strictly necessary for the requested service needs consent (§ 25 TDDDG); the frontend reads and writes such storage only through an outgoing adapter that checks consent.
- **DP-MIN-04 (SHOULD): Views for roles that may see only aggregates never show a group smaller than the product's minimum group size (default 5 people).** Where a role is entitled to sums but not to individual figures (management reports, team statistics), every row is computed together with the number of distinct people in it; rows below the minimum are suppressed or merged into "other", and a filter or grouping that resolves to fewer people (a one-person team, a project with one booker, a per-day grouping of a small team) is refused or coarsened. The product records the minimum and its reason in `docs/data-protection/processing-record.md` (agreed with the DPO and, in Germany, the works council), and the report's integration test proves that the aggregate role cannot isolate one person.
  *Why:* a sums-only role that can filter down to a group of one sees exactly the individual data the role was meant to exclude (Art. 5(1)(c), § 87(1) no. 6 BetrVG monitoring).

### Retention and deletion (Art. 5(1)(e), Art. 17)

- **DP-RET-01: Every data category has a retention period and a start event** (e.g. "contract end + statutory period", "last login + 24 months") from the deletion concept, decided by the controller. "Forever" is not a period. A period the controller has deliberately not set yet is written `TBD (DPO)` in the deletion concept, with an ADR that states the deferral and its trigger; until it is set, the product processes no real personal data (demo and test installations only, DP-ENV-01), and no deletion job is invented for it.
- **DP-RET-02: Deletion after the period is automated** by a scheduled job per data category that calls a use case (e.g. `PurgeExpiredCustomerAccounts`) and is covered by tests (DP-TEST-01). Manual deletion runbooks are not a substitute. Deletion reaches every location from the deletion concept, including search indexes, caches, files, dead letters, inbox and idempotency stores, and history tables. The security audit trail keeps its own retention period and pseudonymous ids (SEC-AUD-02).
- **DP-RET-03: Data under statutory retention is restricted, not deleted** (Art. 17(3)(b), Art. 18): it is marked, excluded from normal use cases and visible only to the role that needs it for the retention purpose, and deleted when that period ends.
- **DP-RET-04: Immutable or long-lived stores hold no personal data in clear text.** Event logs, compacted topics and archives reference the person by ID, or encrypt the personal fields with a per-person key that is destroyed on erasure (crypto-shredding; where the keys live and how they are wrapped: [SEC-CRY-04](../security/security-requirements.md)). Whether crypto-shredding counts as erasure for a product is agreed with the DPO.
- **DP-RET-05: Backups are not edited for erasure; they expire.** The backup retention is stated in the deletion concept, and a restore re-applies deletions made since the backup (e.g. from a deletion log holding only IDs) before the system serves traffic again.

### Data subject rights (Art. 12–22)

- **DP-DSR-01: Data subject rights are use cases**, behind incoming ports, authorized for a dedicated role (or the user for self-service), audited (SPRING-SEC-22, NEST-SEC-33) and tested like any use case:

  | Right | Use case | Notes |
  |---|---|---|
  | Access (Art. 15) and portability (Art. 20) | `ExportPersonalData` | All data about the person from every location in the inventory; portable data as structured, machine-readable JSON |
  | Rectification (Art. 16) | the normal update use cases | Every stored personal-data field is changeable through some use case |
  | Erasure (Art. 17) | `ErasePersonalData` | Deletes or anonymises in every location, restricts what statutory retention keeps (DP-RET-03) |
  | Restriction (Art. 18), objection (Art. 21) | `RestrictProcessing` where the inventory names such processing | Excludes the person from the affected processing |

- **DP-DSR-02: Each module that stores personal data contributes to export and erasure through its own port**, so a new storage location cannot be forgotten: a test fails when an adapter holding personal data has no export/erase implementation (e.g. an architecture test or a registry test).
- **DP-DSR-03: Requests are answered within one month** (Art. 12(3); extendable by two months with notice). The use cases run without developer involvement, so the deadline does not depend on a ticket. Erasure and rectification are passed on to recipients and processors listed in the inventory (Art. 19), through an outgoing port where they are systems.
- **DP-DSR-04: Identity verification of the requester is part of the business process**, not something the export endpoint assumes. A self-service export only returns the authenticated caller's own data (SPRING-SEC-16, NEST-SEC-08).
- **DP-DSR-05: An access or portability export contains all stored personal data of the requester, and nothing about other people.** It includes soft-deleted, archived and superseded records that are still stored, marked as such: the export reads them with its own queries, not with the business queries that hide them. It is never silently truncated: it streams, pages or fails with a stated reason. Records that also concern other people (an audit entry the requester wrote about a colleague, a team or project list) show only the requester's part: what the requester did, when, and to which object type, without the other person's identifiers or values (Art. 15(4)). Tests: the export of a user who changed other users' data contains none of their identifiers, and a soft-deleted record of the requester appears in it.
  *Why:* Art. 15 covers every stored record, not just the active ones, and an export built on the business queries silently leaves out the deleted ones while copying everything the requester touched.

### Non-production environments and test data

- **DP-ENV-01: Production personal data never enters non-production environments**, local machines, CI, test fixtures, tickets, chat or prompts to AI tools (like SEC-INC-01 for secrets). Test and demo data is synthetic, generated by fixtures or data generators.
- **DP-ENV-02: Pseudonymised production copies are personal data and fall under DP-ENV-01.** A product that needs production-like data uses an anonymisation process approved by the DPO and recorded in an ADR, with the anonymisation verified (no direct identifiers, no rare combinations of quasi-identifiers, no free text).
- **DP-ENV-03: Debugging production issues uses production tooling with logged, role-based access**, not data exports. Reproductions are rebuilt with synthetic data.
- **DP-ENV-04: Demo data of a running installation is loaded by an incoming adapter that calls the use cases, active only under the `demo` profile (CFG-04).** Master data may come through the product's own bulk-import path (ARCH-UC-19), time-dependent data through a loader that calls the same commands a user would, so audit, authorization and business rules apply; no SQL seed scripts that bypass them. A deployed configuration never sets `demo`, and a test asserts that the loader bean or module is absent without it.
  *Why:* a loader that writes tables directly produces states the product could never reach and drifts from every new rule.

### Processors and third parties (Art. 28, Art. 44–49)

- **DP-PROC-01: Every external service that receives personal data is listed in the inventory before it goes live**: hosting, e-mail and SMS providers, third-party APIs, error tracking and APM, analytics, maps, CDNs, and hosted dev tools that see production data. Each entry names the data sent, the data processing agreement (DPA, AVV) status and the location of processing. Integrating a new one is an outgoing adapter (ARCH-ADP-*) whose pull request states this.
- **DP-PROC-02: Transfers outside the EU/EEA need a documented basis** (adequacy decision under Art. 45, e.g. a certified recipient under the EU–US Data Privacy Framework, or standard contractual clauses under Art. 46), decided by the controller and DPO. The DPF was upheld by the EU General Court on 3 September 2025 (T-553/23, *Latombe*); an appeal is pending before the Court of Justice (C-703/25 P), so a product relying on it names a fallback in the inventory.
- **DP-PROC-03: The browser loads no third-party resources that transmit user data without need.** Fonts, icons, scripts and styles are self-hosted with the frontend; a third-party resource in the CSP (the frontend stack's CSP rule) is a processor entry under DP-PROC-01.

### Logging and telemetry

- **DP-TEL-01: Logs, metrics, traces and frontend error reports contain no personal data beyond pseudonymous identifiers** (SPRING-LOG-08, NEST-LOG-09). [The observability concept](../observability/observability.md) (OBS-08) applies the same rule to span attributes, metric labels and baggage. User IDs are allowed; names, e-mail addresses, free text and full payloads are not.
- **DP-TEL-02: Personal data is never part of a URL path or query string** (`/customers?email=…`). URLs end up in access logs, proxies, traces and browser history; searches by personal data use a request body.
- **DP-TEL-03: Telemetry stores have a retention period** in the deletion concept, and session replay or user-level analytics are off unless the inventory names them and consent exists.

### Breaches (Art. 33, 34)

- **DP-INC-01: A personal-data breach follows the incident runbook ([SEC-INC-02](../security/vulnerability-management.md)) and its clock depends on our role.** As controller: the controller decides, with the DPO's advice, on notifying the supervisory authority without undue delay and where feasible within 72 hours of becoming aware (Art. 33(1)), unless the breach is unlikely to result in a risk, and on informing the people affected without undue delay when the risk is high (Art. 34). As processor: we inform the customer (the controller) without undue delay after becoming aware (Art. 33(2)), through the channel and within the time the DPA names, and support their notification with the facts we have. Every breach is documented with facts, effects and remedial action (Art. 33(5)), also when it is not notified.

### Reviews and tests

- **DP-REV-01: A pull request that touches personal data answers the "Personal data" row of the PR template's security section** (SEC-REV-01; rules per area in [security-review.md](../security/security-review.md)).
- **DP-TEST-01: Deletion and data subject use cases are tested end to end through their adapters**: a persistence test seeds expired and non-expired records and asserts that exactly the expired ones are gone from every table of the category; the export test asserts that every inventoried field appears; the erasure test asserts that no inventoried field of the person remains, apart from restricted records.
- **DP-TEST-02: Tests assert the absence of personal data where it must not appear**: log capture in tests of use cases that handle personal data (SPRING-LOG-09, NEST-DP-09), and the fixtures of DP-ENV-01 use recognisable synthetic values so a leak is detectable.

## Anti-patterns

- "We'll build deletion when someone asks": the first erasure request is then a manual SQL session under a one-month deadline.
- A staging database restored from last night's production backup "because the bugs only show with real data".
- E-mail addresses in log messages, span attributes or URL query strings.
- An event stream that carries full customer records forever.
- A new SaaS error tracker or font CDN wired in without anyone checking the DPA or where the data goes.
- An agent filling the retention column with a plausible-looking period.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Data Protection (GDPR / DSGVO)".*
