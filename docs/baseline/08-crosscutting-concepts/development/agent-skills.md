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
  build-rule-index.*       ← generates docs/baseline/rule-index/ (TOOL-SKL-11)
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
| `npm run docs:rule-index` | Regenerates the rule index in `docs/baseline/rule-index/` from the docs (TOOL-SKL-11) |
| `npm run docs:rule-index:check` | Fails (exit code 1) when the rule index is out of date |
| `npm run docs:lint` | Checks the docs against TOOL-SKL-10..13 (cut-off headlines, checklists or sources inside a doc, pointer lines, reading instructions); exit code 1 on errors |
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
- **TOOL-SKL-09: A product loads only the skills and stack docs of its declared stacks** ([declared stacks](#declared-stacks)). Every own entry skill routes only to its own stack chain (for example `baseline-nestjs` never points to Spring or frontend docs), and new stack docs are written so that a project of that stack never needs another stack's docs.
  *Why:* every installed skill's description sits in each session's context, and every doc an agent reads costs tokens; another stack's rules are noise at best and wrong advice at worst.

## Reading the docs on a token budget

The docs of one stack chain run to 50,000–100,000 words, more than an agent can keep in context next to the code. The generated rule index in [`docs/baseline/rule-index/`](../../rule-index/) lists every rule ID with its headline, about a tenth of the full text: `shared.md` for the shared docs and one file per stack. A stack's file leaves out the docs that are already in the files of the stacks it requires. The agent checklists and the sources sit in their own files as well, so a doc opened for its rules carries only rules. In the baseline repository, the Claude Code agent `baseline-doc-compactor` (`.claude/agents/`, never synced) runs `docs:lint`, fixes its findings and reviews the docs changed since its last run for lossless compaction; run it periodically or after a batch of doc changes.

- **TOOL-SKL-10: Agents read the docs in steps and never load every doc of a stack at once.** (1) At the start of a task: the rule index of the shared rules and of every declared stack, the hexagonal architecture, the code organisation and the defaults D1–D17. (2) The full docs of the topics the task touches, chosen from the "Read by task" table in `AGENTS.md` or the entry skill's task table. (3) Before implementing against a rule from a doc not yet read: that rule's full bullet, found by its ID. (4) Before finishing: the agent checklist sections of the docs it used (TOOL-SKL-13). `AGENTS.md`, the entry skills and the reminder hooks give this order and never say "read the docs a stack page lists".
  *Why:* an agent that loads a whole stack chain up front runs out of context before it writes code, and drops rules it read early. The index keeps every rule visible, so the agent knows when to open a doc.
- **TOOL-SKL-11: The rule index is generated, never edited by hand.** `npm run docs:rule-index` rewrites it from the docs, and a change to a rule doc or a stack page regenerates it in the same change. `npm run docs:rule-index:check` fails when it is out of date; run it before every commit.
- **TOOL-SKL-12: Every rule starts with a bold headline that states the rule on its own as one sentence:** `- **PREFIX-AREA-NN: Headline.** Details …`. The index shows only the headline: the bold part, plus a short reference in parentheses when a colon, semicolon or full stop follows it (`**Headline** (REF-01): details`); otherwise the bold part is read on to the end of its sentence. Values, examples, exceptions and the *Why* follow after it. A rule whose first sentence is longer than about 30 words is cut in the index; split it or shorten the headline.
- **TOOL-SKL-13: Agent checklists and sources live outside the rule docs.** Each doc's checklist is a section titled like the doc in [`docs/baseline/checklists/<scope>.md`](../../checklists/) (`shared` or the stack in the doc's file name), its sources a section in [`docs/baseline/sources.md`](../../sources.md); the doc ends with one line that points to both. A change to a doc's rules updates its checklist section in the same change. Agents read only the sections of the docs they used, once, before finishing a task.
  *Why:* the checklists restate the rules and the sources serve people; kept in the docs, they cost every agent that opens a doc for its rules.

## Editing files

- **TOOL-SKL-14: Agents edit code with the editor tools, or run the formatter before a scripted multi-line replacement.** Prettier, Spotless and `ng lint --fix` rewrite line breaks, quotes and import order, so a `sed`, Python or Node replacement written against the text as the agent last saw it no longer matches and changes nothing, without an error. A scripted replacement runs only on freshly formatted files, and the script fails when a pattern does not match (count the replacements, or assert before writing).
  *Why:* in the first test drive five scripted replacements silently did not apply after a formatter run, and each cost a failed build to find.
- **TOOL-SKL-15: On a red gate, agents run the autofix commands first and hand-fix only what remains; they never loosen a rule to get green.** Autofix: `npm run format` and `npm run lint:fix` (`prettier --write`, `eslint --fix`; Angular `ng lint --fix`), `./mvnw spotless:apply` (Java). Then re-run the failing stage and fix the remaining findings by hand. The entry skills' "Finish" step says so (SEC-REV-02 for the "never loosen" part).
  *Why:* editing fixable findings by hand costs a whole read of the report and is reformatted afterwards anyway.

## Distribution to consuming projects

Products get the baseline by running the sync from the baseline repository against the product's repository root (never a component folder, REPO-LAY-06):

| OS | Command |
|---|---|
| Linux, macOS, Git Bash | `scripts/sync-baseline.sh <project-dir> [--force] [--host <host>]` |
| Windows CMD, PowerShell | `scripts\sync-baseline.cmd <project-dir> [--force] [--host <host>]` |

`--force` runs despite uncommitted changes in the project (otherwise the sync stops, so its result is a reviewable diff). A project without commits has nothing to diff against: the check is skipped there, and a folder that isn't a git repository yet gets a manual step to run `git init`. `--host` is `github`, `gitlab`, `azure` or `bitbucket` and decides where the pull request template goes; without it the host is detected from the `origin` remote, and if that fails the template goes to `docs/pull-request-template.md` with a manual step to re-run with `--host` once the project has one. The sync stops without changing anything if `AGENTS.md` or `.gitattributes` has a start marker without its end marker. The required Node.js version is the baseline's `package.json` `engines.node`; the sync checks it.

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
| `docs/accessibility.md` | project | created once from `templates/accessibility.md` if missing and a TypeScript frontend stack is declared (A11Y-19/26/27) |
| Pull request template, from `templates/pull-request/` | project | created once if missing, at the host's path: GitHub `.github/pull_request_template.md`, GitLab `.gitlab/merge_request_templates/Default.md`, Azure DevOps `.azuredevops/pull_request_template.md`, Bitbucket `docs/pull-request-template.md` (Bitbucket reads no template file; paste it into the repository's default description); no host known: `docs/pull-request-template.md` as the checklist until there is one (SEC-REV-01, API-N1-02) |
| `frontend/public/.well-known/security.txt` | project | created once if missing and a `frontend/` folder exists (SEC-INC-02); other web apps copy `templates/well-known/security.txt` into their static folder |
| `AGENTS.md` | shared | the block between `<!-- baseline:start` and `<!-- baseline:end -->` is replaced, keeping only the lines for the declared stacks; the project notes below it stay. Created if missing; without markers the block is prepended |
| `CLAUDE.md` | project | created with `@AGENTS.md` if missing; if it exists without that line, a manual step is printed |
| `.gitattributes` | shared | the block between `# baseline:start` and `# baseline:end` is replaced, or appended if missing |
| `.baseline.json` | project | created once if missing, from the detected stacks ([declared stacks](#declared-stacks)); afterwards only `syncedCommit` is updated to the synced baseline commit |
| Project copies of templates (`templates/`, `skills/<synced skill>/templates/`) | project | never touched; every file changed in the baseline since the `syncedCommit` of the last sync is printed as a manual step, so the project merges it into its copy |
| `.agents/skills/<name>` for baseline skills | baseline | the shared skills and those of the declared stacks are replaced (never the baseline-only skills, see [declared stacks](#declared-stacks)); skills the baseline dropped, or that belong only to stacks the project does not declare, are removed (tracked in `.agents/skills/.baseline-skills`); the project's own skills stay |
| `.claude/skills/<name>` | baseline | symlinks recreated (on Windows without symlink rights: junctions, with a manual step) |
| `skills-lock.json` | shared | baseline entries of the copied skills merged in (baseline wins for its own entries); entries of dropped baseline skills, and of skills that belong only to undeclared stacks, removed; the project's entries stay |
| `.claude/hooks/baseline-*` and their entries in `.claude/settings.json` | baseline | replaced by the hooks of the declared stacks (and hooks no stack claims); other `baseline-*` hooks and their entries removed; the project's own hooks and settings stay |

Everything else in the project (component folders, other docs, the project's skills) is never touched. `docs/baseline/` is always copied whole, so links between docs keep working; agents read only the stacks the project declares. Projects don't update baseline skills on their own: they re-sync. That keeps all projects on the reviewed versions.

### Declared stacks

A product lists its stacks in `.baseline.json` at the repository root (project-owned, committed):

```json
{ "stacks": ["nestjs", "angular"] }
```

Known stacks and what they bring are defined in the baseline's `baseline-stacks.json`: `java`, `spring` (requires `java`), `node`, `nestjs` (requires `node`), `typescript` (frontends), `angular` (requires `typescript`), `react` (requires `typescript`; React SPA and the base of Next.js), `nextjs` (requires `react`). Shared skills (`baseline-tdd`, `baseline-security`, `baseline-i18n`, `baseline-ide-setup`) are always copied. Skills listed under `baselineOnly` (`baseline-codebase-review`) work on the baseline repository itself and are never copied. The sync copies only the skills and Claude Code hooks of the declared stacks and the stacks they require, and keeps only the `AGENTS.md` lines tagged for them (`<!-- stack:<name> -->` in the baseline's `AGENTS.md`; the tag is removed in the product). Without `.baseline.json` the sync detects the stacks from the component folders and writes the file; if it detects nothing, it copies everything and prints a manual step. An unknown stack name stops the sync. Adding a stack later: edit `.baseline.json` and re-sync.

Each entry stack owns a reminder hook (`hooks` in `baseline-stacks.json`): `baseline-spring-reminder`, `baseline-nestjs-reminder`, `baseline-angular-reminder`, `baseline-react-reminder`, `baseline-nextjs-reminder`. Before an agent's first edit of a file inside a component of that stack (detected like the sync does: the stack's marker file in the root or in a first-level component folder), the hook reminds it once per session to load the stack's entry skill. A Next.js component gets only the Next.js reminder, even though `nextjs` requires `react`. The hooks never block.

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
| `baseline-nestjs` | own | own | Entry point for Node/NestJS work, with project templates validated in a template build |
| `baseline-react` | own | own | Entry point for React work, with React SPA templates validated in a template build |
| `baseline-nextjs` | own | own | Entry point for Next.js work, with templates validated in a template build |
| `vercel-react-best-practices` | vercel-labs/agent-skills | installed | React and Next.js performance rules. Server-side examples fetch or query the database directly; overrides in [stacks/react.md](../../stacks/react.md#skill-overrides) and [stacks/nextjs.md](../../stacks/nextjs.md#skill-overrides) |
| `tanstack-query-best-practices` | DeckardGer/tanstack-agent-skills | installed | `queryFn` calls use cases, not the API; no `retry: 3`, no persisted query cache. Overrides in [ui/react-state-management.md](../ui/react-state-management.md#skill-overrides) |
| `material-ui-theming`, `material-ui-styling` | mui/material-ui (official) | installed | Theme tokens and styling approach; CSP nonce, self-hosted fonts and contrast overrides in [ui/react-mui.md](../ui/react-mui.md#skill-overrides) |
| `material-ui-nextjs` | mui/material-ui (official) | not installed | Install with the first Next.js product (`next/font` and Tailwind sections need overrides) |
| Redux Toolkit skills (`build-slices-and-selectors`, `handle-side-effects`, `adopt-rtk-query`, …) | reduxjs/redux-toolkit (official) | not installed | Names contain `/` (installed folder name does not match the frontmatter name); thunks fetch directly; RTK Query as default. Candidate for an own adapted skill (TOOL-SKL-05) |
| TanStack Router skills | TanStack/router | not installed | File-based routing by default; ours is code-based |
| `vercel-composition-patterns` | vercel-labs/agent-skills | not installed | Generic; overlaps with RTK view state and use cases |
| Next.js Cache Components / PPR skills (`next-cache-components-*`, `next-partial-prefetching-*`, `next-bundle-optimizer`) | vercel/next.js | not installed | Contradict dynamic rendering by default (NEXT-D3); run `npx @next/codemod@latest` and install further skills on the fly |
| `next-best-practices`, `next-upgrade`, `next-cache-components` | vercel-labs/next-skills | rejected | Repository archived; knowledge moved into Next.js itself |
| `web-design-guidelines` | vercel-labs/agent-skills | rejected | Overlaps `accessibility`; update steps run `gh api` and `curl` (TOOL-SKL-03) |
| `next-dev-loop` | vercel/next.js | rejected | Needs a global unpinned `agent-browser`; `playwright-cli` covers it |
| `material-ui-tailwind`, `mui` (softaworks), `tanstack-query` (tanstack-skills), `redux-toolkit` (mindrally), community Next.js skills (wshobson, sickn33, mohamed-hossam1), React Testing Library skills | various | rejected | Tailwind, superseded by official skills, `retry: 3` defaults, RTK Query first, server components that fetch or query the database directly, or too thin |
| MUI MCP (`@mui/mcp`) | mui | not installed | A runtime npm package with network access, not a skill; needs a tool review first |
| `baseline-security` | own | own | Security rules by task, review checklist, ASVS/Top 10 mapping |
| `baseline-i18n` | own | own | Multilingual products: keys, catalogs, formatting, Weblate workflow, per-locale tests |
| `baseline-tdd` | own | own | TDD workflow per [08-crosscutting-concepts/testing/tdd.md](../testing/tdd.md) |
| `baseline-codebase-review` | own | own, baseline repository only | Reviews another codebase independently and against the baseline, turns the gaps into baseline changes, syncs the baseline into the target and leaves a refactoring report there |
| `angular-material-design` | own, adapted from hamen/material-3-skill (MIT) | own | Material Design 3 concepts mapped to Angular Material |
| `ngrx-signals` | own, adapted from danielsogl/skills (MIT) | own | Signal Store inside the hexagonal frontend |
| `angular-i18n` (oguzhan18/angular-ecosystem-skills), `angular-best-practices-transloco` (alfredoperez), `i18n-frontend` (danieldxd), `i18n-expert` (daymade), `internationalization-i18n` (mindrally), `i18n-sync` (affaan-m/ecc) | various | rejected | Build-time only or React/i18next-specific, generic, contradict our architecture (class-free advice, translating in the core), or run third-party audit scripts; replaced by `baseline-i18n` |
| `tdd` | mattpocock/skills | rejected | Chicago-only mocking, seam negotiation with the user, no refactor step |
| `wcag-audit-patterns` | wshobson/agents | rejected | Redundant with `accessibility`, weaker WCAG 2.2 coverage |
| `typescript-advanced-types` | wshobson/agents | rejected | Generic knowledge; contains questionable advice |
| `springboot-patterns`, `springboot-tdd`, `springboot-verification`, `springboot-security` | affaan-m/ecc | rejected | Entity-centric layering, `@MockBean`, 80% coverage target, custom error bodies; superseded by the awesome-copilot skills above |
| `angular-security` | oguzhan18/angular-ecosystem-skills | rejected | Non-existent Angular APIs, `bypassSecurityTrustUrl` on arbitrary input, bearer-token interceptor against SPRING-SEC-08/NEST-SEC-12 |
| `springboot-security` jabrena/plinth variants, `spring-security-configuration` (amplicode) | various | rejected | Overlap with `spring-security`, Maven command conflicts, third-party MCP dependency |
| `security-review` | getsentry/skills | rejected | Broad tool grant, no stack fit |
| `owasp-security`, `security-and-hardening` | agamm, addyosmani | not installed | Generic; `baseline-security` routes to our rules instead (one generic security skill would overlap in triggers) |
| `java-springboot` | github/awesome-copilot | rejected | Package-by-feature advice; thin next to our docs |
| `create-spring-boot-java-project` | github/awesome-copilot | rejected | Its own project layout; `baseline-spring` templates replace it |
| Hexagonal / clean-architecture skills (affaan-m/ecc, jabrena/plinth, giuseppe-trisciuoglio/developer-kit, …) | various | rejected | The architecture is defined in our docs; a second layout in a skill is the conflict TOOL-SKL-05 describes |
| `spring-boot-4-migration` | github/awesome-copilot | not installed | Only for an explicit Boot 3 → 4 migration; install temporarily then |
| NestJS skills (community collections) | various | not evaluated | No skill adopted yet; any candidate is reviewed against [stacks/nestjs.md](../../stacks/nestjs.md#skill-overrides) first (TOOL-SKL-03/05) |
| `material-3` | hamen/material-3-skill | replaced | Compose-first, `@material/web`; replaced by `angular-material-design` |
| `ngrx-signals` (original) | danielsogl/skills | replaced | Store calls HTTP directly; replaced by our adaptation |

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Agent Skills".*
