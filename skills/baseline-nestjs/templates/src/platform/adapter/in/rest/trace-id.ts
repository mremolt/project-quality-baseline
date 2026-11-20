import { isSpanContextValid, trace } from '@opentelemetry/api';

/** Trace id of the active span for problem details (NEST-OBS-10); undefined outside a trace. */
export function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan()?.spanContext();
  return span && isSpanContextValid(span) ? span.traceId : undefined;
}
