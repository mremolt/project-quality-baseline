# REST Conventions (wire format)

How REST APIs between our systems look on the wire, independent of the stack: data types, errors and status codes, paging, sorting, filtering, conditional requests and deprecation. Every API in every project follows them, so generated clients ([typescript-openapi-clients.md](typescript-openapi-clients.md)) and message payloads (MSG-ENV-02) can rely on them. The contract workflow is in [openapi-contracts.md](openapi-contracts.md); the Spring implementation is [spring-rest.md](spring-rest.md) (SPRING-REST-*), the NestJS one [nestjs-rest.md](nestjs-rest.md) (NEST-REST-*); each keeps its own IDs and implements the rules below.

## Rules

### Data types

- **API-REST-01: Decimals and money are JSON strings, never JSON numbers.** The spec declares them `type: string, format: decimal` with an example (`"12.50"`). Money is an object with an amount string and an ISO 4217 currency code: `{ "amount": "12.50", "currency": "EUR" }`. Identifiers are strings (UUID or opaque), even when the database uses numbers. Binary floating point (`double`, `float`) never carries a business value across the boundary.
  *Why:* JSON numbers lose precision in JavaScript and in many parsers; a string keeps the exact value and its scale.
- **API-REST-02: Date and time use ISO 8601 / RFC 3339.** Instants in UTC with `Z` (`2026-11-20T10:15:30Z`, `format: date-time`); calendar dates as `yyyy-MM-dd` (`format: date`); durations as ISO 8601 (`PT30S`). Never epoch numbers, never zone-less timestamps for instants. A local time that needs its zone carries the IANA zone id in its own field. A local date-time without offset (`2026-11-20T08:00`, a wall-clock time in that zone) is not `format: date-time`, which requires an offset: the spec describes it as a string with a pattern (Spring: SPRING-API-12).
- **API-REST-03: Enums are strings in the spec, never ordinals.** Values are `UPPER_SNAKE_CASE`. A client tolerates unknown values only where the spec marks the enum as open (a description saying so and a fallback in the consumer). Adding a value to a closed enum in a response is a breaking change (API-CON-04).
- **API-REST-04: Optional fields are omitted when empty; required fields are never `null`.** The spec lists required fields as `required`; `null` and "absent" mean the same unless a PATCH operation documents otherwise. Servers ignore unknown request properties, so compatible additions do not break older servers (tolerant reader).

### Errors

- **API-REST-05: Errors are RFC 9457 `application/problem+json`.** Members: `type`, `title`, `status`, `detail`, plus the extension members `code` (API-REST-07) and `traceId` (OBS-11). Validation failures add `errors`, a list of items with the required members `field` and `code` and an optional `message`; clients never depend on `message`. Responses never contain stack traces, SQL, class names or exception messages (Spring: SPRING-SEC-18; NestJS: NEST-SEC-30). Clients branch on `status` and `code`, never on `title`, `detail` or `message`, which may be localized (I18N-03).
- **API-REST-06: Status codes follow one table.** The category column is the error category of ARCH-UC-13 ([use-cases.md](../../05-building-block-view/use-cases.md#error-categories)); the adapter maps by category, never by concrete exception (ARCH-ADP-05).

| Situation | Category | Status |
|---|---|---|
| Created | | 201 + `Location` |
| Success without body | | 204 |
| Malformed request, invalid input, domain validation exception | validation | 400 (one status for invalid input; 422 is not used) |
| Not authenticated / not allowed | (security, handled before the use case) | 401 / 403 |
| Resource missing, or not visible to the caller | not found | 404 |
| Business rule violated by the current state ("order already shipped") | business rule | 409 with the rule's `code` |
| Conflict: `version` mismatch in the body, optimistic-lock failure, duplicate key, `Idempotency-Key` reused with a different payload (RES-IDM-02) | conflict | 409 with a conflict `code` |
| `Idempotency-Key` still in progress after the bounded wait (RES-IDM-02; a duplicate first waits for the first request and replays its result) | conflict | 409 with its own conflict `code`; the client retries later |
| `If-Match` does not match the current `ETag` | conflict | 412 |
| `If-Match` required but missing | validation | 428 |
| Rate limit exceeded (gateway by default; Spring: SPRING-SEC-21; NestJS: NEST-SEC-32) | technical | 429 + `Retry-After` |
| Temporarily unavailable (pool exhausted, dependency down, concurrency limit reached: SPRING-RES-06, NEST-RES-05) | technical | 503 + `Retry-After` |
| Unexpected exception (bug) or permanent technical failure | technical | 500, generic problem without `code` |

- **API-REST-07: Every business error has a stable `code` from the API's catalogue.** The catalogue is an enum in the spec (`UPPER_SNAKE_CASE`, for example `ORDER_ALREADY_SHIPPED`), one entry per business error the API can return, documented on the operations that return it. A code is never renamed or reused for another meaning; removing one is a breaking change. Validation errors use generic codes per constraint (`REQUIRED`, `TOO_LONG`, `INVALID_FORMAT`, …) in `errors[].code`. The frontend translates by `code` (SPRING-I18N-02, NEST-I18N-04, I18N-03); the server text is a safety net.

### Collections

- **API-REST-08: Every collection endpoint is bounded: paged, or limited by a documented hard upper bound that the query enforces** (API-N1-07). Paging uses `page` (zero-based) and `size` query parameters with a documented default and a hard maximum; a larger `size` is rejected with 400, not silently capped. The response is `{ "items": [...], "page": 0, "size": 20, "totalElements": 134 }`. Where counting is expensive or the collection changes fast, consider cursor paging instead: `cursor` parameter, `{ "items": [...], "nextCursor": "…" }`, with the cursor opaque to the client.
- **API-REST-09: Sorting uses a repeatable `sort` parameter, `sort=<field>,<asc|desc>`** (`sort=createdAt,desc&sort=id,asc`). The sortable fields are an allow-list per endpoint, declared as an enum in the spec; an unknown field or direction is a 400. Every endpoint has a documented default sort, and the server appends a unique tiebreaker (the id) so pages are stable.
- **API-REST-10: Filtering uses one query parameter per filterable field, named after the response field.** Repeated values mean OR within a field (`status=OPEN&status=SHIPPED`); different fields combine with AND. Ranges use the suffixes `From` (inclusive) and `To` (exclusive): `createdFrom`, `createdTo`. Free-text search is `q`. Filters are declared in the spec and bound to typed query objects; no generic filter expression language (RSQL, OData `$filter`) without an ADR, and filter values never reach SQL as text. A filter set too long for a URL uses `POST /<collection>/search` with the same fields in the body. A search by personal data (a name, an e-mail address) is not a filter parameter: it is a search resource, `POST /<collection>/search` with a JSON body, answering `200` with the same paged response as the collection; it changes no state and is documented as safe in the spec (DP-TEL-02).

### Concurrency and caching

- **API-REST-11: Updates to resources that users change concurrently use optimistic concurrency**, either a `version` field in the request body or `ETag`/`If-Match`; each API documents which. With `ETag`, a `GET` of the resource returns a strong `ETag` derived from its version, and `PUT`, `PATCH` and `DELETE` require `If-Match` (412 on mismatch, 428 when missing, API-REST-06). Weak ETags are never accepted in `If-Match`. A resource that may not exist yet (a singleton per parent, such as a budget per month) has version `0` while absent; the first write carries `If-Match: "0"` (or `version: 0`) and creates version `1`, so two creators cannot overwrite each other. A successful update answers `200` with the resource or at least its new `version` (or the new `ETag` header), never a bare `204`, so the next edit does not need a re-`GET` and a stale in-memory copy does not produce a spurious conflict. Consider conditional `GET` (`If-None-Match` → 304) for reference data that clients cache (API-N1 S5).

### Lifecycle

- **API-REST-12: An operation, parameter or field that will be removed is deprecated first.** The spec marks it `deprecated: true` with the replacement in the description. Responses of a deprecated operation carry the `Deprecation` header (RFC 9745, `Deprecation: @<unix-seconds>`) and, once a removal date is fixed, the `Sunset` header (RFC 8594, HTTP-date) plus `Link: <…>; rel="deprecation"` to the migration note. Removal happens only after the sunset date and after every known consumer has moved; it is a breaking change under API-CON-04.

- **API-REST-13: Checks answer in a fixed order: 401, then request-shape errors that need no data (400 for malformed input, 428 for a missing `If-Match`), then 403/404 decided by the use case, then 409/412 from the current state.** Authentication is a filter and always first. Because the use case authorizes (ARCH-UC-15) and needs the expected version to be called, a `PUT` without `If-Match` answers 428 before the role check; that discloses only what the spec already states, that the operation requires `If-Match`. A test per operation asserts the order for an unauthenticated caller, a caller without the role and a missing header.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "REST Conventions (wire format)".*
