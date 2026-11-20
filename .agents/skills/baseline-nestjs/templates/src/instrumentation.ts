// Loaded before the app: node --import ./dist/instrumentation.js dist/main.js (NEST-OBS). Configured by OTEL_* variables.
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { register } from 'import-in-the-middle/register-hooks.mjs';

// ESM hook, in-thread via module.registerHooks (module.register is deprecated in Node 26)
register();

const probes = new Set(['/livez', '/readyz']);

export const telemetry = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: (req) => probes.has(req.url ?? '') },
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: false }, // supports @nestjs/core < 12 only
      '@opentelemetry/instrumentation-pino': { enabled: false }, // correlation via the pino mixin (NEST-LOG-03)
    }),
    new FastifyOtelInstrumentation({ registerOnInitialization: true, ignorePaths: ({ url }) => probes.has(url) }),
  ],
});
telemetry.start();
