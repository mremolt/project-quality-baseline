# Delivery and Release

How a change gets from a branch into production: branching, commit messages, versions, the delivery pipeline, migrations at deploy time, zero-downtime rollouts, rollback and feature flags. Infrastructure (cluster, network, CI system, registry, the concrete environments) is usually the customer's and lives in the product's chapter 7; this doc sets the application-side rules every product follows and names capabilities, not products (REL-CD-06). Images, frontend delivery and the container runtime contract: [container-runtime.md](container-runtime.md). Spring specifics: [spring-delivery.md](spring-delivery.md); NestJS: [nestjs-delivery.md](nestjs-delivery.md); Next.js: [nextjs-delivery.md](nextjs-delivery.md).

**Three version numbers, three owners.** They are independent and never derived from each other:

| Version | Example | Changes when | Rule |
|---|---|---|---|
| API major | `openapi/orders-v2.yaml`, package `v2` | A breaking contract change | API-CON-03/04, ARCH-ORG-03 |
| Release of a deployable | tag `backend/v1.4.0` | Every release of a deployable | REL-VER-01, REPO-CI-05 |
| Schema version | Flyway `V27__…` (NestJS: Kysely migration file) | Every migration | SPRING-DB-02/04, NEST-DB-14/19 |

**Artifact identity (D16).** An image is identified by the commit it was built from and its digest. The release version is a name attached to an image that already exists; it never causes a build.

## Rules

### Branching and commits

- **REL-BR-01: Trunk-based development.** `main` is always releasable. Work happens on short-lived branches that are merged through a pull request within **two working days** (SHOULD); larger work is split or hidden behind a release flag (REL-FF-02). No long-lived `develop` or feature branches.
  *Why:* long-lived branches delay integration, so contract breaks and migration conflicts show up late. REPO-API-02 and SPRING-DB-05/NEST-DB-20 assume every merge can be deployed.
- **REL-BR-02: `main` is protected:** merges only through pull requests with at least one approving review and the always-reported merge status green (REPO-CI-03). No direct pushes, no force pushes, no deletion. The settings are checked configuration (REL-BR-05).
- **REL-BR-03: Pull requests are squash-merged and the squash commit message follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)**: `<type>(<optional scope>): <summary>` with the types `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. A breaking change for consumers or operators carries `!` after the type or a `BREAKING CHANGE:` footer. CI checks the pull request title. Exception: Weblate's `l10n` pull requests are merged with merge commits (TOOL-I18N-02).
  *Why:* the release tooling derives the next version and the changelog from these messages (REL-VER-03), so a wrong type is a wrong release.
- **REL-BR-04: Fixes for a released version are made on `main` first.** If `main` already holds changes that must not ship yet, a release branch `release/<component>/<major>.<minor>` is cut from the release tag and the fix is cherry-picked onto it. Release branches receive only cherry-picked fixes and are deleted when the next minor version ships. Cutting one for stabilisation before a release (TOOL-I18N-05) follows the same rule. A release branch builds its own images through the same pipeline and gates (REL-CD-07).
- **REL-BR-05: Branch protection is checked configuration, and ownership is explicit.** The settings of REL-BR-02 and of release branches are kept as code where the platform allows it (rulesets or repository settings managed as code), or a scheduled job compares them with the expected settings and fails on drift. A `CODEOWNERS` file (or the platform's equivalent) names owners for the pipeline definition, `docs/adr/`, `docs/security/`, migrations and the OpenAPI specs, and their review is required for changes there.
  *Why:* protection that someone can switch off in a settings page without a trace is not a control; the review rules then exist only on paper.

### Versions, changelog and release notes

- **REL-VER-01: Every deployable is versioned `MAJOR.MINOR.PATCH`** and released by a tag in the REPO-CI-05 format (`backend/v1.4.0`). For deployables: MAJOR = consumers or operators must act (a removed API major version, a required new configuration value, an incompatible event schema); MINOR = new behaviour (`feat`); PATCH = fixes only. Pre-releases use SemVer suffixes (`backend/v1.5.0-rc.1`). A frontend embedded in the BFF image is part of the BFF's release (REL-FE-05).
- **REL-VER-02: Libraries and other published packages follow [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) strictly**, derived from the Conventional Commits since the last release. Their public API is what consumers compile against. A library is built from its release tag, because the published package carries its version (SPRING-REL-06, NEST-REL-06); build once (REL-CD-01) applies to deployables.
- **REL-VER-03: The version is set by the release tooling, never by hand.** The release tool keeps a release pull request per deployable that contains only the next version's changelog, derived from the commits that touched the deployable's folders. Merging that pull request through the normal protected flow (REL-BR-02) creates the tag on the merge commit. That commit is built and deployed to `test` like every other commit on `main`; the tag starts the Release stage, which uses the image already built for the tagged commit (REL-CD-01). A product may keep the changelog in the release notes only; then the tool creates the tag on an existing `main` commit and there is no release pull request. Reference tool: release-please (replaceable); its configuration for prefixed tags is per product (see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)).
- **REL-VER-04: Each deployable keeps a `CHANGELOG.md` in its folder** (unless the product chose release notes only, REL-VER-03), grouped by type (features, fixes, breaking changes). The **release record** (the platform's release page, or the handover package of REL-CD-05) adds what operators and users need: version, commit and image digest, breaking changes with migration steps, new or changed configuration, migrations that run long or lock (SPRING-DB-06, NEST-DB-21), deprecated API versions, locales shipped on fallback (TOOL-I18N-05), SBOM and provenance references (SEC-CI-03).
- **REL-VER-05: Every running deployable reports its release version and commit**, so an incident report names exactly what ran. The commit is built in (backend: info endpoint; frontend: a build constant). The release version is injected at deploy time as configuration (backend: SPRING-REL-06, NEST-REL-06; frontend: the runtime configuration served by the BFF, CFG-11; Next.js: NEXT-REL-15); before a release it reads `unreleased`.

### Pipeline and environments

- **REL-CD-01: Build once, promote the same artifact.** The pipeline builds each deployable's image once per commit, tags it with the commit SHA and deploys it by **digest** to every environment. A release attaches its version to that image without a rebuild: an additional registry tag on the same digest (`1.4.0`) and the release record (REL-VER-04). Nothing is rebuilt per environment or per release; environments differ only in configuration supplied at deploy or run time ([configuration.md](../08-crosscutting-concepts/configuration/configuration.md), CFG-02/03). The frontend bundle is the same for all environments and languages and ships inside the BFF image (REL-FE-01), or is its own image when the frontend renders on a server (Next.js, NEXT-D2).
  *Why:* a rebuilt artifact is an untested artifact; the SBOM and provenance (SEC-CI-03) only describe what was really built.
- **REL-CD-02: The standard stages are:**

  | Stage | Trigger | Deploys | Gate to the next stage |
  |---|---|---|---|
  | Commit | Pull request | nothing | The always-reported merge status (REPO-CI-03): component jobs incl. `e2e` for UI components, security job (pipeline jobs table, REPO-CI-01) |
  | Integration | Merge to `main` | builds the images once; `test` automatically | `e2e:smoke` against the image built from this commit (REPO-CI-04), deployment on `test` healthy, image scan reported (SEC-CI-06) |
  | Release | Release tag on a commit that was already built | `staging` (production-like), automatically, same digest | Smoke tests on `staging`, image scan gate (SEC-CI-06), SBOM and signed provenance stored with the artifact (SEC-CI-03; where the customer platform can do neither, at least SBOM and digest in the release record), migration ran on production-like volume |
  | Production | Recorded manual approval (REL-CD-03) | `production`, same digest | — |

  Every deployment verifies the provenance and signature of the digest it deploys (SEC-CI-07), and deployed digests are re-scanned on a schedule (SEC-CI-06). A product may merge `test` and `staging` or add environments; its chapter 7 names them. Every environment is deployed by the pipeline or, where the customer deploys, by the customer's process from the handover package (REL-CD-05); never by hand from a developer machine.
- **REL-CD-03: The production deployment requires an explicit, recorded manual approval enforced by the delivery platform** (for example a protected environment with required reviewers, or a manual deploy step restricted to a group; examples per platform in [repository-layout.md](repository-layout.md#platform-examples)). The approver is not the sole author of the changes being released. Release credentials live only in the deployment job (SEC-CI-02). Where the customer deploys, the customer's change approval takes this place.
- **REL-CD-04: A release is blocked by each of the following:** a red gate from REL-CD-02, an unmet ASVS L1 requirement (SEC-REQ-02), a critical or high finding past its fix time (SEC-VUL-02) without an accepted-risk entry (SEC-VUL-03), or a release-blocking locale that is not complete (TOOL-I18N-05). Gates are never skipped to meet a date (SEC-REV-02).
- **REL-CD-05: Where the customer deploys, each release is delivered as a handover package** instead of a deployment: image references by digest with their provenance (SEC-CI-03, verifiable per SEC-CI-07), the SBOM, the release notes (REL-VER-04), the configuration keys each environment must set and their secret sources (CFG-10), migration notes (variant, expected runtime, locking statements, the pre-deploy command if used, REL-DB-01) and the runtime requirements (probes, termination budget, resources, REL-RUN-*). Our gates up to the Release stage still run in our pipeline. The product's chapter 7 names who deploys which environment and the handover channel.
- **REL-CD-06: Pipeline rules name capabilities; the product records its tools.** CI system, registry, runtime platform, secret store, scanners and the approval mechanism are the customer's or the product's choice. Tools named in the baseline are reference tools (replaceable) or examples. Each product fills in the **delivery platform mapping** in its chapter 7 (template: `docs/architecture/07-deployment-view.md`): SCM host, CI, registry, image build, runtime, secret store and mount mechanism, approval, provenance, scanners, probe and termination settings, who deploys. A capability the platform cannot provide is recorded in chapter 11 with its compensating measure.
- **REL-CD-07: The pipeline is fast enough for roll-forward, and there is only one** (SHOULD for the numbers). Targets: the required pull request status within 15 minutes, a merge on `test` within 30 minutes. A product that misses them records its numbers and the reason in chapter 7. Hotfixes and release-branch fixes go through the same pipeline and gates; there is no fast lane that skips a gate (REL-CD-04).
- **REL-CD-08: A product without a pipeline yet (no SCM host or CI chosen, a local demo installation as deliverable) runs the gates locally and records the gap.** `verify` and the scans of SEC-CI-01 run on the developer machine before each delivery; chapter 7 keeps every pipeline row, filled "not applicable" with the reason and the trigger that brings the pipeline (an SCM host, a first hosted environment), and an ADR states the interim. The PR template and branch protection come with the SCM host.

### Database migrations during deployment

- **REL-DB-01: Migrations run before the new version takes traffic, with a separate DDL role**; the application's own connection has DML rights only (SPRING-SEC-27, NEST-SEC-38). The DDL credentials are used only by the migration. Two variants:
  - **Default: at start-up.** The new version migrates when it starts, before it reports ready (Spring: SPRING-REL-01; NestJS: NEST-REL-01).
  - **Allowed alternative: pre-deploy job.** The **same image** runs once in a migrate-only mode before the rollout starts (Spring: SPRING-REL-07; NestJS: NEST-REL-03). The application instances then hold no DDL credentials and refuse to start when the schema is not current. The product records this choice in its chapter 7; no ADR needed.

  Both variants follow REL-DB-02..06 (compatibility, lock timeout and retry, time budget, failure handling, lint). A separate migration image, a different migration tool or manual SQL in a deployment needs an ADR.
- **REL-DB-02: Every migration is compatible with the previous release still running** (expand/contract, REL-ZD-03; Spring: SPRING-DB-05; NestJS: NEST-DB-20), during the rollout and after a rollback (REL-RB-02). A contract step (drop, rename, `NOT NULL` on an existing column) ships at the earliest one release after the code stopped using the old form.
- **REL-DB-03: Several instances, or a retried job, may start the migration at once.** The migration tool serialises them with a database lock. The others retry for a bounded time and then either find the schema current or fail their start (Flyway: `lockRetryCount`, default 50 retries about one second apart; Spring: SPRING-REL-02; NestJS: NEST-REL-02). The retry window covers the longest expected migration and fits the start-up budget (REL-DB-04). Separately, migrations set a lock timeout on the tables they change (default 5 s, SPRING-REL-02, NEST-DB-16), so DDL that waits for a busy table fails the deployment instead of blocking production traffic behind its lock.
- **REL-DB-04: A migration finishes within its time budget.** At start-up, the migration plus the lock wait of REL-DB-03 fit the platform's start-up budget (REL-RUN-04). A pre-deploy job has an explicit timeout. Data migrations over large tables do not run in either; they run as an idempotent, batched background job of the new version, and the contract step follows in a later release.
- **REL-DB-05: A failed migration stops the rollout.** The new instance never becomes ready (or the pre-deploy job fails and the rollout does not start), the old version keeps serving, and the fix ships as a new migration (SPRING-DB-04, NEST-DB-19). Non-transactional migrations (`CREATE INDEX CONCURRENTLY`, SPRING-DB-06, NEST-DB-21) can leave partial state behind (an invalid index); their pull request states how to clean it up.
- **REL-DB-06: Migrations are linted in the pull request** for statements that break REL-DB-02 or lock busy tables: drops, renames, type changes, `NOT NULL` on existing columns, index creation that is not concurrent on an existing table, missing lock timeout. Reference tool for PostgreSQL: Squawk (replaceable). A flagged statement that is a deliberate contract step carries an inline reason naming the release that stopped using the old form.
  *Why:* REL-DB-02 is a MUST that reviewers miss easily; a rename looks harmless in a diff.

### Zero-downtime rollouts

- **REL-ZD-01: Production runs at least two instances of every server-side deployable (backends, BFFs, Next.js apps) and deploys rolling** (SHOULD), so one instance always serves. A product running a single instance documents the accepted downtime in chapter 7.
- **REL-ZD-02: An instance receives traffic only when ready and stops receiving it before it stops.** Readiness: OBS-03. Graceful shutdown and its budget: OBS-04 (Spring: SPRING-OBS-04; NestJS: NEST-OBS-04; Next.js: NEXT-OBS-12, NEXT-REL-12). Termination settings of the platform: REL-RUN-06.
- **REL-ZD-03: Version N works with version N-1 on every boundary** for at least one release: the database schema (REL-DB-02), REST consumers including browsers still running the old frontend (REPO-API-02), events in both directions (old producers, new consumers and the reverse), and anything serialised across instances (sessions, cache entries). A breaking change uses **expand/contract**: add the new form, move every user to it, remove the old form in a later release.
- **REL-ZD-04: Browsers that loaded the previous release keep working during and after a rollout.** `index.html` is never cached; the previous release's hashed assets stay loadable; a lazy chunk that fails to load leads to one full reload, not a broken screen. Default mechanism with the bundle in the BFF image: REL-FE-04.

### Rollback

- **REL-RB-01: Roll forward by default.** A defect is fixed on `main` and released through the same pipeline (REL-BR-04, REL-CD-07).
- **REL-RB-02: Rolling back the application is always possible for one release**: redeploy the previous artifact by its digest. This works because of REL-DB-02 and REL-ZD-03; nothing else needs to be undone.
- **REL-RB-03: The schema is never rolled back.** No down-migrations: the previous version runs against the new schema. Restoring a database backup is disaster recovery, not a rollback, and needs a decision by the product owner (data written since the backup is lost, REL-RB-05).
- **REL-RB-04: The rollback is rehearsed** before the first production go-live and then at least once a year (SHOULD for the yearly repeat): after a release that contains a migration, redeploy the previous digest on `staging` and run the smoke tests. The result goes into the release record.
  *Why:* REL-RB-02 holds only if REL-DB-02 and REL-ZD-03 were really followed; a drill finds the miss before production does.
- **REL-RB-05: The product's chapter 7 states RPO and RTO for each data store and who backs up and tests restores** (usually the platform operator). A restore is rehearsed before the first go-live, and the measured restore time is compared with the RTO.

### Feature flags

- **REL-FF-01: A feature flag is read through an outgoing port** (e.g. `FeatureFlags` in `ports.out`, frontend: an injection token) with an adapter for the flag source (configuration by default, a flag service such as an OpenFeature provider through an ADR). The domain never reads flags. The decision is made in the application ring or by wiring a different implementation in the composition root.
  *Why:* the flag source is infrastructure like any other (ARCH-DEP-*); the use case stays testable with a stubbed port.
- **REL-FF-02: Every flag is registered with name, type, owner, creation date and removal date** in one place per component (an enum or a flags file). Types: *release* flags hide unfinished work and are removed at the latest **90 days** after creation (SHOULD); *ops* flags (kill switches) may stay and are reviewed yearly. A scheduled CI job (not the pull request build) fails and opens an issue when a release flag is past its removal date.
- **REL-FF-03: Both states of every flag are tested** at the test type of the element that reads it (one test per state, not all combinations). The default when the flag source is unavailable is the established behaviour (off).
- **REL-FF-04: A flag is never an access control.** Hiding a UI element does not authorize anything; the backend checks permissions (SPRING-SEC-01/02, NEST-SEC-01/02) regardless of flags. Flag values are not secrets and may reach the browser.

## Anti-patterns

- A `develop` branch, or feature branches that live for weeks and merge with conflicts in migrations and specs.
- Rebuilding the image for production "with the production profile", rebuilding it from the release tag, or one frontend build per environment.
- A version number baked into the image at build time, so the image on `test` cannot become the release.
- A migration that renames a column the running version still reads, because "the new version is deployed in the same minute".
- `DROP` in the same release that stops using the column, so a rollback breaks.
- Down-migrations kept "for rollbacks" that nobody ever tested.
- A pre-deploy migration job that runs a different image or a hand-written SQL script.
- `if (flags.isEnabled("x"))` inside an entity, or a release flag still in the code a year later.
- Deploying to production from a developer machine, a hotfix pipeline that skips gates, or skipping the approval because "it's only a fix".
- Branch protection switched off "for a moment" in the settings page.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Delivery and Release".*
