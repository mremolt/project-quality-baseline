# NestJS: Internationalization

NestJS rules on top of [i18n.md](i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`). The backend owns error codes, localized fallback texts and server-generated documents; it never owns UI wording: the frontend translates by `code` (API-REST-07), the server text is a safety net for other clients, logs and support.

## What the backend owns

| Concern | Decision | Where |
|---|---|---|
| Locale resolution | `Accept-Language` negotiated against the product's supported locales, default the source locale (NEST-I18N-03) | `src/platform/adapter/i18n`, called from `adapter/in/rest` |
| Error `type`, `code` | Stable, not localized; `code` is `UPPER_SNAKE_CASE` from the API's catalogue (API-REST-07) | domain error carries the code, the problem filter maps it |
| `title`, `detail` | Localized from the catalog with the error's parameters; a single-language product keeps the standard reason phrase as `title` (NEST-REST rules in [api/nestjs-rest.md](../api/nestjs-rest.md)) | `ProblemDetailsFilter` in `src/platform/adapter/in/rest` |
| Validation messages | `errors[]` keeps the required `field` and `code`; the optional `message` (API-REST-05) is added localized | problem filter |
| Emails, notifications, PDFs | The use case calls an outgoing port with data and the recipient's `Language`; the adapter renders templates and catalog texts | `adapter/out/*` |
| Recipient language, time zone | Stored user attributes; asynchronous work never reads a request | domain data and persistence adapter |
| Headers | `Content-Language` on localized bodies; `Vary: Accept-Language` on cacheable responses | REST adapter |

## Rules

- **NEST-I18N-01: Server texts are ICU MessageFormat strings, formatted with `intl-messageformat` 12; `nestjs-i18n` is not used.** `nestjs-i18n` (10.8) is CommonJS, declares its Nest peers as `*` (no stated NestJS 12 support), centres on class-validator (`I18nValidationPipe`), which this stack does not use, offers a request-scoped `I18nContext` that invites locale lookups inside services, and in ICU mode returns the raw message when a message fails to compile. `intl-messageformat` is ESM, uses the same ICU syntax as the frontend catalogs, throws on a syntax error or a missing argument, and passes decimal strings to `Intl.NumberFormat` without converting them to `number` (`{amount, number, ::currency/EUR}` keeps every digit). Accept-Language parsing uses `negotiator` 1.1.
- **NEST-I18N-02: One catalog per supported locale, nested JSON with ICU messages, in `src/platform/adapter/i18n/messages/<locale>.json`.** Keys are prefixed by area: `error.<CODE>.title`, `error.<CODE>.detail`, `status.<status>.title`, `validation.<CODE>`, `mail.<template>.<part>`. The format is the one of the frontend catalogs (nested JSON per language, ICU for plural and select), managed in Weblate as a second component next to them, with translator context in a `context.json` sidecar (TOOL-I18N-01/02/07). The source catalog is the only hand-written one (I18N-05). Catalogs are imported as JSON modules (`import en from './messages/en.json' with { type: 'json' }`, `resolveJsonModule` in `tsconfig.json`), so `tsc` copies them into `dist/` and the source catalog types direct key access. Locale tags are BCP 47 and the list of supported locales is the product's one list (I18N-04).
- **NEST-I18N-03: The locale of a response comes from `Accept-Language`, negotiated in the REST adapter only.** One module in `src/platform/adapter/i18n` exports the supported locales, the source locale, `negotiateLocale(header)` and `translate(locale, key, params)`:

```ts
export const SUPPORTED_LOCALES = ['en', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const SOURCE_LOCALE: SupportedLocale = 'en';

/** I18N-06: Accept-Language → supported locale (de-CH → de), else the source locale. */
export function negotiateLocale(acceptLanguage: string | undefined): SupportedLocale {
  const match = new Negotiator({ headers: { 'accept-language': acceptLanguage ?? '' } }).language([...SUPPORTED_LOCALES]);
  return (match as SupportedLocale | undefined) ?? SOURCE_LOCALE;
}

/** I18N-09: locale → source locale; a key missing in the source catalog is a bug. */
export function translate(locale: SupportedLocale, key: string, params: Record<string, string | number> = {}): string {
  const message = CATALOGS.get(locale)?.get(key) ?? CATALOGS.get(SOURCE_LOCALE)?.get(key);
  if (message === undefined) throw new Error(`Missing message key ${key}`);
  return new IntlMessageFormat(message, locale).format(params) as string;
}
```

  `CATALOGS` maps each locale to its catalog flattened to dotted keys. A fallback to the source locale logs a warning (I18N-09). No locale is stored in AsyncLocalStorage or a request-scoped provider: the REST adapter passes the negotiated locale to whatever it renders.
- **NEST-I18N-04: In a multilingual product, `ProblemDetailsFilter` keeps the stable `code` and localizes `title` and `detail`.** Domain errors carry a `code` and parameters, never text (I18N-02; `DomainError.params`, NODE-ARCH-07); for a business error the filter looks up `error.<CODE>.title` and `error.<CODE>.detail` with those parameters, for other problems `status.<status>.title`, sets `Content-Language` to the negotiated locale, and keeps `type`, `status` and `code` unchanged. Validation failures keep `field` and the generic `code` per entry (`REQUIRED`, `TOO_LONG`, …) and get the optional `message` (API-REST-05; clients never depend on it) from `validation.<CODE>`. A unit test asserts that every code of the API's catalogue has `title` and `detail` in the source catalog, because keys built from codes are not checked by the compiler.
- **NEST-I18N-05: Locale code and locale-dependent calls never appear in `domain`, `ports` or `application`.** The allow-list rules of dependency-cruiser (`domain-is-pure`, `ports-only-domain`, `application-only-core`) already reject `intl-messageformat`, `negotiator` and `src/platform/adapter/i18n` in these rings. Built-in globals are not imports, so ESLint adds, for files in those rings:

```js
'no-restricted-globals': ['error', { name: 'Intl', message: 'No locale logic in the core (I18N-02).' }],
'no-restricted-properties': ['error',
  ...['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'localeCompare', 'toLocaleUpperCase', 'toLocaleLowerCase']
    .map((property) => ({ property, message: 'Locale-dependent: format or translate in an adapter (I18N-02/03).' }))],
```

  Where language is a business input ("send the confirmation in the customer's language") it travels as a `Language` value object in the command.
- **NEST-I18N-06: Outgoing adapters render emails and documents in the recipient's stored language and time zone,** never the request locale. The subject is a catalog message that gets the same arguments as the body. Consumers get the recipient (or its language) in the event or look it up through a port. Dates are formatted with the stored time zone; amounts stay decimal strings until the ICU message formats them.
- **NEST-I18N-07: The API never formats values for display** (I18N-03): decimals as strings, instants in UTC, dates as `yyyy-MM-dd`, enums as strings.
- **NEST-I18N-08: Server-side sorting that users see uses an explicit ICU collation per locale** in the query (`order by name collate "de-x-icu"`; PostgreSQL images ship the ICU collations), documented per endpoint.

## Tests

- Per-locale contract test (TEST-I18N-05): a REST adapter test (setup in [testing/nestjs.md](../testing/nestjs.md)) sends `Accept-Language` for each supported locale and one unsupported locale, and asserts the same `code`, the localized `title` and `detail`, and `Content-Language`:

```ts
it.each([
  ['en', 'en', 'Order total too low'],
  ['de-CH,de;q=0.9', 'de', 'Bestellwert zu niedrig'],
  ['fr-FR', 'en', 'Order total too low'],
])('Accept-Language %s → %s, same code', async (header, locale, title) => {
  const res = await app.inject({ method: 'POST', url: '/v1/orders', headers: { 'accept-language': header }, payload: lowTotalOrder });
  expect(res.statusCode).toBe(409); // business rule (API-REST-06)
  expect(res.headers['content-language']).toBe(locale);
  expect(res.json()).toMatchObject({ code: 'ORDER_TOTAL_TOO_LOW', title });
});
```

- Catalog parity (TEST-I18N-06, applied to the JSON catalogs): a unit test compares the key set of every catalog with the source catalog and, per key, the ICU argument names (from `new IntlMessageFormat(message, locale).getAst()`), so a translation that drops or renames `{min}` fails. Each message also compiles, which catches ICU syntax errors.
- Code coverage of the catalog (NEST-I18N-04), negotiation cases (`de-CH` → `de`, unsupported → source, empty header), and an email rendering test per supported locale (NEST-I18N-06).
- The architecture rules of NEST-I18N-05 run with `check:arch` and `lint`.

## Skill overrides

| Source | Says | Our rule |
|---|---|---|
| `nestjs-i18n` guides | `I18nService.t()` or `I18nContext.current()` inside services; `I18nValidationPipe` | Language is data in the command; texts only in adapters (NEST-I18N-01/05) |
| Common examples | Message text built in the use case or the error | Errors carry a code and parameters (I18N-02, NEST-I18N-04) |
| Common examples | `toLocaleString()` or `Intl` in services | Formatting in adapters or ICU messages (NEST-I18N-05/06) |

*Agent checklist in [checklists/nestjs.md](../../checklists/nestjs.md) and sources in [sources.md](../../sources.md), section "NestJS: Internationalization".*
