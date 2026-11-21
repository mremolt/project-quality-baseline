import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { createApp } from './create-app.js';
import { telemetry } from './instrumentation.js';
import { ShutdownCallbacks } from './platform/adapter/in/health/shutdown-callbacks.js';
import { createDatabase, createMigrationDatabase } from './platform/adapter/out/persistence/database.js';
import { assertSchemaCurrent, migrateToLatest } from './platform/adapter/out/persistence/migrator.js';
import { readBuildInfo } from './platform/config/build-info.js';
import { loadConfig } from './platform/config/load-config.js';
import { DatabaseConfig, HttpConfig, ReleaseConfig } from './platform/config/platform.config.js';

const db = loadConfig(DatabaseConfig);
if (db.DATABASE_MIGRATION_USER) {
  const ddl = createMigrationDatabase(db); // start-up variant (NEST-REL-01)
  await migrateToLatest(ddl);
  await ddl.destroy();
} else {
  const dml = createDatabase(db); // pre-deploy variant: refuse to start on a pending migration (NEST-REL-03)
  await assertSchemaCurrent(dml);
  await dml.destroy();
}

const app = await createApp();
app.get(ShutdownCallbacks).add(() => telemetry.shutdown());
// Release version from the deployment, commit from the image build (NEST-REL-06)
const { commit } = readBuildInfo(new URL('build-info.json', import.meta.url));
new Logger('Main').log({ releaseVersion: loadConfig(ReleaseConfig).RELEASE_VERSION, commit }, 'Starting');
await app.listen({ port: loadConfig(HttpConfig).HTTP_PORT, host: '0.0.0.0' });
