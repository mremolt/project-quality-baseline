import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { loadConfig } from './platform/config/load-config.js';
import { HttpConfig } from './platform/config/platform.config.js';

/** Builds the app without listening; reused by main.ts, tests and the spec export (NEST-ARCH-07). */
export async function createApp(): Promise<NestFastifyApplication> {
  const http = loadConfig(HttpConfig);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: http.HTTP_BODY_LIMIT_BYTES,
      requestTimeout: http.HTTP_REQUEST_TIMEOUT_MS,
      connectionTimeout: http.HTTP_REQUEST_TIMEOUT_MS,
      trustProxy: http.HTTP_TRUSTED_PROXIES.length > 0 ? http.HTTP_TRUSTED_PROXIES : false,
    }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (_request, reply) => {
      if (!reply.hasHeader('cache-control')) void reply.header('cache-control', 'no-store'); // NEST-SEC-20
    });
  if (http.CORS_ALLOWED_ORIGINS.length > 0) app.enableCors({ origin: http.CORS_ALLOWED_ORIGINS, credentials: false });
  app.enableShutdownHooks();
  return app;
}
