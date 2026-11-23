# Spring Boot: Messaging with Kafka

The Spring Kafka 4 specifics of [messaging/messaging.md](messaging.md): configuration, serialization, error handling and dead letters, outbox, inbox, AsyncAPI and tests. Library choice: SPRING-LIB-11 (`spring-boot-starter-kafka`, JSON payloads, share groups only with an ADR). Package placement: SPRING-ARCH-12/13. Broker hardening: SPRING-SEC-28. Timeouts and retries in general: [resilience/spring.md](../resilience/spring.md).

## Rules

### Structure

- **SPRING-MSG-01: Listeners live in `adapter.in.kafka`, producers and the outbox in `adapter.out.kafka`,** each class with `@MessagingAdapter` (SPRING-ARCH-04). Message records (envelope and payload, MSG-ENV-01) are package-private records in the adapter, named per type and version (`OrderPlacedV1Message`). The core publishes domain events through a port (`PublishOrderPlacedPort`) and never sees topics, headers or `KafkaTemplate`.
- **SPRING-MSG-02: A listener dispatches on the envelope `type`, maps and calls the incoming port.** A topic can carry several event types, and a new type is a non-breaking change (MSG-CON-02), so the listener reads `type` first and skips every type it does not handle: no call, no error, no dead letter (MSG-CON-03). For a handled type it maps the envelope to a command with a system `Caller` (SPRING-SEC-02) and the envelope `id` as the command's idempotency key (MSG-IDM-02), calls the port, and lets exceptions propagate to the error handler. It never catches and logs (SPRING-LOG-07), never retries, never acknowledges by hand (SPRING-MSG-09).

```java
@MessagingAdapter
class OrderPlacedListener {
    private final RecordPaymentDueUseCase recordPaymentDue;
    private final JsonMapper json;                            // Boot's Jackson 3 mapper (SPRING-MSG-04)
    // constructor omitted
    @KafkaListener(topics = "orders.order-events.v1", groupId = "billing")
    void on(String value) {
        switch (json.readTree(value).path("type").asString()) {
            case "orders.OrderPlaced.v1" -> recordPaymentDue.record(
                    Caller.system("billing"), toCommand(json.readValue(value, OrderPlacedV1Message.class)));
            default -> { }                                    // type not used by this consumer: skip (MSG-CON-03)
        }
    }
}
```

### Configuration

- **SPRING-MSG-03: Kafka settings are explicit in `application.yaml`:**

```yaml
spring:
  kafka:
    producer:
      acks: all                                  # MSG-PUB-03
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      properties:
        enable.idempotence: true                 # MSG-PUB-03; set explicitly, a conflicting acks/retries/max.in.flight fails at start-up
        linger.ms: 5                             # Kafka 4 default, explicit because delivery.timeout.ms depends on it
        request.timeout.ms: 10000                # RES-TMO-01
        delivery.timeout.ms: 30000               # must be >= linger.ms + request.timeout.ms, or the producer fails at start-up
        max.block.ms: 5000
    consumer:
      group-id: ${spring.application.name}
      enable-auto-commit: false
      auto-offset-reset: earliest
      isolation-level: read-committed            # never see aborted transactional writes
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      properties:
        max.poll.interval.ms: 300000
    listener:
      observation-enabled: true                  # traceparent in and out (default false)
    template:
      observation-enabled: true
```

  `acks=all` and `enable.idempotence=true` are the Kafka client defaults today; they are still written down so a later property cannot silently disable them (with an explicit `true`, a conflicting setting stops the producer instead of turning idempotence off). The Kafka client checks `delivery.timeout.ms ≥ linger.ms + request.timeout.ms` and throws a `ConfigException` when `delivery.timeout.ms` is set explicitly and smaller; all three are therefore set together. The observation flags are the one place that switches on Kafka trace propagation (SPRING-OBS-09).
- **SPRING-MSG-04: JSON is written and read with Boot's Jackson 3 `JsonMapper`, as strings.** The adapter serializes the message record to a `String` (the outbox stores it, SPRING-MSG-07). A listener receives the record value as a `String`, reads the envelope `type` and converts the value to the record for that type with the same `JsonMapper` (SPRING-MSG-02). The target type comes from the envelope, never from type headers, so no type headers and no trusted-package list are needed (SPRING-SEC-20); unknown properties are ignored as in SPRING-REST-09 (MSG-CON-03). A value that is not valid JSON throws Jackson's `JacksonException`, which the error handler treats as not retryable (SPRING-MSG-05). Spring Kafka's JSON (de)serializers and message converters are not needed; the Jackson 2 `JsonSerializer`, `JsonDeserializer` and `JsonMessageConverter` are deprecated for removal since Spring Kafka 4.0 and never used.

### Errors and dead letters

- **SPRING-MSG-05: One `DefaultErrorHandler` bean with a `DeadLetterPublishingRecoverer`, an explicit DLT name and a bounded exponential backoff.** Boot adds the bean to the auto-configured listener factory.

```java
@Bean
DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template,
        (rec, ex) -> new TopicPartition(rec.topic() + ".billing-dlt", rec.partition())); // MSG-DLT-01
    var backOff = new ExponentialBackOffWithMaxRetries(5);  // about 0.5, 1, 2, 4, 8 s
    backOff.setInitialInterval(500);
    backOff.setMultiplier(2.0);
    backOff.setMaxInterval(10_000);
    backOff.setJitter(250);                                  // RES-RTY-03; scales with the interval
    var handler = new DefaultErrorHandler(recoverer, backOff);
    handler.addNotRetryableExceptions(                       // ARCH-UC-13 categories, by base type (JAVA-ARCH-13, SPRING-ARCH-18)
        DomainValidationException.class,                     // validation (JAVA-ARCH-12)
        BusinessRuleException.class,
        NotFoundException.class,
        AccessDeniedException.class,                         // domain type, not Spring Security's
        JacksonException.class);                             // value is not valid JSON (SPRING-MSG-04)
    return handler;
}
```

  Not retryable by default in Spring Kafka (dead letter on first failure): `DeserializationException`, `MessageConversionException`, `ConversionException`, `MethodArgumentResolutionException`, `NoSuchMethodException`, `ClassCastException`. The service adds the base types of the categories that are not retryable (MSG-ERR-01): validation, business rule, not found and access denied; `ConflictException` and technical failures stay retryable. Classification also matches nested causes. A listener that must retry not found (the object can arrive later) or acknowledge an expected business-rule rejection gets its own container factory with its own `DefaultErrorHandler`, or catches that one base type in the listener and says why in its Javadoc (an exception to SPRING-MSG-02's no-catch rule). `setJitter` comes from Spring Framework 7's `ExponentialBackOff`; with jitter, `ExponentialBackOffWithMaxRetries` stops by attempt count only. Sizing: the total backoff of one record (≈ 15 s above, plus jitter) plus the normal processing time of the rest of one poll (`max.poll.records` × the slowest expected processing time) stays below `max.poll.interval.ms`, so the consumer is not removed from the group while it retries. The Spring Kafka default DLT name is `<topic>-dlt`; we always set the name, because the default is shared by all consumers of a topic. The DLT partition is the source partition, so the DLT has at least as many partitions (provisioned with the source topic; no auto-creation, SPRING-SEC-28). Spring Kafka is at least 4.1.1 (CVE-2026-59317 in the dead-letter recoverer factory). Non-blocking retry topics (`@RetryableTopic`, `spring.kafka.retry.topic.*`) need a stated reason (MSG-ERR-02). Share groups (Kafka queues, KIP-932) need an ADR and fit only work-queue cases: share consumers have no dead-letter topic integration and no `CommonErrorHandler` (the broker rejects a record after repeated failures), so this error handling and MSG-DLT do not apply to them.
- **SPRING-MSG-06: Dead letters are counted.** The error handler's recovery is observed through a `Counter` (`messaging.dead.letters`, tags `topic`, `consumer`) registered in the recoverer wrapper; the alert on it is MSG-DLT-02. Replay is an admin use case or operator script that copies records from the DLT back to the source topic with the original envelope `id` (MSG-DLT-03), covered by one `*IT`.

### Outbox and inbox

- **SPRING-MSG-07: The outbox is a table plus a relay inside `adapter.out.kafka`.** This is the default (MSG-PUB-02) and needs no ADR. The port implementation serializes the message and inserts a row with `JdbcClient` into the use case's transaction (it has no `@Transactional` of its own, SPRING-ARCH-07; it asserts that a transaction is active). The current trace context is stored with the row (`traceparent` column, written with Micrometer Tracing's `Propagator`).

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

  The relay is a `@Scheduled` method under ShedLock (one active relay keeps per-key order, SPRING-RES-12). It is technical plumbing of the outgoing adapter and calls no use case (the exception to RES-JOB-01). Each run reads a bounded batch of unsent, unparked rows ordered by `position`, skipping keys that have a parked row. It sends each row with `KafkaTemplate.send(…)`, waits for the result outside any database transaction (RES-TX-01) for at most `delivery.timeout.ms` plus a small margin, and marks sent rows. Failures are classified by the Kafka exception behind the send failure (MSG-PUB-04):
  - transient (a Kafka `RetriableException`, a timeout): the run stops, so later rows of the same key do not overtake; the next run retries;
  - not retryable (any other Kafka exception, for example `RecordTooLargeException` or `TopicAuthorizationException`): the row gets `parked_at` and `park_reason`, and the run continues with other keys.

  Parked rows are released (`parked_at` set back to null) or discarded by an operator script or admin use case, as described in the product's runbook. Sent rows are deleted after a retention period.

  Trace context: the relay restores the stored context as the parent of a span around the send (`Propagator.extract(…)`, then `tracer.withSpan(…)`), and the template's observation (SPRING-MSG-03) injects `traceparent`. The relay never sets the header itself (MSG-ENV-01), so the consumer's trace has the same trace id as the request that wrote the row.

  Metrics (MSG-PUB-04): gauges `outbox.oldest.unsent.age` (seconds), `outbox.unsent` and `outbox.parked`, registered with functions that query the table (cheap through the partial index), so the age keeps growing even when the relay does not run. Each instance reports the same values; alerts use the maximum across instances.

  Change data capture (Debezium) instead of the relay needs an ADR (MSG-PUB-02, SPRING-ARCH-13).
- **SPRING-MSG-13: A side effect after commit without a broker (an e-mail, a call to an external system) uses the same outbox shape inside its own adapter.** The port implementation in `adapter.out.mail` (`@MailAdapter`) or `adapter.out.http` inserts a row (recipient, template, arguments, language, `traceparent`) into the use case's transaction; a sender job in the same adapter, under ShedLock (SPRING-RES-12), reads a bounded batch, sends outside any transaction with explicit timeouts (SPRING-RES-01), marks sent rows, retries transient failures on the next run and parks permanent ones with a reason; the same gauges as SPRING-MSG-07 and a retention for sent rows (the rows hold personal data: deletion concept, DP-INV-02). Rendering and mapping (template, message keys, parameters) run inside the per-row `try`, and any other exception than a transient send failure (a template error, a missing message key, a bad parameter) parks that row with its reason. One row's exception never aborts the batch: the oldest due row would otherwise head every run, and no later mail would ever go out. A test queues an unrenderable mail ahead of a good one and asserts that the first is parked and the second sent. No Kafka is added for this. A `@TransactionalEventListener(AFTER_COMMIT)` that sends directly is not an outbox: a crash after commit loses the mail.
- **SPRING-MSG-08: Consumers deduplicate through an inbox port** unless the use case is naturally idempotent (MSG-IDM-02). The use case calls `firstDelivery(consumer, key)` first in its transaction; the persistence adapter runs `insert into processed_messages … on conflict do nothing` and returns whether a row was inserted. Primary key `(consumer, message_id)`; rows are purged by a ShedLock job after a period longer than the source topic's retention.

### Consumption

- **SPRING-MSG-09: Offsets are committed by the container.** `enable-auto-commit` stays `false` and `spring.kafka.listener.ack-mode` stays at the default (`BATCH`); `RECORD` is allowed. `MANUAL` acknowledgement and batch listeners (`spring.kafka.listener.type=batch`, failures signalled with `BatchListenerFailedException`) need a stated reason in the listener's Javadoc. `spring.kafka.listener.concurrency` is at most the topic's partition count.
### Contract

- **SPRING-MSG-11: The AsyncAPI document is generated with Springwolf and committed** (MSG-CON-01): `io.github.springwolf:springwolf-kafka` 2.x (Boot 4 support since 2.0, AsyncAPI 3 output; not managed by Boot, pin it). Springwolf annotations stay in the Kafka adapter packages (`domainAndPortsAreFrameworkFree` in the ArchUnit template covers `io.github.springwolf..`). An `*IT` fetches `/springwolf/docs` as YAML and fails if `asyncapi/<context>-v<N>.yaml` differs, like SPRING-API-08. The Springwolf UI and endpoint are off outside local development (SPRING-SEC-23). Springwolf 2.x uses Jackson 2 internally, like springdoc; the `noJackson2` rule for our own code is unaffected (SPRING-LIB-04). Springwolf 2.x cannot be combined with springdoc 3.2.1+ (conflicting swagger-core lines, `VerifyError` at start-up); a service with Kafka stays on Boot 4.1 / springdoc 3.2.0 until a Springwolf release on swagger-core 3 is out.

### Tests

- **SPRING-MSG-12: Kafka adapter tests are `*IT` with the shared Testcontainers Kafka** (`org.testcontainers.kafka.KafkaContainer`, `apache/kafka` in the production broker version, `@ServiceConnection`, SPRING-TEST-04/07), awaited with Awaitility (SPRING-TEST-09). Each listener has: a success case (port called with the mapped command, `@MockitoBean` port), an unknown-type case (a record with a `type` the listener does not handle → port not called, nothing on the DLT, the next record is processed), a validation case (the port throws the domain's validation exception → the record is on the DLT and the port was called once), and a transient case (fails once, then succeeds). Each producer or outbox has: commit → message on the topic with key and envelope; rollback → no message. The outbox relay additionally has: a non-retryable failure parks the row and a row of another key is still sent; the consumed record's trace id equals the trace id of the transaction that wrote the row. Mapping and envelope serialization are plain `*Test`s against the committed examples (MSG-CON-05).

## Verify before first use

Items of this file that are written from reference docs and not yet exercised in a service are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Messaging with Kafka".*
