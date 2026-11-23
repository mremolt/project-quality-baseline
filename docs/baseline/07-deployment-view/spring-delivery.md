# Spring Boot: Delivery

Spring Boot wiring for the shared delivery rules in [delivery-and-release.md](delivery-and-release.md) and [container-runtime.md](container-runtime.md): Flyway with a separate DDL role at start-up or in a pre-deploy job, lock behaviour with several instances, the release version injected at deploy time, and the frontend bundle in the BFF image. Database rules: [08-crosscutting-concepts/persistence/spring.md](../08-crosscutting-concepts/persistence/spring.md). Image build: SPRING-LIB-13.

## Rules

### Migrations (REL-DB-01..06)

- **SPRING-REL-01: Flyway runs at start-up with its own credentials.** Setting `spring.flyway.user` (and `spring.flyway.password`) makes Flyway use its own `DataSource`; unset values fall back to `spring.datasource.*`. The DDL role owns the schema and is not a superuser; `spring.datasource.username` is the DML-only role (SPRING-SEC-27). All four values come from the config tree (SPRING-CFG-07, example there): files named `spring.datasource.username`, `spring.datasource.password`, `spring.flyway.user` and `spring.flyway.password` in the mounted secret folder. Environment variables are only the fallback where the platform cannot mount files (CFG-05). The role split also holds in a delivered Compose installation: an init script creates the non-superuser DDL owner and the DML role (the image's `POSTGRES_USER` is a superuser and would make every `REVOKE` meaningless), and the application service connects as the DML role.

  ```yaml
  spring:
    flyway:
      init-sqls: SET lock_timeout = '5s'   # SPRING-REL-02
      lock-retry-count: 50                 # SPRING-REL-02
      placeholders:
        app-role: ${spring.datasource.username}
  ```

  *Why:* the default accepts that the DDL credential is present in the runtime in exchange for no extra deployment step; keeping it out of the application's own pool limits what an injection in application code can do. The pre-deploy variant (SPRING-REL-07) removes it from the runtime.
- **SPRING-REL-02: Flyway's connection sets `lock_timeout` and a bounded lock retry.** `spring.flyway.init-sqls` sets `lock_timeout` (default `5s`, tuned per product): a migration that waits longer for a table lock fails, the instance does not become ready, and the old version keeps serving (REL-DB-03/05). `spring.flyway.lock-retry-count` (Flyway default 50, about one second apart) bounds how long a second instance waits for the migration lock held by the first; set it explicitly so the wait covers the longest expected migration and stays inside the start-up budget (REL-DB-04, REL-RUN-04).
- **SPRING-REL-03: The DML role gets its rights through a schema grant and default privileges.** They are set once in the first migration, so every later table is covered without a grant per migration:

  ```sql
  GRANT USAGE ON SCHEMA ${flyway:defaultSchema} TO ${app-role};
  ALTER DEFAULT PRIVILEGES IN SCHEMA ${flyway:defaultSchema}
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${app-role};
  ALTER DEFAULT PRIVILEGES IN SCHEMA ${flyway:defaultSchema}
    GRANT USAGE, SELECT ON SEQUENCES TO ${app-role};
  ```

  Default privileges apply to objects created by the role that runs them, which is the Flyway user here. With `@ServiceConnection` (Testcontainers) `spring.datasource.username` is not set as a property, so the `app-role` placeholder resolves empty: the shared Testcontainers configuration sets `spring.flyway.placeholders.app-role` to the DML role that the test infrastructure creates (SPRING-DB-19), with a `@DynamicPropertySource` method or a `DynamicPropertyRegistrar` bean next to the `@ServiceConnection` container. It does not use an `application-test.yaml`, which SPRING-CFG-05 rules out. Without the schema grant the DML role cannot see any table in a schema it does not own. The role setup is confirmed in the first project (see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)).
- **SPRING-REL-04: Projects that use `CREATE INDEX CONCURRENTLY` (SPRING-DB-06) set `spring.flyway.postgresql.transactional-lock=false`.** Flyway's default transactional advisory lock keeps a transaction open around the migration, which Flyway's documentation says must be switched off for such statements. Session-level locks require that Flyway connects to PostgreSQL directly, not through a transaction-pooling proxy (set `spring.flyway.url` to the direct address if a pooler sits in front).
- **SPRING-REL-07: The pre-deploy variant (REL-DB-01) runs the same image in a migrate-only mode.** The job starts the image with `app.migrate-only=true`, `spring.main.web-application-type=none` and `spring.kafka.listener.auto-startup=false`, and with the DDL credentials. A runner in the composition root, active only with `app.migrate-only=true`, exits the application with `SpringApplication.exit` once the context has started, which is after Flyway migrated. The application instances get no DDL credentials (`spring.flyway.user` unset) and a `FlywayMigrationStrategy` bean that calls `validate()` instead of `migrate()`, so an instance whose schema is not current fails its start instead of migrating. The job's timeout follows REL-DB-04. The validate-only behaviour with pending migrations is confirmed in the first project that uses this variant (see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use)).

### Version (REL-VER-05)

- **SPRING-REL-06: The image does not carry the release version; the deployment injects it** (REL-CD-01). The deployable's POM version stays fixed (the template's `0.0.1-SNAPSHOT`), and CI passes no version to the build. The commit comes from `git.properties` (`git-commit-id-maven-plugin`, managed by the Boot parent and limited to the commit id and time) and from the `build-info` goal; both appear on the info endpoint. The release version is configuration: `application.yaml` sets `info.release.version: unreleased` and `management.info.env.enabled: true`, and the deployment sets `INFO_RELEASE_VERSION=1.4.0` (SPRING-CFG-06). Libraries published to a Maven repository are built from their tag (REL-VER-02): `<version>${revision}</version>` with `-Drevision=1.4.0` and `flatten-maven-plugin`, so the installed POM carries the resolved version.

### Frontend bundle in the BFF (REL-FE-01..04)

- **SPRING-REL-08: The BFF embeds the bundle through a Maven profile activated by the bundle path.** The image build job runs `./mvnw spring-boot:build-image -Dfrontend.dist=<path to the bundle artifact>`; the profile `embed-frontend` (template: `pom.reference.xml`) copies that folder to `classpath:/frontend/` in `process-resources`. Not into `static/`: Boot would then serve `index.html` itself, without the CSP nonce (NG-SEC-06) and with the wrong cache headers. The BFF serves `classpath:/frontend/` with a resource handler for the files and a controller for `index.html` and deep links, following the table in REL-FE-03. Its tests use a fixture bundle in `src/test/resources`, so `./mvnw verify` never needs the frontend (REL-FE-02).
- **SPRING-REL-09: The hashed files are served by one resource handler per URL pattern, each with its own location.** Spring resolves the path *inside* the pattern below the location, so `/media/**` needs `addResourceLocations("classpath:/frontend/media/")`, not `classpath:/frontend/`; a single `/**` handler would also shadow the `index.html` controller. Each handler sets the cache rules of REL-FE-03 (`Cache-Control: public, max-age=31536000, immutable` for hashed files), and the code that writes `index.html` (a controller or a filter for deep links) runs inside the security filter chain after Spring Security's `HeaderWriterFilter`, so the document carries every header of SPRING-SEC-13; a filter added before it commits the response without them. An integration test against the fixture bundle (REL-FE-02) asserts a hashed script, a font below `media/`, a deep link and all security headers on the document.
  *Why:* both mistakes pass unit tests with a stub `index.html`: fonts 404 and the document ships without `X-Content-Type-Options` and `Referrer-Policy`.

*Agent checklist in [checklists/spring.md](../checklists/spring.md) and sources in [sources.md](../sources.md), section "Spring Boot: Delivery".*
