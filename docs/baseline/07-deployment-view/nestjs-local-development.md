# NestJS: Local Development

How a developer, an agent or the frontend team runs a NestJS service with its dependencies on a laptop: Docker Compose for the services, Node from `.nvmrc`, watch mode with `.env.local`. Tests use Testcontainers instead ([testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md)). All commands run from `backend/` (REPO-TOOL-03).

## Rules

- **NEST-DEV-01: `backend/compose.yaml` defines every infrastructure dependency the service uses.** Docker and Node are the only prerequisites. It is a component file (REPO-LAY-05). Nest has no Compose integration: developers start the services with `docker compose up -d --wait` and the app separately (NEST-DEV-05).
- **NEST-DEV-02: Core services (database, broker) have no Compose profile** and start by default. Optional extras use profiles: `tools` (Kafka UI), `auth` (Keycloak with an imported dev realm in `dev/keycloak/`), `mail` (Mailpit), `observability` (Grafana LGTM); start them with `docker compose --profile <name> up -d`. A service the application cannot start or work without is core, not optional: a product with login drops the `auth` profile from Keycloak, one that sends mail drops the `mail` profile from Mailpit, in its own `compose.yaml`.
- **NEST-DEV-03: Images are pinned, ports bind to `127.0.0.1`, credentials are throwaway.** Pin at least the major where the image publishes such tags (`postgres:18`, Debian-based like production, NEST-DB-01); `apache/kafka` publishes only full versions, so pin the production broker version (`apache/kafka:4.2.2`). No `latest`; images that CI starts are pinned by digest (SEC-CI-02) and updated by the update automation. The file contains no real secret (SEC-INC-03).
- **NEST-DEV-04: Local PostgreSQL has the production role split.** An init script `dev/postgres/init.sql`, mounted into `/docker-entrypoint-initdb.d/`, creates the DDL user (owner of the database) and the DML user, so migrations, grants and the "DML only" behaviour (NEST-DB-17) run locally as in production. Data lives in a named volume; `docker compose down -v` resets it.

```yaml
services:
  postgres:
    image: postgres:18
    environment: { POSTGRES_DB: orders, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["127.0.0.1:5432:5432"]
    volumes:
      - postgres-data:/var/lib/postgresql            # PostgreSQL 18 keeps PGDATA in a versioned subfolder
      - ./dev/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres -d orders"], interval: 5s, timeout: 3s, retries: 20 }
  kafka:
    image: apache/kafka:4.2.2                         # production broker version; single-node KRaft
volumes:
  postgres-data:
```

```sql
-- dev/postgres/init.sql: local only, throwaway passwords
CREATE ROLE orders_owner LOGIN PASSWORD 'orders_owner';
CREATE ROLE orders_app LOGIN PASSWORD 'orders_app';
ALTER DATABASE orders OWNER TO orders_owner;
```

- **NEST-DEV-05: Kafka is a single-node KRaft broker on the fixed host port 9092.** It advertises `localhost:9092` (a random host port would break clients), with a second listener `DOCKER://kafka:19092` for other containers on the Compose network.
- **NEST-DEV-06: Local configuration is the committed `.env.local`** (NEST-CFG-06): the throwaway values that match `compose.yaml` (`DATABASE_*` with the DML user and, for start-up migration, the DDL user; `KAFKA_*`), nothing machine-specific and no real secret. There is no `.env.example`: the key list is `configuration-keys.yaml` (CFG-12). A developer overrides a value in the shell (`DATABASE_PORT=55432 npm run start:dev`): Node's `--env-file` never overrides variables already set in the environment.
- **NEST-DEV-07: The Node version comes from `.nvmrc`** (`nvm use`, `fnm use` or the IDE), the same major as CI and the image (NODE-TOOL-01).
- **NEST-DEV-08: `npm run start:dev` is `nest start --watch --env-file .env.local`.** The Nest CLI compiles with `tsc` in watch mode from `tsconfig.build.json` (ESM, decorators), restarts `node dist/main.js` after each successful compile, adds `--enable-source-maps`, and passes `--env-file` to Node (a missing file is skipped). It needs `nest-cli.json` with `"compilerOptions": { "builder": "tsc", "tsConfigPath": "tsconfig.build.json", "deleteOutDir": true }`. The app migrates at start-up against Compose (NEST-REL-01). Readable logs: the script does not pipe; a developer pipes the output through `pino-pretty` when wanted (`npm run start:dev | npx pino-pretty`, a dev dependency); the service itself always writes JSON (NEST-LOG-02). Telemetry is not loaded in watch mode; to run the built app as the image does, use `npm run build` and `node --env-file=.env.local --import ./dist/instrumentation.js dist/main.js | pino-pretty`.
- **NEST-DEV-09: Debugging uses `npm run start:debug` = `nest start --watch --debug --env-file .env.local`**, which adds `--inspect` (inspector on `127.0.0.1:9229`); attach from the IDE. Never `--inspect=0.0.0.0`, never an inspector in an image or a deployed environment.
- **NEST-DEV-10: No bash or PowerShell start-up scripts.** Compose and npm scripts cover starting, stopping and resetting (TOOL-SKL-08); a script that becomes unavoidable is a Node `.mjs` file.
- **NEST-DEV-11: A frontend developer gets a working backend with** `cd backend && docker compose up -d --wait && npm ci && npm run start:dev`, or the built image with Compose (NEST-DEV-12).
- **NEST-DEV-12: The `e2e:smoke` job runs the application image of the same commit next to the local services with Docker Compose** (REPO-CI-04): it runs `docker compose -f compose.yaml -f compose.app.yaml up` from `backend/`, where `compose.app.yaml` only adds the application image built from the same commit (for the BFF with the frontend bundle, NEST-REL-10), referenced by digest and started read-only (NEST-REL-09). No orchestrator across components (REPO-LAY-04).

*Agent checklist in [checklists/nestjs.md](../checklists/nestjs.md) and sources in [sources.md](../sources.md), section "NestJS: Local Development".*
