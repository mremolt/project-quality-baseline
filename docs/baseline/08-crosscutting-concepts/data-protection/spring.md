# Spring Boot: Data Protection

Spring wiring for the shared rules in [data-protection.md](data-protection.md): retention jobs, erasure across tables, history tables and Kafka topics, and tests that prove deletion and the absence of personal data in logs. Package structure: [05-building-block-view/spring.md](../../05-building-block-view/spring.md).

## Rules

### Retention jobs (DP-RET-02)

- **SPRING-DP-01: A retention job is an incoming adapter in `adapter.in.scheduling`**: a `@Scheduled` method that only calls a use case (`PurgeExpiredCustomerAccounts`) with the current time from an injected `Clock`. The cut-off date is computed in the use case from the retention period in configuration, not in SQL literals. The job runs on one instance at a time using the cluster lock from [RES-JOB-02 / SPRING-RES](../resilience/spring.md).
- **SPRING-DP-02: Deletion runs in bounded batches, one transaction per batch, repeated until nothing is left.** The batches run inside the persistence adapter (`JdbcClient`, e.g. `DELETE … WHERE id IN (SELECT id … WHERE expires_at < :cutoff LIMIT :batch)`). A single unbounded `DELETE` on a large table holds locks and bloats the transaction.
- **SPRING-DP-03: Child tables owned by the person reference their parent with `ON DELETE CASCADE`** in the migration, so one delete per aggregate removes everything the deletion concept lists for that category. Tables that must outlive the person (statutory retention, DP-RET-03) reference it with a nullable foreign key or keep only the ID, and are listed in the deletion concept.
- **SPRING-DP-04: History, messaging and idempotency stores are part of erasure and retention.** Hibernate Envers `_aud` tables, own history tables, outbox tables, stored idempotency results (RES-IDM-03/04), inbox deduplication records (MSG-IDM-02) and dead-letter topics or tables (MSG-DLT-01) are listed in the deletion concept and covered by the erasure and retention adapters; a dead-letter or inbox entry keeps its payload only as long as its retention says. Security audit events (SPRING-SEC-22) carry only the pseudonymous user id and follow their own retention (SEC-AUD-02).

### Kafka (DP-MIN-02, DP-RET-04)

- **SPRING-DP-05: Events are keyed by the person's or aggregate's ID and carry personal fields only where the consumer needs them.** Topic `retention.ms` is in the deletion concept. On compacted topics, erasure publishes a tombstone (null value) for the key; the earlier values disappear only after compaction runs, which the deletion concept states as part of the deletion time. Topics that must keep history use crypto-shredding for personal fields.

### Tests (DP-TEST-01/02)

- **SPRING-DP-06: Retention, export and erasure adapters are tested against Testcontainers PostgreSQL with the real migrations** (SPRING-DB-14) as `*IT`: seed expired and current records in every table of the category, run the adapter, assert per table. The use case is tested with a fixed `Clock`.
- **SPRING-DP-07: Use cases that handle personal data have a test asserting it does not reach the log**: run with `OutputCaptureExtension` (SPRING-LOG-09) and synthetic values (e.g. `erika.mustermann@example.test`), assert that the output does not contain them.

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Data Protection".*
