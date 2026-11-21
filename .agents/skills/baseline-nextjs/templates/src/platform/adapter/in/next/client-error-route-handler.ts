import { z } from 'zod';

import type { ClientErrorIntakeUseCase } from '../../../ports/in/client-error-intake.use-case';
import { problemResponse } from '../../problem-response';
import type { RouteHandler } from './auth-route-handlers';
import { isSameOriginRequest } from './security-headers';

export interface ClientErrorIntakeLimits {
  readonly appOrigin: string;
  /** Larger bodies are refused with 413 before they are parsed. */
  readonly maxBodyBytes: number;
  /** Per instance, over all clients: the client address behind the ingress is not trustworthy here. */
  readonly maxReportsPerMinute: number;
  readonly now: () => number;
}

const truncated = (max: number) => z.string().transform((value) => value.slice(0, max));

/** The report the browser's `HttpErrorReporting` sends (`ErrorReport`), bounded field by field; unknown keys fail. */
const ClientErrorReportSchema = z.strictObject({
  type: z.string().min(1).max(100),
  message: truncated(2_000),
  stack: truncated(8_000).optional(),
  release: z.string().max(64),
  environment: z.string().max(30),
  route: z.string().regex(/^\/[^\s?#]{0,200}$/),
  status: z.number().int().min(100).max(599).optional(),
  traceId: z
    .string()
    .regex(/^[\w-]{1,100}$/)
    .optional(),
});

const WINDOW_MS = 60_000;

/** Reads at most `maxBytes`; undefined when the body is larger (a missing Content-Length does not help). */
async function readLimited(request: Request, maxBytes: number): Promise<string | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return undefined;
  if (!request.body) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > maxBytes) return undefined; // leaving the loop cancels the stream
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * `POST /client-errors`: the browser's error reports, kept in the BFF (NEXT-OBS-18). No session needed (errors happen
 * before login too), so it is a public endpoint: same origin only, small bodies, a per-instance rate limit, a strict
 * schema, and the use case scrubs again. Answers 204 and never echoes anything.
 */
export function createClientErrorRouteHandler(
  intake: ClientErrorIntakeUseCase,
  limits: ClientErrorIntakeLimits,
): RouteHandler {
  let windowStart = Number.NEGATIVE_INFINITY;
  let reportsInWindow = 0;

  function withinRateLimit(): boolean {
    const at = limits.now();
    if (at - windowStart >= WINDOW_MS) {
      windowStart = at;
      reportsInWindow = 0;
    }
    reportsInWindow += 1;
    return reportsInWindow <= limits.maxReportsPerMinute;
  }

  return async (request) => {
    if (!isSameOriginRequest(request.headers, limits.appOrigin)) return problemResponse(403);
    if (!withinRateLimit()) return problemResponse(429, { 'retry-after': String(WINDOW_MS / 1000) });
    if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return problemResponse(415);
    const body = await readLimited(request, limits.maxBodyBytes);
    if (body === undefined) return problemResponse(413);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return problemResponse(400);
    }
    const parsed = ClientErrorReportSchema.safeParse(json);
    if (!parsed.success) return problemResponse(400);
    const { stack, status, traceId, ...required } = parsed.data;
    intake.accept({ ...required, stack, status, traceId });
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  };
}
