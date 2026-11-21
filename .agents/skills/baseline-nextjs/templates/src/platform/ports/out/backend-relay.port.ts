import type { ApiCall } from '../in/api-relay.use-case';

/** Sends a call to the backend; answers 502/504 problem responses when the backend fails or times out. */
export interface BackendRelayPort {
  relay(call: ApiCall): Promise<Response>;
}
