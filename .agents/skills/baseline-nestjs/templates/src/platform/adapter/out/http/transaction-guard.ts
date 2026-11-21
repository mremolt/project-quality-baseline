import { Logger } from '@nestjs/common';
import type { Dispatcher } from 'undici';

import { isInTransaction } from '../persistence/kysely-transaction.adapter.js';

const log = new Logger('TransactionGuard');

/**
 * undici interceptor that catches a remote call inside a database transaction (RES-TX-01, NEST-RES-03): `fail`
 * throws before the request leaves (integration tests), `warn` logs and lets it through. Every outgoing HTTP adapter
 * composes its Agent with it: `new Agent({ … }).compose(transactionGuard(resilience.RESILIENCE_TRANSACTION_GUARD))`.
 */
export function transactionGuard(
  mode: 'fail' | 'warn',
  inTransaction: () => boolean = isInTransaction,
): Dispatcher.DispatcherComposeInterceptor {
  return (dispatch) => (opts, handler) => {
    if (inTransaction()) {
      const message = `remote call inside a transaction: ${opts.method} ${String(opts.origin)}`;
      if (mode === 'fail') throw new Error(message);
      log.warn(message);
    }
    return dispatch(opts, handler);
  };
}
