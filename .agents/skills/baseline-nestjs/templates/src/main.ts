import 'reflect-metadata';

import { createApp } from './create-app.js';
import { telemetry } from './instrumentation.js';
import { ShutdownCallbacks } from './platform/adapter/in/health/shutdown-callbacks.js';
import { createDatabase, createMigrationDatabase } from './platform/adapter/out/persistence/database.js';
import { assertSchemaCurrent, migrateToLatest } from './platform/adapter/out/persistence/migrator.js';
import { loadConfig } from './platform/config/load-config.js';
import { DatabaseConfig, HttpConfig } from './platform/config/platform.config.js';

const db = loadConfig(DatabaseConfig);
if (db.DATABASE_MIGRATION_USER) {
  const ddl = createMigrationDatabase(db); // start-up variant (NEST-REL)
  await migrateToLatest(ddl);
  await ddl.destroy();
} else {
  const dml = createDatabase(db); // pre-deploy variant: refuse to start on a pending migration
  await assertSchemaCurrent(dml);
  await dml.destroy();
}

const app = await createApp();
app.get(ShutdownCallbacks).add(() => telemetry.shutdown());
await app.listen({ port: loadConfig(HttpConfig).HTTP_PORT, host: '0.0.0.0' });
