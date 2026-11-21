---
name: baseline-ide-setup
description: Configures VS Code and IntelliJ IDEA Ultimate for a project that uses the quality baseline - format on save (Prettier, Java formatter), ESLint fix on save, EditorConfig, workspace TypeScript, recommended VS Code extensions and required IntelliJ plugins detected from the stack (Angular, NestJS, Vitest, Playwright, Java/Spring, OpenAPI, Docker). Use when setting up a new project or developer machine, when asked to "set up the IDE", "format on save", "eslint on save", "recommended extensions", ".vscode", ".idea", or after adding a new technology to the stack.
---

# Baseline IDE setup

Rules: `docs/baseline/08-crosscutting-concepts/development/ide-setup.md` (project root) (`TOOL-IDE-*`). The docs win over this skill.

## Steps

1. **Check prerequisites.** The project should already have its formatter and linter configs (`.prettierrc*`, `eslint.config.*`, a Java formatter in the build if it has Java). The IDE settings only point at them (TOOL-IDE-01). If one is missing, say so and propose adding it per `docs/baseline/08-crosscutting-concepts/development/typescript-tooling.md`, instead of encoding a style in IDE settings.
2. **Run the script** from the repository root. In a product repo with component folders (`backend/`, `frontend/`, REPO-LAY-03) that is the root, never a component folder (TOOL-IDE-07):
   ```bash
   # Linux, macOS, Git Bash
   sh .agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh .
   ```
   ```bat
   :: Windows CMD / PowerShell
   .agents\skills\baseline-ide-setup\scripts\apply-ide-config.cmd .
   ```
   Both launchers run `apply-ide-config.mjs` and only need Node.js.
   It detects the stack in the root and in first-level component folders, points `typescript.tsdk` into the TypeScript component, and creates or merges:
   - `.editorconfig` (only if missing)
   - `.vscode/settings.json` (merged; baseline keys win), `.vscode/extensions.json` (recommendations merged)
   - `.idea/prettier.xml`, `.idea/jsLinters/eslint.xml`, `.idea/externalDependencies.xml` (required plugins), Java formatter plugin settings
   - an IDE block in `.gitignore` (TOOL-IDE-03) and the tool-output entries of REPO-LAY-07
   It never overwrites differing files: it writes `*.baseline*` next to them and reports `MANUAL:` items.
3. **Resolve every `MANUAL:` line** from the output: merge the `*.baseline*` file by hand (e.g. a `settings.json` with comments), then delete it.
4. **Review the diff** (`git diff`, new files). Check that `.gitignore` has no older rule that contradicts the IDE block (e.g. a blanket `.idea/` line above it).
5. **Report to the user**: what was configured, the one-time per-developer steps the script printed (IntelliJ keeps some settings per user), and any gaps, especially a missing shared Java formatter.

## What the configuration does

| | VS Code | IntelliJ IDEA Ultimate |
|---|---|---|
| Prettier on save | `editor.formatOnSave` + Prettier as default formatter for TS/JS/HTML/SCSS/CSS/JSON/MD/YAML; `prettier.requireConfig` | `.idea/prettier.xml`: automatic config, run on save and on reformat |
| ESLint fix on save | `source.fixAll.eslint`; Angular templates validated (`html`) | `.idea/jsLinters/eslint.xml`: fix on save |
| Import order | from ESLint (`simple-import-sort`); `source.organizeImports` off | keep "Optimize imports" off for TS (printed as one-time step) |
| TypeScript version | `typescript.tsdk` = workspace | one-time step |
| Java | organize imports on save; no format on save (no maintained palantir integration): format with `./mvnw spotless:apply` (TOOL-IDE-02 exception) | formatter plugin (google/palantir) required + enabled when the build uses it via Spotless |

## Extending the skill

New technology in the baseline (e.g. another stack doc)? Add its detection and its extension/plugin IDs to `scripts/apply-ide-config.mjs` (the `.sh`/`.cmd` files are launchers only), verify the IDs on the VS Code Marketplace and plugins.jetbrains.com, and update the table in `ide-setup.md`.
