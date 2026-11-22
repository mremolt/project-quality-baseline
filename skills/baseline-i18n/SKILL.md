---
name: baseline-i18n
description: Internationalization entry point for any project that uses the quality baseline and supports more than one language - translation keys and catalogs (Transloco, use-intl, next-intl, ICU plurals), where UI text may live, language switching, html lang, formatting of dates, numbers and money, Material locale strings, localized backend errors (ProblemDetail codes, MessageSource, Accept-Language), localized emails, Weblate translation workflow, pseudo-locale and per-locale tests. Routes to the baseline's i18n docs and cites rule IDs. Use it when adding or changing user-visible text in a multilingual product, or when asked to add a language.
---

# i18n in the quality baseline

The baseline docs are the rules; skills supply know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). Paths are relative to the project root; docs are in `docs/baseline/08-crosscutting-concepts/i18n/`. Whether the product is multilingual is an ADR (I18N-01); check `docs/adr/` first. Without that ADR only I18N-02/03 apply.

## 1. Read the docs for the task

| Task | Read |
|---|---|
| Any i18n work, new language, workflow, tests | `i18n.md` (decisions, `I18N-*`, `TOOL-I18N-*`, `TEST-I18N-*`) |
| Angular text, keys, pipes, language switch, Material locale | `angular.md` (`NG-I18N-*`) |
| React text, keys, formatting, language switch, MUI locale (`use-intl`) | `react.md` (`REACT-I18N-*`) |
| Next.js server components, request config, locale detection (`next-intl`) | `nextjs.md` (`NEXT-I18N-*`), on top of `react.md` |
| Error codes, localized errors, emails, bundles, `Accept-Language` | Spring: `spring.md` (`SPRING-I18N-*`), `docs/baseline/08-crosscutting-concepts/api/spring-rest.md` (SPRING-REST-07). NestJS: `nestjs.md` (`NEST-I18N-*`), `docs/baseline/08-crosscutting-concepts/api/nestjs-rest.md` (NEST-REST-14). Read only the project's stack |
| Layout under longer text, logical properties | `docs/baseline/08-crosscutting-concepts/ui/ui-patterns.md` (UI-09/10); Angular: `ui/angular-material.md` (NG-UI-24/25); React: `ui/react-mui.md` |
| `lang`, switcher, screen reader in another language | `docs/baseline/10-quality-requirements/accessibility.md` |

## 2. Skills to combine

`baseline-angular`, `baseline-react`, `baseline-nextjs`, `baseline-spring` or `baseline-nestjs` (this skill is loaded from them; only the project's own stacks), `angular-developer` (Angular only), `baseline-tdd`, `playwright-best-practices` (locale and timezone emulation), `accessibility`.

## 3. Overrides you will hit

| Skill or habit | Baseline rule |
|---|---|
| `@angular/localize`, `i18n` attributes, `ng build --localize` | Transloco at runtime; build-time only via ADR (NG-I18N-01) |
| `@jsverse/transloco-messageformat` for ICU plurals | The eval-free `IcuTranspiler` on `intl-messageformat` (NG-I18N-01); the plugin compiles with `new Function`, which the CSP blocks |
| English sentence as the key | Semantic keys (NG-I18N-03) |
| Translating in a store, service or use case | Codes and keys in the core, text in the UI edge (I18N-02, NG-I18N-04) |
| Showing the server's `detail` | Translate by `code`, generic fallback (NG-I18N-04, SPRING-I18N-02) |
| `CurrencyPipe`/`Number()` on money, `toLocaleDateString()` without locale | `money` pipe and explicit locale (NG-I18N-08) |
| Switching `LOCALE_ID` at runtime; `DatePipe`/`DecimalPipe` for localized output | Own `Intl` pipes bound to the active-language signal (NG-I18N-07/08) |
| Pure pipe that reads the language signal inside `transform` | Impure with a per-locale cache, or pure with the locale as an argument (NG-I18N-08) |
| Error mapper or store returning translated text | Store holds the error key; the component translates (NG-STATE-09, NG-I18N-04) |
| `LocaleContextHolder` or `MessageSource` in a service | Language as data in the command (SPRING-I18N-04) |
| `Intl`, `toLocale*`, `nestjs-i18n` or a catalog lookup in a NestJS use case | Language as data in the command; translation in the filter or outgoing adapter (NEST-I18N-04/05) |
| `react-i18next`, source sentences as ids, `t()` in mutation hooks or slices | `use-intl` (React SPA) or `next-intl` (Next.js), semantic keys, keys in the core and slices (REACT-I18N-01/03/04, NEXT-I18N-01; overrides table in `react.md`) |
| Translated text returned by a Next.js server action or passed from a server to a client component | Codes from actions, translation on each side (NEXT-I18N-07/09) |
| Third-party i18n skills (React/i18next) or running their audit scripts | Not used (TOOL-SKL-03/05); use `npm run i18n:check` |
| Editing non-source catalogs by hand | Weblate writes them (TOOL-I18N-02) |

## 4. Workflow

1. **Check the ADR** (I18N-01): supported locales, source locale, release-blocking locales.
2. **Add the text as a key** in the feature scope, source locale only, with context in `context.json` (I18N-08; Angular: NG-I18N-02/03; React: REACT-I18N-02/03; Next.js: NEXT-I18N-02). ICU for plurals and selects (NG-I18N-06, REACT-I18N-07). Never concatenate (I18N-07).
3. **Keep the core language-free:** stores, slices, mappers, use cases and server actions return codes or keys (NG-I18N-04, REACT-I18N-04, NEXT-I18N-09); new business errors get a `code` in the enum, the OpenAPI spec and every bundle (SPRING-I18N-02/07 or NEST-I18N-02/04).
4. **Format at the edge** with the active locale (Angular: shared pipes, NG-I18N-08; React and Next.js: `useFormatter()` and shared `Intl` helpers, REACT-I18N-10); no formatted values on the wire (I18N-03).
5. **Test first** (`baseline-tdd`): real source catalog in component tests (TEST-I18N-01); formatting in two locales (TEST-I18N-07); a language switch re-formats what is on screen (TEST-I18N-08); per-locale contract and bundle parity tests in the backend (TEST-I18N-05/06).
6. **Check the layout** in the pseudo-locale and with `lang`/`dir` asserted by axe (TEST-I18N-02..04).
7. **Finish** with `npm run i18n:check` and the stack's verify command green, plus `npm run e2e` (locale projects) for changed screens; no gate, lint rule or parity test loosened.
