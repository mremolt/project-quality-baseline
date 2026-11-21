# Next.js: Internationalization

Next.js rules on top of [i18n.md](i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`) and [react.md](react.md) (`REACT-I18N-*`), with `next-intl` 4.15 (NEXT-D6, [04-solution-strategy/nextjs.md](../../04-solution-strategy/nextjs.md)). `next-intl` is `use-intl` plus the server side: the same `useTranslations`, `useFormatter` and `useLocale` in client components, and `getTranslations`, `getLocale` and a request configuration on the server. So REACT-I18N-03..08, 10, 11 and 13..15 apply unchanged (keys, typed keys, no hard-coded text, ICU, missing messages, formatting, `lang` on fragments, text expansion, tests). This file replaces the "(React SPA)" rules: REACT-I18N-01 (provider), 02 (catalog location), 09 (locale ownership) and 12 (language switch).

What the Next.js reference build verified (2026-11-20, next-intl 4.15.1): the plugin with a request configuration, locale negotiation from `Accept-Language`, `getTranslations` in a server component and in `generateMetadata`, `NextIntlClientProvider` without props in the root layout, `useTranslations`/`useFormatter`/`useLocale` in server-rendered client components, ICU plural, `<html lang>` from `getLocale()`, component tests with `NextIntlClientProvider` and the source catalog. Only English ran in the browser. Everything marked "to verify before first use" is listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Mechanism and catalogs

- **NEXT-I18N-01: `next-intl` with one request configuration in the platform.** `next.config.ts` wraps the config with `createNextIntlPlugin('./src/platform/adapter/in/i18n/request.ts')`. That file default-exports `getRequestConfig(async () => ({ locale, messages, timeZone }))`; it is an incoming adapter of the platform, because it reads the request. Server components translate with `await getTranslations(namespace)` from `next-intl/server`; client components with `useTranslations(namespace)` from `next-intl`. `react-i18next`, `react-intl` and build-time translation need an ADR (I18N-01). Replaces REACT-I18N-01 for Next.js.

```ts
// src/platform/adapter/in/i18n/request.ts (validated; time zone: NEXT-I18N-05)
export default getRequestConfig(async () => {
  const locale = negotiate((await headers()).get('accept-language'));
  const messages = (await import(`../../../../../messages/${locale}.json`)) as { default: Record<string, unknown> };
  return { locale, messages: messages.default, timeZone: 'Europe/Berlin' };
});
```

- **NEXT-I18N-02: Catalogs are nested JSON in `messages/<lang>.json` at the component root, one top-level namespace per feature or area** (`app`, `platform`, `orders`). They are loaded per request by the dynamic `import()` above, so only the active language is read. The translator context sits in `messages/context.json` (TOOL-I18N-07). The supported locales (`LOCALES = ['en', 'de'] as const`, I18N-04) and the negotiation live next to `request.ts` in `src/platform/adapter/in/i18n/`. Replaces the catalog location of REACT-I18N-02; the namespace rules stay.
- **NEXT-I18N-03: Keys are typed against the source catalog** (REACT-I18N-05) by augmenting `next-intl`'s `AppConfig`: `declare module 'next-intl' { interface AppConfig { Locale: (typeof LOCALES)[number]; Messages: typeof en } }` in `src/platform/adapter/in/i18n/`. The reference build had no augmentation (keys were untyped); to verify before first use that `getTranslations` and `useTranslations` then reject a missing key, including template-literal keys from a union type.

## Locale and time zone per request

- **NEXT-I18N-04: The locale is resolved once per request, in the request configuration, and everything else reads it from there.** Order: the user's stored choice (I18N-06: profile for signed-in users, a cookie for anonymous ones), then the first supported language of `Accept-Language` (by language subtag; quality values are not weighed), then the source locale `en`. Server code reads it with `getLocale()`, client code with `useLocale()`; nothing parses `Accept-Language` or the cookie a second time. Authenticated apps have no locale in the URL ([i18n.md](i18n.md#decisions)), so no `next-intl` routing and no `next-intl` middleware in `proxy.ts`. Reading `headers()` in the request configuration makes every page dynamic, which matches NEXT-D3. Verified: `Accept-Language` negotiation. To verify before first use: the stored choice ahead of the header (where the profile language comes from without an extra backend call per request, for example from the session) and the cookie's attributes. Replaces REACT-I18N-09 for Next.js.
- **NEXT-I18N-05: Server and client render with the same time zone, taken from the request configuration.** The client provider inherits `timeZone` (NEXT-I18N-06), so server-rendered HTML and the hydrated client format instants alike; a client that switched to the browser's zone after hydration would produce a hydration mismatch. The zone is the user's zone where the app knows it (profile setting), otherwise the product's default zone from the server configuration (a key of [configuration/nextjs.md](../configuration/nextjs.md)), never a literal in code. The reference build hard-codes `'Europe/Berlin'`; the configured default and the profile zone are to verify before first use. Date-only values are never converted (REACT-I18N-10).

## Server and client components

- **NEXT-I18N-06: The root layout renders one `<NextIntlClientProvider>` without props; it passes locale, messages and time zone from the request configuration to the client** (verified). It sits in `src/app/layout.tsx` around the client providers, and `<html lang={await getLocale()}>` is set in the same layout (verified; `dir` is not set while RTL is out of scope, [i18n.md](i18n.md#decisions)). The provider sends the whole catalog of the active locale to the browser in the RSC payload. When the catalogs grow, the layout passes only the namespaces client components use (`messages={pick(messages, ['app', 'orders'])}`, with `getMessages()`); to verify before first use. Catalogs contain no secrets, so sending them is safe either way.
- **NEXT-I18N-07: Server components use the async API, client components the hooks, and neither passes translated text across the boundary.** A server component calls `getTranslations`, `getLocale` and, for dates and numbers, `getFormatter()` (the latter to verify before first use). A client component calls `useTranslations`, `useFormatter` and `useLocale`. Data crosses the server/client boundary as domain values (`initialOrders`), never as formatted strings, so a client component re-formats with its own locale and the React Compiler memoizes on it (REACT-I18N-10). `formatMoney(locale, money)` takes the locale from `getLocale()` or `useLocale()`.
- **NEXT-I18N-08: Page titles and metadata are translated in `generateMetadata`:** `return { title: (await getTranslations('orders'))('title') }` in the feature's pages file (verified; NEXT-ARCH-01). The root layout's title template (`'%s | Shop'`) holds the app name; the reference build writes it as a literal, which REACT-I18N-06 does not allow: the layout builds it from the catalog with its own `generateMetadata`; to verify before first use.
- **NEXT-I18N-09: Server actions and route handlers return codes, never translated text** (REACT-I18N-04, I18N-03). A server action answers `{ ok: false, errorCode: 'ORDER_ALREADY_SHIPPED' }`; the client maps the code to a key once per feature (`ordersErrorKey`) and translates it (verified). A route handler's problem body carries the backend's `code`; the BFF's own problems carry the fixed reason phrase only.

## Language switch and backend language

- **NEXT-I18N-10: The language switch stores the choice and re-renders on the server, without a full page load.** One selector in the shell (WCAG 3.2.3/3.2.6, UI-02), keyboard operable, current language marked, language names in their own language with `lang` (REACT-I18N-11). It calls a server action that stores the choice (profile through a use case for signed-in users, the cookie for anonymous ones), then `router.refresh()`, so server components and the provider render again with the new locale and `<html lang>` follows. Client state (store, query cache) survives; server data needs no refetch because the UI translates codes (I18N-03). Focus stays on the selector. Not built in the reference build: to verify before first use, including that `router.refresh()` updates `<html lang>` and the client provider's messages. Replaces REACT-I18N-12 for Next.js.
- **NEXT-I18N-11: Calls to the backend carry the active locale in `Accept-Language`** (I18N-06), so localized backend fallbacks match the UI. The server-side mutator sets it from `getLocale()`, and the API proxy route handler replaces the browser's header with the request's resolved locale (one source, NEXT-I18N-04). The reference build's proxy forwards the browser's `Accept-Language` unchanged and the server-side mutator sends none: to verify before first use ([api/nextjs-openapi-clients.md](../api/nextjs-openapi-clients.md)).
- **NEXT-I18N-12: MUI's component strings follow the locale:** the root client providers create the theme with the locale object of `@mui/material/locale` chosen by `useLocale()`. To verify before first use (the reference build had English MUI strings only).
- **NEXT-I18N-13: Public SEO pages with a locale prefix (`/de/…`) are an ADR, not a default** ([i18n.md](i18n.md#decisions)). Such a product uses `next-intl` routing (`defineRouting`, its middleware called from `proxy.ts` before the nonce and header logic, `hreflang` alternates) for the public part only; the authenticated part keeps NEXT-I18N-04. Not built: to verify before first use.

## Tests

The shared test rules are TEST-I18N-01..04, 07 and 08; REACT-I18N-14/15 apply with these Next.js specifics:

- **NEXT-I18N-14: Component tests wrap the screen in `<NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Berlin">`** inside `renderWithProviders` ([testing/nextjs.md](../testing/nextjs.md)), with the real source catalog (TEST-I18N-01, verified). Server components' translations, the negotiation and `<html lang>` are covered by E2E: Playwright's `locale` option sets the browser's `Accept-Language`, so a locale project (`locale: 'de-DE'`, TEST-I18N-02) gets German server HTML. The negotiation function is a pure function with a node spec (header with and without a supported language, region subtags, empty header). Locale projects and the negotiation spec were not built: to verify before first use.
- **NEXT-I18N-15: The language-switch E2E test switches through the selector without a document load** (TEST-I18N-08, REACT-I18N-15): it asserts the new text, the new date and amount format, `<html lang>` and the kept focus, and that `page.on('load')` does not fire. To verify before first use.

## Tooling

`npm run i18n:check`, the pseudo-locale and the Weblate format follow the React tooling section ([react.md](react.md#tooling)), with the catalogs in `messages/`. To verify before first use, as there.

## Open points

Verify before first use ([chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)): typed keys through `next-intl`'s `AppConfig` (NEXT-I18N-03); stored language choice ahead of `Accept-Language`, its cookie and the profile source (NEXT-I18N-04); configured default and profile time zone (NEXT-I18N-05); passing only client namespaces (NEXT-I18N-06); `getFormatter()` in server components (NEXT-I18N-07); translated title template (NEXT-I18N-08); language switch with `router.refresh()` (NEXT-I18N-10); `Accept-Language` from the resolved locale in the server mutator and the proxy (NEXT-I18N-11); MUI locale strings (NEXT-I18N-12); locale-prefixed public pages (NEXT-I18N-13); locale projects and negotiation spec (NEXT-I18N-14); language-switch E2E (NEXT-I18N-15).

## Skill overrides

| Skill or habit | Says | Our rule |
|---|---|---|
| next-intl docs ("with i18n routing" setup), generic Next.js habit | `app/[locale]/` segment, `createMiddleware(routing)` in `middleware.ts`, locale in every URL | No locale in the URL for authenticated apps; negotiation in the request configuration; routing only for public SEO pages by ADR, in `proxy.ts` (NEXT-I18N-04, NEXT-I18N-13) |
| next-intl docs | `src/i18n/request.ts` | `src/platform/adapter/in/i18n/request.ts`, an incoming adapter of the platform (NEXT-I18N-01) |
| Generic habit | `NextIntlClientProvider` with explicit `locale`/`messages` read again in the layout, or a provider per page | One provider without props in the root layout (NEXT-I18N-06) |
| Generic habit | Server component formats dates and passes strings to client components | Domain values cross the boundary; each side formats with the active locale (NEXT-I18N-07) |
| Generic habit | `timeZone` left out, or the browser zone on the client | One zone from the request configuration for server and client (NEXT-I18N-05) |
| Generic habit | Server action returns a translated error message | Codes only; the client translates (NEXT-I18N-09) |
| Generic habit | Language switch with `window.location.reload()` or a redirect to `/de/…` | Server action plus `router.refresh()` (NEXT-I18N-10) |

*Agent checklist in [checklists/nextjs.md](../../checklists/nextjs.md) and sources in [sources.md](../../sources.md), section "Next.js: Internationalization".*
