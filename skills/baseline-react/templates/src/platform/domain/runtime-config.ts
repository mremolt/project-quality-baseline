/**
 * Per-environment values from `/config.json` (CFG-02); public values only (TS-SEC-04). A plain type in the platform
 * domain, so a feature composition can hand single values to its use cases (REACT-CFG-04).
 */
export interface RuntimeConfig {
  readonly environment: string;
  readonly release: string;
  readonly requestTimeoutMs: number;
  readonly loginPath: string;
  readonly errorReporting: { readonly enabled: boolean; readonly path: string };
}
