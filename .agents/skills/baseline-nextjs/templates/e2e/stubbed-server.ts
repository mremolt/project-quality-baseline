// NEXT-TEST-12: starts the built standalone server in test mode for the stubbed E2E tier: Redis in a container for
// the sessions, backend and IdP answered by stubs inside the server (APP_TEST_STUBS=1, NEXT-D5). Run by Playwright's
// webServer after `npm run build`.
import { spawn } from 'node:child_process';
import { cpSync } from 'node:fs';

import { RedisContainer } from '@testcontainers/redis';

import { E2E_IDP_ORIGIN, E2E_PORT } from './e2e-constants.ts';

const redisContainer = await new RedisContainer('redis:8.4-alpine').start();
// standalone output does not contain the static assets; the Dockerfile copies them the same way
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });

const server = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(E2E_PORT),
    HOSTNAME: '127.0.0.1',
    APP_ENVIRONMENT_KIND: 'test', // the only kinds that may start the stubs: test, local (NEXT-TEST-11)
    APP_TEST_STUBS: '1',
    OTEL_SDK_DISABLED: 'true',
    APP_ORIGIN: `http://localhost:${String(E2E_PORT)}`,
    API_BASE_URL: 'http://orders-backend.stub',
    OIDC_ISSUER_URL: E2E_IDP_ORIGIN,
    OIDC_CLIENT_ID: 'shop',
    OIDC_CLIENT_SECRET: 'e2e-client-secret-not-real',
    REDIS_URL: redisContainer.getConnectionUrl(),
    ENVIRONMENT_NAME: 'e2e',
    ENVIRONMENT_LABEL: 'e2e',
  },
});

async function stop(): Promise<void> {
  server.kill('SIGTERM');
  await redisContainer.stop();
  process.exit(0);
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
server.once('exit', (code) => {
  void redisContainer.stop().then(() => process.exit(code ?? 1));
});
