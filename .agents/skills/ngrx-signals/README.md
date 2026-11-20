# ngrx-signals (baseline adaptation)

Agent skill for `@ngrx/signals` Signal Stores, adapted to this baseline's hexagonal frontend rules.

## Origin

Adapted from [danielsogl/skills](https://github.com/danielsogl/skills), path `skills/ngrx-signals`, commit `63095ae4bf894465f6c1279a07a5e226377f5502` (MIT, Copyright (c) 2026 Daniel Sogl). The original license is in [LICENSE.upstream](LICENSE.upstream). The origin is also recorded in the `metadata` block of [SKILL.md](SKILL.md).

## What changed

The API knowledge (`references/api-reference.md`, `entities.md`, `custom-features.md`) is kept close to upstream. The architecture advice follows `docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md`, which wins on conflict:

| Upstream | Here |
|---|---|
| Store holds state + orchestration and injects an API service that does HTTP | Store is view state of the UI adapter (`features/<f>/adapter/in/ui/<f>-store.ts`) and injects use-case contracts via tokens from `<f>.tokens.ts` (NG-STATE-01/02) |
| `providedIn: 'root'` in the scaffold | Component/route providers by default; root only for app-wide state in `src/platform` (NG-STATE-12) |
| `type FooState = {…}` | `interface` with `readonly` fields; domain values, never DTOs (NG-STATE-04/05) |
| Rules may live in the store | Pure domain functions, called from `withComputed` (NG-STATE-07) |
| Raw `e.message` into `setError` | Feature error mapper (NG-STATE-09) |
| Stores may keep data to avoid refetching | Caching/batching as an outgoing-adapter decorator (NG-STATE-11, TS-ARCH-15) |
| Events plugin as a coordination tool | Needs an ADR (NG-STATE-13) |
| Tests with hand-written `vi.fn()` service objects | `mock<UseCase>()` from vitest-mock-extended, provided via tokens (NG-STATE-14, TS-TEST-01) |
| `rxMethod` over observable API services | `rxMethod` over promise-returning use cases with `AbortSignal` (`fromAbortable`, NG-STATE-08) |

`references/patterns.md` and `references/testing.md` are rewritten. `evals/evals.json` checks our rules (two new evals: push back on a root store with HTTP + caching, and the events-plugin ADR). `evals/checks/arch.mjs` is new (regex-based NG-STATE checks); `evals/checks/tsc.mjs` is a Node port of upstream's `tsc.sh` with vitest-mock-extended/zod added, a separate deps cache dir, and a fixed stubber (names aggregated per missing module; stubs are callable, constructible and allow static members). Both checks run on Linux, macOS and Windows through their `.sh` / `.cmd` launchers (only Node.js and npm needed). The upstream README is not copied.

## Checking upstream for changes

```bash
npm run skills:upstream-diff ngrx-signals
```

The full diff lands in `.skills-upstream/ngrx-signals.diff`. Merge useful API changes by hand (keep our architecture rules), then bump `upstream-commit` in the SKILL.md frontmatter.
