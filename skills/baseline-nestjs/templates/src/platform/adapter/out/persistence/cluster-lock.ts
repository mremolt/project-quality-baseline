import { setTimeout } from 'node:timers/promises';

import { type Kysely, sql } from 'kysely';

/** Runs a job on one instance only (session advisory lock on a dedicated connection; NEST-RES). */
export async function withClusterLock<T>(
  db: Kysely<unknown>,
  name: string,
  opts: { maxRunMs: number; minHoldMs: number },
  job: (signal: AbortSignal) => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  return db.connection().execute(async (conn) => {
    const { rows } = await sql<{
      locked: boolean;
    }>`select pg_try_advisory_lock(hashtextextended(${name}, 0)) as locked`.execute(conn);
    if (!rows[0]?.locked) return { ran: false };
    const started = Date.now();
    try {
      return { ran: true, value: await job(AbortSignal.timeout(opts.maxRunMs)) };
    } finally {
      const rest = opts.minHoldMs - (Date.now() - started);
      if (rest > 0) await setTimeout(rest);
      await sql`select pg_advisory_unlock(hashtextextended(${name}, 0))`.execute(conn);
    }
  });
}
