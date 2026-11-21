import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { databaseConfig } from '../../../../../test/postgres.js';
import { ConcurrentModificationError, UnavailableError } from '../../../domain/index.js';
import { createDatabase, createMigrationDatabase } from './database.js';
import { isInTransaction, KyselyTransactionAdapter } from './kysely-transaction.adapter.js';

interface Db {
  notes: { id: number; text: string };
}

class NoteModifiedConcurrently extends ConcurrentModificationError {
  constructor() {
    super('NOTE_MODIFIED_CONCURRENTLY', 'Note modified concurrently');
  }
}

describe('KyselyTransactionAdapter (NEST-ARCH-08, NEST-DB-08/09/22)', () => {
  let db: Kysely<Db>;
  let tx: KyselyTransactionAdapter;

  beforeAll(async () => {
    const ddl = createMigrationDatabase(databaseConfig(inject('postgres')));
    await sql`create table notes (id int primary key, text text not null)`.execute(ddl); // own table per test file
    await ddl.destroy();
    db = createDatabase<Db>(databaseConfig(inject('postgres'))); // the DML user, as in production
    tx = new KyselyTransactionAdapter(db as Kysely<unknown>);
  });
  afterAll(async () => {
    await db.destroy();
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

  it('hides uncommitted rows from other connections', async () => {
    await tx.runInTransaction(async () => {
      await tx.executor<Db>().insertInto('notes').values({ id: 4, text: 'd' }).execute();
      expect(await count()).toBe(2); // db is the pool, not the open transaction
    });
    expect(await count()).toBe(3);
  });

  it('gives concurrent units of work their own transactions', async () => {
    const txid = (): Promise<string> =>
      tx.runInTransaction(async () => {
        const { rows } = await sql<{ id: string }>`select txid_current()::text as id`.execute(tx.executor());
        return rows[0]!.id;
      });
    const [a, b] = await Promise.all([txid(), txid()]);
    expect(a).not.toBe(b);
  });

  it('re-runs the whole unit of work on a concurrent modification (NEST-DB-09)', async () => {
    let attempts = 0;
    await tx.runInTransaction(async () => {
      attempts++;
      await tx.executor<Db>().insertInto('notes').values({ id: 5, text: 'e' }).execute();
      if (attempts === 1) throw new NoteModifiedConcurrently();
    });
    expect(attempts).toBe(2);
    expect(await count()).toBe(4);
  });

  it('turns an exhausted pool into UnavailableError after DATABASE_CONNECTION_TIMEOUT_MS', async () => {
    const tiny = createDatabase(
      databaseConfig(inject('postgres'), { DATABASE_POOL_MAX: '1', DATABASE_CONNECTION_TIMEOUT_MS: '200' }),
    );
    const blocking = new KyselyTransactionAdapter(tiny);
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const holding = new Promise<void>((resolve) => (started = resolve));
    const held = blocking.runInTransaction(() => {
      started(); // the only connection is taken now
      return new Promise<void>((resolve) => (release = resolve));
    });
    await holding;
    await expect(blocking.runInTransaction(() => Promise.resolve())).rejects.toBeInstanceOf(UnavailableError);
    release();
    await held;
    await tiny.destroy();
  });
});
