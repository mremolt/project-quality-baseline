# Agent Skills

Agent skills are packaged instructions (a `SKILL.md` plus reference files) that coding agents load when a task matches the skill's description. We use third-party skills for framework knowledge and our own skills to make agents follow this baseline. This doc defines how skills are installed, updated, reviewed and distributed.

## Precedence (default D11)

**The docs in this baseline win over every skill.** Skills provide framework know-how; the docs provide our rules. Each stack doc lists the known conflicts with its skills in a "Skill overrides" table (e.g. [stacks/angular.md](../../stacks/angular.md)).

## Layout

*Baseline repository only.* A product repository has `.agents/skills/`, `.claude/skills/` and `skills-lock.json` from the sync, but no `skills/` folder, no `package.json` scripts and no `scripts/` of the baseline.

```
skills/                    ← our own skills (source of truth, edited here)
.agents/skills/<name>/     ← installed skills, canonical copy for all agents
.claude/skills/<name>      ← symlinks for Claude Code
skills-lock.json           ← source, commit and content hash of every third-party skill
package.json               ← pinned `skills` CLI and the scripts below
scripts/
  skills-upstream-diff.*   ← upstream changes of skills we adapted
  sync-baseline.*          ← copies the baseline into a consuming project
```

Every script is a Node.js file (`.mjs`, built-in modules only) with two launchers next to it: `.sh` for Linux, macOS and Git Bash, `.cmd` for Windows CMD and PowerShell. Put new logic in the `.mjs` file, never in a launcher, so it behaves the same on every OS. `.gitattributes` pins the launchers' line endings (`.sh` LF, `.cmd` CRLF).

## Commands

*Baseline repository only.* Products don't run these; they re-sync (see [distribution](#distribution-to-consuming-projects)).

| Command | What it does |
|---|---|
| `npm run skills:check` | Lists third-party skills with upstream updates or local changes (exit code 1 if any) |
| `npm run skills:update` | Updates all third-party project skills and moves their pinned commits in `skills-lock.json` |
| `npm run skills:restore` | Reinstalls exactly what `skills-lock.json` records (no updates) |
| `npm run skills:link-own` | Installs our own skills from `skills/` into `.agents/skills` (as copies) and links them into `.claude/skills`. **Re-run after every edit in `skills/`.** |
| `npm run skills:upstream-diff` | For own skills adapted from third-party skills: shows upstream changes since the recorded commit |
| `npx skills add <owner/repo> --skill <name> -a universal -a claude-code -y` | Adds a new third-party skill (then record it in the catalogue below) |

## Rules

- **TOOL-SKL-01: Docs win over skills.** When a skill contradicts a doc, follow the doc and, if the conflict is new, add it to the stack's "Skill overrides" table.
- **TOOL-SKL-02: Third-party skills are installed only through the `skills` CLI, pinned in `skills-lock.json`, and committed** (`.agents/skills`, `.claude/skills`, lock file).
  *Why:* every agent and every developer gets the same instructions, and changes show up as diffs.
- **TOOL-SKL-03: Every new skill and every update is reviewed like a dependency.** Skills run with the agent's full permissions. Read the diff and look for: shell commands or URLs the agent would execute or fetch, instructions that override safety or our docs, and claims that contradict our rules.
- **TOOL-SKL-04: Installed third-party skills are never edited in place.** `skills:check` reports local changes, and the next update would overwrite them. Record conflicts in the override table instead.
- **TOOL-SKL-05: A skill whose core contradicts our architecture is not installed.** If its knowledge is valuable, we adapt it into an own skill in `skills/` (license permitting), keep the license notice, and record the origin in the frontmatter (`metadata.upstream-repo`, `upstream-path`, `upstream-commit`), so `skills:upstream-diff` can show later improvements.
- **TOOL-SKL-06: Own skills cite rule IDs instead of restating rules.** The rule text lives only in the docs.
- **TOOL-SKL-07: Skills are updated deliberately** in the baseline repository, at least before each consuming project syncs the baseline: run `skills:check`, `skills:update` and `skills:upstream-diff`, review, and merge in one pull request.
- **TOOL-SKL-08: Scripts and hooks shipped by the baseline or by own skills run on Linux, macOS and Windows.** Logic lives in a Node.js `.mjs` file that uses built-in modules only; it is started through a `.sh` launcher (bash, Git Bash) and a `.cmd` launcher (CMD, PowerShell), and Claude Code hooks call `node` directly. No `jq`, `rsync`, `python3` or GNU-only flags.
  *Why:* our teams develop on Linux and Windows, and Node.js is the only runtime every project already requires.

## Distribution to consuming projects

Products get the baseline by running the sync from the baseline repository against the product's repository root (never a component folder, REPO-LAY-06):

| OS | Command |
|---|---|
| Linux, macOS, Git Bash | `scripts/sync-baseline.sh <project-dir> [--force] [--host <host>]` |
| Windows CMD, PowerShell | `scripts\sync-baseline.cmd <project-dir> [--force] [--host <host>]` |

`--force` runs despite uncommitted changes in the project (otherwise the sync stops, so its result is a reviewable diff). `--host` is `github`, `gitlab`, `azure` or `bitbucket` and decides where the pull request template goes; without it the host is detected from the `origin` remote, and if that fails the template is skipped with a manual step. The sync stops without changing anything if `AGENTS.md` or `.gitattributes` has a start marker without its end marker. The required Node.js version is the baseline's `package.json` `engines.node`; the sync checks it.

**This table is the one list of what the sync does.** Other docs and the script header point here.

| In the project | Ownership | What the sync does |
|---|---|---|
| `docs/baseline/` | baseline | replaced as a whole |
| `docs/{shared,java,spring,typescript,angular}/` (pre-arc42 layout) | baseline, legacy | the files the baseline once shipped there are deleted; a folder is removed only if nothing else is left in it, otherwise a manual step names it |
| `docs/architecture/` | project | created from `templates/arc42/` only if the folder does not exist (DOC-ARC-01) |
| `docs/adr/0000-template.md` | project | created once if missing (ARCH-SC-03) |
| `docs/security/{requirements,threat-model,exceptions,incident-runbook}.md` | project | each created once if missing (SEC-REQ-01, SEC-TM-01, SEC-VUL-03, SEC-INC-02) |
| `docs/data-protection/{processing-record,deletion-concept}.md` | project | each created once if missing (DP-INV-01/02) |
| `SECURITY.md` | project | created once if missing (SEC-INC-02) |
| Pull request template, from `templates/pull-request/` | project | created once if missing, at the host's path: GitHub `.github/pull_request_template.md`, GitLab `.gitlab/merge_request_templates/Default.md`, Azure DevOps `.azuredevops/pull_request_template.md`, Bitbucket `docs/pull-request-template.md` (Bitbucket reads no template file; paste it into the repository's default description) (SEC-REV-01, API-N1-02) |
| `frontend/public/.well-known/security.txt` | project | created once if missing and a `frontend/` folder exists (SEC-INC-02); other web apps copy `templates/well-known/security.txt` into their static folder |
| `AGENTS.md` | shared | the block between `<!-- baseline:start` and `<!-- baseline:end -->` is replaced; the project notes below it stay. Created if missing; without markers the block is prepended |
| `CLAUDE.md` | project | created with `@AGENTS.md` if missing; if it exists without that line, a manual step is printed |
| `.gitattributes` | shared | the block between `# baseline:start` and `# baseline:end` is replaced, or appended if missing |
| `.agents/skills/<name>` for baseline skills | baseline | replaced; skills the baseline dropped are removed (tracked in `.agents/skills/.baseline-skills`); the project's own skills stay |
| `.claude/skills/<name>` | baseline | symlinks recreated (on Windows without symlink rights: junctions, with a manual step) |
| `skills-lock.json` | shared | baseline entries merged in (baseline wins for its own entries); entries of dropped baseline skills removed; the project's entries stay |
| `.claude/hooks/baseline-*` and their entries in `.claude/settings.json` | baseline | replaced; the project's own hooks and settings stay |

Everything else in the project (component folders, other docs, the project's skills) is never touched. Projects don't update baseline skills on their own: they re-sync. That keeps all projects on the reviewed versions.

## Skill catalogue

*Baseline repository only.* The record of what was installed, adapted and rejected, and why; products read it but don't change it.

| Skill | Source | Status | Notes |
|---|---|---|---|
| `angular-developer`, `angular-new-app` | angular/skills | installed | Overrides in [stacks/angular.md](../../stacks/angular.md) |
| `accessibility` | addyosmani/web-quality-skills | installed | AAA and test assertions per [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md) |
| `playwright-cli` | microsoft/playwright-cli | installed | Interactive browser control for agents; needs `@playwright/cli` |
| `playwright-best-practices` | currents-dev/playwright-best-practices-skill | installed | Overrides in [08-crosscutting-concepts/testing/typescript.md](../testing/typescript.md) and [testing/typescript-e2e.md](../testing/typescript-e2e.md) |
| `vitest` | antfu/skills | installed | Overrides in [08-crosscutting-concepts/testing/typescript.md](../testing/typescript.md) |
| `orval` | orval-labs/orval | installed | Configuration per [08-crosscutting-concepts/api/typescript-openapi-clients.md](../api/typescript-openapi-clients.md) |
| `spring-boot-testing`, `spring-security`, `spring-observability`, `java-hibernate-jpa` | github/awesome-copilot | installed | Boot 4-aware know-how. Overrides in [stacks/spring.md](../../stacks/spring.md#skill-overrides) |
| `baseline-angular` | own | own | Entry point for Angular work |
| `baseline-spring` | own | own | Entry point for Java/Spring work, with project templates |
| `baseline-security` | own | own | Security rules by task, review checklist, ASVS/Top 10 mapping |
| `baseline-i18n` | own | own | Multilingual products: keys, catalogs, formatting, Weblate workflow, per-locale tests |
| `baseline-tdd` | own | own | TDD workflow per [08-crosscutting-concepts/testing/tdd.md](../testing/tdd.md) |
| `angular-material-design` | own, adapted from hamen/material-3-skill (MIT) | own | Material Design 3 concepts mapped to Angular Material |
| `ngrx-signals` | own, adapted from danielsogl/skills (MIT) | own | Signal Store inside the hexagonal frontend |
| `angular-i18n` (oguzhan18/angular-ecosystem-skills), `angular-best-practices-transloco` (alfredoperez), `i18n-frontend` (danieldxd), `i18n-expert` (daymade), `internationalization-i18n` (mindrally), `i18n-sync` (affaan-m/ecc) | various | rejected | Build-time only or React/i18next-specific, generic, contradict our architecture (class-free advice, translating in the core), or run third-party audit scripts; replaced by `baseline-i18n` |
| `tdd` | mattpocock/skills | rejected | Chicago-only mocking, seam negotiation with the user, no refactor step |
| `wcag-audit-patterns` | wshobson/agents | rejected | Redundant with `accessibility`, weaker WCAG 2.2 coverage |
| `typescript-advanced-types` | wshobson/agents | rejected | Generic knowledge; contains questionable advice |
| `springboot-patterns`, `springboot-tdd`, `springboot-verification`, `springboot-security` | affaan-m/ecc | rejected | Entity-centric layering, `@MockBean`, 80% coverage target, custom error bodies; superseded by the awesome-copilot skills above |
| `angular-security` | oguzhan18/angular-ecosystem-skills | rejected | Non-existent Angular APIs, `bypassSecurityTrustUrl` on arbitrary input, bearer-token interceptor against SPRING-SEC-08 |
| `springboot-security` jabrena/plinth variants, `spring-security-configuration` (amplicode) | various | rejected | Overlap with `spring-security`, Maven command conflicts, third-party MCP dependency |
| `security-review` | getsentry/skills | rejected | Broad tool grant, no stack fit |
| `owasp-security`, `security-and-hardening` | agamm, addyosmani | not installed | Generic; `baseline-security` routes to our rules instead (one generic security skill would overlap in triggers) |
| `java-springboot` | github/awesome-copilot | rejected | Package-by-feature advice; thin next to our docs |
| `create-spring-boot-java-project` | github/awesome-copilot | rejected | Its own project layout; `baseline-spring` templates replace it |
| Hexagonal / clean-architecture skills (affaan-m/ecc, jabrena/plinth, giuseppe-trisciuoglio/developer-kit, …) | various | rejected | The architecture is defined in our docs; a second layout in a skill is the conflict TOOL-SKL-05 describes |
| `spring-boot-4-migration` | github/awesome-copilot | not installed | Only for an explicit Boot 3 → 4 migration; install temporarily then |
| `material-3` | hamen/material-3-skill | replaced | Compose-first, `@material/web`; replaced by `angular-material-design` |
| `ngrx-signals` (original) | danielsogl/skills | replaced | Store calls HTTP directly; replaced by our adaptation |

## Agent checklist

- [ ] Did a skill's advice contradict a doc? Followed the doc and noted the conflict?
- [ ] Added or updated a skill? Lock file, installed files and catalogue updated in the same change, and the diff reviewed?
- [ ] Never edited a file under `.agents/skills/` that belongs to a third-party skill?
- [ ] Added or changed a script or hook? Logic in `.mjs`, `.sh` and `.cmd` launchers present, tested on Linux and Windows (TOOL-SKL-08)?
- [ ] Changed what the sync creates or replaces? The distribution table above updated; nothing else lists it.

## Sources

`skills` CLI (github.com/vercel-labs/skills), Agent Skills format (agentskills.io).
