# Repository Layout

How a product's code is split into git repositories, how components sit in a shared repo, and what that means for tooling and CI. Default D12: **one repository per product**. Backend and frontend live side by side in component folders. Separate repositories are the exception, chosen deliberately with the decision guide below.

## Default layout (D12)

What the sync creates, replaces and never touches: [agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md#distribution-to-consuming-projects).

```
<product>/                              ← git root, opened as-is in the IDE
  AGENTS.md, CLAUDE.md                  ← baseline (synced once, at the root)
  .agents/skills/, .claude/skills/
  docs/
    baseline/                           ← baseline docs (arc42 reference architecture, synced)
    architecture/                       ← the product's arc42 documentation (DOC-ARC-01)
    adr/                                ← the product's ADRs, for all components
    security/                           ← requirements, threat model, exceptions, incident runbook
    data-protection/                    ← processing record, deletion concept
  SECURITY.md                           ← how to report a vulnerability (SEC-INC-02)
  .editorconfig, .gitignore
  .baseline.json                        ← the stacks this product uses; the sync and agents load only these (TOOL-SKL, agent-skills.md)
  .vscode/, .idea/                      ← shared IDE settings for all components (TOOL-IDE-07)
  CODEOWNERS (or the host's location)   ← owners of pipeline, ADRs, security docs, migrations, specs (REL-BR-05)
  <pipeline definition>                 ← one pipeline for the repo, at the CI system's path
  <pull request template>               ← PR checklist (SEC-REV-01, API-N1-02), at the host's path
  backend/                              ← Spring Boot: mvnw, pom.xml, compose.yaml, configuration-keys.yaml, src/
                                          (NestJS: package.json, package-lock.json, .nvmrc, compose.yaml, configuration-keys.yaml, src/)
    openapi/orders-v1.yaml              ← committed spec (API-CON-03)
  frontend/                             ← Angular: package.json, angular.json, orval.config.ts, src/; bundle ships in the BFF image (REL-FE-01)
                                          (React SPA: package.json, vite.config.ts, orval.config.ts, src/, bundle in the BFF image;
                                           Next.js: package.json, next.config.ts, orval.config.ts, Dockerfile, src/, its own image, NEXT-D2)
    public/.well-known/security.txt     ← served with the SPA (SEC-INC-02)
```

Stack docs show paths relative to the component folder: `src/features/…` in the TypeScript docs means `frontend/src/features/…` here, and in the Node docs `backend/src/features/…`.

## Rules

### Choosing the layout

- **REPO-LAY-01: A product's backend and the frontends built for it live in one repository** (default D12), each in its own top-level component folder. Deviating needs an ADR that names the signals from the decision guide.
  *Why:* a contract change (controller, spec, generated client, adapter, tests) is one reviewable pull request. Breakage shows up in the CI run of the change that causes it. Reviewers and agents can check N+1 usage (API-CON-06) with both sides in view. The baseline, ADRs and agent setup exist once.
- **REPO-LAY-02: Every new project and every project plan is checked against the [decision guide](#decision-guide-one-or-several-repositories)** before the repositories are created. The agent lists the signals it found and gives a recommendation. The team decides.

### Component folders

- **REPO-LAY-03: One component per folder, named by its role**: `backend/`, `frontend/`. With several of one kind, use `backend-<name>/` and `frontend-<name>/` (e.g. `frontend-admin/`, `backend-bff/`). Each component builds, tests and runs on its own from its folder (`./mvnw verify`, `npm run verify`). A backend component is a deployable image; a frontend component delivers a bundle that ships inside the BFF image (REL-FE-01), unless its stack renders on a server and is itself the BFF (a Next.js `frontend/` is a deployable image, NEXT-D2).
- **REPO-LAY-04: No build orchestrator across components.** No root aggregator POM, no Nx/Turborepo/Gradle composite spanning Java and TypeScript. The CI pipeline is the only place that coordinates components.
  *Why:* two or three components don't need a task graph. Each stack keeps its standard tooling, docs and skills.
- **REPO-LAY-05: Repo-wide files live at the root, component files in the component.** Root: baseline, `docs/architecture/`, `docs/adr/`, `docs/security/`, `docs/data-protection/`, `SECURITY.md`, the PR template, `.editorconfig`, `.gitignore`, IDE settings, CI definition, git hooks setup. `CODEOWNERS`. Component: build files and wrappers (`mvnw`, `.mvn/`), lockfiles, formatter and linter configs, `openapi/`, `compose.yaml` for the component's local dependencies, `configuration-keys.yaml` (CFG-12), and the image build definition if the product has one (REL-IMG-02).
- **REPO-LAY-06: The baseline is synced into the repository root**, never into a component folder (command and options: [agent-skills.md](../08-crosscutting-concepts/development/agent-skills.md#distribution-to-consuming-projects)). The project notes below the `AGENTS.md` end marker name the components and their folders, so agents know where to run commands.
- **REPO-LAY-07: The root `.gitignore` also ignores tool output** (`node_modules/`, `dist/`, `coverage/`, `.env*.local`), next to the IDE block of TOOL-IDE-03; each component keeps its own `.gitignore` from the template. Stack commands run from the component folder (REPO-TOOL-03); the root entries catch the stray run from the repository root, which otherwise leaves a tool cache (`node_modules/.vite/…`) that a later `git add .` commits.
  *Why:* one test run from the wrong folder put a Vitest cache under a root `node_modules/` into history.

### Contract between components

- **REPO-API-01: A frontend in the same repository generates its client directly from the backend's committed spec** (`frontend/orval.config.ts` → `../backend/openapi/orders-v1.yaml`). The commit pins the spec, so no copy is needed (API-CON-08).
- **REPO-API-02: One commit is not one deployment.** API-CON-04 still applies: `oasdiff` runs, and a breaking change needs a new major version or an explicit decision. That decision must cover the rollout: browsers keep running the old frontend after the new version deploys (REL-ZD-03, REL-FE-04), and separately deployed consumers may deploy in either order. Breaking changes use expand/contract (REL-ZD-03).

### Tooling in component folders

- **REPO-TOOL-02: Git hooks, if used, are installed from the component that owns the tooling and work from the git root.** Hooks run with the repo root as working directory. With husky in the frontend: `"prepare": "cd .. && husky frontend/.husky"` in `frontend/package.json`, and every hook starts with `cd frontend`. Hooks only speed up feedback; CI runs the same checks (TS-TOOL-09). With `ignore-scripts=true` (TS-TOOL-11) npm does not run `prepare` on install, so developers run `npm run prepare` once.
- **REPO-TOOL-03: Agents run stack commands from the component folder** (`cd backend && ./mvnw …` or `npm run …`, `cd frontend && npm run …`). Stack rules apply only to their component.

### CI

- **REPO-CI-01: The pipeline runs the jobs in this table.** Component jobs run in the component folder (REPO-TOOL-03) and only when the component is affected (REPO-CI-02). `verify` is the component's local gate: build, static checks and the tests that need no deployed system (TS-TOOL-10, JAVA-TOOL-20, NODE-TOOL-07). E2E tiers and security scans are separate jobs. Caches are keyed on the component's lockfile or build file (`frontend/package-lock.json`, `backend/pom.xml` or `backend/package-lock.json`).

  | Job | Command or content | Trigger | Required for merge |
  |---|---|---|---|
  | Change detection | platform mechanism (REPO-CI-03) | every pull request and push to `main` | feeds the others |
  | Commit message | pull request title check (REL-BR-03) | every pull request | yes |
  | Backend verify | `./mvnw verify` (Spring) or `npm run verify` (NestJS) in `backend/` | backend affected | yes, when it runs |
  | Frontend verify | `npm run verify` in `frontend/` | frontend affected | yes, when it runs |
  | Frontend E2E (stubbed) | `npm run e2e` in `frontend/` (TS-TEST-10) | frontend with UI affected | yes, when it runs |
  | Security | dependency scan, secret scan, SAST (SEC-CI-01) | every pull request and push to `main`, no path filter | yes |
  | Migration lint | REL-DB-06 | migrations changed | yes, when it runs |
  | Image build | image with SBOM (REL-IMG-01/02), frontend bundle embedded in the BFF image (REL-FE-02); a Next.js frontend builds its own image (NEXT-D2) | push to `main` and release branches; pull requests that need `e2e:smoke` | via the jobs that use it |
  | E2E smoke | `npm run e2e:smoke` against the image of this commit (REPO-CI-04, SPRING-DEV-10, NEST-DEV-12, NEXT-REL-21) | push to `main`, before a release, pull requests that touch the spec | yes, when it runs |
  | Image scan | gate table in [secure-pipeline.md](../08-crosscutting-concepts/security/secure-pipeline.md) | after the image build (report); Release stage (gate) | release gate (REL-CD-02) |
  | Merge status | aggregates every job above (REPO-CI-03) | always | **the only required check** |
  | Deploy | REL-CD-02 stages | push to `main`, release tag, approval | — |
  | Scheduled | `npm run e2e:nightly` (TS-TEST-18), DAST (SEC-CI-04), image re-scan, release-flag expiry (REL-FF-02), branch-protection drift (REL-BR-05), dependency updates (TS-TOOL-15) | schedule | no; a failure opens an issue |

  A product without a frontend or without migrations drops those rows; a product adds rows for its own checks. The pipeline definition follows SEC-CI-02.
- **REPO-CI-02: Contract and shared files trigger every affected component.**

  | Changed path | Runs |
  |---|---|
  | `backend/**` | backend |
  | `backend/openapi/**` | backend **and** every frontend generating from it |
  | `frontend/**` | frontend, and the BFF image build on `main` (a Next.js frontend: its own image build) |
  | CI definition, `.editorconfig`, root tooling | all components |
  | `docs/**` only | nothing (or a docs lint job) |

- **REPO-CI-03: The merge gate is one always-reported status.** A required check that a path filter skips either never reports and blocks the merge, or reports as skipped and lets a broken change through, depending on the platform. So: one pipeline with a change-detection step, component jobs that depend on it, and one final job that always runs, fails if any job it aggregates failed, and is the only required status. How each platform does this: [platform examples](#platform-examples).
- **REPO-CI-04: The `e2e:smoke` tier runs against a backend built from the same commit** ([08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md), NG-TEST-08): the image, with the frontend bundle embedded (a Next.js frontend: its own image next to the backend's, NEXT-REL-21), started with Docker Compose or Testcontainers in the pipeline (SPRING-DEV-10, NEST-DEV-12). It runs on the main branch and before releases, and on pull requests that touch the spec.
- **REPO-CI-05: Each release unit is versioned separately**, with tags prefixed by its component folder (`backend/v1.4.0`, `backend-admin/v2.1.0`). A frontend embedded in the BFF image has no tag of its own; it is released with the BFF (REL-FE-05). A frontend that is its own image (Next.js) is its own release unit (`frontend/v…`). Components that always deploy together share one version tag.
### Platform examples

Examples, not requirements (REL-CD-06). The product records what it uses in the delivery platform mapping of its chapter 7.

| Capability | GitHub Actions | GitLab CI | Jenkins | Azure DevOps |
|---|---|---|---|---|
| Change detection (REPO-CI-03) | a change-detection step such as `dorny/paths-filter`, pinned by SHA | `rules: changes:` on jobs inside one pipeline | `when { changeset … }` in a declarative pipeline | a script step that compares with the target branch; path filters only on the trigger of the whole pipeline |
| Always-reported merge status (REPO-CI-03) | a final job with `if: always()` as the only required status check | "Pipelines must succeed" on the whole merge request pipeline | the build status the multibranch pipeline reports to the SCM | one build-validation branch policy on the pipeline |
| Recorded manual approval (REL-CD-03) | environment with required reviewers | protected environment with deployment approvals, or a manual job on a protected environment | `input` step with a restricted `submitter` | environment approvals and checks |
| Pull request template (sync `--host`) | `.github/pull_request_template.md` | `.gitlab/merge_request_templates/Default.md` | the SCM host's mechanism | `.azuredevops/pull_request_template.md` |

## Decision guide: one or several repositories

Agents apply this guide to every project plan, tender, architecture sketch or "new project" request (REPO-LAY-02). Go through the plan, quote the parts that match a signal, and give a recommendation.

### Signals for separate repositories

A **strong** signal on its own justifies a separate repo for the component it affects. **Medium** signals justify one when they add up or are confirmed by the team.

| # | Signal | Strength | Look for in the plan |
|---|---|---|---|
| S1 | The API has consumers outside this product: other teams' services, a separately built mobile app, partners, a public API | strong | "API for partners", "other systems will use", "public API", mobile app by another team |
| S2 | Different owners or access rules: another company, agency or vendor builds one part, or some people may not see one part's code | strong | subcontractor, agency, "customer's IT builds the backend", NDA, need-to-know, separate contracts per part |
| S3 | Compliance or certification separates one component's lifecycle (validated releases, audited change process, separate security zone) | strong | medical device software, banking/insurance regulation, ISO/IEC audits for one part only, "certified backend" |
| S4 | A component is shared by several products (a backend serving several products' frontends, a UI library or shell used across apps) | strong | "platform", "reused by", "shared service", design system for several apps |
| S5 | Components must live on different hosting or CI platforms that can't share a pipeline (customer's on-prem GitLab vs our cloud CI) | strong | "source code delivered into the customer's repository", air-gapped environments |
| S6 | Only one part will be open-sourced or handed over to the customer | strong | "the frontend becomes open source", "the backend's code is handed over at the end" |
| S7 | Clearly different release cadences, contractually or organisationally fixed (backend quarterly, frontend weekly) | medium | release trains, change advisory boards for one part |
| S8 | Clearly different lifespans (one part is a prototype or a short-lived campaign, the other long-term) | medium | "MVP frontend, will be replaced", "campaign site" |
| S9 | Many independently deployed backend services owned by different teams | medium | microservices with team-per-service. Each team's service plus the frontend parts it owns still go together. |

### Not enough on their own

These come up often but are handled in a single repo with this doc's rules:

- Frontend and backend are written by different people in the same team.
- Different languages or build tools.
- "CI would be slower": path filters (REPO-CI-01/02).
- "The repository gets big": two components aren't big. Look at S9 instead.
- Wanting to deploy frontend and backend separately: by default the frontend ships inside the BFF image (REL-FE-01); another topology is an ADR in the same repository, not a reason for a second one.

### Mixed setups

Signals usually affect one component, not the whole product. Split only that component off. Example: the product repo holds the backend and web frontend, while the partner API's consumers, or a mobile app built by an agency, live in their own repositories and get the spec as a pinned copy (API-CON-08).

### What the agent reports

1. **Signals found**: each with its ID, the quoted passage from the plan, and which component it affects.
2. **Recommendation**: single repository (D12), or which components go into separate repositories and why.
3. **Consequences**: for each separate repository, how it gets the spec (pinned copy, API-CON-08, TS-API-08), how its full-stack E2E tests find a matching backend version, and which syncs of the baseline it needs.
4. **Open questions**: signals the plan doesn't settle ("Will the mobile app be built by our team?").
5. **Next step**: for a deviation from D12, a draft ADR in `docs/adr/` (D6).

The team decides. The agent doesn't create repositories before that decision.

## Anti-patterns

- Splitting frontend and backend into two repositories "because that's how it's always done", without a signal from the guide.
- A root `pom.xml` or Nx workspace that wraps the Angular app as a Maven module or the backend as an Nx project.
- Required CI checks filtered by path that block merges of docs-only changes, or let them through unchecked.
- A frontend in the same repo keeping a stale copy of the backend spec, or fetching it from a running backend.
- A breaking API change merged without a new version because "the frontend is updated in the same PR", while browsers still run the old frontend.
- The baseline synced into `frontend/` and `backend/` separately, so there are two diverging copies.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Repository Layout".*
