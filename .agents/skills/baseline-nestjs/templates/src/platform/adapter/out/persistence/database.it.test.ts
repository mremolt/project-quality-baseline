import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { databaseConfig } from '../../../../../test/postgres.js';
import { createDatabase, createMigrationDatabase } from './database.js';
import { assertSchemaCurrent } from './migrator.js';

interface Db {
  grant_probe: { id: number; text: string };
}

const config = (overrides: Readonly<Record<string, string>> = {}): ReturnType<typeof databaseConfig> =>
  databaseConfig(inject('postgres'), overrides);

describe('database and migrations (NEST-DB-04, NEST-DB-16..18, NEST-RES-01)', () => {
  const open: Kysely<unknown>[] = [];
  const track = <T>(db: Kysely<T>): Kysely<T> => {
    open.push(db as Kysely<unknown>);
    return db;
  };

  beforeAll(async () => {
    // A table the DDL user creates after the grant migration, like every later migration (global setup migrated)
    const ddl = createMigrationDatabase(config());
    try {
      await sql`create table grant_probe (id int primary key, text text not null)`.execute(ddl);
    } finally {
      await ddl.destroy();
    }
  });
  afterAll(async () => {
    await Promise.all(open.map((db) => db.destroy()));
  });

  it('runs the application pool as the DML user with the session timeouts from configuration', async () => {
    const db = track(
      createDatabase(config({ DATABASE_STATEMENT_TIMEOUT_MS: '1500', DATABASE_TRANSACTION_TIMEOUT_MS: '2500' })),
    );
    const { rows } = await sql<Record<string, string>>`select current_user as "user",
      current_setting('statement_timeout') as statement,
      current_setting('transaction_timeout') as transaction,
      current_setting('idle_in_transaction_session_timeout') as idle`.execute(db);
    expect(rows[0]).toEqual({ user: 'orders_app', statement: '1500ms', transaction: '2500ms', idle: '2500ms' });
  });

  it('ends a statement that runs longer than DATABASE_STATEMENT_TIMEOUT_MS', async () => {
    const db = track(
      createDatabase(config({ DATABASE_STATEMENT_TIMEOUT_MS: '200', DATABASE_TRANSACTION_TIMEOUT_MS: '1000' })),
    );
    await expect(sql`select pg_sleep(2)`.execute(db)).rejects.toMatchObject({ code: '57014' });
  });

  it('runs migrations as the DDL user with lock and statement timeouts (NEST-DB-16)', async () => {
    const ddl = track(createMigrationDatabase(config()));
    const { rows } = await sql<Record<string, string>>`select current_user as "user",
      current_setting('lock_timeout') as lock, current_setting('statement_timeout') as statement`.execute(ddl);
    expect(rows[0]).toEqual({ user: 'orders_owner', lock: '5s', statement: '2min' });
  });

  it('lets the DML user read and write later tables, but not change the schema (NEST-DB-17)', async () => {
    const db = track(createDatabase<Db>(config()));
    await db.insertInto('grant_probe').values({ id: 1, text: 'a' }).execute();
    expect(await db.selectFrom('grant_probe').select('text').execute()).toEqual([{ text: 'a' }]);
    await expect(sql`create table forbidden (id int)`.execute(db)).rejects.toMatchObject({ code: '42501' });
  });

  it('reports the schema current to the DML user after the migration (NEST-DB-18)', async () => {
    const db = track(createDatabase(config()));
    await expect(assertSchemaCurrent(db)).resolves.toBeUndefined();
  });
});
