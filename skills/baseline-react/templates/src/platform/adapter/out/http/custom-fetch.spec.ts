import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError } from '../../../domain';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { configureHttp, customFetch } from './custom-fetch';
import { HttpProblem } from './http-problem';

const server = setupServer();

describe('customFetch', () => {
  const reportError = mock<ReportErrorUseCase>();
  const onUnauthorized = vi.fn();

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  beforeEach(() => {
    configureHttp({ timeoutMs: 200, onUnauthorized, reportError });
    document.cookie = 'XSRF-TOKEN=token-1';
  });
  afterEach(() => {
    server.resetHandlers();
    reportError.report.mockReset();
    onUnauthorized.mockReset();
  });
  afterAll(() => {
    server.close();
  });

  it('sends the XSRF header on same-origin mutating calls only', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.all('*/api/echo', ({ request }) => {
        seen.push(request.headers.get('X-XSRF-TOKEN'));
        return HttpResponse.json({});
      }),
    );

    await customFetch('/api/echo', { method: 'POST' });
    await customFetch('/api/echo', { method: 'GET' });

    expect(seen).toEqual(['token-1', null]);
  });

  it('treats a malformed XSRF cookie as absent instead of throwing', async () => {
    document.cookie = 'XSRF-TOKEN=%E0%A4%A';
    const seen: (string | null)[] = [];
    server.use(
      http.post('*/api/echo', ({ request }) => {
        seen.push(request.headers.get('X-XSRF-TOKEN'));
        return HttpResponse.json({});
      }),
    );

    await customFetch('/api/echo', { method: 'POST' });

    expect(seen).toEqual([null]);
  });

  it('rejects a target on another origin without sending it', async () => {
    await expect(customFetch('https://evil.example/api/echo', { method: 'POST' })).rejects.toMatchObject({
      failure: 'unexpected',
    });
    expect(reportError.report).toHaveBeenCalledOnce();
  });

  it('turns 401 into the unauthorized callback and a technical error, without reporting', async () => {
    server.use(http.get('*/api/echo', () => new HttpResponse(null, { status: 401 })));

    await expect(customFetch('/api/echo', {})).rejects.toMatchObject({ failure: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('passes 4xx problems on for the feature mapper', async () => {
    server.use(
      http.get('*/api/echo', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', status: 409, code: 'X' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(customFetch('/api/echo', {})).rejects.toEqual(new HttpProblem(409, { code: 'X' }));
  });

  it('reports a 2xx body that is not JSON once, as the technical error it creates (TS-ARCH-18)', async () => {
    server.use(http.get('*/api/text', () => new HttpResponse('<html>proxy page</html>', { status: 200 })));

    await expect(customFetch('/api/text', { method: 'GET' })).rejects.toMatchObject({ failure: 'malformed-response' });
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(expect.any(TechnicalError), { status: 200 });
  });

  it('reports a time-out', async () => {
    server.use(
      http.get('*/api/echo', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    await expect(customFetch('/api/echo', {})).rejects.toMatchObject({ failure: 'timeout' });
    expect(reportError.report).toHaveBeenCalledWith(expect.any(TechnicalError));
  });

  it('reports a network failure', async () => {
    server.use(http.get('*/api/echo', () => HttpResponse.error()));

    await expect(customFetch('/api/echo', {})).rejects.toMatchObject({ failure: 'network' });
    expect(reportError.report).toHaveBeenCalledOnce();
  });

  it('does not report a call the caller aborted', async () => {
    server.use(
      http.get('*/api/echo', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();

    const call = customFetch('/api/echo', { signal: controller.signal });
    controller.abort();

    await expect(call).rejects.toThrow();
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('times out a call that also carries the caller signal (anySignal)', async () => {
    server.use(
      http.get('*/api/echo', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    await expect(customFetch('/api/echo', { signal: new AbortController().signal })).rejects.toMatchObject({
      failure: 'timeout',
    });
    expect(reportError.report).toHaveBeenCalledOnce();
  });
});
