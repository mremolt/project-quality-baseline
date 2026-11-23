# Angular: Internationalization

Angular rules on top of [i18n.md](i18n.md) (`I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`). Framework know-how comes from `angular-developer` and the `baseline-i18n` skill; the Angular i18n skills found on skills.sh are not used (TOOL-SKL-05).

**Why runtime over build time.** Our apps are authenticated Material apps with a store per feature. Users switch language, or it comes from a profile, without a page load; we want one artifact per release; E2E and `ng serve` work with all languages. `@angular/localize` gives one bundle per locale, no runtime switching, and `ng serve` serves one locale at a time. Its strengths (compile-time ICU, no runtime library, `i18nMissingTranslation: error`) are replaced by the CI gates in [i18n.md](i18n.md).

## Mechanism and catalogs

The frontend-mechanism decision of [i18n.md](i18n.md#decisions) in Angular: runtime translation with Transloco; `@angular/localize` (build time) only through an ADR, for single-language deployments. The rendering decision that a public SEO path prefix needs is NG-ARCH-18.

- **NG-I18N-01: Runtime translation with Transloco (`@jsverse/transloco`) is the default, with ICU interpreted by `intl-messageformat` through the baseline's eval-free transpiler;** `@angular/localize` needs an ADR (I18N-01). Use the stable 8.x line until 9.x is stable (see [chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)). The transpiler is the template `.agents/skills/baseline-angular/templates/src/platform/adapter/in/ui/icu-transpiler.ts` (with its spec), registered once with `provideTranslocoTranspiler(IcuTranspiler)` in `app.config.ts`. `@jsverse/transloco-messageformat` is not used: `@messageformat/core` compiles every message with `new Function`, which the CSP of NG-SEC-05 (no `unsafe-eval`, `require-trusted-types-for 'script'`) blocks at runtime.
  *Why:* runtime switching and one artifact; the eval-based plugin passes the dev server and jsdom tests, which enforce no CSP, and fails only in the BFF-served build (NG-SEC-12).
- **NG-I18N-02: Catalogs are nested JSON, one file per language and scope,** next to the feature: `features/<f>/adapter/in/ui/i18n/<lang>.json` with its `context.json`; shared UI in `src/shared/ui/i18n`; platform texts in `src/platform`. Scopes are lazy and provided in the route providers (NG-ARCH-11).
  *Why:* translations live in the incoming UI adapter ring and load with the feature.
- **NG-I18N-03: Keys are stable semantic ids** `<feature>.<screen-or-component>.<element>[.<state>]`, lower-camel segments, never the English sentence. A changed meaning gets a new key.
- **NG-I18N-13: A lazy scope is the key prefix, so its catalog has no root key for it.** With `provideTranslocoScope({ scope: 'orders' })`, `features/orders/…/i18n/en.json` holds `{ "list": { … } }` and the key is `orders.list.…`; repeating `orders` as root key doubles the prefix. Templates use the `transloco` pipe with the full key; `translateSignal` inside a scoped component prefixes the scope a second time and is used only with scope-relative keys. Route titles are rendered by the shell outside the lazy scope, so they live in the shell catalog (`shell.title.<feature>`).
  *Why:* a doubled prefix produces missing keys that only the running router and loader reveal.
- **NG-I18N-14: Texts of a lazy scope are built in the template, never with `transloco.translate()` inside a `computed`.** The pipe and the `transloco` directive re-render when the scope has loaded; an imperative `translate()` runs once and shows the raw key while the scope loads. Component tests cannot see this, because their loader has every catalog at once; the stubbed E2E tier does.
  *Why:* stale translations stay silent otherwise.
- **NG-I18N-04: Stores, use cases and mappers return codes or keys, never translated text.** Translation happens in components (pipe, directive, `translateSignal`); the feature error mapper returns keys, and the store holds them (NG-STATE-09). An unknown error code maps to a generic key, never to the server's `detail` (SPRING-I18N-02).
  *Why:* keeps the core language-free and tests deterministic.
- **NG-I18N-05: No hard-coded user-visible text** in templates, TypeScript, `aria-label`, `title`, `placeholder`, `mat-label`, dialog titles, snackbar texts and the document `<title>`. Enforced by lint (NG-TOOL).
  *Why:* accessibility labels are text too (NG-UI-12/13).
- **NG-I18N-06: Plural, select and gender use ICU MessageFormat** through the ICU transpiler of NG-I18N-01; no `if (n === 1)`.
  *Why:* Polish, Arabic and others have more than two plural forms.
- **NG-I18N-12: The catalog request is cached and the first route's scope is preloaded;** the source locale is the fallback, and a missing key logs a warning and never shows the raw key in production builds (I18N-09).
  *Why:* no flash of keys, no blank UI.

## Language, locale and formatting

- **NG-I18N-07: The active language is one signal in `src/platform` that drives every locale-dependent setting** (fed by Transloco's active language): `<html lang>`, `dir`, the formatting pipes (NG-I18N-08), the Material date adapter (`DateAdapter.setLocale`) and the Material `*Intl` providers (paginator, sort, stepper, datepicker labels), wired once in `src/platform`. `LOCALE_ID` is only the bootstrap default and is never switched at runtime.
  *Why:* WCAG 3.1.1, formatting and Material's own strings must switch together. Angular reads `LOCALE_ID` once when the injector is created, and `DatePipe`, `DecimalPipe` and `CurrencyPipe` capture it, so changing it later formats nothing differently.
- **NG-I18N-08: Format at the edge with own shared pipes on `Intl.*`, bound to the active-language signal** (NG-I18N-07): a date pipe on `Intl.DateTimeFormat` with the user's zone for instants, a `number` pipe on `Intl.NumberFormat`, a `money` pipe on `Intl.NumberFormat` for decimal strings, and an `Intl.Collator` wrapper for client-side sorting. They live in `src/shared/ui/format/` (stateless pipes, TS-ARCH-11) and re-format on a language switch in one of two ways: **impure** (`pure: false`) with the `Intl` formatter cached per locale, or **pure with the locale as an argument** (`value | money: lang()`). A pure pipe that only reads the signal inside `transform` is not called again while its arguments are unchanged, so it keeps the old format; TEST-I18N-08 catches that. Angular's `DatePipe`, `DecimalPipe` and `CurrencyPipe` are not used (NG-I18N-07). No `Number(amount)` for money, no `toLocaleDateString()` without an explicit locale, and date-only values never go through `new Date('yyyy-MM-dd')` with a zone.
  *Why:* precision, consistency, and the previous-day bug in negative-offset zones. Angular calls a pure pipe only when a primitive input or an object reference changes.
- **NG-I18N-09: Foreign-language fragments carry `lang`** (WCAG 3.1.2). Language names in the language switcher are written in their own language with `lang` set.
  *Why:* screen readers pronounce them correctly.
- **NG-I18N-10: The language switch is one announced action:** one selector in a consistent place (WCAG 3.2.3/3.2.6), keyboard operable, current language marked, no reload, focus kept (NG-UI-10 and UI-02 consistency rules apply). The choice is stored per I18N-06 and in the profile for signed-in users.
- **NG-I18N-11: Layouts tolerate text expansion and, later, RTL:** no fixed widths on text containers, CSS logical properties (NG-UI-24, UI-09), no text in images. German and Finnish commonly need 30 percent or more extra space; the pseudo-locale exaggerates it on purpose.

## Tests

The shared test rules are TEST-I18N-01..04, 07 and 08 in [i18n.md](i18n.md#tests). Angular specifics: component tests use the Transloco testing helpers with the real source catalog; the language-switch test (TEST-I18N-08) calls `setActiveLang` on the `TranslocoService` and asserts the re-formatted pipe output after change detection; Playwright locale projects add the locale as one dimension from the default cell ([TS-TEST-17/18](../testing/typescript-e2e.md), TS-TEST-29); they do not repeat the viewport matrix per locale. The `lang` and `dir` assertion lives in the shared axe fixture (TS-TEST-12, A11Y-32).

## Open points

The Transloco version and testing helpers, and the `Intl` pipes and `DateAdapter.setLocale` on a language switch, are confirmed in the i18n spike before the first product adopts them ([chapter 11](../../11-risks-and-technical-debt/README.md#verify-before-first-use)).

## Tooling

`npm run i18n:check` (TS-TOOL-10 style script) runs, in this order: `transloco-keys-manager find` with `--emit-error-on-extra-keys`, `transloco-validator`, a placeholder/ICU parity script, and the context check (TOOL-I18N-03). The keys-manager package lives in the Transloco monorepo and needs a current Node and `@angular/compiler`; check its requirements when you add it. The lint rule for NG-I18N-05 is `@angular-eslint/template/i18n` with `checkText: true`, `checkAttributes: true` (extend `ignoreAttributes` with the static non-text attributes the app uses, such as `matColumnDef`) and `checkId: false`; with Transloco no template contains static text, so every report is a hard-coded string. `i18n` attributes are not used (NG-I18N-01), so nobody silences a report by adding one. There is no `no-literal-string` rule in angular-eslint; TypeScript strings (snackbar texts, titles) are caught by the catalog check and review. The rule is added with the first multilingual product and is never switched off to pass a build (SEC-REV-02 applies in spirit).

## Skill overrides

| Skill habit | Baseline rule |
|---|---|
| `angular-i18n` skills: `i18n` attributes, `ng extract-i18n`, `ng build --localize` as the default | Transloco at runtime; `@angular/localize` only through an ADR (NG-I18N-01) |
| Text as the key, source sentence in the template | Semantic keys (NG-I18N-03) |
| Translating in the store or service | Codes and keys in the core, text in the UI edge (NG-I18N-04) |
| `CurrencyPipe` on a money amount | `money` pipe on the decimal string (NG-I18N-08) |
| Switching `LOCALE_ID` at runtime; `DatePipe`/`DecimalPipe` for localized output | Own `Intl` pipes bound to the active-language signal (NG-I18N-07/08) |
| Pure pipe that reads the language signal inside `transform` | Impure with a per-locale cache, or pure with the locale as an argument (NG-I18N-08) |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular: Internationalization".*
