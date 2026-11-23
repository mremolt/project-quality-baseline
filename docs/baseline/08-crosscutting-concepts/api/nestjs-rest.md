# NestJS: REST and JSON Conventions

How a NestJS backend (Fastify adapter, zod 4 through Nest's Standard Schema support) implements the shared [REST conventions](rest-conventions.md) (API-REST-*). The contract itself (spec generation, committed spec, breaking-change check, generated clients) is in [nestjs-openapi.md](nestjs-openapi.md). Controller placement and the error base classes: [05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md), ARCH-ADP-03/04/05.

## Rules

### Structure

- **NEST-REST-01: One controller per use case (or a small cohesive group) in `adapter/in/rest/vN/`, with its own request and response zod schemas** (ARCH-ADP-03/04). The schemas live in the controller file or a sibling file of the same folder and are not imported from other folders. Each schema that becomes a component has an id unique per API version: `.meta({ id: 'PlaceOrderRequestV1' })`. No domain object, row type or command is serialized directly (ARCH-MAP-01, ARCH-ADP-12).
- **NEST-REST-02: Mapping is hand-written in the controller folder.** The request becomes a command through the `ports/in` factory (`PlaceOrderCommand.of(body)`); the result becomes a response through a `toXResponse()` function that returns an object literal typed as the response type.
  *Why:* TypeScript's structural typing lets a domain object with extra fields pass as a response type and leak those fields into the JSON; an object literal makes the compiler reject excess properties.
- **NEST-REST-03: URLs are plural nouns in kebab-case with the version prefix in the controller path** (`@Controller('v1/orders')`). Verbs only for explicit command resources, named after the use case (`POST /v1/orders/{id}/cancel`), also for a state transition of a singleton (`POST /v1/me/work-day/start`, [rest-conventions.md](rest-conventions.md)); the handler method has the use case's name, which is also the `operationId` (NEST-API-01).
- **NEST-REST-04: Versioning is by version folder and path prefix** (ARCH-ORG-03). Nest's built-in versioning (`app.enableVersioning()`, `@Version()`) is not used, so there is one mechanism and each spec file maps to one folder. A new major version is a new folder `v2/` with its own controllers and schemas.
- **NEST-REST-05: Fastify types only; no `@Res()` without passthrough.** Request and reply types come from `fastify` (`FastifyRequest`, `FastifyReply`); Express types and Express middleware are not used. `@Res()` alone hands the response to the handler and bypasses Nest's response handling, so it is not used. `@Res({ passthrough: true }) reply: FastifyReply` is allowed only to set dynamic headers (`Location`, `ETag`, `Deprecation`); static headers use `@Header()`, status codes `@HttpCode()`.

### Input validation

- **NEST-REST-06: Every body, query and path parameter has a zod schema on its decorator:** `@Body({ schema })`, `@Query({ schema })`, `@Param({ schema: z.object({ id: z.uuid() }) })`. The object form of `@Param` is used so that errors name the field (the single-parameter form `@Param('id', { schema })` reports an empty path). The schemas check only mappability (types, formats, lengths, enum values); business rules stay in the command factory and the domain (ARCH-UC-05). No `ValidationPipe`, class-validator or `schema.parse()` in the handler. The decorators do nothing without the global pipe of NEST-REST-07.
- **NEST-REST-07: One global `StandardSchemaValidationPipe` with an `exceptionFactory` turns zod issues into the 400 problem of API-REST-05.** It is registered in `AppModule` as `{ provide: APP_PIPE, useValue: requestValidationPipe }`, and tests register the same instance. Nest's default factory returns a message array, which is not our wire format. The factory maps each issue to `{ field, code }` with the generic codes of API-REST-07 (no `message`: it is optional in API-REST-05, and only a multilingual product adds a localized one, NEST-I18N-04):

```ts
// src/platform/adapter/in/rest/request-validation.ts
import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { z } from 'zod';

export class RequestValidationError extends Error {
  constructor(readonly errors: readonly { field: string; code: string }[]) {
    super('Request validation failed');
  }
}

// zod reports a missing value as invalid_type; tag it so it becomes REQUIRED.
z.config({ customError: (issue) => (issue.input === undefined ? 'REQUIRED' : undefined) });

function apiCode(issue: StandardSchemaV1.Issue): string {
  if (issue.message === 'REQUIRED') return 'REQUIRED';
  const { code, origin } = issue as { code?: string; origin?: string };
  const isLength = origin === 'string' || origin === 'array';
  switch (code) {
    case 'too_big': return isLength ? 'TOO_LONG' : 'TOO_LARGE';
    case 'too_small': return isLength ? 'TOO_SHORT' : 'TOO_SMALL';
    case 'invalid_format': return 'INVALID_FORMAT';
    case 'invalid_value': return 'INVALID_VALUE';
    case 'invalid_type': return 'INVALID_TYPE';
    default: return 'INVALID';
  }
}

export const requestValidationPipe = new StandardSchemaValidationPipe({
  exceptionFactory: (issues) =>
    new RequestValidationError(
      issues.map((issue) => ({
        field: (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.'),
        code: apiCode(issue),
      })),
    ),
});
```

  The list of codes is part of the contract (the `ProblemDetail` schema in [nestjs-openapi.md](nestjs-openapi.md)); a new code is added in both places.
- **NEST-REST-08: Unknown request properties are stripped, not rejected** (API-REST-04). Request schemas are `z.object(…)`, never `z.strictObject(…)` or `.strict()`; the pipe hands the parsed value (without unknown keys) to the handler. Fastify rejects JSON with a `__proto__` key (400), and the pipe strips prototype keys from what it validates (NEST-SEC-23). Request schemas contain only fields the caller may set (NEST-SEC-27).
- **NEST-REST-09: Regular expressions in request schemas are anchored, simple and length-bounded** (`max()` before `regex()`), because a catastrophic backtracking pattern blocks the event loop for every request (ReDoS, NEST-SEC-24 in [security/nestjs-hardening.md](../security/nestjs-hardening.md)).

### JSON

- **NEST-REST-10: Decimals and money use the shared `ApiDecimal` schema, never `z.number()`** (API-REST-01). It is the only decimal schema on the wire and maps to `type: string, format: decimal`; the spec test fails on any `type: number` (NEST-API-09). The controller maps it to the domain's decimal type and back. Money is `z.object({ amount: ApiDecimal, currency: z.string().regex(/^[A-Z]{3}$/) })`. Identifiers are strings.

```ts
// src/platform/adapter/in/rest/api-decimal.ts
export const ApiDecimal = z
  .string()
  .regex(/^-?\d{1,20}(\.\d{1,10})?$/)
  .meta({ id: 'Decimal', format: 'decimal', example: '12.50' });
```

- **NEST-REST-11: Date and time** (API-REST-02): `z.iso.datetime()` for instants (accepts only UTC with `Z`), `z.iso.date()` for calendar dates, `z.iso.duration()` for durations. The response mapper writes instants with `toISOString()`; epoch numbers and zone-less timestamps are never sent.
- **NEST-REST-12: Enums are `z.enum([...])` with `UPPER_SNAKE_CASE` values and an id** (`.meta({ id: 'OrderStatusV1' })`, API-REST-03). An open enum says so in `.meta({ description })`; consumers map unknown values to a fallback.
- **NEST-REST-13: Optional response fields are left `undefined`, never `null`** (API-REST-04). `JSON.stringify` drops `undefined` properties but sends `null`. Required fields have no `.optional()` in the response schema (NEST-API-03).

### Errors

- **NEST-REST-14: Errors are RFC 9457 problems from one global exception filter** (API-REST-05/06, ARCH-ADP-05): `ProblemDetailsFilter` in `src/platform/adapter/in/rest/`, `@Catch()` without arguments, registered as `{ provide: APP_FILTER, useClass: ProblemDetailsFilter }`. It maps by the error base classes of `src/platform/domain` (ARCH-UC-13), never by concrete class, and answers with `content-type: application/problem+json`, `status`, `title` (the standard reason phrase; localized in a multilingual product, NEST-I18N-04 in [i18n/nestjs.md](../i18n/nestjs.md)), `code` for business errors, `errors` for validation and `traceId` (OBS-11, taken from the active trace as the NEST-OBS rules in [observability/nestjs.md](../observability/nestjs.md) describe). `title` comes from the status (or the catalog, NEST-I18N-04), never from an error message; the body never contains a stack trace, SQL, class name or exception message (NEST-SEC-30 in [security/nestjs-hardening.md](../security/nestjs-hardening.md)); `detail` is set only with a localized text (NEST-I18N rules in [i18n/nestjs.md](../i18n/nestjs.md)).

| Error | Status | Body members |
|---|---|---|
| `RequestValidationError` (pipe, NEST-REST-07) | 400 | `errors` |
| `DomainValidationError` | 400 | `code`, `errors` |
| `NotFoundError` | 404 | `code` |
| `AccessDeniedError` | 403; the filter also records the security event (NEST-SEC-33) | `code` |
| `BusinessRuleError` | 409 | the rule's `code` |
| `ConflictError` | 409; 412 when the request carried `If-Match` (NEST-REST-18) | conflict `code` |
| Temporarily unavailable (`UnavailableError` from `src/platform/domain` for an exhausted pool, open circuit, full bulkhead or the auth guard's key set outage, NODE-ARCH-07; NEST-RES rules in [resilience/nestjs.md](../resilience/nestjs.md), NEST-SEC-04) | 503 + `Retry-After` | none |
| `HttpException` below 500: Fastify's own errors, unknown route (404), guards (401/403) | its status; every 401 with `WWW-Authenticate: Bearer`, a rejected token (`InvalidTokenException` of the guard) with `Bearer error="invalid_token"` (RFC 6750, NEST-SEC-04) | none |
| Other error with a numeric `statusCode` from 400 to 499: Fastify plugins such as rate limit (429), CSRF (403), multipart (413) | that status; headers the plugin set (`Retry-After`) stay | none |
| `HttpException` 503 (Terminus readiness: database down or drain, NEST-OBS-03/04) or another error with `statusCode` 503 (Fastify `handlerTimeout`, NEST-SEC-22) | 503 + `Retry-After` | none (the health details never reach the body) |
| Anything else | 500 | none |

  Each error is logged once here (NEST-LOG-08 in [logging/nestjs.md](../logging/nestjs.md)): 4xx at `info` and 503 at `warn`, with status and `code` and without a stack; 500 at `error` with the error object as `err`.

```ts
// src/platform/adapter/in/rest/problem-details.filter.ts (excerpt; log levels: template)
const unavailable = (retryAfterSeconds = 5): Problem => ({ status: 503, headers: { 'retry-after': String(retryAfterSeconds) } });

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const { headers = {}, ...problem } = this.toProblem(error, http.getRequest<FastifyRequest>());
    this.logOnce(error, problem);                                  // 4xx info, 503 warn, 500 error (NEST-LOG-08)
    const reply = http.getResponse<FastifyReply>();
    for (const [name, value] of Object.entries(headers)) void reply.header(name, value);
    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send({ ...problem, title: STATUS_CODES[problem.status], traceId: currentTraceId() });
  }

  private toProblem(error: unknown, request: FastifyRequest): Problem {
    return this.categoryProblem(error, request) ?? this.transportProblem(error);
  }

  private categoryProblem(error: unknown, request: FastifyRequest): Problem | undefined {
    if (error instanceof RequestValidationError) return { status: 400, errors: error.errors };
    if (error instanceof DomainValidationError) {
      return { status: 400, code: error.code, errors: error.field ? [{ field: error.field, code: error.code }] : [] };
    }
    if (error instanceof NotFoundError) return { status: 404, code: error.code };
    if (error instanceof AccessDeniedError) return { status: 403, code: error.code };
    if (error instanceof ConflictError) return { status: request.headers['if-match'] ? 412 : 409, code: error.code };
    if (error instanceof BusinessRuleError) return { status: 409, code: error.code };
    if (error instanceof UnavailableError) return unavailable(error.retryAfterSeconds);
    return undefined;
  }

  // Fastify's 4xx, unknown routes, guards, plugin errors with a statusCode: status only, never the message
  private transportProblem(error: unknown): Problem {
    if (error instanceof InvalidTokenException) return { status: 401, headers: { 'www-authenticate': 'Bearer error="invalid_token"' } };
    const status = error instanceof HttpException ? error.getStatus() : statusCodeOf(error);
    if (status === 401) return { status, headers: { 'www-authenticate': 'Bearer' } };
    if (status !== undefined && status >= 400 && status < 500) return { status };
    if (status === 503) return unavailable();                     // Terminus readiness, Fastify handlerTimeout
    return { status: 500 };                                       // a bug or technical failure: generic body
  }
}
```

- **NEST-REST-15: Fastify's errors and those of its plugins become problems too.** The Fastify adapter turns Fastify's own errors below 500 into an `HttpException` with the Fastify error as `cause` (`FST_ERR_CTP_INVALID_JSON_BODY` → 400, `FST_ERR_CTP_BODY_TOO_LARGE` → 413, `FST_ERR_CTP_INVALID_MEDIA_TYPE` → 415). Errors of plugins such as `@fastify/rate-limit` are passed on unchanged; the filter answers any error with a 4xx `statusCode` with that status, and a 5xx `statusCode` other than 503 stays a generic 500. Fastify's `handlerTimeout` error (`FST_ERR_HANDLER_TIMEOUT`, `statusCode` 503) reaches the filter through the adapter's error handler: the template's filter test runs a real `new FastifyAdapter({ handlerTimeout })` against a slow handler and gets the 503 problem with `Retry-After`. Without that case a rate-limit 429 becomes a 500 (rate limits: NEST-SEC-32). The body limit is set on the adapter from configuration (`new FastifyAdapter({ bodyLimit })`, NEST-SEC-22). Fastify accepts `application/json` and `text/plain`; a `text/plain` body fails the body schema with 400.
- **NEST-REST-16: A raw `ZodError` never reaches the filter.** Command and query factories in `ports/in` throw `DomainValidationError` ([05-building-block-view/nestjs.md](../../05-building-block-view/nestjs.md)); a `ZodError` or `TypeError` that arrives at the filter is a bug and answers 500.

### Collections and updates

- **NEST-REST-17: Collection endpoints are paged with a hard maximum `size`, or bounded by a documented upper limit that the query enforces** (API-REST-08, API-N1-07). The query schema has no `.meta({ id })`, so the spec lists its fields as query parameters. `size` above the maximum fails validation (400). `sort` is repeatable with an allow-list of `field,direction` values (API-REST-09); filters follow API-REST-10. The handler maps the query to the port's own page request; the default sort and the id tiebreaker are applied in the persistence adapter (NEST-DB rules in [persistence/nestjs.md](../persistence/nestjs.md)).

```ts
// src/platform/adapter/in/rest/paging.ts
export const repeatable = <T extends z.ZodType>(item: T) => // one value arrives as string, several as array
  z.preprocess((v) => (v === undefined || Array.isArray(v) ? v : [v]), z.array(item).optional());
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.int().min(0), size: z.int().min(1), totalElements: z.int().min(0) });

// adapter/in/rest/v1/list-orders.controller.ts
const ListOrdersQuery = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  sort: repeatable(z.enum(['createdAt,asc', 'createdAt,desc'])),
  status: repeatable(OrderStatus),
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
});
const OrderSummaryPage = pageOf(OrderSummary).meta({ id: 'OrderSummaryPageV1' });
```

- **NEST-REST-18: Updates to concurrently changed resources use optimistic concurrency** (API-REST-11), with the version in the body or as a strong `ETag`. With `ETag`, `GET` sets `ETag: "<version>"` through the passthrough reply; `PUT`, `PATCH` and `DELETE` read `@Headers('if-match')`, documented with `@ApiHeader({ name: 'If-Match', required: true })`. The controller throws `new HttpException('Precondition Required', 428)` when it is missing and `new HttpException('Precondition Failed', 412)` for a weak (`W/`) or malformed value; otherwise the command carries the expected version. The update answers `200` with the new `version` (or the new `ETag` header), not `204` (API-REST-11); the template's lint rule rejects `@HttpCode(204)` on a `@Put` or `@Patch` handler. The use case or persistence adapter throws a `ConflictError` on a mismatch, which the filter answers with 412 when `If-Match` was sent and 409 when the version came from the body.
- **NEST-REST-19: A `201 Created` sets `Location`** (API-REST-06): `@Post()` answers 201 by default, and the handler sets `reply.header('location', '/v1/orders/<id>')` through the passthrough reply. A handler without a body uses `@HttpCode(204)`.
- **NEST-REST-20: A deprecated operation is marked `@ApiOperation({ deprecated: true, description: '<replacement>' })` and sends the `Deprecation` header** (`@Header('Deprecation', '@<unix-seconds>')`), plus `Sunset` and `Link` once the removal date is fixed (API-REST-12).

### Tests

- **NEST-REST-21: Controller tests run the controller in Nest with the Fastify adapter and a mocked use case** (TEST-ARCH-03, NEST-TEST rules in [testing/nestjs.md](../testing/nestjs.md)): `Test.createTestingModule({ controllers: [PlaceOrderController], providers: [{ provide: PLACE_ORDER_USE_CASE, useValue: mock<PlaceOrderUseCase>() }] })`, `createNestApplication(new FastifyAdapter())`, the production pipe and filter (`app.useGlobalPipes(requestValidationPipe)`, `app.useGlobalFilters(new ProblemDetailsFilter())`), then `app.inject(...)`. They assert status, headers (`Location`, `content-type`) and the JSON body, including the problem shape of each documented error. Mapper edge cases (decimals, dates, absent fields) are unit tests of the mapping functions.

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: REST and JSON Conventions".*
