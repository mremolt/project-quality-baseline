# Resilience and Idempotency

How a service behaves when the things it depends on are slow, down or called twice: timeouts, transactions around remote calls, retries, concurrency limits, idempotency, scheduled jobs in a cluster, and caching. The rules are language-neutral; the Spring settings are in [resilience/spring.md](spring.md), the NestJS ones in [resilience/nestjs.md](nestjs.md). Messaging-specific rules (consumers, dead letters, outbox) are in [messaging/messaging.md](../messaging/messaging.md).

Placement follows the hexagon: timeouts, retries, circuit breakers, concurrency limits and caches are **adapter** concerns, because they depend on the technology. Whether an operation may run twice is a **use case** decision, so idempotency is decided in the application layer through ports (ARCH-ADP-01, ARCH-UC).

## Rules

### Timeouts

- **RES-TMO-01: Every outbound call MUST have an explicit connect timeout and an explicit read (response) timeout.** This covers HTTP clients, database connections and statements, message producers, object storage, mail and any SDK. A library default is not accepted, even if it is finite: it must be visible in configuration. Infinite timeouts (`0`, `-1`, "none") are never used.
  *Why:* a call without a timeout turns one slow dependency into a hung service. Most library defaults are infinite or minutes long.
- **RES-TMO-02: Timeouts are chosen from the caller's budget, not the callee's worst case.** An incoming request with a 10 s budget cannot wait 30 s for one downstream call. Starting values SHOULD be connect 1–2 s and read a little above the dependency's p99 latency. The values per dependency are recorded in the product's chapter 7 with the timeout ladder (RES-TMO-04).
- **RES-TMO-03: Each client adapter has a test that proves the read timeout fires.** The test stubs the dependency with a delay longer than the timeout and asserts the adapter fails within a bounded time and maps the failure to the port's error (no protocol exception crosses the port, ARCH-ADP-01).
- **RES-TMO-04: Timeouts form a ladder, from the outside in: gateway timeout > request budget > transaction timeout > statement timeout.** Each rung is shorter than the one above it, so the inner operation is cancelled first and the caller gets an answer before its own timeout. Outbound calls fit into the request budget with all their attempts: connect + read × attempts + backoff delays stays below the budget minus the time the use case needs for its own work. Default ladder (the product may change the values, not the order):

| Rung | Default | Notes |
|---|---|---|
| Gateway / ingress read timeout | 15 s | Set on the platform; recorded in chapter 7 |
| Request budget | 10 s | The time a synchronous request may take end to end; the rungs below enforce it |
| Outbound call (per dependency) | connect 1–2 s, read from the dependency's p99, attempts × read + backoff < budget | RES-TMO-02, RES-RTY-03 |
| Transaction timeout | 5 s | RES-TX-02 |
| Statement timeout | 3 s | Per database session; a longer report query raises it locally for that query only |

  Message consumers and scheduled jobs have their own budget: the consumer's poll interval (MSG-ERR-02) or the job's lock time (RES-JOB-03), with the same ladder below it. Each product records its ladder (the values per rung and per dependency) in chapter 7 (`docs/architecture/07-deployment-view.md`, section "Timeouts and capacity").
  *Why:* without an outer anchor, every layer picks its own timeout and the outermost one (often the browser or the gateway) gives up while the service is still working, and retries pile on top.

### Transactions and remote calls

- **RES-TX-01: No remote call (HTTP, messaging send, object storage, mail) runs inside an open database transaction.** The use case does remote reads before the transaction, or hands remote side effects to after the commit (outbox, MSG-PUB-02). Short reads and writes to the service's own database are the only I/O inside a transaction.
  *Why:* a remote call inside a transaction holds a database connection and row locks for as long as the remote side is slow, and a rollback cannot undo the remote effect.
- **RES-TX-02: Transactions have a timeout,** below the request budget (RES-TMO-04). A transaction that runs longer than its budget is rolled back, not left holding locks.

### Retries

- **RES-RTY-01: Only idempotent operations are retried automatically.** Reads, `PUT`/`DELETE` by id, and `POST` calls that send an `Idempotency-Key` (RES-IDM-02) may be retried. Anything else is not, because a timeout does not tell you whether the first attempt succeeded.
- **RES-RTY-02: Retries are only for transient failures:** connection errors, timeouts, HTTP 408/429/502/503/504, and optimistic-lock conflicts inside the own service. Other 4xx responses, validation errors and business exceptions are never retried. An optimistic-lock conflict is retried by re-running the whole unit of work (read, change, commit) in a new transaction, never a single statement; the stack file says where that retry lives.
- **RES-RTY-03: Retries use exponential backoff with jitter and a budget:** a maximum number of attempts **and** a maximum total time that fits the caller's budget (RES-TMO-04). Retries without delay or without jitter are not allowed (they synchronise clients into a retry storm). `Retry-After` from the server SHOULD be respected: the next attempt waits at least that long, and when that wait does not fit the remaining budget, the call fails at once with the port's error.
- **RES-RTY-04: Retry in one layer only.** If a message consumer's error handler retries (MSG-ERR-02), the outbound adapter called by that use case does not retry as well; nested retries multiply (3 × 3 × 3 = 27 calls). The product documents which layer retries for each flow.
- **RES-RTY-05: Retries are tested:** an adapter test stubs one transient failure followed by success and asserts the call succeeds; a second test stubs a non-retryable failure and asserts exactly one attempt.

### Circuit breakers, bulkheads and capacity

- **RES-CAP-01: Concurrency towards each dependency is bounded (bulkhead).** A connection pool bounds the database; a concurrency limit bounds each remote dependency whose capacity is lower than ours. When the limit is reached, the caller fails fast or waits a bounded time, never unbounded.
  *Why:* with cheap threads (virtual threads, async runtimes) the number of concurrent requests is no longer limited by a thread pool, so the pool or limit in front of the dependency is the real limit.
- **RES-CAP-02: The database connection pool is sized deliberately.** The sum of all instances' maximum pool sizes stays below the database's connection limit minus a reserve for migrations and operations. "All instances" is the highest count the platform can run at once: the autoscaling maximum plus the extra instances of a rolling deployment (surge), plus every other service or job that uses the same database. The calculation (instances, pool size, other users, reserve, database limit) is recorded in the product's chapter 7 (section "Timeouts and capacity") and updated when any of its inputs changes. The time to wait for a connection is short (seconds) and a timeout there is reported as "service temporarily unavailable", not as an internal error.
- **RES-CAP-03: A circuit breaker SHOULD be added where a failing dependency is called often enough that fast failure matters** (high request volume, a slow-failing dependency, or a fallback that makes sense). It is not a default for every client. Each breaker has a stated fallback (error to the caller, cached value, degraded response) and a test that drives it open.
- **RES-CAP-04: Fallbacks never fake success.** A fallback returns a degraded but truthful answer, or an error. It never reports a write as done that was not done.

### Idempotency

- **RES-IDM-01: Every state-changing entry point states whether it is idempotent, and how.** Natural idempotency (`PUT` of a full state, "set status to X", upsert by business key) is preferred. Where it is not natural, the use case deduplicates with a key.
- **RES-IDM-02: `POST` endpoints that clients may retry (payments, orders, anything a user can double-submit, any call from another service) accept an `Idempotency-Key` header.** The client sends a unique value (UUID) per logical operation and reuses it on every retry. Behaviour:

| Situation | Response |
|---|---|
| New key | Process; store key, caller, request fingerprint and result |
| Same key, same caller, same fingerprint, finished | Replay the stored status and body; do not process again |
| Same key, still in progress | The duplicate waits a bounded time (the statement timeout, RES-TMO-04) for the first request to finish, then replays its result. If the first request rolled back, the duplicate processes. If the wait exceeds the bound: `409` (problem+json); the client retries later |
| Same key, different fingerprint | `409` (problem+json, its own `type`); the draft standard uses 422, which our REST conventions do not use (API-REST-06) |
| Header missing on an endpoint that requires it | `400` |

- **RES-IDM-03: The key is stored in the same transaction as the business change**, with a unique constraint on (caller, key), as the first write of that transaction. The insert must not abort the transaction on a duplicate: it uses the database's conflict-free form (PostgreSQL: `INSERT … ON CONFLICT DO NOTHING`) and then reads the stored row when nothing was inserted. A concurrent duplicate waits on the unique index until the first transaction ends, which gives the "still in progress" behaviour of RES-IDM-02. The adapter extracts the header; the command carries the key as a core value object; the use case records it through an outgoing port. Storing the key in a separate store after the commit leaves a window where a retry runs twice.
- **RES-IDM-04: Keys have a time to live** (default 24 hours, at least the client's longest retry window), and a scheduled job purges expired keys (RES-JOB-01).
- **RES-IDM-05: Idempotency is tested at the use case and at the store.** The use case test calls twice with the same key and asserts one effect and the same result; the persistence test asserts the unique constraint rejects a concurrent duplicate.
- **RES-IDM-06: Remote side effects are covered by the same idempotency.** A use case that writes to another system either hands that write to the outbox after the commit (MSG-PUB-02), so a replayed request finds it already recorded, or, when the remote write must happen before the transaction (RES-TX-01), sends an idempotency key derived from the incoming one (the same key, or the key plus a step name) to the remote system. A remote write without either repeats on every client retry. Where the remote system accepts no key, the product records the gap and its handling in chapter 11.

### Scheduled jobs

- **RES-JOB-01: A scheduled job is an incoming adapter that calls an incoming port** (ARCH-ADP-02), like a controller. It contains no business logic.
- **RES-JOB-02: In a deployment with more than one instance, every scheduled job either runs under a cluster-wide lock or is proven safe to run concurrently on all instances** (idempotent, and work items claimed with row locks such as `FOR UPDATE SKIP LOCKED`). Which applies is stated on the job.
- **RES-JOB-03: Jobs work in bounded batches** and are safe to stop at any point: the next run continues where the last one stopped. A lock's maximum hold time is longer than the job's longest expected run.

### Caching

- **RES-CCH-01: A cache is an adapter concern.** It wraps an outgoing port's implementation (or sits in the outgoing adapter), never in `domain`, `ports` or `application`. The core does not know whether an answer came from a cache.
- **RES-CCH-02: What may be cached:** reference and configuration data, results of expensive reads from other systems, and anything whose staleness the business accepts. **Not cached** without an ADR: authorization decisions, data that depends on the caller unless the caller (and tenant) is part of the key, and anything whose staleness causes a wrong write.
- **RES-CCH-03: Every cache has a maximum size and a time to live,** and its invalidation is written down: TTL only (staleness up to the TTL accepted), or explicit eviction on change (and how other instances learn of it). Unbounded caches are not allowed.
- **RES-CCH-04: Local in-memory caches are the default.** A shared cache (Redis or similar) is new infrastructure and needs an ADR. HTTP response caching of authenticated API responses is off (`Cache-Control: no-store`, SPRING-SEC-13, NEST-SEC-20).
- **RES-CCH-05: Cached adapters are tested** for a hit (the dependency is called once for two reads), expiry or eviction, and key separation per caller or tenant where RES-CCH-02 requires it.

## Anti-patterns

- A client created with `new` and library defaults "because it is only a small call".
- A 30 s read timeout behind a gateway that gives up after 15 s.
- `@Transactional` use case that calls a payment API and then saves the order.
- Retrying a `POST` without an idempotency key after a read timeout.
- Retries in the client adapter, again in the message error handler, and again in the caller.
- A cache in front of a query that returns "orders of the current user", keyed by order status only.
- A nightly job that runs once per instance and sends every e-mail three times.

## Agent checklist

- [ ] New outbound call: connect and read timeout set explicitly; timeout test (RES-TMO-01/03)?
- [ ] Timeouts fit the ladder: gateway > request budget > transaction > statement; attempts × read + backoff within the budget; ladder recorded in chapter 7 (RES-TMO-04)?
- [ ] No remote call inside the use case's transaction (RES-TX-01)?
- [ ] Retries only for idempotent operations and transient errors, with backoff, jitter and a budget, in one layer (RES-RTY)?
- [ ] Concurrency to the dependency bounded; pool size and wait time set deliberately, pool sum recorded in chapter 7 (RES-CAP-01/02)?
- [ ] New state-changing entry point: idempotency stated; `Idempotency-Key` for retryable `POST`s, stored in the same transaction with a conflict-free insert; remote writes through the outbox or with a derived key (RES-IDM)?
- [ ] New scheduled job: calls an incoming port; cluster lock or concurrency-safe (RES-JOB-02)?
- [ ] New cache: in the adapter, bounded, TTL, invalidation stated, caller in the key where needed (RES-CCH)?
- [ ] Security-relevant (new outbound call)? Then the threat model note (SEC-TM-02).

## Sources

Michael T. Nygard, *Release It!*, 2nd ed. (timeouts, circuit breaker, bulkhead, steady state). AWS Builders' Library: *Timeouts, retries, and backoff with jitter*; *Making retries safe with idempotent APIs*. IETF draft *The Idempotency-Key HTTP Header Field* (draft-ietf-httpapi-idempotency-key-header). Google SRE Book, ch. 22 (*Addressing Cascading Failures*). HikariCP wiki, *About Pool Sizing*.
