import type { ApiCall } from '../../../ports/in/api-relay.use-case';
import type { BackendRelayPort } from '../../../ports/out/backend-relay.port';
import { problemResponse } from '../../problem-response';
import { backendUrl } from './backend-url';

export class FetchBackendRelay implements BackendRelayPort {
  constructor(private readonly apiBaseUrl: string) {}

  async relay(request: ApiCall): Promise<Response> {
    const target = backendUrl(request.pathAndQuery, this.apiBaseUrl);
    if (!target) return problemResponse(400); // path steering: dot segments, encoded separators, outside /api/
    try {
      return await fetch(target, {
        method: request.method,
        headers: request.headers,
        ...(request.body ? { body: request.body } : {}),
        redirect: 'error',
        signal: request.signal, // the call's total deadline from the API proxy (RES-TMO-01, NEXT-RES-03)
      });
    } catch (error) {
      return problemResponse(error instanceof DOMException && error.name === 'TimeoutError' ? 504 : 502);
    }
  }
}
