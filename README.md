# Project Quality Baseline

The shared rules for how we structure, build and test software, plus the agent skills and tooling that make coding agents (Claude Code, Codex, Copilot, …) follow them. Projects don't depend on this repository at build time: they **copy** it in with a sync script and commit the result.

- Rules for humans and agents: [docs/](docs/) — start with [docs/shared/README.md](docs/shared/README.md)
- Entry point for agents: [AGENTS.md](AGENTS.md) (Claude Code reads it through [CLAUDE.md](CLAUDE.md))

## Prerequisites

Works on Linux, macOS and Windows. All scripts are Node.js; there is nothing else to install (no `bash`, `jq`, `rsync` or Python).

| Tool | Version | Needed for |
|---|---|---|
| [Node.js](https://nodejs.org/) (includes npm) | **22.20 or newer** (LTS recommended) | all scripts, the `skills` CLI, the Claude Code hook |
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

`--force` runs it despite uncommitted changes. The sync copies the docs, the managed block in `AGENTS.md` and `.gitattributes`, the skills, `skills-lock.json` entries and the Claude Code hooks. It never touches project-owned files such as `docs/adr/`, the project's own skills or the project notes below the `AGENTS.md` end marker. Details: [agent-skills.md](docs/shared/tooling/agent-skills.md#distribution-to-consuming-projects).

Then, in the project:

1. Set up the IDEs: ask the agent to run the `baseline-ide-setup` skill, or run it yourself from the project root:
   - Linux/macOS/Git Bash: `.agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh .`
   - Windows: `.agents\skills\baseline-ide-setup\scripts\apply-ide-config.cmd .`
2. Review `git diff`, then commit.

To update a project later, pull this repository and run the sync again. Projects don't update baseline skills on their own.

## Repository layout

```
docs/shared/            rules for every project
docs/<stack>/           additions per technology (java, spring, typescript, angular)
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

Rules for adding, reviewing and updating skills: [agent-skills.md](docs/shared/tooling/agent-skills.md).

### Writing scripts

Every script must work on Linux and Windows (TOOL-SKL-08):

- Logic goes into a `.mjs` file that uses Node.js built-in modules only.
- Next to it, add two launchers that only call `node`: `<name>.sh` (`exec node "$(dirname "$0")/<name>.mjs" "$@"`) and `<name>.cmd` (`@echo off`, then `node "%~dp0<name>.mjs" %*`). Copy an existing pair from `scripts/`.
- Claude Code hooks call `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<hook>.mjs"` directly.
- `.gitattributes` keeps `.sh` files LF and `.cmd` files CRLF on every machine; don't override it.
