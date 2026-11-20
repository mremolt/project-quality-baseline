import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { AuthGuard } from './platform/adapter/in/rest/auth.guard.js';
import { ProblemDetailsFilter } from './platform/adapter/in/rest/problem-details.filter.js';
import { requestValidationPipe } from './platform/adapter/in/rest/request-validation.js';
import { loadConfig } from './platform/config/load-config.js';
import { LoggingConfig } from './platform/config/platform.config.js';
import { PlatformModule } from './platform/platform.module.js';

const logging = loadConfig(LoggingConfig);
const probes = ['/livez', '/readyz'];

/** Root composition: platform, context modules, global filter, pipe and guard (NEST-ARCH-01/06). */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: logging.LOG_LEVEL,
        mixin() {
          const span = trace.getActiveSpan()?.spanContext();
          return span && isSpanContextValid(span) ? { traceId: span.traceId, spanId: span.spanId } : {};
        },
        serializers: {
          req: (req: { id: unknown; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            path: req.url.split('?')[0],
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        // Nest mounts pino-http as middleware: req.url is '/' there, originalUrl holds the path
        autoLogging: {
          ignore: (req) => probes.includes((req as { originalUrl?: string }).originalUrl ?? req.url ?? ''),
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.email',
          ],
          censor: '[redacted]',
        },
      },
    }),
    PlatformModule,
    // context modules: OrdersModule, …
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: requestValidationPipe },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
