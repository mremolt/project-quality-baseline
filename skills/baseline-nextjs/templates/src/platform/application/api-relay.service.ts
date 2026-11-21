import type { ApiCall, ApiRelayUseCase } from '../ports/in/api-relay.use-case';
import type { SessionUseCase } from '../ports/in/session.use-case';
import type { BackendRelayPort } from '../ports/out/backend-relay.port';

export class ApiRelayService implements ApiRelayUseCase {
  constructor(
    private readonly sessions: SessionUseCase,
    private readonly backend: BackendRelayPort,
  ) {}

  async relay(sessionId: string | undefined, call: ApiCall): Promise<Response | undefined> {
    const token = await this.sessions.accessToken(sessionId, call.signal); // the call's deadline covers a refresh
    if (!token) return undefined;
    const headers = new Headers(call.headers);
    headers.set('authorization', `Bearer ${token}`);
    return this.backend.relay({ ...call, headers });
  }
}
