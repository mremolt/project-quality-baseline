import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ApiCall } from '../ports/in/api-relay.use-case';
import type { SessionUseCase } from '../ports/in/session.use-case';
import type { BackendRelayPort } from '../ports/out/backend-relay.port';
import { ApiRelayService } from './api-relay.service';

const call = (): ApiCall => ({
  method: 'GET',
  pathAndQuery: '/api/v1/orders',
  headers: new Headers({ accept: 'application/json' }),
  body: undefined,
  signal: new AbortController().signal,
});

describe('ApiRelayService', () => {
  const sessions = mock<SessionUseCase>();
  const backend = mock<BackendRelayPort>();
  const service = new ApiRelayService(sessions, backend);

  it('relays the call with the bearer token of the session', async () => {
    sessions.accessToken.calledWith('s-1').mockResolvedValue('at-1');
    backend.relay.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await service.relay('s-1', call());

    expect(response?.status).toBe(204);
    const relayed = backend.relay.mock.lastCall?.[0];
    expect(relayed?.headers.get('authorization')).toBe('Bearer at-1');
    expect(relayed?.headers.get('accept')).toBe('application/json');
  });

  it('relays nothing without an access token', async () => {
    sessions.accessToken.mockResolvedValue(undefined);

    await expect(service.relay('s-2', call())).resolves.toBeUndefined();
    expect(backend.relay).not.toHaveBeenCalled();
  });
});
