/** The configuration subset the browser may see (NEXT-CFG-05): public, no secrets, no internal URLs. */
export interface PublicConfig {
  readonly environmentLabel: string;
  readonly environmentName: string;
  readonly release: string;
  readonly commit: string;
  /** Timeout of the browser HTTP mutator (NEXT-RES-03). */
  readonly requestTimeoutMs: number;
}
