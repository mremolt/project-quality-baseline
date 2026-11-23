# NestJS: Hexagonal Architecture

Structure and wiring of NestJS services. It builds on [node.md](node.md) (layout, core rules, enforcement) and the shared docs. Topic rules (REST, security, persistence, …) are listed in [stacks/nestjs.md](../stacks/nestjs.md).

## Wiring

- **NEST-ARCH-01: Each bounded context has one Nest module, `<context>.module.ts`, as its composition root.** It registers the context's controllers and adapters, binds adapters to outgoing port tokens with `useExisting`, and creates use cases with `useFactory`. `src/app.module.ts` imports the context modules and the platform module and registers the global filter and pipe. No other file wires implementations to contracts.

```ts
// features/orders/orders.module.ts
@Module({
  controllers: [OrdersController],
  providers: [
    KyselyOrderAdapter,
    { provide: SAVE_ORDER_PORT, useExisting: KyselyOrderAdapter },
    {
      provide: PLACE_ORDER_USE_CASE,
      useFactory: (orders: SaveOrderPort, tx: TransactionPort) => new PlaceOrderService(orders, tx),
      inject: [SAVE_ORDER_PORT, TRANSACTION_PORT],
    },
  ],
  exports: [PLACE_ORDER_USE_CASE], // only what index.ts publishes
})
export class OrdersModule {}
```

- **NEST-ARCH-02: Core classes carry no decorators.** Use cases in `application` are plain classes with constructor parameters typed by port interfaces; only `useFactory` creates them. `@Injectable()`, `@Controller()`, `@Inject()` and other Nest decorators appear only in adapters and modules.
  *Why:* the core stays testable with `new` and mocks, and moves to another framework unchanged (NODE-ARCH-04).
- **NEST-ARCH-03: Tokens are `Symbol`s in `<context>.tokens.ts`**, one per `ports/in` and `ports/out` contract (`export const PLACE_ORDER_USE_CASE = Symbol('PlaceOrderUseCase')`). The file imports nothing but its own ports. Adapters inject with `@Inject(TOKEN)` and a type from `ports`; nobody injects a concrete class from another folder.
- **NEST-ARCH-04: Constructor injection only, singleton scope only.** No property injection, no `Scope.REQUEST` or `Scope.TRANSIENT`, no `ModuleRef.get` outside tests. Request-bound data (caller, trace context, current transaction) travels as arguments or through `AsyncLocalStorage` in the platform.
  *Why:* request-scoped providers make the whole dependency chain request-scoped and are created per request.
- **NEST-ARCH-05: No `forwardRef`.** A cycle between modules or providers is a design error (ARCH-ENF-05); a context reaches another only through its published `ports/in` (NODE-ARCH-03).
- **NEST-ARCH-06: Global concerns are registered once in `app.module.ts` via `APP_FILTER`, `APP_PIPE`, `APP_GUARD`** (problem-details filter, `StandardSchemaValidationPipe`, auth guard). Controllers do not add their own filters or pipes for these concerns.
- **NEST-ARCH-07: `create-app.ts` builds the application; `main.ts` only starts it.** `createApp()` creates the Nest app on the Fastify adapter, sets the logger, registers the Fastify plugins and enables shutdown hooks; tests and the spec export reuse it. `main.ts` imports `reflect-metadata` first, calls `createApp()` and `listen()`.

## Use cases and transactions

- **NEST-ARCH-08: The use case owns the transaction through an outgoing port** (ARCH-UC-11). `application` calls `TransactionPort.runInTransaction(work)`; the persistence platform adapter implements it with Kysely, and persistence adapters join the current transaction ([persistence/nestjs.md](../08-crosscutting-concepts/persistence/nestjs.md)). No Kysely type reaches `application`. Remote calls stay outside the transaction (RES-TX-01).
- **NEST-ARCH-09: Use cases never call each other**, also not through `@nestjs/event-emitter` or RxJS subjects (ARCH-UC-14). Domain events go to an outgoing port and the outbox ([messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md)).

## Adapters

- **NEST-ARCH-10: Controllers are incoming adapters in `adapter/in/rest/v<N>`**, one controller per use case or small group of use cases on the same resource. A controller parses the request with its zod schema, builds the command through its factory, passes the `Caller`, calls the use-case token and maps the result to the response schema. No business rule, no repository, no other adapter.
- **NEST-ARCH-11: Third-party SDK types never leave their adapter folder** (ARCH-DEP-05): Kysely, `pg`, Kafka client, fetch responses, generated client types, Fastify request/reply.
- **NEST-ARCH-12: Every incoming adapter maps the error categories by their base classes** (ARCH-UC-13, NODE-ARCH-07): the global filter for REST ([api/nestjs-rest.md](../08-crosscutting-concepts/api/nestjs-rest.md)), the consumer error handler for messaging ([messaging/nestjs.md](../08-crosscutting-concepts/messaging/nestjs.md)), the job runner for scheduling.
- **NEST-ARCH-13: Demo and seed data of a running installation are loaded by an incoming adapter that calls the use cases.** A provider in `adapter/in/demo/`, registered only when the configuration's `DEMO_DATA` flag is on (default off, never set in deployed configuration), runs in `onApplicationBootstrap`, acts as a named system caller and goes through the incoming ports (master data through the bulk-import use case where one exists), so validation, rules and the audit trail apply; it never writes tables directly, skips when its data is present, and uses synthetic data (DP-ENV-01). A test asserts the provider is absent without the flag.

## Architecture test template

Copy `.agents/skills/baseline-nestjs/templates/dependency-cruiser.cjs` to `backend/.dependency-cruiser.cjs`; `npm run check:arch` runs it. It was validated against a template service, including a fixture with deliberate violations ([chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use) lists what has not run in a product yet).

| Rule | Guards |
|---|---|
| `no-circular` | No import cycle (ARCH-ENF-05) |
| `domain-is-pure` | `domain` imports only its own domain and `platform/domain/index.ts`; no Nest, Fastify, `node:*` (NODE-ARCH-04) |
| `ports-only-domain` | `ports` imports domain, ports, `platform/ports/index.ts` and zod |
| `application-only-core` | Allow-list for `application`: own rings, platform domain and ports entries, zod (ARCH-DEP-03) |
| `adapters-use-ports-not-services` | Adapters never import `application` (ARCH-ADP-02) |
| `adapters-are-independent` | One `adapter/<in\|out>/<technology>` folder never imports another; platform adapters are shared (ARCH-DEP-05) |
| `features-only-via-index` | Contexts reach each other only through `index.ts` (NODE-ARCH-03) |
| `platform-no-features` | `src/platform` never imports a context |
| `tokens-only-ports` | Tokens files import only their own ports (NEST-ARCH-03) |
| `feature-module-only-from-app-module` | Only `app.module.ts` and the context's `index.ts` import a context module (NEST-ARCH-01) |
| `db-client-only-in-persistence-adapter` | `kysely` and `pg` only in persistence adapters, scheduling adapters (cluster lock) and the readiness check (NEST-ARCH-11) |
| `kysely-token-only-in-persistence` | `KYSELY` (`src/platform/adapter/out/persistence/kysely.token.ts`) is imported only by platform persistence, `platform.module.ts`, scheduling adapters (cluster lock) and the readiness check; context persistence adapters use `KyselyTransactionAdapter.executor()` (NEST-DB-04). The canary contains a context adapter that imports it |
| `kafka-client-only-in-messaging-adapter` | `@platformatic/kafka` only in `adapter/in/messaging` and `adapter/out/messaging` (NEST-MSG rules) |
| `no-locale-in-core` (ESLint) | No `Intl`, `toLocale*` or `localeCompare` in the core (NEST-I18N rules) |
| `generated-api-only-in-http-adapter` | Generated clients only in `adapter/out/http` (API-CON-09) |
| `no-process-env-outside-config` (ESLint, not dependency-cruiser) | NODE-ARCH-12 |

## New service

1. Check that the repository layout decision was made (REPO-LAY-02). Copy the templates of the `baseline-nestjs` skill into `backend/` as `.agents/skills/baseline-nestjs/templates/README.md` describes: a complete skeleton (platform rings, configuration with `Secret`, auth guard, problem details, probes and shutdown, telemetry, logging, Kysely with `TransactionPort` and migrator, cluster lock, tests, tooling, `compose.yaml`, `Dockerfile`), validated as a whole. The Nest CLI generator (`nest new`) is not used: it scaffolds Express, Jest, CommonJS and a different layout.
2. Rename the service, run `npm install` once to create the lockfile, then `npm ci` and `npm run verify`; it must be green before the first feature. The first bounded context goes under `src/features/<context>/` and into `app.module.ts`.

*Agent checklist in [checklists/nestjs.md](../checklists/nestjs.md) and sources in [sources.md](../sources.md), section "NestJS: Hexagonal Architecture".*
