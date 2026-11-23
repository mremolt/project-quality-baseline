# Spring Boot: Local Development

How a developer (or an agent, or the frontend team) runs a service with its dependencies on a laptop. Default SPRING-D11: **Docker Compose** with Spring Boot's Docker Compose support. Tests use Testcontainers instead ([08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md)).

Templates: `.agents/skills/baseline-spring/templates/compose.yaml`, `application.yaml`, `application-local.yaml`, `sdkmanrc` (copy as `.sdkmanrc`). The core path (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local` starting PostgreSQL and Kafka, Flyway, Hibernate `validate`, health UP) has been run with the template; Keycloak of the `auth` profile was started from the template (health check, realm import, admin-API token); Kafka listeners and producers and the `tools`, `mail` and `observability` profiles have not. Confirm those in the first service that uses them and fix the template (see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)).

## Why Compose and not Testcontainers dev mode

| | Docker Compose (default) | Testcontainers dev mode (`spring-boot:test-run`) |
|---|---|---|
| Start | `./mvnw spring-boot:run` starts `compose.yaml` | needs a `TestApplication` class in `src/test` |
| Usable without the JVM | yes: frontend developers, DB tools, the `e2e:smoke` job (REPO-CI-04) | no |
| Data between runs | persists (named volume) | only with container reuse |

## Rules

- **SPRING-DEV-01: `backend/compose.yaml` defines every infrastructure dependency the service uses.** Docker and a JDK are the only prerequisites. It is a component file (REPO-LAY-05).
- **SPRING-DEV-02: `spring-boot-docker-compose` is a runtime, optional dependency.** Boot leaves it out of the repackaged jar and disables it in tests by default. Developers start the app with the `local` profile (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local`, IDE: active profile `local`). Boot then starts the services from `compose.yaml` and derives the datasource and Kafka settings from the running containers; no connection settings in `application-local.yaml`.
- **SPRING-DEV-03: Core services (database, broker) have no Compose profile** and start by default. Optional extras use profiles: `tools` (Kafka UI), `auth` (Keycloak with an imported dev realm in `dev/keycloak/`, template `orders-realm.json`, SPRING-DEV-12), `mail` (Mailpit), `observability` (Grafana LGTM). Enable them with `spring.docker.compose.profiles.active` or `docker compose --profile … up`. A service the application cannot start or work without is core, not optional: a product with login drops the `auth` profile from Keycloak, one that sends invitations or other mail drops the `mail` profile from Mailpit, in its own `compose.yaml`.
- **SPRING-DEV-04: Images are pinned at least to the major version** where the image publishes such tags (`postgres:18`). `apache/kafka` publishes only full versions, so it is pinned to the exact production broker version (`apache/kafka:4.2.2`, SPRING-DEV-05). No `latest`: every image in `compose.yaml` is pinned to a version, or to a digest when CI runs the file. SEC-CI-02 covers Compose images that CI starts; updates come from the update automation (TS-TOOL-15). Ports bind to `127.0.0.1`. Credentials are throwaway dev values; the file contains no real secrets (SPRING-SEC-06).
- **SPRING-DEV-05: Kafka is a single-node KRaft broker on the fixed host port 9092, in the production broker version** (the Boot-managed client may be newer; clients are compatible with older brokers, but features like share groups depend on the broker). It advertises `localhost:9092`, so a random host port would break clients. A second listener (`DOCKER://kafka:19092`) serves other containers on the Compose network.
- **SPRING-DEV-06: PostgreSQL uses the production major version** and a Debian-based image (SPRING-DB-01). Its data lives in a named volume; `docker compose down -v` resets it.
- **SPRING-DEV-07: Application settings come from `application.yaml` plus `application-local.yaml`.** Nothing machine-specific in the repository; secrets through the environment.
- **SPRING-DEV-08: No bash or PowerShell start-up scripts.** Compose and Maven cover starting, stopping and resetting (TOOL-SKL-08). If a script becomes unavoidable, it is a Node `.mjs` with launchers.
- **SPRING-DEV-09: A frontend developer gets a working backend with** `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`, or only the dependencies with `docker compose up -d` when the API runs from the IDE.
- **SPRING-DEV-10: The `e2e:smoke` job** (REPO-CI-04) runs `docker compose -f compose.yaml -f compose.app.yaml up` from `backend/`, where `compose.app.yaml` only adds the application image built from the same commit (`spring-boot:build-image`; for the BFF with the frontend bundle embedded, SPRING-REL-08), referenced by digest, with `depends_on: { condition: service_healthy }` on every service it calls at start-up (database, Keycloak: OIDC discovery fails and the app exits when it starts before the realm is imported). No orchestrator across components (REPO-LAY-04).
- **SPRING-DEV-11: The IdP issuer URL is identical for the browser, the app on the host and the app in a container.** The issuer is part of every token and of OIDC discovery, so one URL must work everywhere: Keycloak runs with `KC_HOSTNAME: http://keycloak.localhost:8180` and `KC_HTTP_PORT: "8180"` (the same port inside and outside the container), publishes `127.0.0.1:8180:8180`, and has the Compose network alias `keycloak.localhost`. Browsers resolve `*.localhost` to the loopback address, the host JVM does too on current systems, and containers resolve the alias; `application-local.yaml` and `compose.app.yaml` both use `http://keycloak.localhost:8180/realms/<realm>`. Back-channel logout from Keycloak to an app on the host goes to `host.docker.internal` (`extra_hosts: host-gateway`).
  *Why:* `localhost:8180` in the browser and `keycloak:8080` in a container are two issuers; token validation then fails in one of the two run modes.
- **SPRING-DEV-12: Keycloak has a health check and a realm template.** `KC_HEALTH_ENABLED: "true"` serves `/health/ready` on the management port 9000; the image has no `curl`, so the Compose health check speaks HTTP through bash `/dev/tcp` (template). Boot's Docker Compose support and `compose.app.yaml` (SPRING-DEV-10) wait for it to be healthy. The realm import (`dev/keycloak/orders-realm.json`) holds a confidential BFF client (code flow with PKCE, back-channel logout URL), and, where the product manages users through the admin API (outgoing port, `@HttpClientAdapter`), a service-account client with `realm-management` roles `manage-users`/`view-users` **and the `kc-admin-api` client scope**: Keycloak 26.8 accepts admin-API tokens only with that audience and otherwise answers a bare 401 whose reason is logged at DEBUG only. Dev users are fictitious (DP-ENV-01); all secrets in the file are throwaway dev values (SPRING-SEC-06).
  *Why:* without the health check the app starts before the realm exists and exits at discovery; the missing admin scope cost a product a long diagnosis.

### Excerpt: the core services

```yaml
services:
  postgres:
    image: postgres:18
    environment: { POSTGRES_DB: orders, POSTGRES_USER: orders, POSTGRES_PASSWORD: orders }
    ports: ["127.0.0.1:5432:5432"]
    volumes: ["postgres-data:/var/lib/postgresql"]   # PostgreSQL 18 images keep PGDATA in a versioned subfolder
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U orders -d orders"], interval: 5s, timeout: 3s, retries: 20 }
  kafka:
    image: apache/kafka:4.2.2                         # production broker version; single-node KRaft, see the template for the listener settings
```

### Not included

An S3 emulator for the `adapter.out.s3` tests: the free-tier terms of LocalStack and MinIO have been changing. Check the current terms before adding one to a project's `compose.yaml` (and to this baseline).

*Agent checklist in [checklists/spring.md](../checklists/spring.md) and sources in [sources.md](../sources.md), section "Spring Boot: Local Development".*
