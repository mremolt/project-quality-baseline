# Spring Boot: Resilience and Idempotency

The Spring Boot 4 settings and code for [resilience/resilience.md](resilience.md). Library choice is SPRING-LIB-07: Spring Framework 7's built-ins (`@Retryable`, `@ConcurrencyLimit`, `RetryTemplate`, `@EnableResilientMethods`), Resilience4j only for a circuit breaker. Kafka consumer retries and dead letters: [messaging/spring.md](../messaging/spring.md).

## Rules

### Timeouts (RES-TMO)

- **SPRING-RES-01: Every client sets its timeouts in configuration**, with these keys:

| Client | Connect | Read / overall |
|---|---|---|
| `RestClient`, HTTP Service Clients (all) | `spring.http.clients.connect-timeout` | `spring.http.clients.read-timeout` |
| HTTP Service Client group | `spring.http.serviceclient.<group>.connect-timeout` | `spring.http.serviceclient.<group>.read-timeout` |
| `RestClient` built in code | `HttpClientSettings` passed to `ClientHttpRequestFactoryBuilder` (`withReadTimeout(…)`) | same |
| JDK `HttpClient` used directly | `HttpClient.newBuilder().connectTimeout(…)` | `HttpRequest.newBuilder().timeout(…)` on **every** request (the JDK client has no client-wide read timeout) |
| PostgreSQL (pgjdbc) | `connectTimeout` in the JDBC URL (seconds) | `socketTimeout` in the JDBC URL (seconds, default `0` = none); `statement_timeout` through `spring.datasource.hikari.connection-init-sql` |
| Hikari pool | `spring.datasource.hikari.connection-timeout` (wait for a free connection; milliseconds as a plain number, because Boot binds it to Hikari's `long` setter and a duration string such as `2s` fails at start-up) | — |
| Transactions | — | `spring.transaction.default-timeout` (RES-TX-02) |
| Kafka producer | `spring.kafka.producer.properties.max.block.ms` | `request.timeout.ms` and `delivery.timeout.ms` under `spring.kafka.producer.properties`, with `linger.ms` explicit (SPRING-MSG-03) |
| Kafka consumer | — | `max.poll.interval.ms` bounds one poll's processing (SPRING-MSG-09) |
| Spring Security resource server: JWKS | a `JwtDecoder` bean over a Nimbus key source: `new NimbusJwtDecoder(processor)` with a `DefaultJWTProcessor` whose key selector uses `JWKSourceBuilder.create(url, new DefaultResourceRetriever(connectMs, readMs, sizeLimitBytes)).build()`, values from the IdP group. Not `NimbusJwtDecoder.….restOperations(…)`: it takes a `RestTemplate`, which `noRestTemplate` forbids (SPRING-LIB-06) | same |
| Spring Security OIDC login: token endpoint | `RestClientAuthorizationCodeTokenResponseClient.setRestClient(…)` (and the refresh-token client), built from the injected `RestClient.Builder` | same |
| Spring Security OIDC login: userinfo | a small own user service that calls the userinfo endpoint with the injected `RestClient.Builder` and the IdP group values (`OidcUserService` and `DefaultOAuth2UserService` accept only `RestOperations`, i.e. a `RestTemplate`, which `noRestTemplate` forbids) | same |
| Spring Security: issuer discovery at start-up | static provider metadata (`authorization-uri`, `token-uri`, `jwk-set-uri`) instead of `issuer-uri` discovery, or the decoder's lazy discovery through the client above | same |

  Global HTTP values are a floor; each dependency gets its own group values (RES-TMO-02). The `application.yaml` template sets the global and database values on the default ladder of RES-TMO-04 (statement 3 s < transaction 5 s < request budget 10 s); `socketTimeout` is a network backstop above the statement timeout. Spring MVC does not cancel a synchronous request when its budget runs out; the rungs below (transaction, statement and client timeouts, the `@Retryable` `timeout`) enforce it.

  Clients are built from the auto-configured `RestClient.Builder` or as HTTP Service Clients, so the configured timeouts apply (SPRING-OBS-09). The ArchUnit template's `noUnconfiguredHttpClients` rule fails the build on `RestClient.create(…)`, the static `RestClient.builder()` and `HttpClient.newHttpClient()`, which all start with library defaults (RES-TMO-01).

  Spring Security builds its own HTTP clients for the identity provider, and they do **not** read `spring.http.clients.*`. Their defaults are the library's own: 30 s for discovery, a static `RestClient.builder()` for the token endpoint, a plain `new RestTemplate()` without timeouts for userinfo. A BFF or resource server therefore declares these clients itself, as the Spring Security rows of the table show, with the values of an `idp` group (RES-TMO-02), and a WireMock delay test covers the token and JWKS calls (SPRING-RES-02).

```yaml
spring:
  http:
    clients:
      connect-timeout: 2s
      read-timeout: 5s
  datasource:
    url: jdbc:postgresql://db:5432/orders?connectTimeout=2&socketTimeout=10
    hikari:
      maximum-pool-size: 20           # SPRING-RES-05
      connection-timeout: 2000        # milliseconds; Hikari's property is a long, "2s" does not bind
      connection-init-sql: "SET statement_timeout = '3s'"
  transaction:
    default-timeout: 5s               # below the 10 s request budget (RES-TMO-04)
```

- **SPRING-RES-02: Timeout tests use a delayed stub:** `@RestClientTest` with `MockRestServiceServer` cannot delay, so client adapters with timeouts are tested against WireMock with `withFixedDelay` greater than the read timeout (`*Test` when WireMock runs in-process, `*IT` when it runs as a container; SPRING-TEST-07). The test asserts the port's error, not `ResourceAccessException`.

### Transactions and remote calls (RES-TX)

- **SPRING-RES-03: A use case that mixes remote calls and database work runs the database part in a `TransactionTemplate`** and calls remote ports before it, outside the transaction. `@Transactional` is only for use case methods that make no remote call at all. Never move the database part into a separate `@Transactional` method of the same class: a self-invoked method bypasses the proxy and runs without a transaction. Remote side effects after the commit go through the outbox (SPRING-MSG-07). `REQUIRES_NEW` around a remote call is not a fix.

```java
@UseCase
class PlaceOrderService implements PlaceOrderUseCase {
    // constructor omitted
    @Override
    public OrderId place(Caller caller, PlaceOrderCommand command) {
        Price price = pricing.quote(command.items());           // remote, no transaction open
        return tx.execute(status -> {                            // TransactionTemplate
            Order order = Order.place(caller.id(), command.items(), price);
            saveOrder.save(order);
            publishOrderPlaced.publish(OrderPlaced.of(order));   // outbox row, same transaction
            return order.id();
        });
    }
}
```

  An optimistic-lock conflict (`OptimisticLockingFailureException`, RES-RTY-02) is retried in the application service around the whole `tx.execute(…)` call, with a `RetryTemplate` (`RetryPolicy.builder()`, bounded, with jitter and a `timeout` inside the request budget). It is never retried inside the transaction, in the persistence adapter, or with `@Retryable` (that stays on outgoing adapters, SPRING-RES-08). In a flow started by a Kafka listener the error handler retries instead (SPRING-RES-09).

- **SPRING-RES-04: Tests fail when a remote call runs inside a transaction.** Every `RestClient` gets a `ClientHttpRequestInterceptor` (registered through a `RestClientCustomizer` in `adapter.out.http`) that checks `TransactionSynchronizationManager.isActualTransactionActive()`. Its mode is the property `app.resilience.transaction-guard` (`fail` throws, `warn` logs a `WARN`), bound in a `@ConfigurationProperties` record whose default is `fail` (SPRING-CFG-04). The `application.yaml` template sets `warn` for deployments; the shared Testcontainers `@TestConfiguration` (SPRING-TEST-04) sets `fail` through a `DynamicPropertyRegistrar` bean, so every `*IT` and system test fails on a violation. The same check sits in the outbox relay's send path (SPRING-MSG-07).

### Capacity with virtual threads (RES-CAP)

- **SPRING-RES-05: The Hikari pool is the limit, so it is sized and its wait is short.** With virtual threads (SPRING-LIB-02) every request gets its own thread; nothing queues in front of the pool except `connection-timeout`. Set `maximum-pool-size` explicitly (the pool sum of RES-CAP-02, recorded in chapter 7) and `connection-timeout` to a few seconds (in milliseconds, SPRING-RES-01). A pool timeout surfaces as Spring's `CannotCreateTransactionException`, which the `@RestControllerAdvice` maps to `503` with `Retry-After` (the "temporarily unavailable" row of API-REST-06; the Spring mapping lives in SPRING-REST-07).
- **SPRING-RES-06: Remote dependencies get a `@ConcurrencyLimit` on the outgoing adapter with `policy = ThrottlePolicy.REJECT`** (bulkhead, RES-CAP-01), always with an explicit value or `limitString = "${…}"`; a bare `@ConcurrencyLimit` allows one call (SPRING-LIB-07). The default policy `BLOCK` makes excess callers wait without a bound and is not used. `REJECT` (Spring Framework 7.0.3 or later) throws `InvocationRejectedException`, a `RejectedExecutionException`, from the proxy, outside the adapter method. The `@RestControllerAdvice` maps it to `503` with `Retry-After` (the "temporarily unavailable" row of API-REST-06, like the pool timeout in SPRING-RES-05). Where the use case must react to the rejection (a fallback), the limit sits on a package-private delegate inside the adapter, and the adapter maps the rejection to the port's error. Never use a fixed thread pool to limit virtual threads, and never pool virtual threads.
- **SPRING-RES-07: A circuit breaker uses Resilience4j** (`resilience4j-spring-boot4`, pinned, SPRING-LIB-07): `@CircuitBreaker(name = "pricing", fallbackMethod = "…")` on the outgoing adapter, configured under `resilience4j.circuitbreaker.instances.<name>.*`. The test drives the breaker open with stubbed failures and asserts the fallback (RES-CAP-03). Boot 4.2 compatibility: see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

### Retries (RES-RTY)

- **SPRING-RES-08: `@Retryable` sits on outgoing adapter methods only, and always lists `includes`, `maxRetries`, `delay`, `multiplier`, `jitter`, `maxDelay` and `timeout`.** No bare `@Retryable` (it retries every exception three times, without a total time limit). `timeout` (Spring Framework 7.0.2 or later) bounds the elapsed time of all attempts and delays; it plus one read timeout fits the request budget (RES-RTY-03, RES-TMO-04). `@EnableResilientMethods` goes on the adapter's `@Configuration` (SPRING-ARCH-05). Programmatic retries use `RetryTemplate` with `RetryPolicy.builder()` (the one exception to "adapters only" is the lock-conflict retry in SPRING-RES-03).

```java
@Retryable(
    includes = {ResourceAccessException.class,                      // connect and read timeouts
                HttpServerErrorException.BadGateway.class,
                HttpServerErrorException.ServiceUnavailable.class,
                HttpServerErrorException.GatewayTimeout.class,
                HttpClientErrorException.TooManyRequests.class},
    maxRetries = 2, delay = 200, multiplier = 2, jitter = 100, maxDelay = 2000,
    timeout = 6000)   // pricing group read-timeout 2 s: 6 s + one more read < 10 s budget
@ConcurrencyLimit(limitString = "${app.pricing.max-concurrent-calls}", policy = ConcurrencyLimit.ThrottlePolicy.REJECT)
@Override
public Price quote(List<OrderItem> items) { … }
```

  The `includes` list matches RES-RTY-02. HTTP 408 has no exception subclass; where a dependency sends it, a `predicate` (`MethodRetryPredicate`) on the status code adds it. `@Retryable` does not read `Retry-After`. For a dependency that sends it, the adapter SHOULD use a `predicate` that stops retrying when `Retry-After` is longer than `maxDelay`, and pass the value on in the port's error so the REST adapter can set it on its own `503` (RES-RTY-03).

- **SPRING-RES-09: An adapter called from a Kafka listener does not retry;** the listener's `DefaultErrorHandler` owns the retries for that flow (RES-RTY-04, SPRING-MSG-05). If one adapter serves both REST and Kafka flows, keep its retries at `maxRetries ≤ 1` and document the product's retry layering.

### Idempotency (RES-IDM)

- **SPRING-RES-10: The `Idempotency-Key` header is read in the controller and passed in the command** as a core value object (`IdempotencyKey(value, fingerprint)`; the fingerprint is a SHA-256 over the canonical request body, computed in the adapter). The use case calls an outgoing port (`IdempotencyStore`) **first in its transaction** and stores its result through the same port before the transaction commits. The persistence adapter runs `insert into idempotency_keys … on conflict do nothing` (a plain `insert` that hits the unique constraint aborts the PostgreSQL transaction) and, when no row was inserted, reads the stored row: same fingerprint → the stored result is returned; different fingerprint → the port's mismatch error (`409`). A concurrent duplicate waits in that insert until the first transaction ends, bounded by `statement_timeout`; the adapter maps the cancelled wait (SQLSTATE `57014`) to the port's "in progress" error, which the REST adapter answers with `409` (RES-IDM-02). The REST adapter maps a replayed result exactly like a fresh one. The header and its `400`/`409` responses are documented in the OpenAPI spec (SPRING-API-05).
- **SPRING-RES-11: The idempotency table is a Flyway migration in the persistence adapter**, written with `JdbcClient`:

```sql
create table idempotency_keys (
    caller_id   text        not null,
    key         text        not null,
    fingerprint text        not null,
    result      jsonb,
    created_at  timestamptz not null,
    expires_at  timestamptz not null,
    primary key (caller_id, key)
);
```

  Expired rows are purged by a scheduled job (SPRING-RES-12).

### Scheduled jobs (RES-JOB)

- **SPRING-RES-12: `@Scheduled` methods live in `adapter.in.scheduling`** on a class with an adapter stereotype, call an incoming port, and run under ShedLock. `@EnableScheduling` and `@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")` go on that package's `@Configuration`. Dependencies: `net.javacrumbs.shedlock:shedlock-spring` and `shedlock-provider-jdbc-template` 7.x (supports Spring 7 / Boot 4; not managed by Boot, pin it). The lock provider is `JdbcTemplateLockProvider` with `.usingDbTime()`; the `shedlock` table comes from a Flyway migration (schema in the ShedLock README). Each job sets `@SchedulerLock(name = "…", lockAtMostFor = "…", lockAtLeastFor = "…")`.

```java
@Scheduled(cron = "0 15 * * * *")
@SchedulerLock(name = "purgeIdempotencyKeys", lockAtMostFor = "PT5M", lockAtLeastFor = "PT30S")
void purge() { purgeExpiredIdempotencyKeys.purge(); }
```

  A job that claims work rows with `select … for update skip locked` may run on all instances without ShedLock (RES-JOB-02); a PostgreSQL advisory lock (`pg_try_advisory_xact_lock`) is an alternative to ShedLock when the project wants no extra dependency.
- **SPRING-RES-13: Jobs are tested as adapters:** a plain test calls the job method and verifies the port call (London style); the lock configuration is covered by one `*IT` that runs two invocations concurrently against the Testcontainers PostgreSQL and asserts one execution.

### Caching (RES-CCH)

- **SPRING-RES-14: Caching uses Spring's cache abstraction with Caffeine** (`spring-boot-starter-cache`, `com.github.ben-manes.caffeine:caffeine`), configured per cache with a size and TTL (`spring.cache.caffeine.spec=maximumSize=10000,expireAfterWrite=10m`, or a `CaffeineCacheManager` customizer for per-cache specs). `@EnableCaching` is on the adapter's `@Configuration`; `@Cacheable`/`@CacheEvict` only on outgoing adapter classes. An ArchUnit rule keeps `org.springframework.cache..` out of `domain`, `ports` and `application`. Keys that depend on the caller include caller and tenant id (RES-CCH-02). Redis needs an ADR (RES-CCH-04).

## Verify before first use

Items of this file that are written from reference docs and not yet exercised in a service are listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Resilience and Idempotency".*
