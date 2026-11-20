// Migrate-only entrypoint for the pre-deploy job: node dist/migrate.js (NEST-REL)
import { createMigrationDatabase } from './platform/adapter/out/persistence/database.js';
import { migrateToLatest } from './platform/adapter/out/persistence/migrator.js';
import { loadConfig } from './platform/config/load-config.js';
import { DatabaseConfig } from './platform/config/platform.config.js';

const db = createMigrationDatabase(loadConfig(DatabaseConfig));
try {
  await migrateToLatest(db);
} finally {
  await db.destroy();
}
