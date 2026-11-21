import type { ApiCall } from '../in/api-relay.use-case';

/** Sends a call to the backend within `call.signal`; answers 502/504 problem responses when it fails or times out. */
export interface BackendRelayPort {
  relay(call: ApiCall): Promise<Response>;
}
