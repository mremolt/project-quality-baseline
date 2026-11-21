# React: Internationalization

React rules on top of [i18n.md](i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`), with `use-intl` 4.15 (REACT-D7, [04-solution-strategy/react.md](../../04-solution-strategy/react.md)). Scope: rules marked "(React SPA)" are about the SPA's provider, catalog loading and locale resolution; Next.js replaces them with `next-intl` ([nextjs.md](nextjs.md)). The rules on keys, ICU, formatting and tests apply to both, because `next-intl` uses the same `useTranslations` and `useFormatter` API. No third-party i18n skill is installed for React; the `baseline-i18n` skill routes here.

**Why runtime translation.** One build for all languages (CFG rules, REACT-D9), language from the user's settings without a page load, and E2E and the dev server with every language. `use-intl` is small, has ICU MessageFormat built in, formats through `Intl` with the active locale and time zone, and types message keys against the source catalog, so a wrong key fails `tsc`.

What the React SPA reference build verified: provider, typed keys and catalog shape, ICU plural, `useFormatter().dateTime`, money formatting in two locales, startup locale from the browser, `<html lang>` at startup, component tests with the source catalog. Everything else in this file is marked "verify before first use" and listed in [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Mechanism and catalogs

- **REACT-I18N-01: (React SPA) Runtime translation with `use-intl`:** one `IntlProvider` in the app root (`src/app/app.tsx`) with `locale`, `messages` and `timeZone`; components use `useTranslations(namespace)`, `useFormatter()` and `useLocale()`. Build-time translation, `react-i18next` and `react-intl` need an ADR (I18N-01).
  ```tsx
  <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
  ```
  *Why:* one artifact, runtime switching, ICU without a plugin, typed keys.
- **REACT-I18N-02: (React SPA) Catalogs are nested JSON, one file per language, in `src/i18n/<lang>.json`, with one top-level namespace per feature or area** (`app`, `platform`, `orders`). `src/i18n/messages.ts` holds the supported locales (`LOCALES = ['en', 'de'] as const`, I18N-04), the catalog map and the type registration. All catalogs are bundled; they are small next to the app code. The translator context sits in `src/i18n/context.json` (TOOL-I18N-07).
  Per-feature catalog files that load with the feature's route chunk and merge into the provider's messages were not built in the validated project; the Weblate file layout for this shape, and lazy loading, are to verify before first use. Until then a feature owns its namespace in the shared files, and only its own code uses it.
- **REACT-I18N-03: Keys are stable semantic ids** `<feature>.<screen-or-component>.<element>[.<state>]`, lower-camel segments (`orders.cancel.reasonInvalid`), never the English sentence. A changed meaning gets a new key. Enum strings from the API map to `<namespace>.<enumType>.<VALUE>` (`orders.status.SHIPPED`), the shared `enum.<type>.<value>` convention inside the feature namespace.
  *Why:* stale translations stay silent otherwise.
- **REACT-I18N-04: Slices, mutations, selectors, use cases and error mappers return codes or keys, never translated text.** Translation happens in components: `const t = useTranslations('orders')`, then `t('page.title')` or `` t(`errors.${toErrorKey(mutation.error)}`) `` for a command error (REACT-STATE-07). An unknown error code maps to a generic key, never to the server's `detail`.
  *Why:* the core stays language-free (I18N-02) and tests stay deterministic.
- **REACT-I18N-05: Keys are typed against the source catalog.** `messages.ts` registers the types: `declare module 'use-intl' { interface AppConfig { Locale: AppLocale; Messages: typeof en } }`. A key missing from `en.json` is then a type error, including template-literal keys built from a union type (`` `status.${order.status}` ``), and route title keys are typed the same way (`MessageKeys<Messages, NestedKeyOf<Messages>>`, REACT-UI-30). `MESSAGES: Readonly<Record<AppLocale, typeof en>>` forces every catalog to the source's shape, so a missing translation fails `tsc`.
  That strict shape fits products whose locales are all release-blocking. A product that ships partly translated locales (TOOL-I18N-05) types non-source catalogs as partial and deep-merges them over the source catalog, which also gives the fallback of I18N-09; verify before first use.
- **REACT-I18N-06: No hard-coded user-visible text** in JSX, `aria-label`, `title`, `placeholder`, MUI `label` and `helperText`, dialog titles, snackbar texts and the document title (route `titleKey`, REACT-UI-30). The only static text is `index.html`'s start-up error, shown before any catalog exists; it carries every supported language, each paragraph with its `lang`. The validated ESLint set has no rule that finds literal strings in JSX; choosing and adding one (for example a `no-literal-string` rule) is to verify before first use, and until then review and the pseudo-locale run catch them (TOOL-I18N-04).
- **REACT-I18N-07: Plural, select and gender use ICU MessageFormat in the catalog,** never `if (count === 1)` in code: `"count": "{count, plural, =0 {No orders} one {# order} other {# orders}}"` with `t('count', { count })`. Values go in as placeholders, never by concatenating strings (I18N-07).
- **REACT-I18N-08: A missing message never shows the raw key.** The `IntlProvider` gets `onError` (log a warning for `IntlErrorCode.MISSING_MESSAGE`, report other errors) and a `getMessageFallback`; with the deep-merge of REACT-I18N-05 a non-source locale falls back to the source text (I18N-09). Both options type-check with `use-intl` 4.15; the behaviour is to verify before first use (the validated project relies on complete catalogs).

## Language, locale and formatting

- **REACT-I18N-09: (React SPA) The active locale is one value owned by the app root, and it drives everything that depends on the language:** the `IntlProvider`'s `locale` and `messages`, `<html lang>` and `dir`, MUI's own component strings, and the `Accept-Language` header the HTTP mutator sends (I18N-06).
  - Verified: at start-up `main.tsx` resolves the locale with `pickLocale(navigator.languages)` (first supported language, by language subtag, else the source locale `en`) and sets `document.documentElement.lang` before the first render.
  - To verify before first use: the explicit choice from the profile or storage ahead of the browser languages (I18N-06); MUI's strings through `createTheme(themeOptions, deDE)` with the locale objects from `@mui/material/locale` (type-checked with MUI 9.5); `Accept-Language` in the mutator ([api/react-openapi-clients.md](../api/react-openapi-clients.md)).
  - The `timeZone` passed to the provider is the user's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), so instants render in the user's zone.
- **REACT-I18N-10: Format at the edge with `useFormatter()` and shared `Intl` helpers, with the active locale as an argument.**
  - Dates and instants: `format.dateTime(order.createdAt, { dateStyle: 'medium' })` (zone from the provider). Date-only values (`yyyy-MM-dd`) never go through `new Date('yyyy-MM-dd')` with a zone.
  - Numbers: `format.number(value, options)`.
  - Money: `formatMoney(locale, money)` in `src/shared/ui/format/money.ts`, on `Intl.NumberFormat` with the decimal **string** (`money.amount as Intl.StringNumericLiteral`), so no digit is lost (tested in `en` and `de` and with `'90071992547409.93'`). Never `Number(amount)` and never `format.number` on a money amount.
  - Client-side sorting: `Intl.Collator(locale)`; server-paged lists are not re-sorted.
  - Helpers take the locale from `useLocale()` as a parameter. Never cache formatted strings in state, in a module-level memo keyed only by the value, or in the query cache; React re-renders with the new locale, and the React Compiler memoizes on the arguments, locale included. No `toLocaleString()` or `toLocaleDateString()` without an explicit locale.
  *Why:* precision, one format per locale, the previous-day bug in negative-offset zones, and re-formatting on a language switch (TEST-I18N-08).
- **REACT-I18N-11: Foreign-language fragments carry `lang`** (WCAG 3.1.2). Language names in the language switcher are written in their own language with `lang` set.
- **REACT-I18N-12: (React SPA) The language switch is one action without a reload:** one selector in a consistent place in the shell (WCAG 3.2.3/3.2.6, UI-02), keyboard operable, current language marked, focus kept. It changes the app root's locale state, which re-renders the provider and the MUI theme locale and updates `<html lang>` and `dir`; the choice is stored per I18N-06 (profile for signed-in users, browser storage for anonymous ones; the language is not personal data in this sense, TS-SEC-01). For a signed-in user the switch calls the settings mutation first and then changes the root locale, and the profile is the only source on load: no second store (browser storage, a cookie) may disagree with it, otherwise the stored language overrides the visible choice after a reload and backend mail and documents use another language than the screen. Server data needs no refetch because the UI translates codes, not server text (I18N-03). Not built in the validated project: verify before first use.
- **REACT-I18N-13: Layouts tolerate text expansion and, later, RTL:** no fixed widths on text containers, logical properties in `sx` (REACT-UI-22, UI-09), no text in images.

## Tests

The shared test rules are TEST-I18N-01..04, 07 and 08 in [i18n.md](i18n.md#tests). React specifics:

- **REACT-I18N-14: Component tests render with the real source catalog:** `renderWithProviders` wraps the screen in `<IntlProvider locale="en" messages={MESSAGES.en} timeZone="UTC">` and tests query by the English role names (TEST-I18N-01, verified). Formatting helpers have unit tests in two locales (`formatMoney` in `en` and `de`, TEST-I18N-07, verified).
- **REACT-I18N-15: The language-switch test (TEST-I18N-08) asserts the new text and format without a reload:** it renders a date and an amount, switches the locale through the app's switch mechanism (REACT-I18N-12), and asserts the new text and the new format without a reload. Playwright locale projects (`locale`, `timezoneId`) add the locale as one dimension from the default cell ([TS-TEST-17/18](../testing/typescript-e2e.md), TS-TEST-29); the `lang` and `dir` assertion lives in the shared axe fixture (TS-TEST-12, A11Y-32). Neither ran in the validated project (only `en` in the browser): verify before first use.

## Tooling

`npm run i18n:check` (TS-TOOL-10 style script) covers TOOL-I18N-03. With typed keys (REACT-I18N-05) `tsc` already fails on keys used in code but missing in the source catalog and, with complete catalogs, on missing translations. The script adds what types cannot see: unused keys, invalid or duplicate JSON keys, placeholder and ICU parity between source and targets, and keys without context. It was not built in the validated project; the script, the pseudo-locale package (TOOL-I18N-04) and the Weblate file format for `use-intl` catalogs are to verify before first use.

## Open points

Verify before first use ([chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)): per-feature catalogs with lazy loading (REACT-I18N-02); partial catalogs merged over the source and `getMessageFallback` behaviour (REACT-I18N-05/08); a lint rule for literal strings (REACT-I18N-06); the language switch with stored choice, MUI locale, `<html lang>`/`dir` update and `Accept-Language` (REACT-I18N-09/12); the language-switch component test and Playwright locale projects (REACT-I18N-15); `i18n:check`, pseudo-locale package and Weblate format (Tooling).

## Skill overrides

| Skill or habit | Says | Our rule |
|---|---|---|
| Generic habit | `react-i18next` / `i18next` as the default React i18n library | `use-intl`; another library needs an ADR (REACT-I18N-01) |
| Generic habit, `react-intl` docs | Source sentence as the message id, `defaultMessage` in components | Semantic keys in catalogs; no text in components (REACT-I18N-03/06) |
| Generic habit | `t()` inside mutation hooks, slices or use cases; translated text in Redux state | Keys in the core and in slices, text in components (REACT-I18N-04, REACT-STATE-07) |
| Generic habit | `count === 1 ? 'order' : 'orders'`, string concatenation | ICU in the catalog (REACT-I18N-07) |
| Generic habit | `Number(amount).toLocaleString()`, `toLocaleDateString()` without a locale | `formatMoney` on the decimal string, `useFormatter()` with the active locale (REACT-I18N-10) |
| Generic habit | Locale in the URL (`/de/orders`) for an authenticated app | No locale in the URL ([i18n.md](i18n.md#decisions)); Next.js public pages: [nextjs.md](nextjs.md) |
| `vercel-react-best-practices` (`client-localstorage-schema`) | Anything in `localStorage` | The language choice may be stored for anonymous users; never tokens or personal data (TS-SEC-01) |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: Internationalization".*
