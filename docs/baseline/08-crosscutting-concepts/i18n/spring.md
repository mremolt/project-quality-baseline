# Spring: Internationalization

Spring rules on top of [i18n.md](i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`). The backend owns error codes, localized fallback texts and server-generated documents; it never owns UI wording (the frontend translates by code, SPRING-I18N-02).

## What the backend owns

| Concern | Decision | Where |
|---|---|---|
| Locale resolution | One `LocaleResolver` bean (`AcceptHeaderLocaleResolver` with explicit supported locales and default) | `adapter.in.rest` config |
| Error `type` | Stable URI per business error, not localized | `adapter.in.rest` advice |
| Error `code` | Stable, machine-readable, an enum in the OpenAPI spec; the frontend translates it | domain exception carries it, the advice maps it |
| `title`, `detail` | Localized through `MessageSource` as a fallback for non-Angular clients, logs and support. RFC 9457 allows localized titles and says consumers should not parse `detail` | `adapter.in.rest` |
| Validation messages | `errors[]` keeps `field` and `code` (SPRING-REST-07); `message` is localized | `adapter.in.rest` |
| Emails, notifications, PDFs | The use case calls an outgoing port with data and the recipient's `Language`; the adapter renders templates and bundles | `adapter.out.*` |
| Recipient language | A stored user attribute (profile); async work never reads the request | domain data plus persistence adapter |
| Headers | `Content-Language` on localized bodies; `Vary: Accept-Language` on cacheable responses | `adapter.in.rest` |

## Rules

- **SPRING-I18N-01: One `MessageSource` (Boot auto-configuration, basename `messages`, UTF-8, `spring.messages.fallback-to-system-locale=false`) and one `LocaleResolver` bean** with an explicit supported-locale list and default, both in `adapter.in.rest` or its configuration.
  *Why:* the server's OS locale must not change the output.
- **SPRING-I18N-02: Business errors map to a stable `code` in the ProblemDetail** (an enum in the OpenAPI spec; catalogue: [API-REST-07](../api/rest-conventions.md); extends SPRING-REST-07). `title` and `detail` come from `error.<code>.title|detail` bundle entries that the advice looks up itself, not from FQCN-based default codes. The frontend translates by `code`; the server text is a safety net.
  *Why:* consistent wording across the UI, still a usable API for other clients.
- **SPRING-I18N-03: `Content-Language` is set on localized responses;** `Vary: Accept-Language` on cacheable ones.
  *Why:* caches and clients need it.
- **SPRING-I18N-04: `Locale`, `MessageSource` and `LocaleContextHolder` never appear in `domain`, `ports` or use cases;** the architecture test enforces it (`applicationHasNoJsonOrI18nTypes`, `noLocaleFieldsInCore`, `noLocaleInCoreSignatures`). For `Locale` it checks fields, parameters and return types only, so `Locale.ROOT` for locale-neutral case conversion stays possible. Where language is a business input (for example "send the confirmation in the customer's language") it travels as a `Language` value object inside the command.
  *Why:* the dependency rule (ARCH-DEP, SPRING-ARCH-03). `LocaleContextHolder` is acceptable in `adapter.in.rest` and only there.
- **SPRING-I18N-05: Outgoing adapters render emails and documents from templates and bundles using the recipient's stored language,** never the request locale. The subject is a message of the same bundle and gets the same arguments as the body (`mail.budget-warning.subject={0}: {1} % used`), so it can name what the mail is about. Kafka consumers get the recipient (or its language) in the event or look it up through a port.
  *Why:* async and batch work has no request.
- **SPRING-I18N-06: Validation messages use bundle keys** (`{…}` message templates) resolved through the same message sources, and the response still carries `code` per violation. A `@WebMvcTest` posts an invalid body with `Accept-Language` set to a supported non-source locale and asserts the message in that locale, because the locale Hibernate Validator picks under the current Boot line is not yet confirmed (see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)).
  *Why:* one place for texts.
- **SPRING-I18N-07: Bundles are UTF-8 `.properties` per supported locale, keys prefixed by area** (`error.`, `validation.`, `mail.<template>.`), managed in Weblate as a second component next to the frontend catalogs (TOOL-I18N-01).
  *Why:* backend texts follow the same review path.
- **SPRING-I18N-08: Server-side sorting that users see uses an explicit collation per locale,** documented per endpoint. Spring Data sorting cannot name a collation, and nullable filter parameters (`:p is null or …`) are a PostgreSQL typing trap, so a sorted, filtered list reads one page of ids through `JdbcClient` (`order by display_name collate "de-x-icu", id`, filters appended only when set, values bound) and then loads those aggregates with one `findAllById` (with `@BatchSize` on their collections), keeping the id order; the statement count is asserted (SPRING-TEST-06).
  *Why:* pages must be consistent across clients.
- **SPRING-I18N-09: The time zone is stored per user when emails or reports need it;** `AcceptHeaderLocaleResolver` does not provide one.

## Tests

TEST-I18N-05 (per-locale contract tests) and TEST-I18N-06 (bundle parity) in [i18n.md](i18n.md#tests), plus the ArchUnit rules for SPRING-I18N-04 in the architecture test ([05-building-block-view/spring.md](../../05-building-block-view/spring.md#architecture-test-template)), and an email rendering test per supported locale.

## Skill overrides

| Skill habit | Baseline rule |
|---|---|
| `LocaleContextHolder.getLocale()` inside services | Language is data in the command (SPRING-I18N-04) |
| Message text built in the use case or exception | Exceptions carry a code and parameters (I18N-02, SPRING-ARCH-03) |
| Default Spring ProblemDetail message codes (`problemDetail.title.<fqcn>`) for domain errors | Own stable codes (SPRING-I18N-02) |

*Agent checklist in [checklists/spring.md](../../checklists/spring.md) and sources in [sources.md](../../sources.md), section "Spring: Internationalization".*
