# Agent Skills

Agent skills are packaged instructions (a `SKILL.md` plus reference files) that coding agents load when a task matches the skill's description. We use third-party skills for framework knowledge and our own skills to make agents follow this baseline. This doc defines how skills are installed, updated, reviewed and distributed.

## Precedence (default D11)

**The docs in this baseline win over every skill.** Skills provide framework know-how; the docs provide our rules. Each stack doc lists the known conflicts with its skills in a "Skill overrides" table (e.g. [angular/README.md](../../angular/README.md)).

## Layout

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
- **TOOL-SKL-07: Skills are updated deliberately**, at least before each consuming project syncs the baseline: run `skills:check`, `skills:update` and `skills:upstream-diff`, review, and merge in one pull request.
- **TOOL-SKL-08: Scripts and hooks shipped by the baseline or by own skills run on Linux, macOS and Windows.** Logic lives in a Node.js `.mjs` file that uses built-in modules only; it is started through a `.sh` launcher (bash, Git Bash) and a `.cmd` launcher (CMD, PowerShell), and Claude Code hooks call `node` directly. No `jq`, `rsync`, `python3` or GNU-only flags.
  *Why:* our teams develop on Linux and Windows, and Node.js is the only runtime every project already requires.

## Distribution to consuming projects

Projects copy the baseline with `scripts/sync-baseline.sh <project-dir>` (Windows: `scripts\sync-baseline.cmd <project-dir>`). It copies only baseline-owned paths, and it never touches project-owned files such as `docs/adr/` or the project's own skills:

| Baseline path | In the project |
|---|---|
| `docs/{shared,java,spring,typescript,angular}/` | replaced as a whole |
| `AGENTS.md` | the block between `<!-- baseline:start -->` and `<!-- baseline:end -->` is replaced; the rest of the project's `AGENTS.md` stays |
| `CLAUDE.md` | created with `@AGENTS.md` if missing |
| `.agents/skills/<name>` for baseline skills | replaced; skills not from the baseline are kept |
| `.claude/skills/<name>` | symlinks recreated |
| `skills-lock.json` | baseline entries merged in (baseline wins for its own entries) |
| `.claude/hooks/baseline-*` and their entries in `.claude/settings.json` | replaced; hook entries pointing at `.claude/hooks/baseline-*` are replaced, the project's own hooks stay |
| `.gitattributes` | the block between `# baseline:start` and `# baseline:end` is replaced or appended |

Projects don't update baseline skills on their own: they re-sync. That keeps all projects on the reviewed versions.

## Skill catalogue

| Skill | Source | Status | Notes |
|---|---|---|---|
| `angular-developer`, `angular-new-app` | angular/skills | installed | Overrides in [angular/README.md](../../angular/README.md) |
| `accessibility` | addyosmani/web-quality-skills | installed | AAA and test assertions per [wcag.md](../accessibility/wcag.md) |
| `playwright-cli` | microsoft/playwright-cli | installed | Interactive browser control for agents; needs `@playwright/cli` |
| `playwright-best-practices` | currents-dev/playwright-best-practices-skill | installed | Overrides in [typescript/testing.md](../../typescript/testing.md) |
| `vitest` | antfu/skills | installed | Overrides in [typescript/testing.md](../../typescript/testing.md) |
| `orval` | orval-labs/orval | installed | Configuration per [typescript/openapi-clients.md](../../typescript/openapi-clients.md) |
| `baseline-angular` | own | own | Entry point for Angular work |
| `baseline-tdd` | own | own | TDD workflow per [tdd.md](../testing/tdd.md) |
| `angular-material-design` | own, adapted from hamen/material-3-skill (MIT) | own | Material Design 3 concepts mapped to Angular Material |
| `ngrx-signals` | own, adapted from danielsogl/skills (MIT) | own | Signal Store inside the hexagonal frontend |
| `tdd` | mattpocock/skills | rejected | Chicago-only mocking, seam negotiation with the user, no refactor step |
| `wcag-audit-patterns` | wshobson/agents | rejected | Redundant with `accessibility`, weaker WCAG 2.2 coverage |
| `typescript-advanced-types` | wshobson/agents | rejected | Generic knowledge; contains questionable advice |
| `material-3` | hamen/material-3-skill | replaced | Compose-first, `@material/web`; replaced by `angular-material-design` |
| `ngrx-signals` (original) | danielsogl/skills | replaced | Store calls HTTP directly; replaced by our adaptation |

## Agent checklist

- [ ] Did a skill's advice contradict a doc? Followed the doc and noted the conflict?
- [ ] Added or updated a skill? Lock file, installed files and catalogue updated in the same change, and the diff reviewed?
- [ ] Never edited a file under `.agents/skills/` that belongs to a third-party skill?
- [ ] Added or changed a script or hook? Logic in `.mjs`, `.sh` and `.cmd` launchers present, tested on Linux and Windows (TOOL-SKL-08)?

## Sources

`skills` CLI (github.com/vercel-labs/skills), Agent Skills format (agentskills.io).
