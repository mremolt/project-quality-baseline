# IDE Setup: VS Code and IntelliJ IDEA Ultimate

We support two IDEs for frontend and backend work: **Visual Studio Code** and **IntelliJ IDEA Ultimate**. Both must produce the same result as CI: code formatted by the project's formatter and auto-fixable lint findings fixed on save. The `baseline-ide-setup` skill writes and merges the configuration described here.

## What gets configured

| Concern | Source of truth | VS Code | IntelliJ IDEA Ultimate |
|---|---|---|---|
| Basic whitespace, line endings, indentation | `.editorconfig` | EditorConfig extension | built in |
| Formatting TS/HTML/SCSS/JSON/MD/YAML | Prettier config (TS-TOOL-08) | Prettier extension, format on save | Prettier, run on save and on reformat (`.idea/prettier.xml`) |
| Lint fixes (incl. import sorting) | ESLint config (TS-TOOL-04) | `source.fixAll.eslint` on save | ESLint fix on save (`.idea/jsLinters/eslint.xml`) |
| Java formatting | Spotless with palantir-java-format (JAVA-TOOL-11) | Java extension; no maintained palantir integration, so format with `./mvnw spotless:apply` | palantir-java-format plugin, Actions on Save |
| Recommended / required plugins | stack detection | `.vscode/extensions.json` | `.idea/externalDependencies.xml` (Required Plugins) |

## Rules

- **TOOL-IDE-01: The project's config files are the source of truth** (`.editorconfig`, Prettier, ESLint, Java formatter). IDE settings only point at them; they never define their own formatting style.
  *Why:* CI and every editor then format identically, and nobody's diff is full of whitespace changes.
- **TOOL-IDE-02: Format on save and lint-fix on save are on in both IDEs** wherever the project's formatter has an IDE integration. Import order comes from ESLint (`simple-import-sort`), so IDE "organize imports" is off for TypeScript. One exception: VS Code has no maintained palantir-java-format integration, so Java in VS Code only organizes imports on save and is formatted with `./mvnw spotless:apply`; `spotless:check` in `verify` catches what was missed.
- **TOOL-IDE-03: Shared IDE settings are committed; personal ones are not.** Commit `.vscode/settings.json`, `.vscode/extensions.json`, `.idea/prettier.xml`, `.idea/jsLinters/eslint.xml`, `.idea/externalDependencies.xml`, `.idea/codeStyles/`. Everything else under `.vscode/` and `.idea/` stays ignored.
- **TOOL-IDE-04: Recommended extensions/plugins follow the stack**, detected from the project (Angular, React and Next.js, NestJS, Vitest, Playwright, Java/Spring, OpenAPI, Docker). No personal-taste extensions in the shared list.
- **TOOL-IDE-05: Use the workspace TypeScript version** (`node_modules/typescript` of the frontend component) in both IDEs, so editor errors match the build.
- **TOOL-IDE-06: Settings IntelliJ only stores per user** (e.g. "Reformat code" for Java under Actions on Save) are listed in the project README as a one-time step; the skill prints them.
- **TOOL-IDE-07: In a product repository with component folders (D12), the IDE opens the repository root and the shared settings live there.** They point into the components: VS Code `typescript.tsdk` → `frontend/node_modules/typescript/lib`, ESLint working directories detected per component (`"eslint.workingDirectories": [{ "mode": "auto" }]`). IntelliJ imports `backend/pom.xml` as a Maven module and finds Prettier and ESLint through the nearest `package.json`. Component folders have no `.vscode/` or `.idea/` of their own.

## `.gitignore` entries

```gitignore
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/*
!.idea/prettier.xml
!.idea/jsLinters/
!.idea/externalDependencies.xml
!.idea/codeStyles/

# Tool output of a stray run from the repository root (REPO-LAY-07)
node_modules/
dist/
coverage/
.env*.local
```

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "IDE Setup: VS Code and IntelliJ IDEA Ultimate".*
