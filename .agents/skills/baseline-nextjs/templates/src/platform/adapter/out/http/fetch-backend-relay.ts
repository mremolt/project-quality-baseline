import type { ApiCall } from '../../../ports/in/api-relay.use-case';
import type { BackendRelayPort } from '../../../ports/out/backend-relay.port';
import { problemResponse } from '../../problem-response';

export class FetchBackendRelay implements BackendRelayPort {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async relay(request: ApiCall): Promise<Response> {
    try {
      return await fetch(new URL(request.pathAndQuery, this.apiBaseUrl), {
        method: request.method,
        headers: request.headers,
        ...(request.body ? { body: request.body } : {}),
        redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(this.timeoutMs)]), // RES-TMO-01
      });
    } catch (error) {
      return problemResponse(error instanceof DOMException && error.name === 'TimeoutError' ? 504 : 502);
    }
  }
}
