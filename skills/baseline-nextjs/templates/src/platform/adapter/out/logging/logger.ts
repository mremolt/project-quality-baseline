import 'server-only';

import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino from 'pino';

/** The only server logger (NEXT-OBS-07): JSON lines to stdout, never tokens, ids or bodies (NEXT-OBS-10). */
export const logger = pino({
  level: 'info', // instrumentation.ts sets the configured LOG_LEVEL at start
  base: { service: 'orders-frontend' },
  redact: {
    // `*.key` matches one level down only: the top-level keys and header objects are listed too (NEXT-OBS-10)
    paths: [
      ...['authorization', 'cookie', 'accessToken', 'refreshToken', 'idToken', 'xsrfToken', 'sessionId'].flatMap(
        (key) => [key, `*.${key}`],
      ),
      ...['authorization', 'cookie', 'set-cookie', 'x-xsrf-token'].flatMap((name) => [
        `headers["${name}"]`,
        `*.headers["${name}"]`,
      ]),
    ],
    censor: '[redacted]',
  },
  // trace id as the correlation id of every line written inside a request (NEXT-OBS-08)
  mixin() {
    const context = trace.getActiveSpan()?.spanContext();
    return context && isSpanContextValid(context) ? { traceId: context.traceId, spanId: context.spanId } : {};
  },
});
