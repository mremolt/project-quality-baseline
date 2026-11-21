// @vitest-environment jsdom
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError, UnauthenticatedError } from '../../../domain';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { anySignal, configureHttp, customFetch } from './browser-fetch';
import { HttpProblem } from './http-problem';

const server = setupServer();

describe('browser customFetch (NEXT-API-05, REACT-API-05)', () => {
  const reportError = mock<ReportErrorUseCase>();
  const onUnauthorized = vi.fn();

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  beforeEach(() => {
    configureHttp({ timeoutMs: 200, onUnauthorized, reportError });
    document.cookie = 'XSRF-TOKEN=abc%3D';
  });
  afterEach(() => {
    server.resetHandlers();
    reportError.report.mockReset();
    onUnauthorized.mockReset();
    document.cookie = 'XSRF-TOKEN=; max-age=0';
  });
  afterAll(() => {
    server.close();
  });

  it('sends the XSRF cookie value as X-XSRF-TOKEN on mutating calls only', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.all('*/api/echo', ({ request }) => {
        seen.push(request.headers.get('x-xsrf-token'));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await customFetch('/api/echo', { method: 'POST' });
    await customFetch('/api/echo', { method: 'GET' });

    expect(seen).toEqual(['abc=', null]);
  });

  it('never sends an Authorization header (TS-SEC-01)', async () => {
    let authorization: string | null = 'unset';
    server.use(
      http.get('*/api/echo', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({ a: 1 });
      }),
    );

    await expect(customFetch('/api/echo', {})).resolves.toEqual({ a: 1 });
    expect(authorization).toBeNull();
  });

  it('turns 401 into the unauthorized callback and UnauthenticatedError, without reporting', async () => {
    server.use(http.get('*/api/echo', () => new HttpResponse(null, { status: 401 })));

    await expect(customFetch('/api/echo', {})).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('passes 4xx problems on for the feature mapper, without reporting', async () => {
    server.use(
      http.get('*/api/echo', () =>
        HttpResponse.json(
          { status: 409, code: 'X' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(customFetch('/api/echo', {})).rejects.toEqual(new HttpProblem(409, { status: 409, code: 'X' }));
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('reports a server error with its trace id', async () => {
    server.use(
      http.get('*/api/echo', () =>
        HttpResponse.json(
          { status: 503, traceId: 't-1' },
          { status: 503, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(customFetch('/api/echo', {})).rejects.toBeInstanceOf(HttpProblem);
    expect(reportError.report).toHaveBeenCalledWith(expect.any(TechnicalError), { status: 503, traceId: 't-1' });
  });

  it('reports a time-out (RES-TMO-03)', async () => {
    server.use(
      http.get('*/api/echo', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );

    await expect(customFetch('/api/echo', {})).rejects.toMatchObject({ failure: 'timeout' });
    expect(reportError.report).toHaveBeenCalledWith(expect.any(TechnicalError));
  });

  it("passes the caller's abort through unchanged, without reporting", async () => {
    server.use(
      http.get('*/api/echo', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();

    const pending = customFetch('/api/echo', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toHaveProperty('name', 'AbortError');
    expect(reportError.report).not.toHaveBeenCalled();
  });
});

describe('anySignal', () => {
  it('aborts when any input aborts, with its reason', () => {
    const first = new AbortController();
    const combined = anySignal(first.signal, new AbortController().signal);

    first.abort('stop');

    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe('stop');
  });
});
