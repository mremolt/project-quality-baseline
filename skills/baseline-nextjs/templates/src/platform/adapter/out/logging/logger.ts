import 'server-only';

import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino from 'pino';

/** The only server logger (NEXT-OBS-07): JSON lines to stdout, never tokens, ids or bodies (NEXT-OBS-10). */
export const logger = pino({
  level: 'info', // instrumentation.ts sets the configured LOG_LEVEL at start
  base: { service: 'orders-frontend' },
  redact: {
    paths: [
      '*.authorization',
      '*.cookie',
      '*.accessToken',
      '*.refreshToken',
      '*.idToken',
      '*.xsrfToken',
      '*.sessionId',
    ],
    censor: '[redacted]',
  },
  // trace id as the correlation id of every line written inside a request (NEXT-OBS-08)
  mixin() {
    const context = trace.getActiveSpan()?.spanContext();
    return context && isSpanContextValid(context) ? { traceId: context.traceId, spanId: context.spanId } : {};
  },
});
