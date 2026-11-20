import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, type HealthCheckResult, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { type Kysely, sql } from 'kysely';

import { KYSELY } from '../../out/persistence/database.js';
import { Public } from '../rest/auth.decorators.js';

/** Probes on the serving port, not routed from outside (NEST-OBS-02/03, NEST-SEC-10). */
@Public()
@ApiExcludeController()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    @Inject(KYSELY) private readonly db: Kysely<unknown>,
  ) {}

  /** Liveness without checks: Terminus would answer 503 while draining. */
  @Get('livez')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        this.indicators
          .check('database')
          .attempt(async () => {
            await sql`select 1`.execute(this.db);
          })
          .withTimeout(1000),
    ]);
  }
}
