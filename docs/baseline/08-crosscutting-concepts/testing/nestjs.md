# NestJS: Testing

The NestJS specifics of [testing-by-architecture-element.md](testing-by-architecture-element.md) and [tdd.md](tdd.md): which tool and which setup for which element. Test type, style and doubles per element come from the [element table](testing-by-architecture-element.md#test-type-style-and-doubles-per-element); the table below adds only the setup. The test-first workflow is the `baseline-tdd` skill. Tooling and npm scripts: [node-tooling.md](../development/node-tooling.md).

## Element to test setup

| Element | Test setup | File (NEST-TEST-02) |
|---|---|---|
| Domain, application services | Plain Vitest; services built with `new` and `mock<Port>()`. **No Nest testing module.** | `*.test.ts` |
| `adapter/in/rest` | `Test.createTestingModule` with the controller and `mock<UseCase>()` under the use-case token, Fastify adapter, the production pipe and filter, requests with `app.inject()` (NEST-TEST-05) | `*.test.ts` |
| `adapter/out/persistence` | Testcontainers PostgreSQL in the production major version, real Kysely migrations, adapter built with `new` (NEST-TEST-06) | `*.it.test.ts` |
| `adapter/in/messaging`, `adapter/out/messaging` | Testcontainers Kafka; success, unknown type, validation → dead-letter topic, transient retry, outbox commit and rollback ([messaging/nestjs.md](../messaging/nestjs.md), NEST-MSG-14) | `*.it.test.ts` |
| `adapter/out/http` | A `node:http` stub server on port 0, so status codes, headers, timeouts and retries run over real sockets; one delayed response proves the read timeout ([resilience/nestjs.md](../resilience/nestjs.md)) | `*.test.ts` |
| Security | REST adapter setup plus the real auth guard: 401, 403 and success per protected route; a `cross-user` test (Vitest tag) for every use case that takes a caller-supplied id ([security/nestjs.md](../security/nestjs.md)) | `*.test.ts` |
| Business metrics | Adapter test with `InMemoryMetricExporter` from `@opentelemetry/sdk-metrics`: one data point per tag value, exact attribute keys ([observability/nestjs.md](../observability/nestjs.md)) | `*.test.ts` |
| Query and batch ports | Statement count asserted ([persistence/nestjs.md](../persistence/nestjs.md), API-N1-05) | `*.it.test.ts` |
| Architecture | `npm run check:arch` (dependency-cruiser) plus the canary test (NEST-TEST-10) | `*.test.ts` |
| OpenAPI spec test | `createApp()` without `init()` or `listen()`, document compared with the committed file (NEST-TEST-11) | `*.test.ts` |
| System tests (TEST-ARCH-05) | The application from `createApp()`, own infrastructure in Testcontainers, third-party systems stubbed at their outgoing ports (NEST-TEST-12) | `*.it.test.ts` |

## Rules

### Runner and doubles

- **NEST-TEST-01: Tests run on Vitest 5 with `unplugin-swc`; never Jest.** Nest's dependency injection reads decorator metadata, which Vitest's default transform does not emit. SWC does not know the ES2025 target, so the plugin sets its own. One config holds both projects:

```ts
// vitest.config.ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const swcPlugin = swc.vite({ module: { type: 'es6' }, jsc: { target: 'es2024' } });

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    setupFiles: ['reflect-metadata', './test/setup-env.ts'],      // test values for required configuration
    tags: [{ name: 'cross-user', description: 'Object-level access across callers (NEST-SEC-08)' }],
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'scripts/**/*.test.ts'], exclude: ['**/*.it.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'it',
          include: ['src/**/*.it.test.ts', 'test/**/*.it.test.ts'],
          globalSetup: ['test/postgres.global-setup.ts'],   // NEST-TEST-07
          testTimeout: 60_000,
          hookTimeout: 120_000,
          env: { RESILIENCE_TRANSACTION_GUARD: 'fail' },     // NEST-RES-03
        },
      },
    ],
  },
});
```

- **NEST-TEST-02: A test that starts a container is a `*.it.test.ts`; everything else is a `*.test.ts`.** Tests sit next to the code they test; `test/` holds only fixtures, global setups and the architecture canary. `npm test` runs the `unit` project, needs no Docker and stays the fast loop. `npm run test:it` runs the `it` project. `npm run verify` runs both.
- **NEST-TEST-03: Doubles of contracts are `mock<Contract>()` from `vitest-mock-extended` 6, typed by the port or use-case interface.** Queries are stubbed with `calledWith(...).mockResolvedValue(...)` (value objects through a typed `matches(...)` predicate, since non-matcher arguments compare with `===`, TS-TEST-03) and asserted on the outcome; only commands are verified (TEST-TDD-09). `vi.mock()` is not used for our own modules (dependencies come in through constructors and tokens, TEST-TDD-07); for a third-party module that cannot be injected it is a sign to wrap that module in a port. In a testing module a contract is replaced by its token: `{ provide: TOKEN, useValue: mock<Contract>() }` or `.overrideProvider(TOKEN).useValue(...)`.
- **NEST-TEST-04: Domain and application tests never start Nest.** Use cases are plain classes created by factories in the context module, so the test calls `new PlaceOrderService(orders)` with mocked ports (London) and domain code is tested with values in, values out (Chicago).

```ts
it('saves the placed order', async () => {
  const orders = mock<SaveOrderPort>();
  orders.nextId.mockReturnValue('o-1' as OrderId);
  const order = await new PlaceOrderService(orders).placeOrder(PlaceOrderCommand.of({ customerId: 'c1', total: '3.00' }));
  expect(order).toEqual({ id: 'o-1', customerId: 'c1', total: '3.00' });
  expect(orders.save).toHaveBeenCalledWith(order);
});
```

### Adapters

- **NEST-TEST-05: REST adapter tests run the controller inside Nest and Fastify with the production pipe and filter, and send requests with `app.inject()`.** The global `StandardSchemaValidationPipe` and the problem-details filter are registered through `APP_PIPE` and `APP_FILTER` in the root module, which a testing module with only the controller does not load, so the test adds them with `useGlobalPipes` and `useGlobalFilters`. The test registers the same `requestValidationPipe` instance the root module uses (NEST-REST rules in [api/nestjs-rest.md](../api/nestjs-rest.md)), so test and production cannot differ. Without the pipe, an invalid body reaches the controller. The test asserts status, body, `content-type` and the headers the rules require, and covers each documented error status.

```ts
describe('OrdersController', () => {
  const useCase = mock<PlaceOrderUseCase>();
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: PLACE_ORDER_USE_CASE, useValue: useCase }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(requestValidationPipe);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  it('rejects an invalid body with a problem', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/orders', payload: { total: '3' } }); // customerId missing
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(useCase.placeOrder).not.toHaveBeenCalled();
  });
});
```

- **NEST-TEST-06: Persistence adapters are tested against a real PostgreSQL with the real migrations** (TEST-ARCH-04). The container image has the production major version; the migrations are the migrator's static list ([persistence/nestjs.md](../persistence/nestjs.md)). No in-memory or substitute database (`pg-mem`, SQLite), no hand-written test schema. The adapter is built with `new` on a Kysely instance; a test that needs a transaction uses the same transaction mechanism as production.
- **NEST-TEST-07: Containers are started once per test run and shared.** A Vitest `globalSetup` in the `it` project starts each container, runs the migrations once and passes the connection data with `project.provide()`; test files read it with `inject()`. Tests isolate their data with unique ids or by cleaning the tables they write; they never depend on the order of files.

```ts
// test/postgres.global-setup.ts (template); startPostgres() and databaseConfig() live in test/postgres.ts
declare module 'vitest' {
  export interface ProvidedContext { postgres: PostgresServer }    // { host, port }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await startPostgres();                          // postgres:18 with dev/postgres/init.sql (NEST-DB-22)
  const server = { host: container.getHost(), port: container.getPort() };
  const ddl = createMigrationDatabase(databaseConfig(server));       // migrations as the DDL user
  try { await migrateToLatest(ddl); } finally { await ddl.destroy(); }
  project.provide('postgres', server);
  return async () => { await container.stop(); };
}

// in a test file: the DML user with the production session timeouts
const db = createDatabase<DB>(databaseConfig(inject('postgres')));
```

  `withReuse()` on a container keeps it across runs for a faster local loop; Testcontainers reuses it unless `TESTCONTAINERS_REUSE_ENABLE=false`, which CI sets.

### Data and time

- **NEST-TEST-08: Test data is deterministic** (TEST-TDD-16). Time comes from an injected `Clock` port fixed in the test; ids from an injected generator or literals. Where code reads `Date` directly (a third-party library), `vi.useFakeTimers({ toFake: ['Date'] })` with `vi.setSystemTime(...)` fixes it without faking the timers Fastify, `pg` and the Kafka client rely on. Test data is synthetic, never copied from production (DP-ENV-01).
- **NEST-TEST-09: No fixed waits.** Asynchronous outcomes are awaited with `vi.waitFor(...)` or `await expect.poll(() => ...).toBe(...)`, with a bounded timeout. `setTimeout`-based sleeps in tests are not used.

### Architecture, contract and system tests

- **NEST-TEST-10: The architecture check runs on every build and proves that it can fail** (ARCH-ENF-02). `npm run check:arch` runs dependency-cruiser on `src` with the template config ([05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md)). A canary under `test/fixtures/arch-violation/src/` contains deliberate violations, at least a **type-only** import of an adapter type in `domain` (proves `tsPreCompilationDeps` is on), a Nest import in `application` and a context persistence adapter that imports the `KYSELY` token (NEST-DB-04). A unit test (`test/architecture.test.ts`) runs dependency-cruiser's `cruise()` on the canary with the same rules and an absolute `baseDir` (NODE-ARCH-14) and expects violations naming those rules. Re-check the canary after renaming folders or rules.

```ts
it('rejects a type-only adapter import in domain and Nest in application', async () => {
  const fixture = fileURLToPath(new URL('fixtures/arch-violation', import.meta.url));
  const result = await cruise(['src'], { ...options, ruleSet: { forbidden }, validate: true, baseDir: fixture } as never);
  const rules = (result.output as { summary: { violations: { rule: { name: string } }[] } }).summary.violations.map((v) => v.rule.name);
  expect(rules).toContain('domain-is-pure');
  expect(rules).toContain('application-only-core');
  expect(rules).toContain('kysely-token-only-in-persistence');
});
```

- **NEST-TEST-11: The OpenAPI spec test compares the generated document with the committed file** ([nestjs-openapi.md](../api/nestjs-openapi.md)). It sits next to the API description, builds the application with `createApp()` without `init()` or `listen()` (nothing connects, so it is a Docker-free `*.test.ts`), generates the document and fails on any difference. With `OPENAPI_UPDATE=true` it writes the file instead (`npm run openapi`); reading `process.env` is allowed in `*.test.ts` by the lint rules of [node-tooling.md](../development/node-tooling.md).
- **NEST-TEST-12: Main paths have system tests** (TEST-ARCH-05, TEST-TDD-06). The test builds the application with the same `createApp()` as production, listens on port 0 and calls it over HTTP (or through the topic, for a message-driven path). Own infrastructure runs in Testcontainers; only third-party systems are stubbed, by overriding their outgoing-port tokens or with an HTTP stub. Helpers hide technical details, so the test reads as the domain scenario.

### Coverage and tags

- **NEST-TEST-13: Coverage is reported, not gated.** `vitest run --coverage` with `@vitest/coverage-v8` (same version as Vitest) produces the report; no threshold fails the build unless an ADR adds one (TEST-ARCH-09). The template ships the dependency, a `coverage` block in `vitest.config.ts` (`provider: 'v8'`, `include: src/**/*.ts`, reporters `text-summary` and `lcov`, no threshold) and the script `test:coverage`; `verify` does not run it. Use the report to find untested branches of `domain` and `application`, not to chase a number.
- **NEST-TEST-14: Tags select test groups, never skip them.** Security tests that prove object-level checks carry the Vitest tag `cross-user`, declared under `test.tags` in `vitest.config.ts` (NEST-SEC rules in [security/nestjs.md](../security/nestjs.md)); `--tags-filter=cross-user` runs them alone. Tagged tests still run in `npm test`.

## Skill overrides

| Source | Says | Our rule |
|---|---|---|
| `nest new`, NestJS testing docs | Jest with `ts-jest`, `test/jest-e2e.json` | Vitest with `unplugin-swc` (NEST-TEST-01) |
| NestJS testing docs | `supertest(app.getHttpServer())` | Fastify adapter and `app.inject()` (NEST-TEST-05); supertest targets the Express-style server |
| `nest new` | `*.spec.ts` beside the code, end-to-end tests in a separate `test/` folder | `*.test.ts` and `*.it.test.ts` beside the code; `test/` only for fixtures (NEST-TEST-02) |
| NestJS testing docs | Testing a service through `Test.createTestingModule` | Use cases and domain without Nest (NEST-TEST-04) |
| `vitest` skill | `vi.mock` module mocking as the standard | Contracts mocked through tokens with `vitest-mock-extended` (NEST-TEST-03) |
| Common Node examples | In-memory database or SQLite for repository tests | Real PostgreSQL in a container (NEST-TEST-06) |

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Testing".*
