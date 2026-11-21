import type { TestProject } from 'vitest/node';

import { createMigrationDatabase } from '../src/platform/adapter/out/persistence/database.js';
import { migrateToLatest } from '../src/platform/adapter/out/persistence/migrator.js';
import { databaseConfig, type PostgresServer, startPostgres } from './postgres.js';

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: PostgresServer;
  }
}

/** One PostgreSQL per test run, migrated once as the DDL user (NEST-TEST-07, NEST-DB-22). */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await startPostgres();
  const server = { host: container.getHost(), port: container.getPort() };
  const ddl = createMigrationDatabase(databaseConfig(server));
  try {
    await migrateToLatest(ddl);
  } finally {
    await ddl.destroy();
  }
  project.provide('postgres', server);
  return async () => {
    await container.stop();
  };
}
