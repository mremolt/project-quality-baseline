/** Per-environment values from `/config.json` (CFG-02); public values only (TS-SEC-04). */
export interface RuntimeConfig {
  readonly environment: string;
  readonly release: string;
  readonly requestTimeoutMs: number;
  readonly loginPath: string;
  readonly errorReporting: { readonly enabled: boolean; readonly path: string };
}

export interface LoadRuntimeConfigPort {
  loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>>;
}
