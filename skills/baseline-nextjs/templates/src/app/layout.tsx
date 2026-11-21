import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { publicRuntimeConfig } from '@/platform/index.server';

import { AppShell } from './app-shell';
import { Providers } from './providers';

export const metadata: Metadata = { title: { template: '%s | Shop', default: 'Shop' } };

/** Root composition: per-request nonce (set by src/proxy.ts) and the public runtime config go to the client providers. */
export default async function RootLayout({ children }: { readonly children: ReactNode }): Promise<ReactNode> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers nonce={nonce} publicConfig={publicRuntimeConfig()}>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
