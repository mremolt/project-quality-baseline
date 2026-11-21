import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

const LOCALES = ['en', 'de'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** The first supported language of `Accept-Language`; quality values are not weighed. */
function negotiate(acceptLanguage: string | null): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const language = part.split(';')[0]?.trim().slice(0, 2).toLowerCase() ?? '';
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = negotiate((await headers()).get('accept-language'));
  const messages = (await import(`../../../../../messages/${locale}.json`)) as { default: Record<string, unknown> };
  return { locale, messages: messages.default, timeZone: 'Europe/Berlin' };
});
