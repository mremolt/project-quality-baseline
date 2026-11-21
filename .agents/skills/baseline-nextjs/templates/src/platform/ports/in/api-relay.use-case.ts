export interface ApiCall {
  readonly method: string;
  /** Path and query below the backend's base URL, e.g. `/api/v1/orders?page=0`. */
  readonly pathAndQuery: string;
  /** Allow-listed request headers; the use case adds the access token. */
  readonly headers: Headers;
  readonly body: ArrayBuffer | undefined;
  /** The call's total deadline (NEXT-RES-03), combined with the browser's disconnect. */
  readonly signal: AbortSignal;
}

/** Token relay for the browser's same-origin API calls (NODE-BFF-01). */
export interface ApiRelayUseCase {
  /** The backend's answer, or undefined when the session has no valid access token. */
  relay(sessionId: string | undefined, call: ApiCall): Promise<Response | undefined>;
}
