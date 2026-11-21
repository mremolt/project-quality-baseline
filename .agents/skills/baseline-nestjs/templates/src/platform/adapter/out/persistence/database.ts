import { Logger } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DatabaseConfig } from '../../../config/platform.config.js';

const log = new Logger('Database');

function pool(cfg: DatabaseConfig, login: { user: string; password: string; max: number; options: string }): pg.Pool {
  const p = new pg.Pool({
    host: cfg.DATABASE_HOST,
    port: cfg.DATABASE_PORT,
    database: cfg.DATABASE_NAME,
    ...login,
    connectionTimeoutMillis: cfg.DATABASE_CONNECTION_TIMEOUT_MS, // pool wait plus connect (NEST-RES-01/04)
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

/** Runtime instance with the DML user (NEST-DB-04); session timeouts from configuration (NEST-RES-01). */
export function createDatabase<DB>(cfg: DatabaseConfig): Kysely<DB> {
  const options = [
    `-c statement_timeout=${String(cfg.DATABASE_STATEMENT_TIMEOUT_MS)}`,
    `-c transaction_timeout=${String(cfg.DATABASE_TRANSACTION_TIMEOUT_MS)}`,
    `-c idle_in_transaction_session_timeout=${String(cfg.DATABASE_TRANSACTION_TIMEOUT_MS)}`,
  ].join(' ');
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: pool(cfg, {
        user: cfg.DATABASE_USER,
        password: cfg.DATABASE_PASSWORD.reveal(),
        max: cfg.DATABASE_POOL_MAX, // RES-CAP-02, NEST-RES-04
        options,
      }),
    }),
  });
}

/**
 * One-connection instance with the DDL user, for migrations only (NEST-DB-16/17, NEST-REL-01/03). No transaction
 * timeout: all pending migrations run in one transaction; statement_timeout also bounds the migration lock wait.
 */
export function createMigrationDatabase(cfg: DatabaseConfig): Kysely<unknown> {
  if (!cfg.DATABASE_MIGRATION_USER || !cfg.DATABASE_MIGRATION_PASSWORD) {
    throw new Error('Invalid configuration: DATABASE_MIGRATION_USER, DATABASE_MIGRATION_PASSWORD');
  }
  const options = [
    `-c lock_timeout=${String(cfg.DATABASE_MIGRATION_LOCK_TIMEOUT_MS)}`,
    `-c statement_timeout=${String(cfg.DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS)}`,
    `-c app.runtime_role=${cfg.DATABASE_USER}`, // read by the grant migration (NEST-DB-17)
  ].join(' ');
  return new Kysely({
    dialect: new PostgresDialect({
      pool: pool(cfg, {
        user: cfg.DATABASE_MIGRATION_USER,
        password: cfg.DATABASE_MIGRATION_PASSWORD.reveal(),
        max: 1,
        options,
      }),
    }),
  });
}
