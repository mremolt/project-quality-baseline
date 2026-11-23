# NestJS: Messaging with Kafka

The NestJS specifics of [messaging.md](messaging.md): client, settings, serialization, error handling and dead letters, outbox, inbox, shutdown, AsyncAPI and tests. Folder layout: [05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md). Timeouts and retries of other outbound calls: [resilience/nestjs.md](../resilience/nestjs.md). Trace context and metrics: [observability/nestjs.md](../observability/nestjs.md).

## Rules

### Client and structure

- **NEST-MSG-01: Kafka is used through `@platformatic/kafka` 2.15.0 (Apache-2.0, pinned exactly), with its `Producer`, `Consumer` and `Admin` classes, in our own adapters.** Not the `@nestjs/microservices` Kafka transport (`@EventPattern`, `@MessagePattern`, `ClientKafka`), not `kafkajs` and not `@confluentinc/kafka-javascript`: the transport is built on `kafkajs`, whose development has stalled, and hides the error handling, dead letters and commit behaviour this file requires; the Confluent client has no prebuilt binary for Node 26 and needs a librdkafka source build. The client supports Apache Kafka 3.5 to 4.2 (Confluent Platform 7.5 to 8.2). Its schema-registry API (`@platformatic/kafka/registries`, `registry`, `beforeSerialization`/`beforeDeserialization` hooks) is experimental, outside semver, and not used. Every update reads the release notes and runs the messaging `*.it.test.ts` (NEST-MSG-14), because the commit and close behaviour below is client behaviour, not Kafka behaviour.
- **NEST-MSG-02: The client installs with `ignore-scripts=true` and needs no build step** (NODE-TOOL-08 in [node-tooling.md](../development/node-tooling.md)). Neither the package nor its dependencies have an install script it needs; `npm ci` is enough in CI, the image build and the local setup, and the build stage needs no compiler. Two optional dependencies come with it: `@node-rs/crc32` (CRC32C as a prebuilt Node-API binary, delivered as a platform-specific optional package, not built; without it the client uses its WebAssembly CRC32C) and `protobufjs` (used only by the schema registry; its install script is not needed). The lockfile keeps the optional platform entries, so a musl or arm64 image gets its own binary from the same lockfile. Under Node's permission model the client loads without `--allow-addons` (NEST-SEC rules in [security/nestjs-hardening.md](../security/nestjs-hardening.md)). Node engines: `>= 22.22.0 || >= 24.6.0`.
- **NEST-MSG-03: Consumers live in `adapter/in/messaging/`, producers in `adapter/out/messaging/`; shared Kafka plumbing lives in the platform rings.** `src/platform/adapter/in/messaging/` holds the consumer runner with error handling and dead letters (NEST-MSG-07/08); `src/platform/adapter/out/messaging/` holds the client factory, the outbox writer and relay and the trace propagation helpers (NEST-MSG-05/09/10); the SQL of the outbox and inbox tables is in `src/platform/adapter/out/persistence/`, because Kysely and `pg` stay in persistence adapters (`db-client-only-in-persistence-adapter`, NEST-ARCH-11). `@platformatic/kafka` is imported only in messaging adapters, enforced by dependency-cruiser (`kafka-client-only-in-messaging-adapter`; a file under `src/platform/adapter/(in|out)/messaging/` matches as well):

```js
{
  name: 'kafka-client-only-in-messaging-adapter',
  severity: 'error',
  from: { pathNot: '/adapter/(in|out)/messaging/' },
  to: { path: '^node_modules/@platformatic/kafka/' },
}
```

  The package declares only `exports` (no `main`): without `enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types'] }` in the dependency-cruiser options the import stays unresolved and the rule passes silently (ARCH-ENF-02). Client types (`Message`, `Producer`, `GenericError`) never leave these folders. Message schemas (envelope and payload, MSG-ENV-01) are zod schemas in the feature adapter, named per type and version (`OrderPlacedV1Message`). The core publishes domain events through a narrow port (`PublishOrderPlacedPort`) and never sees topics, headers, schemas or the client.
- **NEST-MSG-04: A consumer dispatches on the envelope `type`, maps and calls one incoming port.** It skips every type it does not handle: no call, no error, no dead letter (MSG-CON-02/03). For a handled type it parses the payload with the type's schema, builds the command with a constant system `Caller` of this consumer (the `Caller` type of NEST-SEC rules in [security/nestjs.md](../security/nestjs.md), with the roles the consumer needs) and the envelope `id` as idempotency key (MSG-IDM-02), calls the use case through its token and lets errors propagate to the runner. It never catches and logs, never retries, never commits.

```ts
@Injectable()
export class OrderEventsConsumer implements MessageHandler {
  readonly topic = 'orders.order-events.v1';
  readonly consumer = 'billing';

  constructor(@Inject(RECORD_PAYMENT_DUE_USE_CASE) private readonly recordPaymentDue: RecordPaymentDueUseCase) {}

  async handle(envelope: Envelope): Promise<void> {
    switch (envelope.type) {
      case 'orders.OrderPlaced.v1': {
        const data = OrderPlacedV1Payload.parse(envelope.data);   // ZodError → dead letter (NEST-MSG-07)
        await this.recordPaymentDue.record(
          RecordPaymentDueCommand.of({ caller: BILLING_CONSUMER_CALLER, messageId: envelope.id, orderId: data.orderId, amount: data.total }),
        );
        return;
      }
      default:
        return;                                                    // type not used by this consumer (MSG-CON-03)
    }
  }
}
```

### Configuration

- **NEST-MSG-05: Client settings are explicit, in one factory in `src/platform/adapter/out/messaging/`.** No serializers and no deserializers: keys, values and headers stay `Buffer` (NEST-MSG-06).

```ts
const common = {
  clientId: config.serviceName,
  bootstrapBrokers: config.brokers,            // ['host:9092', …]
  connectTimeout: 5_000,                        // TCP + TLS connect, RES-TMO-01
  requestTimeout: 5_000,                        // client-side wait per request
  timeout: 5_000,                               // broker-side wait (produce acks)
  retries: 2,                                   // never ≤ 1 on an idempotent producer, see below
  retryDelay: 500,
  autocreateTopics: false,
  tls: config.kafkaTls,                         // node:tls options; undefined only locally
  sasl: config.kafkaSasl,                       // { mechanism: 'SCRAM-SHA-512', username, password }
};
const producer = new Producer({ ...common, idempotent: true, acks: ProduceAcks.ALL });   // MSG-PUB-03
const consumer = new Consumer({
  ...common,
  groupId: config.serviceName,
  autocommit: false,                            // commit after processing only (NEST-MSG-07)
  sessionTimeout: 45_000,
  heartbeatInterval: 3_000,
  rebalanceTimeout: 60_000,
  isolationLevel: FetchIsolationLevels.READ_COMMITTED,
  maxWaitTime: 1_000,
  highWaterMark: 16,                            // records buffered ahead of the handler
});
// consumer.consume({ topics, mode: 'committed', fallbackMode: 'earliest', autocommit: false })
```

  Why each value is set:
  - `idempotent: true` forces `acks: -1` (all in-sync replicas) and one request in flight per broker; `send` with another `acks` is rejected. **With `idempotent: true` and `retries` undefined, `0` or `1`, the client sets `retries` to `Number.MAX_SAFE_INTEGER`**, and a send to an unreachable or stalled broker never settles. With `retries: 2` or more each step is bounded by about (retries + 1) × (`requestTimeout` or `connectTimeout` + `retryDelay`); the settings above give about 17 s per step, which also bounds a dead-letter send during shutdown.
  - `autocommit: true` (the default) commits the offset of a fetched batch when the batch is fetched, before the handler ran: records of a batch are lost when the process dies mid-batch. It is never used.
  - `mode` defaults to `'latest'` and `fallbackMode` to `'latest'`: a new consumer group would skip everything already on the topic. Always `'committed'` with fallback `'earliest'`.
  - `highWaterMark` defaults to 1024 records per stream; 16 bounds memory and the records fetched ahead.
  - Heartbeats run on a timer, independent of the handler; there is no `max.poll.interval.ms`. A slow handler does not lose its partitions, so the retry budget (NEST-MSG-07) is bounded for shutdown, not for the group.

  The client logs through `debug` (`DEBUG=plt:kafka*`), not through pino; the platform provider logs the client events it needs at `warn` (`client:broker:failed`, `consumer:heartbeat:error`, `consumer:heartbeat:stalled`, `consumer:group:rebalance`). Brokers, credentials and TLS come from validated configuration ([configuration/nestjs.md](../configuration/nestjs.md)); outside local development the client uses TLS with certificate verification and SASL, with ACLs per service for topics and consumer groups (NEST-SEC rules in [security/nestjs-hardening.md](../security/nestjs-hardening.md)).
- **NEST-MSG-06: Payloads are UTF-8 JSON in `Buffer`s, typed and checked by zod.** A producer builds the message as a value of `z.input<typeof OrderPlacedV1Message>`, checks it with `.parse` and sends `Buffer.from(JSON.stringify(...))`. The runner decodes `message.value` with `new TextDecoder('utf-8', { fatal: true })` (invalid UTF-8 throws `TypeError`), runs `JSON.parse`, then the envelope schema (`z.object`, which drops unknown fields: tolerant reader, MSG-CON-03), then hands the envelope to the handler, which parses the payload schema of the `type`. `z.strictObject` is never used for messages. Field types follow MSG-ENV-02: money and decimals `z.string()` with a decimal pattern, never `z.number()`; instants `z.iso.datetime()`; ids strings. The target type comes from the envelope `type`, never from a header. Keeping `Buffer`s means the dead letter carries the original bytes, also when they are not valid UTF-8.

```ts
export const Envelope = z.object({
  id: z.uuid(), type: z.string().min(1), occurredAt: z.iso.datetime(), source: z.string(), subject: z.string(), data: z.unknown(),
});
export type Envelope = z.infer<typeof Envelope>;
```

### Errors and dead letters

- **NEST-MSG-07: One consumer runner reads each stream sequentially, classifies errors by category and never lets an error leave the loop.** The runner iterates the stream with `for await` and awaits handler, dead letter and `message.commit()` before taking the next record, so each partition is processed one record at a time and per-key order holds (MSG-ORD-01). Never an async `'data'` listener: the stream does not wait for it, records run concurrently, and a rejected handler becomes an unhandled rejection while the stream moves on. **When an error leaves the `for await` loop, the stream ends and the consumer stays in the group with its partitions assigned: the client does not retry and does not skip, the partitions stall silently.** The runner therefore handles every outcome itself and commits after it:

| Error (ARCH-UC-13 category) | Handling |
|---|---|
| `TypeError` from the UTF-8 decoder, `SyntaxError` from `JSON.parse`, `z.ZodError` from envelope or payload | Dead letter at once |
| `DomainValidationError` (also from a command factory), `BusinessRuleError`, `NotFoundError`, `AccessDeniedError` (base classes in `src/platform/domain`, NODE-ARCH-07) | Dead letter at once |
| `ConflictError`, `UnavailableError` | Retry with backoff, then dead letter |
| Any other error (unknown, technical) | Retry with backoff, then dead letter |

  The decoder and parse steps run in the runner and are classified there, before the handler; the classification uses `instanceof` on the base classes. Retries are in-process and blocking (MSG-ERR-02): 5 retries at about 0.5, 1, 2, 4 and 8 s, each with up to 25 % random jitter (RES-RTY-03); `UnavailableError.retryAfterSeconds` raises the next wait, capped at 8 s. The wait is aborted on shutdown (`setTimeout` from `node:timers/promises` with an `AbortSignal`), and an aborted record is not committed. This is the only retry layer for a consumer (RES-RTY-04). A handler that must retry not found (the object may arrive later) or accept an expected business-rule rejection overrides the classification for that one category and says why in its JSDoc. If the dead-letter send or the commit fails, the runner logs at `error`, closes the stream and the consumer and starts a new consumer after a backoff; the record is delivered again from the last committed offset, and the inbox (NEST-MSG-11) absorbs the repeat.
- **NEST-MSG-08: Dead letters go to the consumer's own topic, keep the record and are counted.** Name `<source-topic>.<consumer-service>-dlt` (MSG-DLT-01), sent to the source partition (`partition: message.partition`), so the dead-letter topic has at least as many partitions as the source; it is provisioned with the source topic, never auto-created. The record keeps key, value bytes and headers and adds the headers `dlt-reason` (error category and `code`, never the error message, which may contain personal data), `dlt-consumer`, `dlt-original-topic`, `dlt-original-partition` and `dlt-original-offset`. The runner awaits the send on the shared idempotent producer, logs the dead letter once at `error` without the payload (the core does not log; the runner is where the error is handled, NEST-LOG rules in [logging/nestjs.md](../logging/nestjs.md)) and increments the counter `messaging.dead.letters` (tags `topic`, `consumer`; alert MSG-DLT-02). Replay (MSG-DLT-03) is an operator script or admin use case that copies records from the dead-letter topic back to the source topic unchanged, so the envelope `id` stays and deduplication makes the replay safe; it has one integration test.

### Outbox and inbox

- **NEST-MSG-09: The outbox writer inserts into the use case's transaction.** The feature's producer adapter implements the publishing port, maps the domain event to the envelope and calls the platform `OutboxWriter`, which inserts one row through the platform outbox store (Kysely) into the current transaction of `TransactionPort`, as [persistence/nestjs.md](../persistence/nestjs.md) provides it. It opens no transaction of its own and fails when none is active. It stores the current trace context with the row (`propagation.inject(context.active(), carrier)` from `@opentelemetry/api`). This is the default for every event tied to a database change (MSG-PUB-01/02) and needs no ADR; change data capture instead of the relay needs one.

```sql
create table outbox_messages (
    position    bigint generated always as identity primary key,
    id          uuid        not null unique,      -- envelope id (MSG-ENV-01)
    topic       text        not null,
    message_key text        not null,             -- aggregate id (MSG-ORD-01)
    payload     jsonb       not null,
    traceparent text,
    created_at  timestamptz not null,
    sent_at     timestamptz,
    parked_at   timestamptz,                      -- non-retryable send failure (MSG-PUB-04)
    park_reason text
);
create index outbox_unsent on outbox_messages (position) where sent_at is null;
```

- **NEST-MSG-10: One relay instance sends the outbox in order per key and parks what can never be sent.** The relay is an `@Interval` method (`@nestjs/schedule`) in `src/platform/adapter/out/messaging/` whose run is wrapped in `withClusterLock` from `src/platform/adapter/out/persistence/cluster-lock.ts` (NEST-RES rules in [resilience/nestjs.md](../resilience/nestjs.md)), with `maxRunMs` below the interval and batches that stop when the lock's signal aborts; it is technical plumbing and calls no use case (the exception to RES-JOB-01). Each run reads a bounded batch of unsent, unparked rows ordered by `position`, skipping keys that have a parked row, sends each row with an awaited `producer.send(...)` (key = `message_key`) outside any database transaction (RES-TX-01), bounded by the client settings of NEST-MSG-05, and marks it sent. A failed send is classified on the error tree: the client throws `MultipleErrors` (`PLT_KFK_MULTIPLE`) wrapping a `ResponseError` that wraps one `ProtocolError` per broker error, each with `apiId` and `canRetry`; `error.findBy('apiId', id)` finds it:
  - not retryable: `MESSAGE_TOO_LARGE`, `RECORD_LIST_TOO_LARGE`, `INVALID_RECORD`, `TOPIC_AUTHORIZATION_FAILED`: the row gets `parked_at` and `park_reason` (the `apiId`), and the run continues with other keys;
  - anything else stops the run, so later rows of the key cannot overtake; the next run retries. That includes timeouts and unreachable brokers (`TimeoutError`, code `PLT_KFK_NETWORK`, `canRetry: true`), a topic that does not exist (`UserError` "Unknown topic", `canRetry: false`: a provisioning fault, caught by the age alert) and a closed client during shutdown.

  The `FOR UPDATE SKIP LOCKED` alternative that resilience/nestjs.md allows for jobs does not fit the relay: two relays could send consecutive rows of one key out of order, so concurrent relays need an ADR with a per-key claim. Parked rows are released or discarded by a documented operator procedure; sent rows are deleted after a retention period. Trace context: no instrumentation is used for this client (`@platformatic/kafka-opentelemetry` is 0.x and not adopted; the contrib `instrumentation-kafkajs` patches only `kafkajs`), so the platform messaging code extracts the stored context as parent, starts a producer span and injects `traceparent` into the record headers with `propagation.inject` of `@opentelemetry/api`, converting to `Buffer`s; the consumer runner extracts it with `propagation.extract` and a getter over the `Map<Buffer, Buffer>` headers and runs the handler inside a consumer span, so log lines carry the trace id (NEST-OBS rules in [observability/nestjs.md](../observability/nestjs.md)). This code is the only place that touches the header (MSG-ENV-01). Metrics (MSG-PUB-04): observable gauges `outbox.oldest.unsent.age` (seconds), `outbox.unsent` and `outbox.parked`, read from the table through the partial index, so the age keeps growing when the relay stops.
- **NEST-MSG-15: A side effect after commit without a broker (an e-mail, a call to an external system) uses the same outbox shape inside its own adapter.** The port implementation in `adapter/out/mail/` (or `adapter/out/http/`) inserts a row (recipient, template, arguments, language, `traceparent`) into the use case's transaction; a sender `@Interval` in the same adapter, wrapped in `withClusterLock`, reads a bounded batch, sends outside any transaction with explicit timeouts (NEST-LIB-07), marks sent rows, retries transient failures on the next run and parks permanent ones with a reason; sent rows have a retention (they hold personal data: deletion concept, DP-INV-02). No Kafka is added for this. Sending from an event handler after commit is not an outbox: a crash after commit loses the mail.
- **NEST-MSG-11: Consumers deduplicate through an inbox port** unless the use case is naturally idempotent (MSG-IDM-01/02; the consumer's JSDoc says which). The use case calls `firstDelivery(consumer, messageId)` first, in its transaction. The persistence adapter inserts into `processed_messages` (primary key `(consumer, message_id)`) with `.onConflict((oc) => oc.columns(['consumer', 'message_id']).doNothing())` and returns `numInsertedOrUpdatedRows === 1n`. A scheduled job purges rows older than the source topic's retention. Redeliveries are normal here: after a crash, a runner restart (NEST-MSG-07), a rebalance or a stop during a retry wait.

### Lifecycle

- **NEST-MSG-12: Consumers start after bootstrap and stop first on shutdown, within 20 s.** One platform provider owns the clients. In `onApplicationBootstrap` it starts the runners. In `onModuleDestroy`, the first shutdown hook and before the database pool closes, it stops the relay and, per runner: aborts the runner's signal (retry waits end, the loop leaves before the next record), calls `stream.close()` (ends an idle wait for records), awaits the loop, so the record in progress finishes and is committed, then calls `consumer.close()`, which leaves the group. Records fetched ahead but not started are not committed and go to the next owner. `consumer.close()` without `force` rejects with `UserError` while a stream is open, and `close(true)` while a record is in progress closes at once: that record's `commit()` never settles and the record is delivered again. So the runner never force-closes before its loop ended. The consumer stop has a budget of 20 s; the deployment's termination grace period is 60 s for a service with consumers (shutdown budget in NEST-OBS rules of [observability/nestjs.md](../observability/nestjs.md)). In `onApplicationShutdown` it closes the producer, which the runner and the relay need until then. The hooks run only with `app.enableShutdownHooks()`.

### Contract

- **NEST-MSG-13: The AsyncAPI document is generated by a script from the adapter's zod schemas and checked like the OpenAPI spec** (MSG-CON-01). No generator supports NestJS 12 today (`nestjs-asyncapi` 2.0.1 declares `@nestjs/swagger` only up to 11). `scripts/write-asyncapi.ts` combines a hand-written AsyncAPI 3 skeleton (channels with addresses, operations, Kafka key, owning team) with the payload schemas from `z.toJSONSchema(schema)` and writes `asyncapi/<context>-v<N>.yaml`. Payload schemas used here carry no `.meta({ id })`: with an id, zod emits a `$ref` into a root `definitions` block that does not resolve once embedded, and `asyncapi validate` fails. A unit test compares the generated document with the committed file; CI runs `asyncapi validate` from `@asyncapi/cli` (6.x, pinned devDependency, needs Node 24.11 or later). `asyncapi diff` reports a removed required payload field as `unclassified`, not `breaking`, so it does not gate MSG-CON-02; the example tests of MSG-CON-05 do.

### Tests

- **NEST-MSG-14: Kafka adapter tests are `*.it.test.ts` with `KafkaContainer` from `@testcontainers/kafka` 12** ([testing/nestjs.md](../testing/nestjs.md)). The module starts Confluent Platform images only (its start script runs `/etc/confluent/docker/run`), so the image is `confluentinc/cp-kafka:<version>` whose Apache Kafka version matches production (8.x runs in KRaft mode); bootstrap address `${container.getHost()}:${container.getMappedPort(9093)}`. Topics are created per test with the client's `Admin` (`createTopics`, unique names), since auto-creation is off. Each consumer has: success (use-case token mocked, called with the mapped command), unknown type (not called, nothing on the dead-letter topic, the next record is processed), validation (use case throws `DomainValidationError` → record on the dead-letter topic, called once), invalid JSON → dead-letter topic, transient (fails once, then succeeds). The platform runner has, once: a stop while a record is in progress commits it and a restart in the same group delivers nothing again; a failed dead-letter send restarts the consumer and the record is delivered again. Each producer or outbox has: commit → message on the topic with key and envelope; rollback → no message. The relay has: an oversized payload (topic with a small `max.message.bytes`) parks its row and a row of another key is still sent; the consumed record's trace id equals the trace id of the transaction that wrote the row. A duplicate delivery gives one effect (MSG-IDM-03). Waiting uses `vi.waitFor` or `expect.poll`, never a fixed sleep. Mapping and envelope serialization are Docker-free unit tests against the committed examples (`events/<type>/v<N>/*.json`, MSG-CON-05).

## Verify before first use

Items of this file that are written from reference docs and not yet exercised in a service are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Messaging with Kafka".*
