import de from './de.json';
import en from './en.json';

export const LOCALES = ['en', 'de'] as const;
export type AppLocale = (typeof LOCALES)[number];

/** `en` is the source catalog (I18N-05); `de` must have the same shape. */
export const MESSAGES: Readonly<Record<AppLocale, typeof en>> = { en, de };

/** Browser language → supported locale, falling back to the source locale (I18N-09). */
export function pickLocale(preferred: readonly string[]): AppLocale {
  for (const tag of preferred) {
    const language = tag.split('-')[0];
    const match = LOCALES.find((locale) => locale === language);
    if (match !== undefined) return match;
  }
  return 'en';
}

declare module 'use-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof en;
  }
}
