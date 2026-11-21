# NestJS: Data Protection

How a NestJS backend implements [data-protection.md](data-protection.md) (`DP-*`): retention jobs, erasure across tables, history, messaging and idempotency stores and Kafka topics, and tests that prove deletion and the absence of personal data in logs. Persistence: [../persistence/nestjs.md](../persistence/nestjs.md); jobs and the cluster lock: NEST-RES-11 in [../resilience/nestjs.md](../resilience/nestjs.md); log redaction: NEST-LOG-05/09 in [../logging/nestjs.md](../logging/nestjs.md).

## Rules

### Retention jobs (DP-RET-02, RES-JOB)

- **NEST-DP-01: A retention job is an incoming adapter in `adapter/in/scheduling`**: a `@Cron` method (`waitForCompletion: true`) that runs under `withClusterLock` (NEST-RES-11) and only calls a use case (`PurgeExpiredCustomerAccountsUseCase`). The use case gets the current time from an injected clock function (`() => Date`, created in the module's `useFactory`) and computes the cut-off from the retention period, which is a constructor argument from configuration; no date literal or `now()` in the SQL.
- **NEST-DP-02: Deletion runs in bounded batches, one transaction per batch.** The port deletes one batch and returns the count; the use case repeats `runInTransaction(() => port.purgeBatch(cutoff, size))` until it returns 0 or the job's `AbortSignal` is aborted (RES-JOB-03), so a stopped run continues next time. The Kysely adapter deletes with a limited subquery:

```ts
const res = await this.tx.executor().deleteFrom('customer_accounts')
  .where('id', 'in', (eb) => eb.selectFrom('customer_accounts').select('id')
    .where('closed_at', '<', cutoff).orderBy('closed_at').limit(size))
  .executeTakeFirst();
return Number(res.numDeletedRows);
```

  A single unbounded `DELETE` on a large table holds locks and runs into `statement_timeout`.
- **NEST-DP-03: Child tables owned by the person reference their parent with `ON DELETE CASCADE`** in the migration (`.references('customer_accounts.id').onDelete('cascade')`). One delete per aggregate then removes everything the deletion concept lists for that category. Tables that must outlive the person (statutory retention, DP-RET-03) use a nullable foreign key or keep only the id, and are listed in the deletion concept.
- **NEST-DP-04: History, messaging and idempotency stores are part of erasure and retention:** own history tables, the outbox, stored idempotency results (RES-IDM-03/04), inbox deduplication rows (MSG-IDM-02) and dead-letter topics or tables (MSG-DLT-01) are in the deletion concept and covered by the erasure and retention adapters; a dead-letter or inbox entry keeps its payload only as long as its retention says. Security audit events carry only the pseudonymous user id and follow their own retention (SEC-AUD-02).

### Erasure and export (DP-DSR)

- **NEST-DP-05: Each context that stores personal data publishes an exporter and an eraser** (`PersonalDataExporter`, `PersonalDataEraser` port contracts in `src/platform/ports/out`, implemented in the context's persistence adapter, tokens exported through the context's `index.ts`). Nest has no multi-providers, so the data subject use case's module injects every context's tokens explicitly in its `useFactory` and passes them as an array (DP-DSR-02). A unit test fails when a context listed in the inventory's storage locations is missing from that array. Each eraser deletes or anonymises in one `runInTransaction`; topics and other systems are reached through their own outgoing ports after the commit (outbox, RES-TX-01).

### Kafka (DP-MIN-02, DP-RET-04)

- **NEST-DP-06: Events are keyed by the person's or aggregate's id and carry personal fields only where the consumer needs them.** Topic `retention.ms` is in the deletion concept. On compacted topics erasure publishes a tombstone (null value) for the key through the producer adapter ([../messaging/nestjs.md](../messaging/nestjs.md)); older values disappear only after compaction, which the deletion concept counts into the deletion time. Topics that keep history use crypto-shredding for personal fields (SEC-CRY-04).

### Logs and telemetry (DP-TEL)

- **NEST-DP-07: Personal data never reaches logs, spans or metric labels** (DP-TEL-01). Request lines carry only method, path, status and duration (NEST-LOG-05); pino `redact` paths cover headers with credentials and the personal-data field names of the context's payloads (`*.email`, `*.name`, `customer.*`), with a fixed `censor`. Redaction is the safety net; the rule is that code logs ids, not payloads (NEST-LOG-09). Personal data never appears in a URL path or query string (DP-TEL-02).

### Tests (DP-TEST-01/02)

- **NEST-DP-08: Retention, export and erasure adapters are tested against Testcontainers PostgreSQL with the real migrations** (NEST-DB-22) as `*.it.test.ts`: seed expired and current records in every table of the category (children included), run the adapter or the use case with the real transaction adapter, assert per table that exactly the expired rows are gone and the current ones stay. The use case's unit test uses a fixed clock function and asserts the cut-off and the batch loop (stops at 0 and on an aborted signal).
- **NEST-DP-09: Code that handles personal data has a test asserting it does not reach the log** (DP-TEST-02, NEST-LOG-10): the Nest test module gets `LoggerModule.forRoot({ pinoHttp: [options, { write: (line) => lines.push(line) }] })` with the production redact options, the test drives the request with synthetic values (`erika.mustermann@example.test`, `Erika Mustermann`) and asserts that no captured line contains them, while the expected log line (with the pseudonymous id) is present.
- **NEST-DP-10: By default an insert-only audit table is partitioned by month and purged by dropping partitions** (SEC-AUD-04; another mechanism per SEC-AUD-04 needs its reason in the deletion concept). The migration creates `audit_log` with `partition by range (occurred_at)` and keeps `revoke update, delete, truncate … from <runtime role>`; a retention job in `adapter/in/scheduling` (NEST-DP-01) creates the next partitions ahead of time and drops the expired ones through a connection of the owner (or purge) role, from its own small pool like the migration pool (NEST-DB-16), never through `executor()` of the request path. A `*.it.test.ts` inserts events in an old and a current partition, runs the job and asserts that only the old partition is gone and that the runtime role still cannot `DELETE` (NEST-DP-08).
  *Why:* partitions make retention a metadata operation and keep the application role insert-only.

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Data Protection".*
