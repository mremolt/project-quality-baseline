import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * OpenTelemetry with the plain Node SDK (NEXT-OBS-01). Endpoint, sampling, `service.version` and on/off come from
 * the OTEL_* variables the deployment sets (NEXT-OBS-02, NEXT-REL-15). Imported only by instrumentation.ts.
 */
export function startTelemetry(): void {
  const sdk = new NodeSDK({
    serviceName: 'orders-frontend', // OTEL_SERVICE_NAME overrides it
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  });
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown()); // flush on shutdown (NEXT-OBS-13)
}
