# Spring Boot: Persistence with PostgreSQL

Database engine, migrations and Hibernate settings for services with PostgreSQL. Adapter structure, mapping strategy and transactions are in [05-building-block-view/spring.md](../../05-building-block-view/spring.md) (SPRING-ARCH-07, -09, -10, -11, -16); this doc adds the database-side rules and the choice between JPA and `JdbcClient` (SPRING-DB-15).

## Rules

### Engine and migrations

- **SPRING-DB-01: PostgreSQL is the engine, in the same major version everywhere** (production, local Compose, Testcontainers). Local and test images are Debian-based (`postgres:18`), not Alpine: Alpine's libc sorts and compares text differently from production.
- **SPRING-DB-02: Flyway owns the schema.** Dependencies: `spring-boot-starter-flyway` **and** `org.flywaydb:flyway-database-postgresql` (SPRING-LIB-01). SQL files `V<n>__<description>.sql` in `src/main/resources/db/migration` (Flyway's default location; resources have no Java package, so migrations belong to the service, not to one adapter). `spring.jpa.hibernate.ddl-auto=validate`: Hibernate never changes the schema.
- **SPRING-DB-03: `spring.jpa.open-in-view=false`.** A lazy-loading exception in a controller means an entity leaked through a port (SPRING-ARCH-09); the fix is in the adapter, not in a wider session.
- **SPRING-DB-04: Migrations are immutable once merged.** Fixes are new versions. Repeatable migrations (`R__`) only for views and functions.
- **SPRING-DB-05: Migrations are backward compatible with the previous release** (expand/contract): during a rollout the old backend instance and the old frontend still run (REPO-API-02). Add the column nullable or with a default, deploy code that writes both, migrate data, remove the old column in a later release. Destructive changes (drop, rename, type change) need an explicit note in the pull request. Shared rule: REL-DB-02 ([delivery-and-release.md](../../07-deployment-view/delivery-and-release.md)).
- **SPRING-DB-06: Long-locking DDL is reviewed for Postgres specifics:** `CREATE INDEX CONCURRENTLY` (outside a transaction: `executeInTransaction=false` for that file, and Flyway's transactional lock switched off, `spring.flyway.postgresql.transactional-lock=false`, SPRING-REL-04), `NOT VALID` then `VALIDATE CONSTRAINT`, no table rewrites on large tables without a plan. Every migration connection runs with a `lock_timeout` (SPRING-REL-02).

### Schema conventions

- **SPRING-DB-07: Names are `snake_case`, tables plural** (`orders`, `order_lines`). An entity named `Order` needs an explicit `@Table(name = "orders")`: the default table name `order` is a reserved word in SQL. Boot's default naming strategy maps camelCase fields to snake_case columns; no custom `@Column(name)` needed for the common case.
- **SPRING-DB-08: Types:** identifiers `uuid` (application-generated) or a `bigint` from a sequence (not `IDENTITY` where batching matters); instants `timestamptz` (maps to `Instant`/`OffsetDateTime`); money and decimals `numeric(19,2)` or with the scale the domain requires, never `float`/`double` (matches the decimal-string JSON rule, API-REST-01, SPRING-REST-04); enums `text` with a check constraint (never ordinals).
- **SPRING-DB-09: Constraints live in the database** (primary and foreign keys, `NOT NULL`, unique, check). Application validation is not a substitute.
- **SPRING-DB-10: Optimistic locking with `@Version`** on aggregates that users update concurrently. Status mapping of a lock failure: SPRING-REST-12 and the status table in API-REST-06 ([rest-conventions.md](../api/rest-conventions.md)).

### JPA specifics (inside `adapter.out.jpa`)

- **SPRING-DB-11: Entities have no Lombok, protected no-arg constructor, no public setters.** `equals`/`hashCode` are chosen deliberately (by business key or by assigned id; never over lazy associations). Details: the `java-hibernate-jpa` skill. This applies to the entity, which is not the domain model when two-way mapping is used (SPRING-ARCH-10).
- **SPRING-DB-12: Query ports are bounded.** Every collection query is paged with a capped page size, or has a documented hard upper bound that the query itself enforces (`LIMIT`, `setMaxResults`) (API-REST-08, API-N1-07, SPRING-REST-11). Statement counts are asserted in adapter tests (SPRING-ARCH-16, [08-crosscutting-concepts/testing/spring.md](../testing/spring.md)).
- **SPRING-DB-13: Native SQL and `JdbcClient` are fine** where JPA adds nothing (ARCH-ADP-13), inside the adapter, with the same tests. Values only as bind parameters; identifiers and `ORDER BY` from an allow-list (SPRING-SEC-31). jOOQ or Spring Data JDBC are allowed in an adapter under the same rule; no ADR needed while the choice stays inside the adapter.

### Testing

- **SPRING-DB-14: Every persistence test runs the real migrations against a Testcontainers PostgreSQL** (SPRING-TEST-05). Mapping and migration are tested together, so a missing migration fails the test, not production.

### Persistence technology (default SPRING-D4)

- **SPRING-DB-15: Spring Data JPA plus `JdbcClient` is the default.** JPA for aggregates that are loaded and changed as a whole: one query with `left join fetch` (SPRING-ARCH-16), dirty checking, `@Version`. `JdbcClient` for read models, reporting queries, bulk updates and simple tables where Hibernate's session, proxies and flush behaviour add nothing. A JPA adapter may run `JdbcClient` queries for its own aggregate inside `adapter.out.jpa`; an adapter built only on `JdbcClient` lives in `adapter.out.jdbc` ([05-building-block-view/spring.md](../../05-building-block-view/spring.md)). Both use the same port, mapping and statement-count tests (SPRING-DB-12, SPRING-TEST-06). Spring Data JDBC and jOOQ stay possible inside an adapter (SPRING-DB-13). If Spring Data JPA and Spring Data JDBC repositories are both on the classpath, Spring Data switches to strict repository configuration mode; then each adapter's `@Configuration` declares its scan explicitly (`@EnableJpaRepositories(basePackages = "…adapter.out.jpa")`, `@EnableJdbcRepositories(basePackages = "…adapter.out.jdbc")`, SPRING-ARCH-05).
  *Why:* JPA pays off where whole aggregates are loaded and written with optimistic locking. Elsewhere its session, proxy and flush behaviour (lazy loading, dirty checking, cascades) is a frequent source of bugs, while a plain SQL query with a row mapper is easier to read, review and count.
- **SPRING-DB-16: Invariants across rows are enforced in PostgreSQL, atomically (ARCH-UC-16).** In order of preference, as far as the domain allows it: a constraint (a partial unique index such as `UNIQUE (user_id, work_date, project_id) WHERE deleted_at IS NULL` with `INSERT … ON CONFLICT`, an exclusion constraint, a foreign key); a conditional write (`UPDATE … WHERE id = :id AND <condition>`) whose row count the adapter checks; `SELECT … FOR UPDATE` on the row the invariant hangs on; `pg_advisory_xact_lock(<key>)` taken in both the check and the conflicting write when no row exists to lock (for example per user and month). Queue rows are claimed with `FOR UPDATE SKIP LOCKED` or a status update before the work starts. The adapter maps the resulting violation to a `ConflictException` (SPRING-DB-18). A constraint is only right when it forbids exactly the states the domain forbids: where the domain allows several rows per key (several bookings in one cell of a timesheet), a unique index would reject valid data, so the invariant is held by a lock instead, and the use case's comment says why. The concurrency test is an `*IT` against Testcontainers that runs the two conflicting operations as two real transactions in a controlled order: the first does its check and write and is held open (a latch) until the second has reached the conflicting statement; the test asserts that the second fails with the mapped exception or, for a lock, is seen waiting and proceeds after the commit, and that exactly one effect remains. It is run against the code without the mechanism once, to see it fail. Repeating a race of two free-running threads many times is not a substitute, because it fails only by chance.
- **SPRING-DB-17: Every adapter query on a table that grows has an index for its filter and sort columns, and every foreign-key column is indexed** (PostgreSQL does not index foreign keys itself). An `OR` across two columns becomes a `UNION ALL` of two indexed queries. The pull request that adds a query names the index it uses, or why a scan is fine (small, bounded table). Append-only tables (audit, history) get these indexes from the start, because they only grow. Indexes on existing large tables are created with `CREATE INDEX CONCURRENTLY` in their own migration (SPRING-REL-02).
  *Why:* a missing index is invisible on test data and turns into statement timeouts (RES-TMO-04) years later.
- **SPRING-DB-18: Constraint violations are mapped by constraint name, never by message text.** The adapter reads the name from the driver's structured error (`PSQLException.getServerErrorMessage().getConstraint()`, reached through `DataIntegrityViolationException.getMostSpecificCause()`), maps it through one shared helper to a business exception with a stable code (ARCH-UC-13), and keeps the original exception as the cause. Constraint names are explicit in the migrations, so a rename is a visible change.

### Migrations at deployment

Flyway runs at start-up with its own DDL user, the application datasource uses a DML-only role, and every migration connection sets `lock_timeout`: SPRING-REL-01..04 in [07-deployment-view/spring-delivery.md](../../07-deployment-view/spring-delivery.md) (shared rules REL-DB-01..05 in [delivery-and-release.md](../../07-deployment-view/delivery-and-release.md)).

## Agent checklist

- [ ] New or changed table: migration file added, previous release still works (expand/contract)?
- [ ] No entity in a port, no lazy loading outside the adapter?
- [ ] Types follow SPRING-DB-08; constraints in the migration?
- [ ] JPA only where whole aggregates are loaded and changed; `JdbcClient` for reads, reports and bulk work (SPRING-DB-15)?
- [ ] Collection query paged or limited in the query itself; statement count asserted (SPRING-DB-12)?
- [ ] Migration touches a large table: lock behaviour considered, `lock_timeout` set (SPRING-DB-06, SPRING-REL-02)?
- [ ] Rule across rows enforced by a constraint, conditional write or shared lock, with a concurrency IT (SPRING-DB-16)?
- [ ] New query: index for its filter and sort columns named in the PR; foreign keys indexed (SPRING-DB-17)?
- [ ] Constraint violations mapped by constraint name, cause kept (SPRING-DB-18)?

## Sources

PostgreSQL documentation (postgresql.org/docs), Flyway documentation (documentation.red-gate.com/flyway), Hibernate ORM 7 user guide, Spring Boot data reference. Expand/contract: Martin Fowler, *Parallel Change*.
