import { type Kysely, sql } from 'kysely';

/**
 * The DML user may read and write every table the DDL user creates, but not change the schema (NEST-DB-17, REL-DB-01).
 * Its name comes from the migration connection (`-c app.runtime_role=<DATABASE_USER>`), never from the migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const { rows } = await sql<{ role: string }>`select current_setting('app.runtime_role') as role`.execute(db);
  const role = rows[0]?.role;
  if (!role) throw new Error('app.runtime_role is not set on the migration connection');
  const app = sql.id(role);
  await sql`grant usage on schema public to ${app}`.execute(db);
  await sql`alter default privileges in schema public grant select, insert, update, delete on tables to ${app}`.execute(
    db,
  );
  await sql`alter default privileges in schema public grant usage, select on sequences to ${app}`.execute(db);
  await sql`grant select on kysely_migration to ${app}`.execute(db); // assertSchemaCurrent as the DML user (NEST-DB-18)
}
