# Project Quality Baseline

The shared rules for how we structure, build and test software, plus the agent skills and tooling that make coding agents (Claude Code, Codex, Copilot, …) follow them. Projects don't depend on this repository at build time: they **copy** it in with a sync script and commit the result.

- Summary for human readers (architecture, technologies, decisions): [ARCHITECTURE.md](ARCHITECTURE.md)
- Rules for humans and agents: [docs/baseline/](docs/baseline/README.md), an arc42 reference architecture; start with its [README](docs/baseline/README.md)
- Entry point for agents: [AGENTS.md](AGENTS.md) (Claude Code reads it through [CLAUDE.md](CLAUDE.md))

## Prerequisites

Works on Linux, macOS and Windows. All scripts are Node.js; there is nothing else to install (no `bash`, `jq`, `rsync` or Python).

| Tool | Version | Needed for |
|---|---|---|
| [Node.js](https://nodejs.org/) (includes npm) | **22.20 or newer** (LTS recommended; `engines.node` in `package.json`) | all scripts, the `skills` CLI, the Claude Code hook. Products' frontend components additionally need npm 11.10 or newer (TS-TOOL-14); Node 22 bundles npm 10 |
| [Git](https://git-scm.com/) (Windows: Git for Windows) | any recent | cloning, `sync-baseline` (uncommitted-changes check), `skills:upstream-diff` |
| [Claude Code](https://claude.com/claude-code) | optional | runs the hook in `.claude/settings.json`; other agents read `AGENTS.md` and `.agents/skills` |

Check with `node --version` and `git --version`.

### Windows: symlinks

`.claude/skills/*` are symbolic links into `.agents/skills/`. Git on Windows only creates them as real links when symlinks are allowed. Otherwise it checks them out as small text files and Claude Code doesn't find the skills.

1. Enable **Developer Mode** (Settings > System > For developers), or run your shell as administrator.
2. `git config --global core.symlinks true`
3. Clone the repository, or, if it's already cloned, delete the `.claude\skills` folder and run `git checkout -- .claude/skills`.

The same applies to every project that has synced the baseline.

## Setup

```bash
git clone <this-repo> project-quality-baseline
cd project-quality-baseline
npm ci
```

## Bringing the baseline into a project

Run the sync from this repository, pointing it at the project's repository root (never a component folder like `frontend/`, REPO-LAY-06). Commit or stash the project's changes first, so the sync shows up as a reviewable diff.

| | Command |
|---|---|
| Linux, macOS, Git Bash | `scripts/sync-baseline.sh ../my-project` |
| Windows CMD, PowerShell | `scripts\sync-baseline.cmd ..\my-project` |
| any OS | `npm run baseline:sync -- ../my-project` |

Options: `--force` runs it despite uncommitted changes; `--host github|gitlab|azure|bitbucket` picks where the pull request template goes (default: detected from the `origin` remote). The sync replaces `docs/baseline/`, the managed block in `AGENTS.md`, the skills and the Claude Code hooks, and creates the project-owned files the rules require from `templates/` once, if they are missing. It never overwrites project-owned files. The complete list: [agent-skills.md](docs/baseline/08-crosscutting-concepts/development/agent-skills.md#distribution-to-consuming-projects).

Then, in the project:

1. Set up the IDEs: ask the agent to run the `baseline-ide-setup` skill, or run it yourself from the project root:
   - Linux/macOS/Git Bash: `.agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh .`
   - Windows: `.agents\skills\baseline-ide-setup\scripts\apply-ide-config.cmd .`
2. Fill in the created templates: `docs/security/requirements.md`, `docs/data-protection/` (with the DPO), `SECURITY.md`, `security.txt` (contact, expiry), the incident runbook's contacts.
3. Review `git diff`, then commit.

To update a project later, pull this repository and run the sync again. Projects don't update baseline skills on their own.

## Repository layout

```
ARCHITECTURE.md         summary of the baseline for human readers, kept current (DOC-ARC-09); not synced to projects
docs/baseline/          the baseline as arc42 reference architecture: chapters 01-12, stacks/ index pages
templates/              project-owned files the sync creates once if missing:
  arc42/                  → docs/architecture/
  adr/, security/         → docs/adr/0000-template.md, docs/security/*.md
  data-protection/        → docs/data-protection/*.md
  SECURITY.md, pull-request/, well-known/  → SECURITY.md, PR template (path per `--host`), frontend/public/.well-known/security.txt
skills/                 our own agent skills (edit here)
.agents/skills/         installed skills, the copy agents read (generated, committed)
.claude/skills/         symlinks for Claude Code
.claude/hooks/          Claude Code hooks shipped to projects (baseline-*)
scripts/                maintenance and sync scripts (.mjs + .sh/.cmd launchers)
skills-lock.json        pinned third-party skills
```

## Maintaining the baseline

| Task | Command |
|---|---|
| Check third-party skills for updates or local changes | `npm run skills:check` |
| Update third-party skills (moves pins in `skills-lock.json`) | `npm run skills:update` |
| Reinstall exactly what the lock file records | `npm run skills:restore` |
| Install our own skills after editing `skills/` (**always re-run**) | `npm run skills:link-own` |
| Show upstream changes for skills we adapted | `npm run skills:upstream-diff` |

Rules for adding, reviewing and updating skills: [08-crosscutting-concepts/development/agent-skills.md](docs/baseline/08-crosscutting-concepts/development/agent-skills.md).

### Writing scripts

Every script must work on Linux and Windows (TOOL-SKL-08):

- Logic goes into a `.mjs` file that uses Node.js built-in modules only.
- Next to it, add two launchers that only call `node`: `<name>.sh` (`exec node "$(dirname "$0")/<name>.mjs" "$@"`) and `<name>.cmd` (`@echo off`, then `node "%~dp0<name>.mjs" %*`). Copy an existing pair from `scripts/`.
- Claude Code hooks call `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<hook>.mjs"` directly.
- `.gitattributes` keeps `.sh` files LF and `.cmd` files CRLF on every machine; don't override it.
