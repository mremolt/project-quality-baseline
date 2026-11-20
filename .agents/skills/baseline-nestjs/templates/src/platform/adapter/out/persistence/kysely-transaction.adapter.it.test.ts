import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UnavailableError } from '../../../domain/index.js';
import { isInTransaction, KyselyTransactionAdapter } from './kysely-transaction.adapter.js';
import { assertSchemaCurrent, migrateToLatest } from './migrator.js';

interface Db {
  notes: { id: number; text: string };
}

describe('KyselyTransactionAdapter (NEST-ARCH-08)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Kysely<Db>;
  let tx: KyselyTransactionAdapter;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
    db = new Kysely<Db>({
      dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: container.getConnectionUri() }) }),
    });
    await migrateToLatest(db as Kysely<unknown>);
    await assertSchemaCurrent(db as Kysely<unknown>);
    await sql`create table notes (id int primary key, text text not null)`.execute(db);
    tx = new KyselyTransactionAdapter(db as Kysely<unknown>);
  });
  afterAll(async () => {
    await db.destroy();
    await container.stop();
  });

  const count = async (): Promise<number> =>
    Number(
      (
        await db
          .selectFrom('notes')
          .select((e) => e.fn.countAll().as('n'))
          .executeTakeFirstOrThrow()
      ).n,
    );

  it('commits the unit of work and joins nested calls', async () => {
    await tx.runInTransaction(async () => {
      expect(isInTransaction()).toBe(true);
      await tx.executor<Db>().insertInto('notes').values({ id: 1, text: 'a' }).execute();
      await tx.runInTransaction(() => tx.executor<Db>().insertInto('notes').values({ id: 2, text: 'b' }).execute());
    });
    expect(isInTransaction()).toBe(false);
    expect(await count()).toBe(2);
  });

  it('rolls back every write when the work fails', async () => {
    await expect(
      tx.runInTransaction(async () => {
        await tx.executor<Db>().insertInto('notes').values({ id: 3, text: 'c' }).execute();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await count()).toBe(2);
  });

  it('turns an exhausted pool into UnavailableError', async () => {
    const tiny = new Kysely<Db>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: container.getConnectionUri(), max: 1, connectionTimeoutMillis: 200 }),
      }),
    });
    const blocking = new KyselyTransactionAdapter(tiny as Kysely<unknown>);
    let release: () => void = () => undefined;
    const held = blocking.runInTransaction(() => new Promise<void>((resolve) => (release = resolve)));
    await new Promise((r) => setTimeout(r, 100));
    await expect(blocking.runInTransaction(() => Promise.resolve())).rejects.toBeInstanceOf(UnavailableError);
    release();
    await held;
    await tiny.destroy();
  });
});
