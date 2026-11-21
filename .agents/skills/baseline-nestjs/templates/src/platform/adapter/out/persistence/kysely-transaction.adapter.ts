import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';

import { Inject, Injectable } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';

import { ConcurrentModificationError, UnavailableError } from '../../../domain/index.js';
import type { TransactionPort } from '../../../ports/index.js';
import { KYSELY } from './kysely.token.js';

const current = new AsyncLocalStorage<Transaction<unknown>>();

/** True inside runInTransaction; outgoing HTTP adapters refuse remote calls then (RES-TX-01, NEST-RES-03). */
export const isInTransaction = (): boolean => current.getStore() !== undefined;

const RETRYABLE_SQLSTATE = new Set(['40001', '40P01']); // serialization failure, deadlock
const MAX_ATTEMPTS = 3;

function toPortError(err: unknown): unknown {
  if (err instanceof Error && err.message === 'timeout exceeded when trying to connect') {
    return new UnavailableError('database pool exhausted', 1, { cause: err });
  }
  return err;
}

/** The use case's unit of work (NEST-ARCH-08, NEST-DB): joins nested calls, re-runs on optimistic-lock conflicts. */
@Injectable()
export class KyselyTransactionAdapter implements TransactionPort {
  constructor(@Inject(KYSELY) private readonly db: Kysely<unknown>) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (current.getStore()) return work();
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.transaction().execute((trx) => current.run(trx, work));
      } catch (err) {
        const code = (err as { code?: unknown }).code;
        const retryable =
          err instanceof ConcurrentModificationError || (typeof code === 'string' && RETRYABLE_SQLSTATE.has(code));
        if (!retryable || attempt >= MAX_ATTEMPTS) throw toPortError(err);
        // eslint-disable-next-line sonarjs/pseudo-random -- retry jitter, not security-relevant
        await setTimeout(Math.random() * 50 * attempt);
      }
    }
  }

  /** The executor persistence adapters use: the current transaction, or the plain instance. */
  executor<DB>(): Kysely<DB> {
    return (current.getStore() ?? this.db) as Kysely<DB>;
  }
}
