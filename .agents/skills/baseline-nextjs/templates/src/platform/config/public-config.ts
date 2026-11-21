/** The configuration subset the browser may see (NEXT-CFG-05): public, no secrets, no internal URLs. */
export interface PublicConfig {
  readonly environmentLabel: string;
  readonly environmentName: string;
  readonly release: string;
  readonly commit: string;
  /** Timeout of the browser HTTP mutator (NEXT-RES-03). */
  readonly requestTimeoutMs: number;
  /** Same-origin path of the BFF's error intake that the browser reports to (NEXT-OBS-18). */
  readonly clientErrorPath: string;
}

/** Fixed by the route file `src/app/client-errors/route.ts`; not configuration. */
export const CLIENT_ERROR_PATH = '/client-errors';
