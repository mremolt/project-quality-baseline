# Agent checklists: shared

The agent checklists of the shared docs (all stacks), one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Hexagonal Architecture (Ports & Adapters)

[04-solution-strategy/hexagonal-architecture.md](../04-solution-strategy/hexagonal-architecture.md)

- [ ] Does the new code sit in the right ring (domain / application / ports / adapter / configuration)?
- [ ] Do all new imports point inward, and does no adapter import another adapter?
- [ ] If the core needs an external capability, did I add an outgoing port instead of calling the technology directly?
- [ ] Is wiring done only in the composition root?

## Implementing Adapters

[05-building-block-view/adapters.md](../05-building-block-view/adapters.md)

- [ ] Adapter contains mapping, protocol and error translation only, with no business decisions?
- [ ] Incoming adapter calls an incoming port; outgoing adapter implements outgoing port(s)?
- [ ] Port models live in the core; technology models stay in the adapter?
- [ ] Port is narrow (ideally one method, or a cohesive few)?
- [ ] No transaction handling in the adapter?
- [ ] Incoming adapter authenticates and passes the caller; object-level authorization left to the use case (ARCH-UC-15)?
- [ ] Outgoing adapter stores what its port method promises: no second table synced on save, no business rule, no wall clock, no denormalised copy of versioned facts (ARCH-ADP-14)?

## Code Organization

[05-building-block-view/code-organization.md](../05-building-block-view/code-organization.md)

- [ ] New file placed per ARCH-ORG-01 and ARCH-ORG-02?
- [ ] Access to another bounded context only through its incoming port, from an outgoing adapter of the own context (ARCH-ORG-09)?
- [ ] Class name states the use case / business term?
- [ ] Visibility as narrow as possible?
- [ ] No new dependency that the table above marks ✘?

## Implementing Use Cases

[05-building-block-view/use-cases.md](../05-building-block-view/use-cases.md)

- [ ] New use case → new incoming port + new service + own command/query + own result?
- [ ] Input model immutable and self-validating?
- [ ] Each rule placed per the validation table?
- [ ] Output minimal and not a domain entity?
- [ ] Caller passed in, and object-level authorization done in the use case (ARCH-UC-15)?
- [ ] Errors raised as exceptions of one ARCH-UC-13 category; results only for expected alternative outcomes (ARCH-UC-10)?
- [ ] Domain events raised in `domain` and handed to an outgoing port, not to another use case (ARCH-UC-14)?
- [ ] Transaction boundary on the service, with no remote call inside it (ARCH-UC-11)?
- [ ] Every rule that depends on other rows (uniqueness, closed periods, "at least one", process once) enforced by a constraint, a conditional write or a shared lock, with a concurrency test (ARCH-UC-16)?
- [ ] A refused caller raises the Access denied category (403, security event), not Business rule or a framework exception; an object the caller may not know stays Not found (ARCH-UC-13/15)?
- [ ] A check against state that may not exist yet uses an advisory lock on the business key, tested in both orders (ARCH-UC-16)?
- [ ] Commands that may act for someone else carry owner and caller separately, owner = caller by default (ARCH-UC-17)?
- [ ] Helpers shared within a cut are package-private classes built by each service, not beans (ARCH-UC-18)?
- [ ] Bulk import parsed in the adapter, rows through one use case, all or nothing, per-row report with codes; own transaction timeout, set-based key reads, max-size IT (ARCH-UC-19)?
- [ ] Time read only from the injected clock, business date from the one shared function in the product's zone, long-lived screens roll over at midnight (ARCH-UC-20)?

## Container Images, Frontend Delivery and Runtime Contract

[07-deployment-view/container-runtime.md](../07-deployment-view/container-runtime.md)

- [ ] New deployable or image change: non-root, minimal base pinned by digest, no build tools or secrets in layers, SBOM, labels (REL-IMG-01, REL-RUN-07)?
- [ ] Build method other than Buildpacks: customer platform reason recorded in chapter 7, or an ADR (REL-IMG-02)?
- [ ] Frontend change to serving, routing or caching: deep-link, cache-header and 404 rules kept; previous release's chunks still served (REL-FE-03/04)?
- [ ] Nonce templating tested against a real build's `index.html`, not a stub (REL-FE-03)?
- [ ] BFF image: start fails without the bundle, built image answers `GET /` with `200` `text/html` (REL-FE-06)?
- [ ] Runtime settings: read-only filesystem, resource bounds, heap from the limit, start-up budget covers migrations, grace period above the shutdown budget; values recorded in chapter 7; also for a delivered Compose installation (REL-RUN-*)?
- [ ] Feature needing fonts, AWT, native libraries or locale data: avoided, or exercised against the real image in the smoke tier (REL-RUN-08)?

## Delivery and Release

[07-deployment-view/delivery-and-release.md](../07-deployment-view/delivery-and-release.md)

- [ ] Commit message or pull request title follows Conventional Commits; breaking changes marked with `!` (REL-BR-03)?
- [ ] Migration compatible with the previous release; contract step deferred; lint green or flagged statement justified; lock timeout, lock retry and time budget considered (REL-DB-02..06)?
- [ ] Contract, event or serialisation change: N-1 compatible, expand/contract where breaking (REL-ZD-03)?
- [ ] New flag: read through a port, registered with type and removal date, both states tested (REL-FF-01..03)?
- [ ] Release notes: breaking changes, new configuration and long migrations listed (REL-VER-04)?
- [ ] Pipeline change: image still built once per commit and promoted by digest; version attached without rebuild; approval gate intact; no gate skipped for hotfixes (REL-CD-01/03/07)?
- [ ] New tool, registry, runtime setting or deployment responsibility: delivery platform mapping in chapter 7 updated (REL-CD-06)?
- [ ] No pipeline yet: gates and scans run locally, chapter 7 rows "not applicable" with reason and trigger, interim ADR (REL-CD-08)?

## Repository Layout

[07-deployment-view/repository-layout.md](../07-deployment-view/repository-layout.md)

- [ ] New project or project plan? Decision guide applied and reported (signals, recommendation, consequences, open questions)?
- [ ] Components in top-level folders, each verifiable on its own?
- [ ] Commands run from the component folder; root `.gitignore` lists `node_modules/`, `dist/`, `coverage/`, `.env*.local` (REPO-LAY-07)?
- [ ] Spec change? Frontend regenerated in the same PR, `oasdiff` green or breaking change decided with a rollout plan?
- [ ] New component or path? CI change detection, the pipeline jobs table (REPO-CI-01) and the always-reported merge status updated (security job included)?

## Avoiding N+1 Requests over REST

[08-crosscutting-concepts/api/avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md)

- [ ] Does the feature load a list and then something per item, or chain independent requests?
- [ ] Strategy recommended with tradeoffs and the template filled in?
- [ ] Frontend batching/caching placed in the outgoing adapter?
- [ ] Backend endpoint free of persistence N+1?
- [ ] Data from several ports assembled in the use case ring, one set-based read per port, statement bound asserted (API-N1-08)?
- [ ] Each read limited to the range its result needs; history-long ranges bounded with a snapshot plan (API-N1-09)?
- [ ] Request-count or query-count test added?

## OpenAPI Contracts

[08-crosscutting-concepts/api/openapi-contracts.md](../08-crosscutting-concepts/api/openapi-contracts.md)

- [ ] Endpoint change → spec regenerated and committed in the same change?
- [ ] Breaking? Then new version or explicit decision, including the rollout (REPO-API-02)?
- [ ] `operationId` names the use case; examples present; errors as problem+json?
- [ ] Consumer: client generated, not hand-written; generated types confined to the adapter?
- [ ] Consumer in the same repo: regenerated and adapted in the same pull request as the spec change?
- [ ] N+1 check done ([08-crosscutting-concepts/api/avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md))?
- [ ] Schema names unique across the API; several request media types as content entries of one operation; downloads with a binary schema (API-CON-12/13)?
- [ ] No two paths that differ only in a template name; spec linted in the spec test (API-CON-14)?

## REST Conventions (wire format)

[08-crosscutting-concepts/api/rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md)

- [ ] Decimals and money as strings (`format: decimal`), instants in UTC, enums as `UPPER_SNAKE_CASE` strings (API-REST-01..03)?
- [ ] Errors as problem+json with `code` from the catalogue and `traceId`; status from the table, business rules 409 (API-REST-05..07)? New codes added without breaking the `oasdiff` check (API-REST-07)?
- [ ] Collection paged or bounded in the query; sort and filter parameters allow-listed in the spec (API-REST-08..10)?
- [ ] Concurrent updates and deletes carry a version (`DELETE …?version=`) or `If-Match`, and a successful update answers 200 with the resource or its version, never a bare 204 (API-REST-11)?
- [ ] No `GET` creates or changes data; generated data comes from a migration, job or command (API-REST-15)?
- [ ] Every date, month and period input checked against the product's window, ranges against a maximum span, with an out-of-window slice test (API-REST-16)?
- [ ] A hard bound that cuts data refuses or reports `truncated`; internal "all rows" reads page through (API-REST-08)?
- [ ] Singleton state transitions as `POST …/<singleton>/<verb>` only, verbs listed in the API doc; everything else nouns (API-REST-14)?
- [ ] Removing something: deprecated first, `Deprecation`/`Sunset` headers, consumers migrated (API-REST-12)?

## Enforcing Architecture Boundaries

[08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md](../08-crosscutting-concepts/architecture-enforcement/enforcing-boundaries.md)

- [ ] Do architecture tests exist and run in CI?
- [ ] Did my change require loosening an architecture test? Then stop and raise it, or record an ADR. Don't silently relax the rule.
- [ ] Are new adapter classes as hidden as the language allows?
- [ ] Does every new class or file land in a location the tests allow (ARCH-ORG-01), so no rule silently skips it?

## Configuration and Environments

[08-crosscutting-concepts/configuration/configuration.md](../08-crosscutting-concepts/configuration/configuration.md)

- [ ] New key: does it really differ per environment (CFG-01)? Typed, constrained, documented (CFG-08/10)?
- [ ] No new profile, configuration file or build configuration per environment (CFG-02/04)?
- [ ] No secret in the repository, image, log line or frontend config; held in the `Secret` type (CFG-05/07)?
- [ ] Configuration read only in adapters or the composition root (CFG-09)?
- [ ] Binding test covers valid, invalid and missing values (TEST-CFG-01)? `configuration-keys.yaml` updated (CFG-12, TEST-CFG-04)? Required keys without a deployed default (TEST-CFG-05)?

## Data Protection (GDPR / DSGVO)

[08-crosscutting-concepts/data-protection/data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md)

- [ ] New or changed personal data: `processing-record.md` and `deletion-concept.md` updated, flagged for DPO review (DP-INV-03)?
- [ ] Field needed for a stated purpose; optional processing off by default (DP-MIN-01/03)?
- [ ] Aggregate-only role: groups below the minimum size suppressed or merged, small filters refused, minimum recorded, IT proves no one person can be isolated (DP-MIN-04)?
- [ ] New table: named in the deletion concept or its "no personal data" list; the schema-vs-concept test passes (DP-INV-04)?
- [ ] Retention job and erasure/export cover the new location; tests updated (DP-RET-02, DP-DSR-02, DP-TEST-01)?
- [ ] Export includes soft-deleted records, is never silently truncated, and redacts other people's data (DP-DSR-05)?
- [ ] No personal data in logs, telemetry, URLs, events beyond IDs (DP-TEL-01/02, DP-MIN-02)?
- [ ] Only synthetic data in fixtures and non-production environments (DP-ENV-01)?
- [ ] Demo data loaded through use cases under the `demo` profile only, absent without it (DP-ENV-04)?
- [ ] A deferred retention period is `TBD (DPO)` with an ADR and no real personal data until it is set (DP-RET-01)?
- [ ] New external service: listed with DPA status and location; transfer basis decided (DP-PROC-01/02)?
- [ ] New store for dead letters, inbox or idempotency results: listed in the deletion concept and covered by retention?
- [ ] Missing legal basis or period written as `TBD (DPO)`, not guessed?

## Agent Skills

[08-crosscutting-concepts/development/agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md)

- [ ] Did a skill's advice contradict a doc? Followed the doc and noted the conflict?
- [ ] Added or updated a skill? Lock file, installed files and catalogue updated in the same change, and the diff reviewed?
- [ ] Never edited a file under `.agents/skills/` that belongs to a third-party skill?
- [ ] Added or changed a script or hook? Logic in `.mjs`, `.sh` and `.cmd` launchers present, tested on Linux and Windows (TOOL-SKL-08)?
- [ ] New `baseline-*` hook of a stack? Listed under that stack's `hooks` in `baseline-stacks.json` and registered in `.claude/settings.json` ([declared stacks](../08-crosscutting-concepts/development/agent-skills.md#declared-stacks))?
- [ ] Changed what the sync creates or replaces? The distribution table above updated; nothing else lists it.
- [ ] New skill or stack? Its entry in `baseline-stacks.json` and its `AGENTS.md` lines tagged (TOOL-SKL-09)?
- [ ] Changed a doc's rules? Its section in `docs/baseline/checklists/` updated (TOOL-SKL-13)?
- [ ] Changed a rule doc or a stack page? `npm run docs:rule-index` run, `docs:rule-index:check` and `docs:lint` green (TOOL-SKL-11); new rules start with a self-contained bold headline (TOOL-SKL-12)?
- [ ] Scripted multi-line replacements only on freshly formatted files, failing when a pattern does not match; otherwise the editor tools (TOOL-SKL-14)?
- [ ] Red gate: autofix commands run first, only the rest fixed by hand, no rule loosened (TOOL-SKL-15)?
- [ ] Wrote reading instructions in a skill, hook or `AGENTS.md`? They follow the steps of TOOL-SKL-10 and point to the rule index, not to "every doc a stack page lists"?

## Architecture Documentation (arc42)

[08-crosscutting-concepts/development/architecture-documentation.md](../08-crosscutting-concepts/development/architecture-documentation.md)

- [ ] Did the change add or change a component, adapter, external system, deployment target or quality requirement? Then the matching chapter in `docs/architecture/` is updated in the same change.
- [ ] New decision or shortcut? ADR drafted and linked in chapter 9 (and chapter 11 for shortcuts)?
- [ ] Linked to the baseline instead of copying it?
- [ ] Diagrams as Mermaid in the Markdown file?
- [ ] In the baseline repository: did the change alter architecture, technology or a decision? Then `ARCHITECTURE.md` is updated in the same change, current state only (DOC-ARC-09).
- [ ] Agreed business answers recorded in chapter 8 "Business rules", open assumptions in `open-questions.md` (DOC-ARC-10)?
- [ ] Every mechanism, value or table the product docs name for this change exists in the code, or is marked planned; chapter 5 shows the current state; superseded ADRs marked (DOC-ARC-11)?

## IDE Setup: VS Code and IntelliJ IDEA Ultimate

[08-crosscutting-concepts/development/ide-setup.md](../08-crosscutting-concepts/development/ide-setup.md)

- [ ] Changed formatter/linter config? IDE settings still only reference it?
- [ ] New technology in the stack or new component folder? Re-run `baseline-ide-setup` from the repository root to update plugins and paths.

## Internationalization (i18n)

[08-crosscutting-concepts/i18n/i18n.md](../08-crosscutting-concepts/i18n/i18n.md)

- [ ] Is the product multilingual (ADR, I18N-01)? If not, only I18N-02/03 apply.
- [ ] No UI text in domain, ports, use cases, stores or mappers (I18N-02)?
- [ ] New user-visible string: key, source text and context added; no concatenation or plural logic (I18N-07/08)?
- [ ] No value formatted on the server; wire formats unchanged (I18N-03)?
- [ ] `npm run i18n:check` green; non-source catalogs untouched by hand (TOOL-I18N-02/03)?
- [ ] Translation tool not connected yet: catalogs in the repository with context, agent-written strings marked for review, ADR for the interim (TOOL-I18N-08)?
- [ ] Locale-sensitive code covered in two locales; a language-switch test re-formats; axe and `lang` asserted per locale (TEST-I18N-02/03/07/08)?

## Mapping Between Boundaries

[08-crosscutting-concepts/mapping/mapping-between-boundaries.md](../08-crosscutting-concepts/mapping/mapping-between-boundaries.md)

- [ ] Which boundary am I crossing, and which strategy do the defaults prescribe?
- [ ] Did web or persistence concerns (annotations, ORM-required constructors) just show up in the core? Then upgrade to two-way for that boundary.
- [ ] Is a deviation from the defaults documented?

## Messaging and Event Contracts

[08-crosscutting-concepts/messaging/messaging.md](../08-crosscutting-concepts/messaging/messaging.md)

- [ ] Event named in past tense, business language, on a `<context>.<stream>.v<N>` topic (MSG-EVT)?
- [ ] Envelope fields present; key = aggregate id (MSG-ENV-01, MSG-ORD-01)?
- [ ] Contract change additive, AsyncAPI regenerated and examples updated; breaking → new type version and topic (MSG-CON)?
- [ ] Publishing consistent with the database through the outbox; relay metrics, alert and parking of non-retryable rows (MSG-PUB)? Also for an e-mail or HTTP outbox without a broker: backoff over hours, rows claimed before sending (MSG-PUB-04)?
- [ ] Broker other than Kafka: ADR with the capability mapping, own adapter packages?
- [ ] Consumer idempotent and tested with a duplicate (MSG-IDM)?
- [ ] Failure classification, bounded retries, dead-letter topic owned, alerted and replayable (MSG-ERR, MSG-DLT)?
- [ ] New topic consumed or produced: threat model note for the new data flow (SEC-TM-02), ACLs (SPRING-SEC-28, NEST-SEC-39)?

## Observability and Operability

[08-crosscutting-concepts/observability/observability.md](../08-crosscutting-concepts/observability/observability.md)

- [ ] Probes reach the instance through the serving connector (OBS-19)?
- [ ] New dependency check: in readiness only if the instance is useless without it; never in liveness (OBS-02/03)?
- [ ] New consumer or long-running work: stops within the shutdown budget, and the budget still fits the grace period (OBS-04)?
- [ ] New metric: needed, named, low-cardinality tags with a cardinality test, emitted outside `domain`/`ports` (OBS-07..09)?
- [ ] New outbound call or producer: built from the instrumented client so the trace propagates (OBS-10)?
- [ ] No personal data in tags, span attributes or error reports (OBS-08, OBS-14)?
- [ ] New user-facing journey: SLO and dashboard panel considered (OBS-16/17)?

## File Exports and Generated Documents

[08-crosscutting-concepts/exports/file-exports.md](../08-crosscutting-concepts/exports/file-exports.md)

- [ ] Export classified as for people (localized) or for a machine (one fixed, documented format pinned by a sample-file test) (EXP-01/02)?
- [ ] CSV for Excel in UTF-8 with BOM; people offered `.xlsx` (EXP-03)?
- [ ] Formula prefixes neutralised in CSV and spreadsheet cells, hostile-value test (EXP-04)?
- [ ] XML/FO/SVG/HTML built with a writer or escaping template, never concatenated (EXP-05)?
- [ ] HTML/SVG rendering without network or file access, tested (EXP-06)?
- [ ] File adapter in `adapter/out/file/<format>`, binary media type in the spec, `Content-Disposition`, `no-store` for personal data, bounded read (EXP-07)?
- [ ] No fonts, AWT or native libraries needed from the image, or the feature runs in the smoke tier (EXP-08)?
- [ ] PDFs for people: PDF/UA-1 validated by veraPDF in tests, manual check in the L6 checklist (EXP-09)?
- [ ] Heavy export: data loaded in the transaction, rendered outside it, behind a concurrency limit with `503` + `Retry-After`; maximum-size test, limit and peak in chapter 7 (EXP-10)?
- [ ] New export of personal data or new download endpoint: threat model note (SEC-TM-02)?

## Resilience and Idempotency

[08-crosscutting-concepts/resilience/resilience.md](../08-crosscutting-concepts/resilience/resilience.md)

- [ ] New outbound call: connect and read timeout set explicitly; timeout test (RES-TMO-01/03)?
- [ ] Timeouts fit the ladder: gateway > request budget > transaction > statement; attempts × read + backoff within the budget; ladder recorded in chapter 7 (RES-TMO-04)?
- [ ] No remote call inside the use case's transaction (RES-TX-01)?
- [ ] Retries only for idempotent operations and transient errors, with backoff, jitter and a budget, in one layer (RES-RTY)?
- [ ] Concurrency to the dependency bounded; pool size and wait time set deliberately, pool sum recorded in chapter 7 (RES-CAP-01/02)?
- [ ] New state-changing entry point: idempotency stated; `Idempotency-Key` for retryable `POST`s, stored in the same transaction with a conflict-free insert; remote writes through the outbox or with a derived key (RES-IDM)?
- [ ] Bulk input with a remote call per item: items stored in the transaction, calls made by a job, a rerun repairs the unfinished (RES-JOB-04)?
- [ ] New scheduled job: calls an incoming port; cluster lock or concurrency-safe (RES-JOB-02)? Lock time above batch × worst-case per-item time, items claimed in the database (RES-JOB-03)?
- [ ] Job that acts once per business fact: primary-key claim with `on conflict do nothing`, concurrency test with one winner (RES-JOB-05)?
- [ ] New cache: in the adapter, bounded, TTL, invalidation stated, caller in the key where needed (RES-CCH)?
- [ ] Security-relevant (new outbound call)? Then the threat model note (SEC-TM-02).

## Secure Pipeline

[08-crosscutting-concepts/security/secure-pipeline.md](../08-crosscutting-concepts/security/secure-pipeline.md)

- [ ] New pipeline step: pinned by SHA or digest, minimal permissions?
- [ ] No gate removed, set to advisory, or filtered by path (REPO-CI-03, SEC-REV-02)?
- [ ] New release artifact: SBOM, provenance, scan and deploy-time verification covered (SEC-CI-03/06/07)?
- [ ] Threshold change: made in the gate table, not in a stack rule?
- [ ] New dependency for untrusted input, or large or young: dependency review table in the ADR (SEC-CI-09)?

## Security Requirements and Threat Modelling

[08-crosscutting-concepts/security/security-requirements.md](../08-crosscutting-concepts/security/security-requirements.md)

- [ ] `docs/security/requirements.md` states level, data classification and CRA applicability; does the change keep it true?
- [ ] New entry point, outbound call, role or personal data: threat model in the PR (SEC-TM-02)?
- [ ] Abuse cases covered by tests?
- [ ] Architecture change: `docs/security/threat-model.md` updated?
- [ ] New stored secret, key, token or encrypted field: algorithm, key location and rotation per SEC-CRY-01..05?
- [ ] IdP password and recovery policy at the SEC-CRY-06 defaults (length, block list, throttling, link lifetimes), recorded in chapter 8?

## Security Review

[08-crosscutting-concepts/security/security-review.md](../08-crosscutting-concepts/security/security-review.md)

- [ ] PR template's security section answered when the change touches a listed area?
- [ ] No check weakened, skipped or made advisory; anything unclear raised, not worked around (SEC-REV-02)?
- [ ] Findings cite rule ID and ASVS/Top 10 reference?

## Vulnerability Management, Secrets, Audit Trail and Incidents

[08-crosscutting-concepts/security/vulnerability-management.md](../08-crosscutting-concepts/security/vulnerability-management.md)

- [ ] New finding or suppression: reason, owner, expiry in `docs/security/exceptions.md`?
- [ ] Nothing that looks like a credential in the diff, tests, fixtures or logs?
- [ ] A leaked secret in the conversation or diff: stop and tell the developer; do not just delete it.
- [ ] New security event: written to the audit trail with a pseudonymous id only (SEC-AUD-01/02); audit retention by dropping time partitions with a separate role, not by `DELETE` (SEC-AUD-04)?
- [ ] New export of other people's personal data: audit event with caller, kind, format, period, per person or aggregated, row count, and a test (SEC-AUD-05)?

## Test-Driven Development

[08-crosscutting-concepts/testing/tdd.md](../08-crosscutting-concepts/testing/tdd.md)

- [ ] Did I see the new test fail before implementing?
- [ ] One behavior per cycle; did I refactor while green?
- [ ] Style matches the element table (London for use cases and incoming adapters, Chicago for domain, pure code and outgoing adapters)?
- [ ] Every use case has a unit test, except a frontend use case that only forwards to one port (TEST-ARCH-02)?
- [ ] Only owned contracts mocked; interactions verified only for commands?
- [ ] Expected values independent of the implementation?
- [ ] Test data from builders; clock and ids fixed in the test (TEST-TDD-16)?
- [ ] Fakers only for volume or seed data, seeded, never for asserted values (TEST-TDD-17)?

## Testing by Architecture Element

[08-crosscutting-concepts/testing/testing-by-architecture-element.md](../08-crosscutting-concepts/testing/testing-by-architecture-element.md)

- [ ] Every new domain/application/adapter element has the matching test type?
- [ ] Use case tests verify only the essential interactions?
- [ ] Persistence tests run against the production DB engine?
- [ ] Bug fix comes with a regression test?
- [ ] New persisted enum value or row kind exercised once through the real adapter and migrations (TEST-ARCH-13)?
- [ ] Main path covered by a system test of its component; critical paths also full-stack?

## UI Patterns: Responsive Layout, Screen Readers and Screen States

[08-crosscutting-concepts/ui/ui-patterns.md](../08-crosscutting-concepts/ui/ui-patterns.md)

- [ ] Layout stated for compact, medium and expanded (UI-08); breakpoints are the size classes (UI-01)?
- [ ] CSS for layout, the window-size contract only for structure; same data in every size class (UI-04..06)?
- [ ] Logical properties, `rem`, `dvh`, safe areas, no hover-only function, zoom not blocked (UI-09..12)?
- [ ] Inputs with `type`, `autocomplete`, `inputmode` (UI-13)?
- [ ] Status via visible region or the announcer; route title; route focus only on path changes, not on `replaceUrl` or same-route pagers (UI-15, UI-16)?
- [ ] Snackbars never the only error channel; progress and tables labelled; dialog focus restored when the trigger can vanish (UI-17, UI-18)?
- [ ] Loading, empty and error states from the shared components (UI-19)?
- [ ] Status regions rendered before their text changes; never a status region and the announcer for the same text (UI-15)? Focus moved when an action removes its trigger; refresh after a command keeps the view, also for app-wide state such as a session renewal, and refreshes every derived figure; e2e `toBeFocused` after each dialog close and destructive action (UI-18)?
- [ ] Every form, including dynamic rows (breaks, list items), shows each error as text linked to its field, and a failed submit focuses the first invalid field (A11Y-22)?
- [ ] Commands show a pending state and ignore re-entry (UI-20)? Dirty dialog asks before closing; unchangeable control explained (UI-21)? Route navigation is a `nav` with `aria-current`, not a tab list (UI-22)?
- [ ] Lists announce their result count after a filter or page change (A11Y-20); destructive and bulk actions confirm or can be undone (A11Y-30)?

## Accessibility: WCAG 2.2

[10-quality-requirements/accessibility.md](../10-quality-requirements/accessibility.md)

- [ ] New UI element reachable and operable by keyboard, with visible focus, also in forced colors?
- [ ] Accessible name and role (component test finds it with `getByRole`)?
- [ ] New screen, journey or state added to the inventory (A11Y-27) and covered by an axe scan with the WCAG 2.2 AA tags?
- [ ] Keyboard journey test updated for changed main paths?
- [ ] Contrast and target size hold in all themes and densities?
- [ ] Main screen reflows at 320 px, survives text spacing, works in both orientations; axe runs per viewport?
- [ ] Status message announced (visible status region or announcer), without moving focus?
- [ ] Route title set; focus on the new `h1` when the path changes, also on back/forward, not on query-only changes?
- [ ] Error linked to its field (`aria-invalid`, accessible description)?
- [ ] Session timeout warns and can be extended, counted from the last backend answer and the server's idle timeout; legal or financial submits can be reviewed, confirmed or undone; hover and focus content dismissible; `html lang` set?
- [ ] L6 release checklist run, results recorded; legal applicability recorded (A11Y-26)?
- [ ] No a11y rule disabled or loosened; every exclusion has a ticket and an expiry date?
- [ ] Session expiry warns and can be extended; long-open pages keep their work state on the server (A11Y-29)?
- [ ] Panels with fixed foreground and background colours have a forced-colors variant (A11Y-28)?
- [ ] Charts named, with a table or text carrying the same figures (A11Y-33); value bars as `meter`/`progressbar` with value text and visible status (A11Y-34)?
- [ ] No wrapper repeats the accessible name of the group or landmark inside it (A11Y-35)?
- [ ] No select, date or text control navigates, submits or reloads on change; navigation commits on Enter, blur or a button (A11Y-36)?
- [ ] Same-route pagers and `replaceUrl` navigations keep focus on the control and announce the new period (A11Y-21)? Idle time shared across tabs, remaining time asked from the server before the redirect, extending keeps the page (A11Y-29)?

## Taking Shortcuts Consciously

[11-risks-and-technical-debt/conscious-shortcuts.md](../11-risks-and-technical-debt/conscious-shortcuts.md)

- [ ] Does my change take one of the shortcuts above, and does its "ADR needed?" column say yes?
- [ ] If yes: is there an existing ADR covering it, or did I draft one and flag it for review? Does the ADR name the rule IDs it deviates from (ARCH-SC-08)?
- [ ] Does my change meet a "grown up" criterion that requires removing an existing shortcut?
