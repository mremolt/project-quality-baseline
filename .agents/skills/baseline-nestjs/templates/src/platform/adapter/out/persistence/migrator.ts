import type { Kysely } from 'kysely';
import { Migrator } from 'kysely/migration';

import { migrations } from './migrations/index.js';

const migrator = (db: Kysely<unknown>): Migrator =>
  new Migrator({ db, provider: { getMigrations: () => Promise.resolve(migrations) }, allowUnorderedMigrations: false });

/** Applies pending migrations with the DDL user; fails on the first error. */
export async function migrateToLatest(db: Kysely<unknown>): Promise<void> {
  const { error, results } = await migrator(db).migrateToLatest();
  const failed = results?.find((r) => r.status === 'Error');
  if (failed) throw new Error(`Migration failed: ${failed.migrationName}`, { cause: error });
  if (error) throw error instanceof Error ? error : new Error('Migration failed', { cause: error });
}

/** Refuses to start an instance without DDL credentials while a migration is pending (pre-deploy variant). */
export async function assertSchemaCurrent(db: Kysely<unknown>): Promise<void> {
  const pending = (await migrator(db).getMigrations()).filter((m) => m.executedAt === undefined);
  if (pending.length > 0) throw new Error(`Pending migrations: ${pending.map((m) => m.name).join(', ')}`);
}
