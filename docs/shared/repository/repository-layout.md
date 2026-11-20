# Repository Layout

How a product's code is split into git repositories, how components sit in a shared repo, and what that means for tooling and CI. Default D12: **one repository per product**. Backend and frontend live side by side in component folders. Separate repositories are the exception, chosen deliberately with the decision guide below.

## Default layout (D12)

```
<product>/                              ← git root, opened as-is in the IDE
  AGENTS.md, CLAUDE.md                  ← baseline (synced once, at the root)
  .agents/skills/, .claude/skills/
  docs/
    shared/, java/, spring/, …          ← baseline docs
    adr/                                ← the product's ADRs, for all components
  .editorconfig, .gitignore
  .vscode/, .idea/                      ← shared IDE settings for all components (TOOL-IDE-07)
  .github/workflows/ or .gitlab-ci.yml  ← one pipeline definition for the repo
  backend/                              ← Spring Boot: mvnw, pom.xml, src/
    openapi/orders-v1.yaml              ← committed spec (API-CON-03)
  frontend/                             ← Angular: package.json, angular.json, orval.config.ts, src/
```

Stack docs show paths relative to the component folder: `src/features/…` in the TypeScript docs means `frontend/src/features/…` here.

## Rules

### Choosing the layout

- **REPO-LAY-01: A product's backend and the frontends built for it live in one repository** (default D12), each in its own top-level component folder. Deviating needs an ADR that names the signals from the decision guide.
  *Why:* a contract change (controller, spec, generated client, adapter, tests) is one reviewable pull request. Breakage shows up in the CI run of the change that causes it. Reviewers and agents can check N+1 usage (API-CON-06) with both sides in view. The baseline, ADRs and agent setup exist once.
- **REPO-LAY-02: Every new project and every project plan is checked against the [decision guide](#decision-guide-one-or-several-repositories)** before the repositories are created. The agent lists the signals it found and gives a recommendation. The team decides.

### Component folders

- **REPO-LAY-03: One deployable per component folder, named by its role**: `backend/`, `frontend/`. With several of one kind, use `backend-<name>/` and `frontend-<name>/` (e.g. `frontend-admin/`). Each component builds, tests and runs on its own from its folder (`./mvnw verify`, `npm run verify`).
- **REPO-LAY-04: No build orchestrator across components.** No root aggregator POM, no Nx/Turborepo/Gradle composite spanning Java and TypeScript. The CI pipeline is the only place that coordinates components.
  *Why:* two or three components don't need a task graph. Each stack keeps its standard tooling, docs and skills.
- **REPO-LAY-05: Repo-wide files live at the root, component files in the component.** Root: baseline, `docs/adr/`, `.editorconfig`, `.gitignore`, IDE settings, CI definition, git hooks setup. Component: build files, lockfiles, formatter and linter configs, `openapi/`, Dockerfile.
- **REPO-LAY-06: The baseline is synced into the repository root**, never into a component folder (`scripts/sync-baseline.sh <product-dir>`, Windows: `scripts\sync-baseline.cmd <product-dir>`). The project notes below the `AGENTS.md` end marker name the components and their folders, so agents know where to run commands.

### Contract between components

- **REPO-API-01: A frontend in the same repository generates its client directly from the backend's committed spec** (`frontend/orval.config.ts` → `../backend/openapi/orders-v1.yaml`). The commit pins the spec, so no copy is needed (API-CON-08).
- **REPO-API-02: One commit is not one deployment.** API-CON-04 still applies: `oasdiff` runs, and a breaking change needs a new major version or an explicit decision. That decision must cover the rollout. Browsers keep running the old frontend after the backend deploys, and the components may deploy in either order. If the old frontend must keep working, use expand/contract (add the new field or endpoint, migrate the frontend, remove the old one in a later release).

### Tooling in component folders

- **REPO-TOOL-01: The IDE opens the repository root.** Shared settings live there and point into the components (TOOL-IDE-07). IntelliJ imports `backend/pom.xml` as a Maven project and uses `frontend/node_modules` for TypeScript, ESLint and Prettier. VS Code needs `typescript.tsdk` to point into the frontend folder. The `baseline-ide-setup` skill detects components in first-level folders and writes these paths.
- **REPO-TOOL-02: Git hooks, if used, are installed from the component that owns the tooling and work from the git root.** Hooks run with the repo root as working directory. With husky in the frontend: `"prepare": "cd .. && husky frontend/.husky"` in `frontend/package.json`, and every hook starts with `cd frontend`. Hooks only speed up feedback; CI runs the same checks (TS-TOOL-09).
- **REPO-TOOL-03: Agents run stack commands from the component folder** (`cd backend && ./mvnw …`, `cd frontend && npm run …`), and stack rules apply only to their component.

### CI

- **REPO-CI-01: Each component has its own CI job that runs only when it is affected.** The job runs in the component folder and calls the component's standard verify command (`./mvnw verify`, `npm run verify`, TS-TOOL-10). Caches are keyed on the component's lockfile or build file (`frontend/package-lock.json`, `backend/pom.xml`).
- **REPO-CI-02: Contract and shared files trigger every affected component.**

  | Changed path | Runs |
  |---|---|
  | `backend/**` | backend |
  | `backend/openapi/**` | backend **and** every frontend generating from it |
  | `frontend/**` | frontend |
  | CI definition, `.editorconfig`, root tooling | all components |
  | `docs/**` only | nothing (or a docs lint job) |

- **REPO-CI-03: Required checks must not depend on path filters.** A skipped workflow never reports a status, so a required check filtered by path blocks the merge forever. Use one workflow with a change-detection job (e.g. `dorny/paths-filter` on GitHub, `rules: changes:` on GitLab), component jobs that depend on it, and one final job that always runs, fails if any component job failed, and is the only required check.
- **REPO-CI-04: The `e2e:smoke` tier runs against a backend built from the same commit** ([typescript/testing.md](../../typescript/testing.md), NG-TEST-08), e.g. the backend image started with Docker Compose or Testcontainers in the pipeline. It runs on the main branch and before releases, and on pull requests that touch the spec.
- **REPO-CI-05: Components that deploy separately are versioned separately**, with tags prefixed by component (`backend/v1.4.0`, `frontend/v2.1.0`). Components that always deploy together share one version tag.

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
- Separate deployment of frontend and backend: separate jobs and tags (REPO-CI-05).

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
- Required CI checks filtered by path that block merges of docs-only changes.
- A frontend in the same repo keeping a stale copy of the backend spec, or fetching it from a running backend.
- A breaking API change merged without a new version because "the frontend is updated in the same PR", while browsers still run the old frontend.
- The baseline synced into `frontend/` and `backend/` separately, so there are two diverging copies.

## Agent checklist

- [ ] New project or project plan? Decision guide applied and reported (signals, recommendation, consequences, open questions)?
- [ ] Components in top-level folders, each verifiable on its own?
- [ ] Commands run from the component folder?
- [ ] Spec change? Frontend regenerated in the same PR, `oasdiff` green or breaking change decided with a rollout plan?
- [ ] New component or path? CI change detection and the always-running final check updated?

## Sources

GitHub Actions docs: path filters and skipped required checks (docs.github.com, "Troubleshooting required status checks"); dorny/paths-filter; GitLab CI `rules:changes`. husky docs, "Project not in git root" (typicode.github.io/husky). Parallel change / expand-contract: Danilo Sato, *ParallelChange* (martinfowler.com). Conway's law as the reason ownership signals (S2, S9) dominate.
