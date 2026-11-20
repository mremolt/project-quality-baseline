# Spring Boot: Local Development

How a developer (or an agent, or the frontend team) runs a service with its dependencies on a laptop. Default SPRING-D11: **Docker Compose** with Spring Boot's Docker Compose support. Tests use Testcontainers instead ([08-crosscutting-concepts/testing/spring.md](../08-crosscutting-concepts/testing/spring.md)).

Templates: `.agents/skills/baseline-spring/templates/compose.yaml`, `application.yaml`, `application-local.yaml`, `sdkmanrc` (copy as `.sdkmanrc`). The core path (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local` starting PostgreSQL and Kafka, Flyway, Hibernate `validate`, health UP) has been run with the template; Kafka listeners and producers and the `tools`, `auth`, `mail` and `observability` profiles have not. Confirm those in the first service that uses them and fix the template (see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)).

## Why Compose and not Testcontainers dev mode

| | Docker Compose (default) | Testcontainers dev mode (`spring-boot:test-run`) |
|---|---|---|
| Start | `./mvnw spring-boot:run` starts `compose.yaml` | needs a `TestApplication` class in `src/test` |
| Usable without the JVM | yes: frontend developers, DB tools, the `e2e:smoke` job (REPO-CI-04) | no |
| Data between runs | persists (named volume) | only with container reuse |

## Rules

- **SPRING-DEV-01: `backend/compose.yaml` defines every infrastructure dependency the service uses.** Docker and a JDK are the only prerequisites. It is a component file (REPO-LAY-05).
- **SPRING-DEV-02: `spring-boot-docker-compose` is a runtime, optional dependency.** Boot leaves it out of the repackaged jar and disables it in tests by default. Developers start the app with the `local` profile (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local`, IDE: active profile `local`). Boot then starts the services from `compose.yaml` and derives the datasource and Kafka settings from the running containers; no connection settings in `application-local.yaml`.
- **SPRING-DEV-03: Core services (database, broker) have no Compose profile** and start by default. Optional extras use profiles: `tools` (Kafka UI), `auth` (Keycloak with an imported dev realm in `dev/keycloak/`), `mail` (Mailpit), `observability` (Grafana LGTM). Enable them with `spring.docker.compose.profiles.active` or `docker compose --profile … up`.
- **SPRING-DEV-04: Images are pinned at least to the major version** where the image publishes such tags (`postgres:18`). `apache/kafka` publishes only full versions, so it is pinned to the exact production broker version (`apache/kafka:4.2.2`, SPRING-DEV-05). No `latest`: every image in `compose.yaml` is pinned to a version, or to a digest when CI runs the file. SEC-CI-02 covers Compose images that CI starts; updates come from the update automation (TS-TOOL-15). Ports bind to `127.0.0.1`. Credentials are throwaway dev values; the file contains no real secrets (SPRING-SEC-06).
- **SPRING-DEV-05: Kafka is a single-node KRaft broker on the fixed host port 9092, in the production broker version** (the Boot-managed client may be newer; clients are compatible with older brokers, but features like share groups depend on the broker). It advertises `localhost:9092`, so a random host port would break clients. A second listener (`DOCKER://kafka:19092`) serves other containers on the Compose network.
- **SPRING-DEV-06: PostgreSQL uses the production major version** and a Debian-based image (SPRING-DB-01). Its data lives in a named volume; `docker compose down -v` resets it.
- **SPRING-DEV-07: Application settings come from `application.yaml` plus `application-local.yaml`.** Nothing machine-specific in the repository; secrets through the environment.
- **SPRING-DEV-08: No bash or PowerShell start-up scripts.** Compose and Maven cover starting, stopping and resetting (TOOL-SKL-08). If a script becomes unavoidable, it is a Node `.mjs` with launchers.
- **SPRING-DEV-09: A frontend developer gets a working backend with** `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`, or only the dependencies with `docker compose up -d` when the API runs from the IDE.
- **SPRING-DEV-10: The `e2e:smoke` job** (REPO-CI-04) runs `docker compose -f compose.yaml -f compose.app.yaml up` from `backend/`, where `compose.app.yaml` only adds the application image built from the same commit (`spring-boot:build-image`; for the BFF with the frontend bundle embedded, SPRING-REL-08), referenced by digest. No orchestrator across components (REPO-LAY-04).

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

## Agent checklist

- [ ] New infrastructure dependency added to `compose.yaml` (core: no profile; extra: profile) with pinned image?
- [ ] Production and local PostgreSQL major version equal?
- [ ] No connection settings or secrets added to the repository for local use?
- [ ] No new start-up script?

## Sources

Spring Boot Docker Compose support (docs.spring.io/spring-boot/reference/features/dev-services.html), Docker Compose file reference and profiles (docs.docker.com/compose), Apache Kafka Docker image (hub.docker.com/r/apache/kafka), PostgreSQL 18 image notes (hub.docker.com/_/postgres).
