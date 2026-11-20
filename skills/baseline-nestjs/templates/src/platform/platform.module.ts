import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { createRemoteJWKSet } from 'jose';
import type { Kysely } from 'kysely';

import { HealthController } from './adapter/in/health/health.controller.js';
import { ShutdownCallbacks } from './adapter/in/health/shutdown-callbacks.js';
import { JWKS } from './adapter/in/rest/auth.guard.js';
import { createDatabase, KYSELY } from './adapter/out/persistence/database.js';
import { KyselyTransactionAdapter } from './adapter/out/persistence/kysely-transaction.adapter.js';
import { loadConfig } from './config/load-config.js';
import {
  AUTH_CONFIG,
  AuthConfig,
  DATABASE_CONFIG,
  DatabaseConfig,
  HTTP_CONFIG,
  HttpConfig,
} from './config/platform.config.js';
import { TRANSACTION_PORT } from './platform.tokens.js';

const http = loadConfig(HttpConfig);

/** Shared platform providers: configuration, database, transactions, key set, probes, shutdown (NODE-ARCH-02). */
@Global()
@Module({
  imports: [TerminusModule.forRoot({ gracefulShutdownTimeoutMs: http.SHUTDOWN_DRAIN_MS })],
  controllers: [HealthController],
  providers: [
    { provide: HTTP_CONFIG, useValue: http },
    { provide: AUTH_CONFIG, useFactory: () => loadConfig(AuthConfig) },
    { provide: DATABASE_CONFIG, useFactory: () => loadConfig(DatabaseConfig) },
    { provide: KYSELY, useFactory: (cfg: DatabaseConfig) => createDatabase(cfg), inject: [DATABASE_CONFIG] },
    KyselyTransactionAdapter,
    { provide: TRANSACTION_PORT, useExisting: KyselyTransactionAdapter },
    {
      provide: JWKS,
      useFactory: (cfg: AuthConfig) =>
        createRemoteJWKSet(new URL(cfg.AUTH_JWKS_URI), { timeoutDuration: cfg.AUTH_JWKS_TIMEOUT_MS }),
      inject: [AUTH_CONFIG],
    },
    ShutdownCallbacks,
  ],
  exports: [HTTP_CONFIG, AUTH_CONFIG, KYSELY, TRANSACTION_PORT, KyselyTransactionAdapter, JWKS, ShutdownCallbacks],
})
export class PlatformModule implements OnApplicationShutdown {
  constructor(@Inject(KYSELY) private readonly db: Kysely<unknown>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy(); // after the HTTP server closed (NEST-OBS-04)
  }
}
