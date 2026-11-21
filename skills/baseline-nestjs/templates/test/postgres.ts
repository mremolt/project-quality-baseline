import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { parseConfig } from '../src/platform/config/load-config.js';
import { DatabaseConfig } from '../src/platform/config/platform.config.js';

export interface PostgresServer {
  readonly host: string;
  readonly port: number;
}

/** PostgreSQL 18 with the role split of dev/postgres/init.sql: DDL and DML users as in production (NEST-DB-22). */
export const startPostgres = (): Promise<StartedPostgreSqlContainer> =>
  new PostgreSqlContainer('postgres:18')
    .withDatabase('orders')
    .withUsername('postgres')
    .withPassword('postgres')
    .withCopyFilesToContainer([{ source: 'dev/postgres/init.sql', target: '/docker-entrypoint-initdb.d/init.sql' }])
    .start();

/** The service's database configuration for the test server: DML user for the pool, DDL user for migrations. */
export const databaseConfig = (
  server: PostgresServer,
  overrides: Readonly<Record<string, string>> = {},
): DatabaseConfig =>
  parseConfig(DatabaseConfig, {
    DATABASE_HOST: server.host,
    DATABASE_PORT: String(server.port),
    DATABASE_NAME: 'orders',
    DATABASE_USER: 'orders_app',
    DATABASE_PASSWORD: 'orders_app',
    DATABASE_MIGRATION_USER: 'orders_owner',
    DATABASE_MIGRATION_PASSWORD: 'orders_owner',
    ...overrides,
  });
