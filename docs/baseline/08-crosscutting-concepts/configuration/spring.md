# Spring Boot: Configuration

How a Spring Boot service binds, validates and receives its configuration and secrets. Shared rules: [configuration.md](configuration.md) (`CFG-*`). Local development settings: [SPRING-DEV-02/07](../../07-deployment-view/spring-local-development.md).

## Rules

### Binding and validation

- **SPRING-CFG-01: Own configuration is bound with `@ConfigurationProperties` on records, annotated `@Validated`.** Jakarta constraints sit on the components (`@NotNull`, `@NotBlank`, `@Positive`, `@URL` from Hibernate Validator) and `@Valid` on nested records (validation does not cascade without it). Use `Duration`, `DataSize` and `URI` instead of numbers and strings. An invalid or missing value makes the context fail at startup (CFG-08). `spring-boot-starter-validation` is present (SPRING-LIB-03).

```java
// adapter/out/http/PaymentClientProperties.java
@ConfigurationProperties("app.payment")
@Validated
record PaymentClientProperties(
    @NotNull URI baseUrl,
    @NotNull Duration readTimeout,
    @NotNull Secret apiKey) {}   // self-masking (CFG-07, SPRING-CFG-11): toString() prints apiKey=***

// adapter/out/http/PaymentClientConfiguration.java
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PaymentClientProperties.class)
class PaymentClientConfiguration { /* builds the RestClient from the properties */ }
```

- **SPRING-CFG-02: Properties records live next to what they configure** (SPRING-ARCH-02), package-private where Spring allows it, and are enabled with `@EnableConfigurationProperties` on that adapter's own `@Configuration` (SPRING-ARCH-05). Not `@ConfigurationPropertiesScan` on the main class: slice tests would then bind and validate every record. Settings a use case needs (limits, business time windows) are a properties record in `application`, enabled by a `@Configuration` class in `application`, and handed to the use case through its constructor; the use case's unit test builds the record directly. `domain` and `ports` never contain a properties type; the ArchUnit rule `domainAndPortsAreFrameworkFree` already forbids Spring there.
- **SPRING-CFG-03: No `@Value` in production code.** It is unvalidated, untyped and invisible to the configuration metadata. Enforced by the template's ArchUnit rules (no field, parameter or method annotated with `org.springframework.beans.factory.annotation.Value` outside tests).
- **SPRING-CFG-04: Own keys use the prefix `app.<area>`** (`app.payment.*`, `app.orders.*`), never `spring.*`, `management.*` or `server.*`. `spring-boot-configuration-processor` is listed in `annotationProcessorPaths` (JAVA-TOOL-10; version from the Boot parent). It generates `META-INF/spring-configuration-metadata.json`, which the IDE uses to complete and document the keys (CFG-10) and the key-list test reads (TEST-CFG-04).

### Profiles and environments

- **SPRING-CFG-05: `application.yaml` holds the deployed defaults; `application-local.yaml` the local ones.** No `application-dev/test/staging/prod.yaml` (CFG-04). Test-only settings use `@TestPropertySource`, `@DynamicPropertySource` or Testcontainers `@ServiceConnection` (SPRING-TEST), not a shared `test` profile file. Behaviour that differs between local and deployed is selected with `on-profile: "local"` or `"!local"` (as the template does for structured logs, SPRING-LOG-02).
- **SPRING-CFG-06: Deployments set values through environment variables in relaxed-binding form:** `app.payment.base-url` → `APP_PAYMENT_BASEURL` (dots become underscores, dashes are removed, upper case). OS environment variables override `application.yaml`. Command-line arguments are not used for configuration in deployments.

### Secrets

- **SPRING-CFG-07: Secrets are read from files mounted by the platform through Boot's config tree:** the deployment sets `SPRING_CONFIG_IMPORT=configtree:/run/secrets/` (path per platform), and each file name is a property name (`/run/secrets/app.payment.api-key` → `app.payment.api-key`). Not `optional:` in deployments, so a missing mount fails the start. Where the platform cannot mount files, the same keys come as environment variables (SPRING-CFG-06, CFG-05); the product records that fallback in chapter 7. The secret manager fills the mount (for example a CSI driver or an external-secrets operator; platform decision). A Spring Cloud integration that reads the secret manager directly (Vault, AWS, Azure) needs an ADR. The database credentials of SPRING-REL-01 as a config tree:

```text
SPRING_CONFIG_IMPORT=configtree:/run/secrets/
/run/secrets/spring.datasource.username   DML-only role (SPRING-SEC-27)
/run/secrets/spring.datasource.password
/run/secrets/spring.flyway.user           DDL role, used only by Flyway (SPRING-REL-01)
/run/secrets/spring.flyway.password
```

```yaml
# application.yaml: no credential placeholders; the Flyway placeholder reads the bound property
spring:
  flyway:
    placeholders:
      app-role: ${spring.datasource.username}
```
- **SPRING-CFG-08: The database and broker credentials of the running service are distinct from the migration credentials** (SPRING-SEC-27) and are rotated by updating the secret and doing a rolling restart (CFG-06). Live reload of secrets without restart is not a default.
- **SPRING-CFG-09: `/actuator/env` and `/actuator/configprops` stay unexposed** (SPRING-SEC-07); configuration is never dumped in logs at startup.
- **SPRING-CFG-11: Secret values in properties records have the type `Secret`** (CFG-07), a final class in the support package `<base>.config` (not a record, whose generated `toString()` would print the value). The binder converts the configured string through the public `String` constructor, so no converter bean is needed; a blank value fails the start. Adapters call `reveal()` only where the value is handed to a client library. The ArchUnit rule `secretsUseSecretType` fails when a field of a `*Properties` class has a name that marks a secret but a type other than `Secret`.

```java
// <base>/config/Secret.java
public final class Secret {
  private final String value;

  public Secret(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("secret must not be blank");
    this.value = value;
  }

  public String reveal() { return value; }

  @Override
  public String toString() { return "***"; }
}
```

### BFF: serving the frontend configuration

- **SPRING-CFG-10: The component that serves the SPA (BFF, SPRING-SEC-08) serves `GET /config.json`** from a validated `app.frontend.*` properties record, mapped to an explicit response record (never a dump of the `Environment`). The endpoint is listed as a public path (SPRING-SEC-01, with the stated reason "public bootstrap data"), and the response carries `Cache-Control: no-store`. It contains public values only (CFG-11, TS-SEC-04), including the release version from `info.release.version` (REL-VER-05), which the frontend attaches to error reports and uses for the chunk-reload guard (NG-ARCH-20). The controller lives in `adapter.in.rest` like any other.

## Tests

| What | How |
|---|---|
| Binding and validation (TEST-CFG-01) | Plain JUnit with `ApplicationContextRunner().withUserConfiguration(PaymentClientConfiguration.class).withPropertyValues(...)`: valid values give the bean, each violated constraint and each missing key gives `hasFailed()` with the key in the message. No Spring Boot test context, no containers |
| Secret masking (TEST-CFG-03) | One unit test: `assertThat(new Secret("s3cr3t").toString()).doesNotContain("s3cr3t")`; the ArchUnit rule `secretsUseSecretType` covers every properties record |
| Key list (TEST-CFG-04) | Plain JUnit: read `META-INF/spring-configuration-metadata.json` from the classpath and `configuration-keys.yaml`, compare the `app.*` names in both directions |
| No deployed default for required keys (TEST-CFG-05) | Plain JUnit: load `application.yaml` (default document, no profile) with a YAML parser, and fail for every `required: true` key of `configuration-keys.yaml` that has a value there or a `${…:default}` fallback; the `@DefaultValue` check reads the generated configuration metadata (`defaultValue`) |
| Use-case settings | Unit test constructs the record directly |
| `/config.json` | `@WebMvcTest`: 200 without authentication, exact JSON keys, `Cache-Control: no-store` (SPRING-REST-13, SPRING-SEC-10) |
| Deployed defaults (TEST-CFG-02) | The `e2e:smoke` start of the image (SPRING-DEV-10) runs without the `local` profile and with the required keys of `configuration-keys.yaml` only (CFG-12) |

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring Boot: Configuration".*
