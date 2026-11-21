# NestJS: Resilience and Idempotency

The Node and NestJS settings and code for [resilience.md](resilience.md) (`RES-*`). Libraries: `undici` for outbound HTTP, `cockatiel` 4 for retry, circuit breaker, bulkhead and timeout policies (NEST-D10, only in outgoing adapters), `@nestjs/schedule` for jobs, `lru-cache` for caches, `piscina` for CPU work. Message consumer retries and dead letters: [../messaging/nestjs.md](../messaging/nestjs.md).

## Rules

### Timeouts (RES-TMO)

- **NEST-RES-01: Every outbound call has explicit timeouts, set from configuration** (RES-TMO-01/02):

| Client | Connect | Read / overall |
|---|---|---|
| HTTP (`undici`) | `connectTimeout` on the dependency's `Agent` | `signal: AbortSignal.timeout(<READ_TIMEOUT_MS>)` on **every** call (the deadline for headers and body together); `headersTimeout` and `bodyTimeout` on the `Agent` as a network backstop |
| PostgreSQL (`pg.Pool`) | `connectionTimeoutMillis` (waiting for a pool slot plus connecting) | `statement_timeout` per session; `transaction_timeout` (PostgreSQL 17 or later) for RES-TX-02; both through the connection's `options` |
| Kafka producer | see [../messaging/nestjs.md](../messaging/nestjs.md) | same |
| OIDC discovery and token calls (BFF) | see [../security/nestjs-hardening.md](../security/nestjs-hardening.md) | same |

  `fetch` and `Agent` are both imported from the pinned `undici` package, one `Agent` per dependency, created in the adapter's module from its config schema and closed in `onApplicationShutdown`. The global `fetch` is banned by ESLint `no-restricted-globals` in `src/**`: without a dispatcher it uses Node's default agent (connect 10 s, headers and body 300 s). undici's socket timeouts are imprecise (in the scratch build `headersTimeout: 200` and `connectTimeout: 300` both fired after about 1 s; undici documents a resolution of about 0.5 s), and `bodyTimeout` measures the gap between chunks, not the whole body, so the per-call `AbortSignal` is the deadline that RES-TMO-04 counts; keep the `Agent` values at 1 s or more. Generated clients get the adapter's `fetch` and dispatcher passed in (NEST-LIB-07).

```ts
// adapter/out/http/payment-http.adapter.ts (excerpt)
const agent = new Agent({ connectTimeout: 1000, headersTimeout: cfg.PAYMENT_READ_TIMEOUT_MS, bodyTimeout: cfg.PAYMENT_READ_TIMEOUT_MS, connections: 20 });
const res = await fetch(url, { dispatcher: agent, signal: AbortSignal.any([policySignal, AbortSignal.timeout(cfg.PAYMENT_READ_TIMEOUT_MS)]) });
```

```ts
// platform persistence (database.ts): pg pool on the default ladder (statement 3 s < transaction 5 s < request budget 10 s)
const pool = new pg.Pool({
  ...connection,                                              // from the database config schema
  max: db.DATABASE_POOL_MAX,                                  // RES-CAP-02, NEST-RES-04
  connectionTimeoutMillis: db.DATABASE_CONNECTION_TIMEOUT_MS, // default 2000
  options: [
    `-c statement_timeout=${db.DATABASE_STATEMENT_TIMEOUT_MS}`,                       // default 3000
    `-c transaction_timeout=${db.DATABASE_TRANSACTION_TIMEOUT_MS}`,                   // default 5000
    `-c idle_in_transaction_session_timeout=${db.DATABASE_TRANSACTION_TIMEOUT_MS}`,   // NEST-DB-04
  ].join(' '),
});
pool.on('error', (err) => log.error({ err }, 'Idle database connection failed'));
pool.on('connect', (client) => client.on('error', (err) => log.error({ err }, 'Database connection failed')));
```

  The two `error` listeners are required: when the server ends a connection (`transaction_timeout` does that, so do restarts and failovers), pg emits `error` on the pool or on the checked-out client, and an `error` event without a listener crashes the process. The pool itself belongs to the persistence rules ([../persistence/nestjs.md](../persistence/nestjs.md)); this file sets its timeouts. Nest does not cancel a request whose budget has run out; the rungs below (transaction, statement and call timeouts, the total timeout of NEST-RES-07) enforce RES-TMO-04.
- **NEST-RES-02: Every HTTP adapter has a timeout test against a delaying stub** (RES-TMO-03): the test starts a `node:http` server on port 0 that answers later than the read timeout, calls the adapter, and asserts that the port's error arrives within the timeout plus a small margin. A timed-out call rejects with a `DOMException` named `TimeoutError` (the `AbortSignal`) or a `TypeError` whose `cause.code` is `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT` or `UND_ERR_BODY_TIMEOUT`; the adapter maps all of them to the port's error, never passes them through (ARCH-ADP-01).

### Transactions and remote calls (RES-TX)

- **NEST-RES-03: Remote calls run before or after the transaction, never inside it** (RES-TX-01). The use case calls remote ports first and then runs its database work through the transaction port ([../persistence/nestjs.md](../persistence/nestjs.md)); remote side effects after the commit go through the outbox. Tests catch violations: every HTTP `Agent` is composed with a guard interceptor that asks the persistence adapter whether a transaction is open in the current async context and then throws (`fail`) or logs a `warn` (`warn`). The mode is `RESILIENCE_TRANSACTION_GUARD` (`z.enum(['fail', 'warn'])`, default `warn`) in the platform's `ResilienceConfig`, provided as `RESILIENCE_CONFIG` by the platform module; the `it` project of `vitest.config.ts` sets `fail` (`test.env`), so every `*.it.test.ts` fails on a violation. The interceptor is the template's `transactionGuard` in `src/platform/adapter/out/http/transaction-guard.ts` (unit-tested against a `node:http` server in both modes). The outbox relay's send path uses the same check.

```ts
// src/platform/adapter/out/http/transaction-guard.ts (excerpt)
export const transactionGuard = (mode: 'fail' | 'warn', inTransaction = isInTransaction): Dispatcher.DispatcherComposeInterceptor =>
  (dispatch) => (opts, handler) => {
    if (inTransaction()) {
      const message = `remote call inside a transaction: ${opts.method} ${String(opts.origin)}`;
      if (mode === 'fail') throw new Error(message);
      log.warn(message);
    }
    return dispatch(opts, handler);
  };

// in an outgoing HTTP adapter's module
const agent = new Agent({ connectTimeout: 1000, … }).compose(transactionGuard(resilience.RESILIENCE_TRANSACTION_GUARD));
```

  An optimistic-lock or serialization conflict (RES-RTY-02) is retried by re-running the whole unit of work: the transaction adapter re-runs the callback in a new transaction on the port's conflict error, bounded like NEST-RES-07. It is never retried inside the callback, and remote calls made before the transaction are not repeated. In a flow started by a message consumer the consumer's error handling retries instead (NEST-RES-08).

### Capacity (RES-CAP)

- **NEST-RES-04: The pg pool is the database limit; its size is explicit and its wait is short.** `max` is the pool sum of RES-CAP-02 divided by the instance count (recorded in chapter 7); `connectionTimeoutMillis` is a few seconds. A pool wait timeout rejects with a plain `Error` whose message is `timeout exceeded when trying to connect`; the persistence adapter maps it to the port's "temporarily unavailable" error, and the problem-details filter answers `503` with `Retry-After` (API-REST-06).
- **NEST-RES-05: Each remote dependency gets a bulkhead that rejects:** `bulkhead(limit, 0)` from cockatiel, one instance per adapter (the adapter is a singleton provider), with an explicit limit from configuration. Queue `0` makes excess calls fail at once with `BulkheadRejectedError`; the adapter maps it to the port's "temporarily unavailable" error (→ `503` with `Retry-After`) or the use case's fallback. A non-zero queue is allowed only with the call's `AbortSignal` bounding the wait. undici's `connections` caps sockets per origin, but further requests wait in undici's queue, so it is not the bulkhead.
- **NEST-RES-06: A circuit breaker, where RES-CAP-03 calls for one, uses cockatiel and is shared by all calls of the adapter:** `circuitBreaker(handleWhen(isTransient), { halfOpenAfter, breaker })` with `new ConsecutiveBreaker(n)` or `new SamplingBreaker({ threshold, duration, minimumRps })`. An open circuit throws `BrokenCircuitError` (`isBrokenCircuitError`), which the adapter maps to its stated fallback (RES-CAP-04). The test drives it open with stubbed failures and asserts the fallback.

### Retries (RES-RTY)

- **NEST-RES-07: Retries are a cockatiel policy in the outgoing adapter, with a filter, jittered backoff and a total timeout:** `wrap(timeout(totalMs, TimeoutStrategy.Aggressive), retry(handleWhen(isTransient), { maxAttempts, backoff }), breaker?, bulkhead)`. `maxAttempts` counts retries, not calls (`2` means up to three calls). `ExponentialBackoff` uses decorrelated jitter by default; set `initialDelay` and `maxDelay`. The total timeout covers all attempts and delays, and its `signal` is passed into each call together with the per-call deadline (`AbortSignal.any`). `totalMs` plus one call timeout fits the request budget (RES-TMO-04). `isTransient` accepts exactly RES-RTY-02: the timeout errors of NEST-RES-02, connection errors (`cause.code` `UND_ERR_SOCKET`, `ECONNRESET`, `ECONNREFUSED`) and an adapter error for HTTP 408, 429, 502, 503 and 504. Only idempotent calls get the retry policy (RES-RTY-01).

```ts
const exp = new ExponentialBackoff({ initialDelay: 200, maxDelay: 2000 });
// Retry-After (RES-RTY-03): wait at least what the server asked for; the total timeout still bounds it
const backoff = new DelegateBackoff<IRetryBackoffContext<unknown>, IBackoff<unknown> | undefined>((ctx, prev) => {
  const next = prev ? prev.next(ctx) : exp.next();
  const err = 'error' in ctx.result ? ctx.result.error : undefined;
  return { delay: Math.max(next.duration, err instanceof TransientHttpError ? err.retryAfterMs ?? 0 : 0), state: next };
});
const policy = wrap(
  timeout(6000, TimeoutStrategy.Aggressive),                 // pricing read timeout 2 s: 6 s + 2 s < 10 s budget
  retry(handleWhen(isTransient), { maxAttempts: 2, backoff }),
  bulkhead(cfg.PRICING_MAX_CONCURRENT_CALLS, 0),
);
const price = await policy.execute(({ signal }) => this.callPricing(items, signal));
```

- **NEST-RES-08: An adapter called from a message consumer does not retry;** the consumer's error handling owns the retries for that flow (RES-RTY-04, [../messaging/nestjs.md](../messaging/nestjs.md)). If one adapter serves both REST and messaging flows, it keeps `maxAttempts ≤ 1` and the product documents its retry layering.

### Idempotency (RES-IDM)

- **NEST-RES-09: The REST adapter reads `Idempotency-Key` and passes it in the command as a core value object.** The value object holds the key plus a SHA-256 fingerprint of the canonical request body, computed in the adapter with `node:crypto`. The use case calls an outgoing `IdempotencyStore` port first in its transaction and stores its result through the same port before the commit. The Kysely adapter inserts without aborting the transaction on a duplicate, then reads the stored row when nothing was inserted: same fingerprint → replay the stored result; different fingerprint → the port's mismatch error (`409`). A concurrent duplicate waits on the primary key until the first transaction ends, bounded by `statement_timeout`; the cancelled wait has SQLSTATE `57014`, which the adapter maps to the port's "in progress" error (`409`). A missing header on an endpoint that requires it is `400`. The header and its `400`/`409` responses are in the OpenAPI spec ([../api/nestjs-openapi.md](../api/nestjs-openapi.md)).

```ts
const claimed = await trx.insertInto('idempotency_keys')
  .values({ caller_id: caller.id, key: cmd.idempotencyKey.value, fingerprint: cmd.idempotencyKey.fingerprint,
            created_at: sql`now()`, expires_at: sql`now() + interval '24 hours'` })
  .onConflict((oc) => oc.columns(['caller_id', 'key']).doNothing())
  .returning('key')
  .executeTakeFirst();                        // undefined → the key exists: read the stored row
```

- **NEST-RES-10: The idempotency table is a Kysely migration** ([../persistence/nestjs.md](../persistence/nestjs.md)): `caller_id text`, `key text`, `fingerprint text`, `result jsonb`, `created_at timestamptz`, `expires_at timestamptz`, primary key `(caller_id, key)`. A scheduled job purges expired rows (RES-IDM-04, NEST-RES-11).

### Scheduled jobs (RES-JOB)

- **NEST-RES-11: Jobs are `@Cron` methods in `adapter/in/scheduling`, call an incoming port, and run under a cluster lock** (RES-JOB-01/02). `ScheduleModule.forRoot()` is imported once in `app.module.ts`. Each job sets `name` and `waitForCompletion: true` (no overlapping runs in one instance; on shutdown Nest waits for the running job, NEST-OBS rules in [../observability/nestjs.md](../observability/nestjs.md)) and catches and logs its own errors. The lock is `withClusterLock` from `src/platform/adapter/out/persistence/cluster-lock.ts`: a PostgreSQL session advisory lock on one dedicated connection, outside any transaction, taken with `pg_try_advisory_lock` (another instance holding it means: skip this run), released in `finally`, and released by PostgreSQL when the connection or the process dies. `maxRunMs` aborts the job's signal (RES-JOB-03: the job works in batches and stops between them when the signal is aborted); `minHoldMs` keeps the lock for a minimum time so an instance whose timer fires late does not run the same tick again. No ShedLock table and no extra dependency.

```ts
// src/platform/adapter/out/persistence/cluster-lock.ts
export async function withClusterLock<T>(
  db: Kysely<unknown>, name: string, opts: { maxRunMs: number; minHoldMs: number },
  job: (signal: AbortSignal) => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  return db.connection().execute(async (conn) => {                     // one dedicated connection
    const { rows } = await sql<{ locked: boolean }>`select pg_try_advisory_lock(hashtextextended(${name}, 0)) as locked`.execute(conn);
    if (!rows[0]?.locked) return { ran: false };
    const started = Date.now();
    try {
      return { ran: true, value: await job(AbortSignal.timeout(opts.maxRunMs)) };
    } finally {
      const rest = opts.minHoldMs - (Date.now() - started);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
      await sql`select pg_advisory_unlock(hashtextextended(${name}, 0))`.execute(conn);
    }
  });
}

// features/orders/adapter/in/scheduling/purge-idempotency-keys.job.ts
// Scheduling adapters may inject KYSELY (from src/platform/adapter/out/persistence/kysely.token.ts) for the lock only;
// the job's database work runs in the use case through the transaction port (NEST-DB-04)
constructor(
  @Inject(PURGE_EXPIRED_KEYS) private readonly purgeExpired: PurgeExpiredKeysUseCase,
  @Inject(KYSELY) private readonly db: Kysely<unknown>,
) {}

@Cron('0 15 * * * *', { name: 'purgeIdempotencyKeys', waitForCompletion: true })
async purge(): Promise<void> {
  try {
    await withClusterLock(this.db, 'purgeIdempotencyKeys', { maxRunMs: 5 * 60_000, minHoldMs: 30_000 }, (signal) => this.purgeExpired.purge(signal));
  } catch (err) {
    this.log.error({ err }, 'Job purgeIdempotencyKeys failed');
  }
}
```

  `pg_try_advisory_xact_lock` is not used: it would hold a transaction open for the whole job (RES-TX-01/02). A job that claims rows with `select … for update skip locked` may run on all instances without the lock; the job states which applies (RES-JOB-02).
- **NEST-RES-12: Jobs are tested as adapters:** a unit test calls the job method with a mocked port and verifies the call (London style); `cluster-lock.it.test.ts` runs against Testcontainers PostgreSQL with two `Kysely` instances (two "instances"): concurrent runs execute once, the lock is free again afterwards and after a thrown job, `minHoldMs` blocks a second run, `maxRunMs` aborts the signal, and terminating the holding backend frees the lock.

### Event loop

- **NEST-RES-13: CPU-heavy work runs in worker threads, behind an outgoing port** (NODE-ARCH-10). Work that takes more than a few milliseconds of CPU per request (PDF or image rendering, large exports, hashing many items) goes to a `piscina` pool in the adapter that implements the port: `new Piscina({ filename, maxThreads, maxQueue })` with explicit `maxThreads` (the instance's CPU limit minus one for the event loop) and `maxQueue` (a full queue rejects with "Task queue is at limit": map it like a bulkhead rejection, NEST-RES-05), and `pool.run(input, { signal })` with the call's deadline. Workers receive and return plain data. Password hashing uses the async `node:crypto` functions, which already run on libuv's thread pool.

### Caching (RES-CCH)

- **NEST-RES-14: Caches are `lru-cache` instances inside the outgoing adapter** (RES-CCH-01/03), with both `max` and `ttl` set (the library rejects a cache with neither, but `ttl` alone does not bound memory). `fetchMethod` with `cache.fetch(key)` deduplicates concurrent loads of the same key. Keys that depend on the caller include caller and tenant id (RES-CCH-02). Nothing from a cache library is imported in `domain`, `ports` or `application`. A shared cache (Redis) needs an ADR (RES-CCH-04).

- **NEST-RES-15: Bulk use cases hand per-item remote calls to a job** (RES-JOB-04): the use case writes the item rows (or a status column) in its unit of work and returns; an `adapter/in/scheduling` job (NEST-RES-11) picks `PENDING` items with `FOR UPDATE SKIP LOCKED` in batches, calls the outgoing port through the policy of NEST-RES-07 and records the result per item. An integration test with a port stub that takes longer than the request budget asserts that the request still answers within it and that the job finishes the items.

## Tests

| What | How |
|---|---|
| Timeout (RES-TMO-03) | NEST-RES-02 |
| Retry (RES-RTY-05) | Delaying or failing `node:http` stub: one transient failure then success → one success and two calls; a `400` → exactly one call; `Retry-After: 1` → the second call comes after at least 1 s |
| Bulkhead, breaker | Fill the bulkhead with slow calls and assert the next call gets the port's error at once; drive the breaker open and assert the fallback |
| Remote call in a transaction | Every `*.it.test.ts` with `RESILIENCE_TRANSACTION_GUARD=fail` (NEST-RES-03) |
| Idempotency (RES-IDM-05) | Use case test: same key twice → one effect, same result; persistence `*.it.test.ts`: a concurrent duplicate waits and gets the stored result or `57014` |
| Cluster lock | NEST-RES-12 |
| Cache (RES-CCH-05) | Hit (dependency called once for two reads), expiry with a short `ttl`, key separation per caller |

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Resilience and Idempotency".*
