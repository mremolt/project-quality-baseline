import { Logger } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DatabaseConfig } from '../../../config/platform.config.js';

export const KYSELY = Symbol('Kysely');

const log = new Logger('Database');

function pool(cfg: DatabaseConfig, user: string, password: string): pg.Pool {
  const p = new pg.Pool({
    host: cfg.DATABASE_HOST,
    port: cfg.DATABASE_PORT,
    database: cfg.DATABASE_NAME,
    user,
    password,
    max: cfg.DATABASE_POOL_MAX, // RES-CAP-02, NEST-RES-04
    connectionTimeoutMillis: 2000,
    options: '-c statement_timeout=3000 -c transaction_timeout=5000 -c idle_in_transaction_session_timeout=5000',
  });
  // Without these listeners a terminated connection crashes the process (NEST-RES-01).
  p.on('error', (err) => {
    log.error({ err }, 'Idle database connection failed');
  });
  p.on('connect', (client) =>
    client.on('error', (err) => {
      log.error({ err }, 'Database connection failed');
    }),
  );
  return p;
}

/** Runtime instance with the DML user (NEST-DB-04). */
export const createDatabase = <DB>(cfg: DatabaseConfig): Kysely<DB> =>
  new Kysely<DB>({
    dialect: new PostgresDialect({ pool: pool(cfg, cfg.DATABASE_USER, cfg.DATABASE_PASSWORD.reveal()) }),
  });

/** Instance with the DDL user, for migrations only (NEST-REL). */
export function createMigrationDatabase(cfg: DatabaseConfig): Kysely<unknown> {
  if (!cfg.DATABASE_MIGRATION_USER || !cfg.DATABASE_MIGRATION_PASSWORD) {
    throw new Error('Invalid configuration: DATABASE_MIGRATION_USER, DATABASE_MIGRATION_PASSWORD');
  }
  return new Kysely({
    dialect: new PostgresDialect({
      pool: pool(cfg, cfg.DATABASE_MIGRATION_USER, cfg.DATABASE_MIGRATION_PASSWORD.reveal()),
    }),
  });
}
