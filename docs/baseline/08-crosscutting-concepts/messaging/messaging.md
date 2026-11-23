# Messaging and Event Contracts

How services talk asynchronously: what a message is, how it is named, versioned, ordered, published and consumed, and what happens when a consumer cannot process it. The rules are language- and broker-neutral; the Spring Kafka specifics are in [messaging/spring.md](spring.md), the NestJS ones in [messaging/nestjs.md](nestjs.md). Timeouts, retries and idempotency in general: [resilience/resilience.md](../resilience/resilience.md). The REST equivalent of the contract rules is [api/openapi-contracts.md](../api/openapi-contracts.md).

Placement follows the hexagon (SPRING-ARCH-12; NestJS: [nestjs.md](nestjs.md)): the core publishes **domain events through an outgoing port** and receives messages **through an incoming port**. Topics, headers, serializers, envelopes and error handlers live in the messaging adapters. Deduplication of a delivery is a use case decision, made through a port (MSG-IDM).

**Broker.** The rules name capabilities, not broker features. The default broker is Apache Kafka; a product that must use another broker (imposed by the customer platform) records the choice in an ADR, maps each capability in that ADR, and puts the code in its own adapter packages (`adapter.in.<broker>`, `adapter.out.<broker>`). The core and its ports do not change.

| Capability | Kafka (default) | Examples for an imposed broker |
|---|---|---|
| Ordered delivery per key (MSG-ORD-01) | Record key → partition; one consumer per partition in a group | RabbitMQ: single active consumer on a queue (or a super stream partitioned by key); Azure Service Bus: sessions keyed by aggregate id |
| Ordering units fixed up front (MSG-ORD-03) | Partition count | RabbitMQ super stream partitions; Service Bus sessions need none |
| Durable publish acknowledgement (MSG-PUB-03) | `acks=all` (all in-sync replicas) | RabbitMQ publisher confirms on quorum queues or streams; Service Bus: a completed send |
| No duplicates from producer retries (MSG-PUB-03) | Idempotent producer | Service Bus duplicate detection by message id; otherwise the consumer's deduplication (MSG-IDM-02) covers it |
| Per-consumer dead-letter destination (MSG-DLT-01) | One DLT topic per consumer service | RabbitMQ: dead-letter exchange per consumer queue; Service Bus: the dead-letter subqueue of the consumer's subscription |

**Outboxes without a broker.** MSG-PUB-01..04 apply to every outbox, including one whose relay sends e-mail or calls an HTTP API. A product without a broker (no Kafka, "no messaging" in its ADRs) still follows them for its outboxes; only the broker-specific rules (topics, consumers, dead-letter topics) do not apply. Its relay is a scheduled job (RES-JOB-01..03) that claims due rows from the outbox table under a cluster-wide lock and sends them, the default for e-mail after commit; no broker is introduced for it.

## Rules

### Events and commands

- **MSG-EVT-01: Messages are either events or commands, and their names say which.**
  - An **event** states a fact that already happened, owned by the producing context: past tense, business language (`OrderPlaced`, `InvoicePaid`). Any number of consumers; the producer does not know them.
  - A **command** asks exactly one owner to do something: imperative (`ShipOrder`). The receiving context owns its contract.
  Between bounded contexts, events are the default; a command over messaging needs a reason (asynchronous work, load levelling), otherwise use a synchronous API.
- **MSG-EVT-02: Events describe business facts, not table changes.** `OrderPlaced` with what consumers need, not `orders_row_updated`. Change-data-capture streams of internal tables are not a public contract.
- **MSG-EVT-03: Payloads carry only what consumers need.** Identifiers and the facts of the event; personal data only where a consumer needs it and the privacy concept allows it (SPRING-LOG-08, NEST-LOG-09 apply to payloads in logs and dead letters as well).
- **MSG-EVT-04: Topic names follow `<context>.<stream>.v<major>`** (`orders.order-events.v1`), in kebab-case per segment. One topic per aggregate's event stream; several event types may share it when they need a common order (MSG-ORD-01). Command topics end in `.commands.v<major>`.

### Envelope

- **MSG-ENV-01: Every message carries the same metadata:**

| Field | Content |
|---|---|
| `id` | Unique message id (UUID), created once by the producer and kept on redelivery and replay; the deduplication key (MSG-IDM-02) |
| `type` | Event or command type with its major version (`orders.OrderPlaced.v1`) |
| `occurredAt` | When the fact happened, UTC ISO-8601 (API-REST-02 format) |
| `source` | Producing service (`orders-service`) |
| `subject` | Id of the aggregate the message is about; also the partition key (MSG-ORD-01) |
| `traceparent` | W3C trace context, set by the tracing instrumentation, not by hand |

  `id`, `type`, `occurredAt`, `source` and `subject` are part of the message body (they survive dead-lettering, replay and copying between systems). `traceparent` is a transport header. The fields map 1:1 to CloudEvents attributes (`time` = `occurredAt`), so a project that adopts CloudEvents changes names, not concepts.
- **MSG-ENV-02: Payload data types follow the REST conventions:** money and decimals as strings, instants as UTC ISO-8601, enums as strings, identifiers as strings (API-REST-01..03, [rest-conventions.md](../api/rest-conventions.md)).

### Contract and compatibility

- **MSG-CON-01: Every topic a service produces SHOULD be documented in an AsyncAPI 3 document committed with the producer** (`asyncapi/<context>-v<N>.yaml`), generated from code like the OpenAPI spec (D8) and checked in CI for staleness. It names the channel, the message types, their schemas with examples, the partition key and the owning team. A product whose topics are only consumed inside the same repository may skip it, with the reason in chapter 8 of its architecture docs; the committed examples (MSG-CON-05) are mandatory either way.
  *Why:* consumers in other teams need a contract they can read and diff; schemas hidden in producer classes drift silently.
- **MSG-CON-02: Within a major version, changes are additive only** (the event equivalent of API-CON-04). Allowed: a new optional field, a new event type on the topic that consumers may ignore, a new enum value where the schema marks the enum as open. Breaking: removing or renaming a field, changing its type, format or meaning, making an optional field required, changing the partition key, changing the `type` name.
- **MSG-CON-03: Consumers are tolerant readers.** They ignore unknown fields and unknown event types on a topic, read only the fields they use, and treat an unknown value of an open enum as a defined fallback. A consumer that fails on an additive change is the bug.
- **MSG-CON-04: A breaking change gets a new type version and a new topic** (`orders.order-events.v2`). The producer publishes v1 and v2 in parallel until every consumer has moved; v1 is then retired on an announced date. Same-repository consumers follow REPO-API-02.
- **MSG-CON-05: Compatibility is tested with committed examples.** Each event type and version has example payloads in the producer's test resources (`events/<type>/v<N>/*.json`). The producer test asserts the current serializer output still contains every field of the previous examples with the same type; consumer tests deserialize the producer's examples plus one with an unknown extra field. CI runs an AsyncAPI breaking-change diff against the target branch where the tooling supports it (`asyncapi diff`, see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)).

### Ordering

- **MSG-ORD-01: Order is guaranteed only per key.** Messages about the same aggregate use its id as key (Kafka: the partition key), so they arrive in order; nothing is assumed about order across keys or topics.
- **MSG-ORD-02: Events carry the aggregate's version (or a sequence number) when consumers keep state from them,** and the consumer ignores an event older than what it already applied.
- **MSG-ORD-03: The number of ordering units of a topic (Kafka: partitions) is chosen up front** and not increased casually: more units remap keys and break per-key order during the switch. Increasing it is a planned change.

### Publishing

- **MSG-PUB-01: A message that must be consistent with a database change is never sent directly from the use case** (no dual write: commit then send, or send then commit). The default is the transactional outbox with a relay (MSG-PUB-02); change data capture needs an ADR.
- **MSG-PUB-02: The default pattern is a transactional outbox with a relay:** the outgoing port writes the serialized message into an outbox table in the use case's transaction; a relay sends it after the commit and marks it sent. The relay preserves per-key order and delivers at least once. Outbox with relay needs no ADR; change data capture (Debezium) on the outbox table instead of the relay needs an ADR (SPRING-ARCH-13; NestJS: [nestjs.md](nestjs.md)).
- **MSG-PUB-03: Producers wait for a durable publish acknowledgement from the broker** (Kafka: `acks=all`, all in-sync replicas) and use the broker's protection against duplicates from producer retries (Kafka: the idempotent producer), so a producer retry does not duplicate or reorder messages of one key.
- **MSG-PUB-04: The outbox relay is observable and does not let one bad row block everything.** It exposes the age of the oldest unsent row and the count of unsent and parked rows as metrics. An alert fires when the oldest unsent row is older than a threshold the product sets (default: 5 minutes) or when any row is parked, and the messaging row of the minimal dashboard (OBS-17) shows these values. A transient send failure (timeout, broker unavailable) ends the run; the next run retries. A non-retryable send failure (message too large, not authorized for the topic, cannot be serialized) parks the row with the reason and the relay continues with other keys. Later rows of the parked row's key wait, so per-key order holds; an operator fixes the cause and releases or discards the parked row through a documented procedure (like MSG-DLT-03). A relay that sends each row on its own (e-mail, HTTP) retries a transiently failed row with exponential backoff (a `next_attempt_at` per row) over a retry window of hours, not a fixed number of quick attempts, and parks it when the window ends. It claims rows before sending (`FOR UPDATE SKIP LOCKED`, or a status update to `SENDING` with a claim expiry), so two relay instances never send the same row, even after a job lock has expired (RES-JOB-03).
  *Why:* a relay that stops at the first failure for good blocks every topic of the service, and without a metric nobody notices until consumers miss data.

### Consuming

- **MSG-IDM-01: Every consumer is idempotent.** Brokers and the outbox deliver at least once; duplicates and redeliveries after a rebalance are normal operation, not an error.
- **MSG-IDM-02: Deduplication uses the message `id` or natural idempotency.** Either the use case records the message id in an inbox table through an outgoing port, in the same transaction as its change (primary key on consumer and id; a duplicate is acknowledged and skipped), or the operation is naturally idempotent (upsert by business key, state transition guarded by the aggregate version, MSG-ORD-02). Which one is stated on the listener.
- **MSG-IDM-03: Idempotency is tested** by delivering the same message twice and asserting one effect.

### Errors and dead letters

- **MSG-ERR-01: Consumers classify failures by the error categories of [ARCH-UC-13](../../05-building-block-view/use-cases.md#error-categories).**

| Failure (category) | Handling |
|---|---|
| Message cannot be deserialized or mapped | Not retryable: dead letter immediately |
| Validation: the validation exception from `domain` (an invalid command) | Not retryable: dead letter immediately |
| Business rule: the current state rejects the message and a retry cannot change it | Not retryable: dead letter, or acknowledge and log when the rejection is an expected outcome (decided per listener) |
| Not found: the addressed object does not exist | Not retryable by default. Retried with backoff only where ordering lets the object arrive later (for example an event of another stream), decided per listener |
| Conflict: optimistic lock | Retry with backoff (RES-RTY-02), then dead letter |
| Technical: timeout, connection error, dependency 5xx/429 | Retry with backoff (MSG-ERR-02), then dead letter |
| Retries exhausted | Dead letter |

- **MSG-ERR-02: Retries for a consumer are bounded, with exponential backoff and jitter** (RES-RTY-03), and happen in the consumer's error handler (one retry layer: RES-RTY-04). Blocking retries keep per-key order; retries through separate retry topics break it and need a stated reason.
- **MSG-ERR-03: A poison message never blocks a partition.** After classification or exhausted retries, it goes to the dead-letter topic and the consumer moves on.
- **MSG-DLT-01: Dead-letter topics belong to the consuming service.** Name: `<source-topic>.<consumer-service>-dlt` (`orders.order-events.v1.billing-dlt`), so two consumers of one topic never share a dead-letter topic. The consuming team creates it (Kafka: at least as many partitions as the source, SPRING-MSG-05; NestJS: [nestjs.md](nestjs.md)), monitors it and handles its records. The dead letter keeps the original key, payload and headers and adds the failure reason, original topic, partition and offset.
- **MSG-DLT-02: Every dead letter raises an alert to the owning team and is logged once.** The alert is a metric on the DLT's record count or the consumer's dead-letter counter; the error handler logs each dead letter once at `ERROR` without the payload (SPRING-LOG-07/08, NEST-LOG-08/09).
- **MSG-DLT-03: Replay is a documented, tested procedure.** After the cause is fixed, records are re-published from the DLT to the source topic (or fed to the consumer) by an operator tool or admin endpoint, keeping the original `id`, so the consumer's deduplication (MSG-IDM-02) makes a replay safe. The runbook lives in the product's chapter 8 and names who may replay.

## Anti-patterns

- `OrderUpdated` with the whole entity, published from a JPA listener.
- Sending to Kafka inside `@Transactional` and hoping the commit succeeds.
- An outbox relay that has been stuck on one oversized message for a week, with no alert.
- A consumer that fails on an unknown field, or on a second event type on its topic.
- "Small" breaking change on `v1` because "all consumers are ours".
- A shared `orders-dlt` that three teams read, and nobody alerts on.
- Infinite retries on a validation error that will fail the same way forever.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Messaging and Event Contracts".*
