# NestJS: Producing the OpenAPI Contract (code-first)

How a NestJS backend produces the spec required by [openapi-contracts.md](openapi-contracts.md) (API-CON-*, code-first) and consumes the specs of other providers. Controllers and their zod schemas ([nestjs-rest.md](nestjs-rest.md)) are the source; `@nestjs/swagger` 12 reads the zod schemas through Standard JSON Schema, the spec is written to a committed YAML file, checked by a test and diffed in CI.

## Setup

- `@nestjs/swagger` (exact version, the line matching `@nestjs/core`) as a dependency; `yaml` as a dev dependency for writing the spec file. No other OpenAPI plugin: the zod schemas on `@Body`, `@Query`, `@Param` and `standardSchema` in the response decorators are all it reads. The Nest CLI swagger plugin is not used.
- One `ApiDescription` per API major version, next to its controllers (`adapter/in/rest/v1/orders-api.ts`): title, major version, the API's business error codes (API-REST-07) and the context modules whose controllers it contains.
- One shared builder in `src/platform/adapter/in/rest/openapi.ts`. It builds the spec from a created app without initializing it or listening, keeps only the paths of the requested version, adds the `ProblemDetail` schema and drops schemas that the version's paths do not reference:

```ts
// src/platform/adapter/in/rest/openapi.ts
export interface ApiDescription {
  readonly title: string;
  readonly major: number;
  readonly errorCodes: readonly [string, ...string[]];
  readonly modules?: Type<unknown>[]; // context modules of this API; all when absent
}

export function buildOpenApiDocument(app: INestApplication, api: ApiDescription): OpenAPIObject {
  const config = new DocumentBuilder().setTitle(api.title).setVersion(String(api.major)).addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, config, {
    ...(api.modules ? { include: api.modules } : {}),
    operationIdFactory: (_controller, method) => method, // the handler is named after the use case
  });
  const version = `/v${api.major}/`;
  const paths = Object.fromEntries(Object.entries(doc.paths).filter(([path]) => path.includes(version)));
  const schemas = {
    ...doc.components?.schemas,
    ProblemDetail: z.toJSONSchema(problemDetailSchema(api.errorCodes), { target: 'openapi-3.0', io: 'output' }) as object,
  };
  return { ...doc, paths, components: { ...doc.components, schemas: onlyReferenced(paths, schemas) } };
}
// onlyReferenced(paths, schemas): walks every "$ref" from the paths (transitively) and keeps only those schemas

// errors[]: field and code required, message optional (API-REST-05); clients branch on code, never on message.
// VALIDATION_CODES: the generic codes of NEST-REST-07 (REQUIRED, TOO_LONG, INVALID_FORMAT, …)
const problemDetailSchema = (errorCodes: readonly [string, ...string[]]) =>
  z.object({
    type: z.string().optional(),
    title: z.string(),
    status: z.int(),
    detail: z.string().optional(),
    code: z.enum(errorCodes).optional(),
    errors: z.array(z.object({ field: z.string(), code: z.enum(VALIDATION_CODES), message: z.string().optional() })).optional(),
    traceId: z.string().optional(),
  });
```

`@nestjs/swagger` writes OpenAPI 3.0 and converts the zod schemas with the `openapi-3.0` target; the builder keeps that version.

## Rules

### Describing the API

- **NEST-API-01: The `operationId` is the handler method name** (API-CON-05), set for all operations by `operationIdFactory` in the builder. Handlers are named after the use case (`placeOrder`, `listOrders`), not after HTTP verbs; `@ApiOperation({ operationId })` is not used. The spec test fails on a duplicate `operationId`.
- **NEST-API-02: Every request, response and enum schema has an id unique per API version:** `.meta({ id: 'PlaceOrderRequestV1' })`, which names the component. Shared platform schemas keep their plain names (`Decimal`, `ProblemDetail`). Query schemas have no id, so they expand into query parameters (NEST-REST-17).
- **NEST-API-03: Required means required.** A zod field without `.optional()` or `.default()` is `required` in the spec; the generated client types and zod schemas depend on it. Response fields are optional only when they can be absent.
- **NEST-API-04: zod constraints are part of the contract** (`min`, `max`, `regex`, `z.uuid()`, `z.iso.*`) and appear as schema constraints, so clients validate the same way. They still check only mappability (NEST-REST-06).
- **NEST-API-05: Every error status an operation can return is documented as `application/problem+json`** (API-CON-05, API-REST-05/07) with the shared decorator, listing the business codes. The `ProblemDetail` schema declares `code` as an enum of the API's catalogue (`errorCodes` of the `ApiDescription`) and `errors[].code` as an enum of the generic validation codes of NEST-REST-07:

```ts
// src/platform/adapter/in/rest/api-problem-response.ts
export const ApiProblemResponse = (status: number, codes: readonly string[] = []) =>
  ApiResponse({
    status,
    description: codes.length > 0 ? `${STATUS_CODES[status]}: ${codes.join(', ')}` : (STATUS_CODES[status] ?? 'Error'),
    content: { 'application/problem+json': { schema: { $ref: getSchemaPath('ProblemDetail') } } },
  });

// on a handler
@Post()
@ApiCreatedResponse({ standardSchema: OrderResponse })
@ApiProblemResponse(400)
@ApiProblemResponse(409, ['ORDER_ALREADY_SHIPPED'])
async placeOrder(@Body({ schema: PlaceOrderRequest }) body: PlaceOrderRequest, …)
```

- **NEST-API-06: Schemas carry examples** (API-CON-05, API-CON-11) with `.meta({ example })`, so generated mocks are realistic.
- **NEST-API-07: Responses are declared with `standardSchema`** (`@ApiOkResponse({ standardSchema: X })`, `@ApiCreatedResponse(…)`); the request body is read from `@Body({ schema })` and needs no `@ApiBody`. Every controller has `@ApiTags('<context>')` (otherwise swagger invents a tag from the class name) and declares its security scheme: `@ApiBearerAuth()` for an API with JWT bearer tokens (`addBearerAuth()` in the builder), `@ApiCookieAuth()` with `addCookieAuth('__Host-session')` for a BFF session (NEST-SEC-47 in [security/nestjs-hardening.md](../security/nestjs-hardening.md)). Public operations have none. A binary download declares its media type with a binary schema (`@ApiOkResponse({ content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } })`, one entry per offered type), so Orval generates a `Blob` client; an operation that accepts two request media types is one operation with two content entries.
- **NEST-API-08: `@nestjs/swagger` is imported only in `adapter/in/rest` and `src/platform/adapter/in/rest`**, never in `domain`, `ports` or `application`; the dependency-cruiser rules of [05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md) forbid `@nestjs/*` in the core.

### Exporting and checking the spec

- **NEST-API-09: A test builds the spec and fails if the committed file is stale** (API-CON-03). It sits next to the `ApiDescription` (`adapter/in/rest/v1/orders-openapi.test.ts`) and runs in the `unit` project of `npm test`: `createApp()` creates the application without calling `init()` or `listen()`, so no lifecycle hook runs and nothing connects. Adapters therefore connect in lifecycle hooks (`onModuleInit`), never in constructors or provider factories, and required configuration without a default gets test values from the test setup (NEST-CFG rules in [configuration/nestjs.md](../configuration/nestjs.md)). The YAML is written with sorted keys, so the comparison does not flap.

```ts
// src/features/orders/adapter/in/rest/v1/orders-openapi.test.ts
const SPEC = 'openapi/orders-v1.yaml';

it('committed spec matches the code (API-CON-03)', async () => {
  const app = await createApp();
  const doc = buildOpenApiDocument(app, ORDERS_API_V1);
  await app.close();

  const operationIds = Object.values(doc.paths).flatMap((item) =>
    Object.values(item).flatMap((op: { operationId?: string }) => op.operationId ?? []),
  );
  expect(new Set(operationIds).size).toBe(operationIds.length);

  const generated = stringify(doc, { sortMapEntries: true }); // from 'yaml'
  expect(generated).not.toContain('type: number'); // decimals are ApiDecimal strings (API-REST-01)
  if (process.env['OPENAPI_UPDATE'] === 'true') await writeFile(SPEC, generated);
  expect(await readFile(SPEC, 'utf8')).toBe(generated);
});
```

  `npm run openapi` regenerates every spec (`OPENAPI_UPDATE=true vitest run --project unit openapi`); the developer commits the diff with the code change. The spec is never edited by hand (API-CON-02).
- **NEST-API-10: CI runs `oasdiff` against the target branch** (API-CON-04), from the backend folder:

```bash
# git show needs the path from the repository root (backend/openapi/… in a product repo)
git show origin/main:backend/openapi/orders-v1.yaml > /tmp/base.yaml
oasdiff breaking /tmp/base.yaml openapi/orders-v1.yaml --fail-on ERR
```

  A breaking change needs a new version folder and spec file (`v2/`, `orders-v2.yaml`) or an explicit decision (API-CON-04). Another diff tool with the same effect is allowed.
- **NEST-API-11: The application does not serve its spec or Swagger UI.** `SwaggerModule.setup()` is not called; consumers use the committed file (API-CON-08), and the API's CSP (`default-src 'none'`) would block the UI anyway. Developers open the committed YAML with the IDE's OpenAPI support. A public API that must serve its spec at runtime serves the committed file and records that in the product's architecture docs.

### Endpoint design

- **NEST-API-12: Every new read endpoint gets the N+1 check** (API-CON-06, API-N1-01): view endpoints are a query use case plus controller, batch lookups a batch endpoint, both loading related data without per-row queries (NEST-DB rules in [persistence/nestjs.md](../persistence/nestjs.md)).

### Consuming other APIs

- **NEST-API-13: Clients for providers with a spec are generated with Orval** (API-CON-07, NEST-LIB rules in [04-solution-strategy/nestjs-libraries.md](../../04-solution-strategy/nestjs-libraries.md)): `client: 'fetch'` with `override.fetch.httpClientInjection: 'factory'`, plus `client: 'zod'` for the response schemas. The output goes to `adapter/out/http/generated/`, is gitignored, excluded from lint and coverage, and regenerated by `npm run generate:api` before `build` and `test`. The input is the provider's spec pinned in this repository (API-CON-08): the backend's own file for an API of the same product, otherwise a copy in `openapi/consumed/<provider>-v<N>.yaml` updated by pull request.

```ts
// orval.config.ts
export default defineConfig({
  payments: {
    input: { target: './openapi/consumed/payments-v1.yaml' },
    output: {
      target: './src/features/checkout/adapter/out/http/generated/payments.ts',
      client: 'fetch',
      override: { fetch: { httpClientInjection: 'factory' } }, // getPayments(fetchFn) returns the operations
    },
  },
  paymentsZod: {
    input: { target: './openapi/consumed/payments-v1.yaml' },
    output: { target: './src/features/checkout/adapter/out/http/generated/payments.zod.ts', client: 'zod' },
  },
});
```

- **NEST-API-14: The outgoing adapter owns the generated client and never lets its types out** (API-CON-09, ARCH-ADP-12). It passes its own `fetch` function to the factory, which adds the base URL from configuration, the timeout (`AbortSignal.timeout(…)`, RES-TMO-01) and authentication; resilience policies wrap the calls (NEST-RES rules in [resilience/nestjs.md](../resilience/nestjs.md)). It parses every response with the generated zod schema before mapping to domain types (API-CON-10); a parse failure is a technical error. Decimal strings map to the domain's decimal type, problem `code` values to domain errors. Adapter tests use responses built from the same spec (API-CON-11).

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Producing the OpenAPI Contract (code-first)".*
