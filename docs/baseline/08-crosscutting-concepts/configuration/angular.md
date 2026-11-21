# Angular: Runtime Configuration

How one Angular build gets per-environment values. Shared rules: [configuration.md](configuration.md) (`CFG-*`); the server side is SPRING-CFG-10 ([spring.md](spring.md)) or NEST-CFG-11 ([nestjs.md](nestjs.md)). Folder layout: [05-building-block-view/angular.md](../../05-building-block-view/angular.md).

## Rules

- **NG-CFG-01: One production build serves every environment** (CFG-02). `angular.json` has no `fileReplacements` and no build configuration per environment; `environment.ts` files, if present, hold only values that are identical in every deployment. Dev-only behaviour uses `isDevMode()`. Enforced by a Vitest test that reads `angular.json` and fails on `fileReplacements` or configurations other than `production` and `development`.
- **NG-CFG-02: Per-environment values come from `/config.json`, loaded before the app starts with `provideAppInitializer`** in `app.config.ts`. The loader is an outgoing adapter in `src/platform/adapter/out/http/` and uses `fetch` with `cache: 'no-store'` and a relative URL, not `HttpClient`, so interceptors that themselves need configuration do not run before it exists. `provideAppInitializer` delays bootstrap until the returned promise resolves; the `APP_INITIALIZER` token is deprecated and not used.
- **NG-CFG-03: The configuration is typed and validated with a zod schema** (TS-D2, TS-ARCH-06) next to the loader. Parsing fails on a missing or invalid field; then bootstrap fails, `main.ts` catches the rejection and shows a static message from `index.html` (no translation catalog is loaded yet) and logs the error to the console; error reporting itself needs the configuration (NG-OBS-03). The parsed object is frozen (`Object.freeze`) and typed `Readonly<RuntimeConfig>`.
- **NG-CFG-04: The configuration is reached only through the injection token `RUNTIME_CONFIG`** in `src/platform/platform.tokens.ts`, exported through `platform/index.ts`. Adapters and providers files inject it; use cases get the single values they need as constructor arguments from the feature's providers file. Nothing reads `window`, `fetch('/config.json')` or a global. dependency-cruiser: `domain`, `application` and `ports` never import the token file (extends TS-ARCH-01).

```ts
// platform/adapter/out/http/runtime-config-loader.ts
export const RuntimeConfigSchema = z.object({
  environment: z.string().min(1),          // shown in error reports, not in the UI
  apiBaseUrl: z.string().startsWith('/'),  // same origin (NG-SEC-07)
  errorReporting: z.object({ enabled: z.boolean(), path: z.string().startsWith('/') }), // NG-OBS-03
});
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

@Injectable()                              // provided once, in app.config.ts
export class RuntimeConfigHolder {
  #value: Readonly<RuntimeConfig> | undefined;
  async load(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`config.json: ${response.status}`);
    this.#value = Object.freeze(RuntimeConfigSchema.parse(await response.json()));
  }
  get value(): Readonly<RuntimeConfig> {
    if (!this.#value) throw new Error('RUNTIME_CONFIG read before the app initializer ran');
    return this.#value;
  }
}

// app/app.config.ts
providers: [
  RuntimeConfigHolder,
  provideAppInitializer(() => inject(RuntimeConfigHolder).load()),
  { provide: RUNTIME_CONFIG, useFactory: () => inject(RuntimeConfigHolder).value },
  // …
]
```

- **NG-CFG-05: `config.json` contains public values only** (CFG-11, TS-SEC-04): environment name, release version (REL-VER-05), same-origin paths, switches, public identifiers. No API keys with write power, no credentials, no internal host names. The schema is the list of what may be in it; a new field is reviewed like an API change.
- **NG-CFG-06: `config.json` is not part of the build output.** During `ng serve` the dev-server proxy (`proxy.conf.json`) forwards `/config.json` to the locally running BFF or backend (SPRING-DEV-09, NEST-DEV-11), like the API calls. Changing a value needs a reload of the page; there is no hot reload of configuration.

## Tests

| What | How |
|---|---|
| Schema (TEST-CFG-01) | Vitest: a valid file parses; each missing or invalid field is rejected |
| Loader | Vitest with a stubbed `fetch`: non-2xx and invalid JSON reject; reading `value` before `load()` throws |
| Consumers | Provide `{ provide: RUNTIME_CONFIG, useValue: testConfig }`; never a real `fetch` |
| E2E stubbed | Playwright `page.route('**/config.json', …)` with a fixture per scenario; one test asserts the start-up error message for an invalid file |
| E2E smoke | Runs against the real BFF, which serves the real `/config.json` (REPO-CI-04) |
| Build | NG-CFG-01 test on `angular.json`; CI asserts the build output contains no `config.json` |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular: Runtime Configuration".*
