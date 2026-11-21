# React: Runtime Configuration

Scope: React SPA. Next.js: [configuration/nextjs.md](nextjs.md).

How one Vite build gets per-environment values. Shared rules: [configuration.md](configuration.md) (`CFG-*`), in particular CFG-02 (one build) and CFG-11 (`/config.json` from the serving origin); the BFF that serves the bundle generates the file ([REL-FE-01/03](../../07-deployment-view/container-runtime.md)). Folder layout: [05-building-block-view/react.md](../../05-building-block-view/react.md).

## Rules

- **REACT-CFG-01: (React SPA) One production build serves every environment** (CFG-02). `vite build` runs without `--mode`; there are no `.env.<environment>` files and no `VITE_*` variables with per-environment values. `define` holds only build constants that are identical in every deployment, such as the commit (REL-VER-05). Dev-only behaviour uses `import.meta.env.DEV`. A Vitest test fails when the frontend folder contains a `.env*` file or `src/` reads `import.meta.env.VITE_`.
- **REACT-CFG-02: (React SPA) Per-environment values come from `/config.json`, loaded and validated before the first render.** `main.tsx` awaits the platform's `loadRuntimeConfig()` (top-level `await`) and only then calls `createPlatform(config, …)` and `createRoot(…).render(…)`. The loader `HttpRuntimeConfig` is an outgoing adapter in `src/platform/adapter/out/http/` implementing `LoadRuntimeConfigPort`; the `RuntimeConfig` type lives in the platform domain (`src/platform/domain/runtime-config.ts`, exported by `src/platform/domain/index.ts` and `src/platform/index.ts`), the port in `src/platform/ports/out/runtime-config.port.ts`. It uses plain `fetch` with a relative URL, `cache: 'no-store'` and an explicit timeout (RES-TMO-01), not the generated client: the HTTP mutator itself needs the configuration (timeout, login path, reporting).
- **REACT-CFG-03: (React SPA) The configuration is typed and validated with a zod schema next to the loader** (TS-ARCH-06, CFG-08). The schema `satisfies z.ZodType<RuntimeConfig>`, rejects paths that leave the origin, and the parsed object is frozen. On a missing or invalid field `main.tsx` catches the error, logs it to the console and unhides a static message in `index.html` (`role="alert"`, in every supported language, because no catalog and no error reporting exist yet).

```ts
// platform/adapter/out/http/http-runtime-config.ts
const SameOriginPath = z.string().startsWith('/').refine((path) => !path.startsWith('//'), 'same-origin path');

export const RuntimeConfigSchema = z.object({
  environment: z.string().min(1),           // in error reports, not in the UI
  release: z.string().min(1),               // REL-VER-05, in error reports (REACT-OBS-05)
  requestTimeoutMs: z.int().positive(),     // the mutator's timeout (RES-TMO-01)
  loginPath: SameOriginPath,                // target of a 401 (REACT-SEC-06)
  errorReporting: z.object({ enabled: z.boolean(), path: SameOriginPath }), // REACT-OBS-03
}) satisfies z.ZodType<RuntimeConfig>;

export class HttpRuntimeConfig implements LoadRuntimeConfigPort {
  async loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>> {
    const response = await fetch('/config.json', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`config.json: HTTP ${String(response.status)}`);
    return Object.freeze(RuntimeConfigSchema.parse(await response.json()));
  }
}

// main.tsx
try {
  const config = await loadRuntimeConfig();
  const platform = createPlatform(config, () => router.state.matches.at(-1)?.routeId ?? 'unknown');
  createRoot(container).render(<StrictMode><App platform={platform} router={router} locale={locale} /></StrictMode>);
} catch (error) {
  console.error('Start-up failed', error);
  document.getElementById('startup-error')?.removeAttribute('hidden');
}
```

- **REACT-CFG-04: (React SPA) The configuration is reached only through the platform.** Components and composition files read it with `useRuntimeConfig()` from `src/platform/platform.tokens.ts` (exported by `src/platform/index.ts`), which reads `RuntimeConfigContext` and throws outside `PlatformProvider` (REACT-ARCH-09). The root composition renders `PlatformProvider` once. Platform parts outside React (the HTTP mutator, error reporting, the global error listeners) receive their values from `createPlatform`. Use cases and adapters get the single values they need as constructor arguments: the feature's provider reads `useRuntimeConfig()` and passes the values to the factory in its lazy `useState` initializer, `const config = useRuntimeConfig(); const [useCases] = useState(() => createOrdersUseCases({ reportError, timeoutMs: config.requestTimeoutMs }))` (REACT-ARCH-10; the orders template needs only `reportError`); the values are fixed for the page load (REACT-CFG-06), so the initializer never needs to run again. A use case that needs a typed part of the configuration may take `RuntimeConfig` or a `Pick` of it, because the type is in the platform domain, which the core may import (TS-ARCH-01). Nothing reads a `window` global or fetches `/config.json` a second time; `domain`, `application` and `ports` never import the tokens file (TS-ARCH-01, dependency-cruiser).
- **REACT-CFG-05: (React SPA) `/config.json` contains public values only** (CFG-11, TS-SEC-04): environment name, release version, timeouts, same-origin paths, switches, public identifiers. No API keys with write power, no credentials, no internal host names. The schema is the list of what may be in it; a new field is reviewed like an API change and added to the BFF's frontend configuration in the same change.
- **REACT-CFG-06: (React SPA) `config.json` is not part of the build output.** `check:bundle` fails when `dist/config.json` exists. During `npm run dev` the Vite dev server's `server.proxy` forwards `/config.json` and `/api` to the locally running BFF, like the API calls. Changing a value needs a reload of the page; there is no hot reload of configuration.

## Tests

| What | How |
|---|---|
| Schema (TEST-CFG-01) | Vitest (`core` project): a valid file parses; each missing or invalid field is rejected, including an absolute or protocol-relative path |
| Loader | Vitest with MSW (`http.get('*/config.json', …)`): valid file loads frozen; a non-2xx answer rejects |
| Consumers | Render inside `PlatformProvider` with a test platform, or pass the values to the use case directly; never a real `/config.json` |
| E2E stubbed | Playwright `page.route('**/config.json', …)` in the shared fixture; one test asserts the static start-up message for an invalid file |
| E2E smoke | Runs against the real BFF, which serves the real `/config.json` (REPO-CI-04) |
| Build | REACT-CFG-01 test; `check:bundle` fails on `dist/config.json` |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Runtime Configuration".*

## Skill overrides

| Skill or habit | Baseline rule |
|---|---|
| Vite docs and generic habit: `.env.production`, `.env.staging`, `import.meta.env.VITE_API_URL` | One build; per-environment values from `/config.json` (REACT-CFG-01/02) |
| `vercel-react-best-practices` `advanced-init-once`: module-level app initialisation | The configuration is loaded once in `main.tsx` and wired by the platform composition (REACT-CFG-02/04) |
