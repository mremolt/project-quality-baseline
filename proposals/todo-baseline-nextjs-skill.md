# Todo: `baseline-nextjs` entry skill with validated templates

Status: **open**, the last step of the React / Next.js stack. Everything else is committed: the `react` and `nextjs` docs, `stacks/nextjs.md`, the `baseline-react` skill, `baseline-stacks.json` and `AGENTS.md` (both already name `baseline-nextjs`).

## What is missing

`skills/baseline-nextjs/` (and its identical copy in `.agents/skills/`, registered with `npm run skills:link-own`):

- `SKILL.md` in the structure of `skills/baseline-react/SKILL.md` and `skills/baseline-nestjs/SKILL.md` (1 read the rules, 2 load the skills, 3 overrides, 4 workflow, 5 new app). It routes only to shared + TypeScript + React + Next.js docs and `security/node-bff.md`. It tells the agent to skip rules marked "(React SPA)" and files whose intro says "Scope: React SPA". It loads the same skills as `baseline-react` but not `baseline-react` itself (that one points to SPA templates). Cite rule IDs, never restate rules (TOOL-SKL-06/09).
- `templates/` with a `README.md` mapping each file to its target path. File names have no leading dots, and no `package-lock.json` is included.

## Starting point

The validated scratch project and reports were saved outside the repository, because the session scratchpad is on tmpfs:

- `~/workspace/project-quality-baseline-scratch/nextjs/`: the validated Next.js 16.4 app (green on 2026-11-20: lint, typecheck, `check:arch`, 68 Vitest tests, build, 14 E2E tests, read-only distroless image). It has no `node_modules`; run `npm ci` first.
- `~/workspace/project-quality-baseline-scratch/next-template-work/`: a copy in which corrections had started, stopped at the Orval `urlEncodeParameters` step. Re-check it or start again from `nextjs/`.
- `nextjs-report.md` (versions, APIs, gotchas), `conventions.md` (decisions, including the three user decisions in the Next.js addendum), `check-links.mjs`.

## Corrections the templates must carry

The docs already state these; where the template and the docs disagree, the docs win:

- **Configuration:**
  - `APP_ENVIRONMENT_KIND` is required, with the `APP_TEST_STUBS` guard and its schema test (NEXT-CFG-07, NEXT-TEST-11).
  - The configuration is parsed in `register()` with try/exit (NEXT-CFG-03).
  - The public config holds `release`, `commit`, `environmentName` and `requestTimeoutMs` (NEXT-CFG-05/08).
  - Timeout ladder defaults (NEXT-RES-03).
- **Dependencies, scripts and config:**
  - msw and faker are in `dependencies` (NEXT-REL-19).
  - `agentRules: false`, the `dev` and `dev:debug` scripts, and the `check:bundle` script name (NEXT-TOOL).
  - `urlEncodeParameters: true` (TS-API-09).
- **Browser code:**
  - The mutator uses `anySignal` and handles 401 and error reporting (NEXT-API-05, REACT-API-05).
  - RHF `field: { ref, ...field }` with `inputRef={ref}` (REACT-ARCH-14).
  - Query retry with jitter (REACT-STATE-15).
- **Security:**
  - The Trusted Types allow-list default policy (NEXT-SEC-10).
  - The server-action Origin/`Sec-Fetch-Site` check in `proxy.ts` (NEXT-SEC).
- **Local setup:** a committed `.env.development` with `APP_ENVIRONMENT_KIND=local`, and a pinned Redis in `compose.yaml` (NEXT-DEV-01..03).
- **Image:** the Dockerfile per NEXT-REL-06.
- **ESLint:** per NEXT-TOOL-06, plus the TS-TOOL-04 template (named sonar import, `warnAsError`), plus the REACT-TOOL-05 bans except the SPA-only `process` ban.
- **dependency-cruiser:** per NEXT-ARCH-13, with a canary that uses an absolute `baseDir`, and if cheap a `server-never-imports-client-entry` assertion.
- **Naming:** `HttpProblem`.

## Done when

- A fresh copy made from `templates/README.md` passes `npm install`, `npm run verify`, `npm run build`, `npm run e2e`, `docker build` and a `docker run --read-only` smoke test (`/livez`, `/readyz` against Redis).
- The two skill copies are identical, `npm run skills:link-own` has been run, and the link check is green.
- The `baseline-nextjs` row is removed from the chapter 11 open points, and this file is deleted.
