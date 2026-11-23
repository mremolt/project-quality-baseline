# Configuration and Environments

How a component gets the values that differ between deployments, and how secrets reach it. These rules apply to every stack; each stack adds its rules in `<stack>.md` here (Spring: [spring.md](spring.md), NestJS: [nestjs.md](nestjs.md); frontends: Per stack line at the end). Where environments run is product-specific (the product's chapter 7); this doc covers the application side.

**Terms.** *Configuration* is every value that can differ between deployments of the same build: URLs, credentials, pool sizes, time-outs, environment-specific switches. Everything else is *code*, even if it is a constant. A *secret* is configuration that grants access (password, client secret, API key, signing key). An *environment* is one deployment target (for example `test`, `staging`, `production`); a *profile* or *build mode* is a way of running the code (local development, tests).

## Decisions

The decisions behind this concept, each stated once in the rule that owns it:

| Topic | Rule |
|---|---|
| Build artifacts: one per component and commit, promoted unchanged | [REL-CD-01](../../07-deployment-view/delivery-and-release.md) (CFG-02) |
| Per-environment values injected at deploy time, never selected by a profile or build flag | CFG-03, CFG-04 |
| Secrets from a secret manager, mounted files preferred | CFG-05 |
| Typed configuration, validated at startup | CFG-08 |
| Frontend: runtime configuration from the serving origin (an SPA: `/config.json`) | CFG-11 |
| Feature-flag systems | [REL-FF-01..04](../../07-deployment-view/delivery-and-release.md); a per-environment on/off switch is ordinary configuration |

## Rules

### Configuration versus code

- **CFG-01: Only values that differ between deployments are configuration.** Business rules, constants, retry policies that are the same everywhere and wire formats stay in code (and in tests). A new configuration key needs an answer to "which environment sets a different value?".
  *Why:* every key is a deployment-time failure mode and a test gap; externalizing too much turns code review into config archaeology.
- **CFG-02: One build artifact per component and commit is promoted through every environment** ([REL-CD-01](../../07-deployment-view/delivery-and-release.md)). For configuration this means: no environment-specific files inside the artifact and no environment name compiled in; the release version is injected at deploy time like any other value.
- **CFG-03: Environment-specific values are injected at deploy time** by the platform, as environment variables or mounted files. The repository holds defaults only where the value is right for every deployed environment; otherwise there is no default, so a missing value fails the start (CFG-08). Values per environment live in the deployment configuration (infrastructure repository or platform), not in the component.
- **CFG-04: Profiles and build modes describe how the code runs, not where.** Allowed: `local` (SPRING-DEV-02; NestJS: `.env.local`, NEST-DEV-06), test-only profiles and `demo` (loads synthetic demo data, DP-ENV-04; never set in a deployed configuration). No `dev`, `staging` or `prod` profile, configuration file or build configuration. Deployed environments run without a profile and differ only in injected values.
  *Why:* environment profiles grow hidden differences between environments that no test sees, and they tempt per-environment builds (CFG-02).

### Secrets

- **CFG-05: Secrets live in a secret manager and reach the component as mounted files or environment variables injected by the platform.** Mounted files are the default; environment variables only where the platform offers nothing else. Secrets never enter git, logs, container images, tickets or chat (SEC-INC-01, SPRING-SEC-06, NEST-SEC-09, TS-SEC-04); development values are throwaway and marked as such (SPRING-DEV-04, NEST-DEV-03, SEC-INC-03).
  *Why:* environment variables leak into process listings, crash dumps, child processes and diagnostic endpoints more easily than file contents.
- **CFG-06: Every secret is rotatable without a code change or rebuild,** by updating the secret manager and restarting (rolling) the component. Credentials the component presents to others (database, broker, API keys) support an overlap period with two valid values, so a rotation never needs downtime. Rotation intervals per secret type are product decisions recorded in `docs/security/`; a leaked secret is rotated immediately (SEC-INC-01).
- **CFG-07: Configuration objects that hold secrets never print them.** Every secret value is held in a small self-masking `Secret` type: its `toString()` returns a fixed mask and the value is read only through an explicit accessor (`reveal()`), so `toString()`, debug output, error messages and diagnostic endpoints cannot print it, even in a record that prints all its components. An architecture test fails when a configuration type holds a value whose name marks a secret (`password`, `secret`, `token`, `apiKey`, `credential`) as a plain string. Stack mechanism: SPRING-CFG-11, NEST-CFG-08, NEXT-CFG-06. A browser bundle holds no secrets (CFG-11).
  *Why:* a hand-written `toString()` per record is forgotten on the next new record; a type cannot be.

### Typed and validated

- **CFG-08: Configuration is typed and validated at startup.** Each component binds its configuration into typed, immutable objects with constraints (required, ranges, URL format, durations with units); an invalid or missing value stops the start with a message naming the key. No string lookups scattered through the code, no validation at first use.
  *Why:* a broken deployment then fails its readiness check (OBS-03) instead of failing the first customer request.
- **CFG-09: Configuration is read only at the edge.** Adapters and the composition root read and bind it; `domain`, `ports` and use cases receive plain values or value objects through constructors or commands, never a configuration framework type and never the environment (ARCH-DEP). Architecture tests enforce it (SPRING-CFG-02, NODE-ARCH-12; frontends: the stack's rule).
- **CFG-10: Every key is documented where it is defined** (the typed configuration class or schema), with meaning, unit and default. The product's chapter 7 says which keys each environment must set and where secrets come from by linking to the key list (CFG-12), not by repeating it.
- **CFG-12: Each deployable component keeps a machine-readable list of the keys a deployment sets:** `configuration-keys.yaml` in the component folder, one entry per key with `key`, `required`, `secret` and a one-line `description`. It holds the component's own keys and the framework keys a deployment must set (for example the database URL). Tests read it (TEST-CFG-02, TEST-CFG-04); a handover to a customer-run platform ships it with the image digest. A frontend served by the BFF has no list of its own: its values are keys of the BFF (CFG-11; Spring: `app.frontend.*`, NestJS: `FRONTEND_*`, NEST-CFG-11). A frontend that is its own deployable keeps its own list (Next.js: NEXT-CFG-09).

```yaml
# backend/configuration-keys.yaml
- key: spring.datasource.url
  required: true
  secret: false
  description: JDBC URL including the pgjdbc timeouts (SPRING-RES-01)
- key: app.payment.base-url
  required: true
  secret: false
  description: Base URL of the payment provider
- key: app.payment.api-key
  required: true
  secret: true        # mounted file from the secret manager (CFG-05)
  description: API key for the payment provider
```

### Frontends

- **CFG-11: A frontend gets its per-environment configuration at runtime from its serving origin**, never at build time. An SPA loads `/config.json`; the file is generated per environment by the server that serves the app (the BFF, SPRING-SEC-08, NEST-SEC-12, which embeds and serves the bundle by default: REL-FE-01/03) and is not cached. A frontend that renders on its own server (Next.js) maps an explicit public subset of its server configuration into the page instead (NEXT-CFG-05). Either way the browser gets public values only: anything shipped to a browser is public (TS-SEC-04).

## Tests

- **TEST-CFG-01: Each configuration type has a binding test:** valid values bind, every constraint rejects an invalid value, and a missing required value fails the start. The test runs without the network and without the real environment.
- **TEST-CFG-02: The deployed defaults start.** One system or smoke test (REPO-CI-04) starts the artifact without a development profile and with only the required keys of the key list (CFG-12), so a newly required key that is missing from the list fails CI.
- **TEST-CFG-03: Secret masking is asserted** (CFG-07): one unit test for the `Secret` type, plus the architecture test that no secret-named value is a plain string.
- **TEST-CFG-04: The key list matches the code.** A unit test fails when the component defines an own key that `configuration-keys.yaml` lacks, or the list names an own key the code no longer defines (Spring: the generated configuration metadata, SPRING-CFG-04; NestJS: NEST-CFG-10).
- **TEST-CFG-05: A required key has no deployed default.** A unit test fails when a key marked `required: true` in `configuration-keys.yaml` gets a value in the deployed configuration: Spring: in `application.yaml` without a profile, through a `${VAR:default}` fallback, or through `@DefaultValue`; NestJS: as a schema default. Defaults for local development live in the local profile or `.env.example` (CFG-03).
  *Why:* a required key with a deployed default never fails the start (CFG-08), so a forgotten value ships silently, for example as a `localhost` link in every e-mail. TEST-CFG-02 catches this only once a smoke test exists; this test catches it in the fast loop.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Configuration and Environments".*
