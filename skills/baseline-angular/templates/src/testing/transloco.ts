import { provideTransloco } from '@jsverse/transloco';
import type { EnvironmentProviders, Provider } from '@angular/core';

/**
 * TEST-I18N-01: component tests render with the real catalog of the source language, not stubs, so a missing key shows
 * up as a test failure. Adapt the language and the catalog import to the product (ADR on the languages, NG-I18N-*).
 * With `vi.useFakeTimers()`, load the language first (`await firstValueFrom(transloco.load('de'))` in the spec setup,
 * before the clock is faked), otherwise messages come back as keys.
 */
export function provideTestTranslations(lang = 'de'): (Provider | EnvironmentProviders)[] {
  return [
    provideTransloco({
      config: { availableLangs: [lang], defaultLang: lang, missingHandler: { allowEmpty: false } },
      loader: undefined,
    }),
    // register the real catalogs here, e.g. a TranslocoLoader that imports src/assets/i18n/<lang>.json synchronously
  ];
}
