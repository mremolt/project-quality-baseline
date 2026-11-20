import './strict-csp';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';
import { router } from './app/router';
import { pickLocale } from './i18n/messages';
import { createPlatform, loadRuntimeConfig } from './platform';

const container = document.getElementById('root');

try {
  if (container === null) throw new Error('#root missing in index.html');
  const config = await loadRuntimeConfig();
  const platform = createPlatform(config, () => router.state.matches.at(-1)?.routeId ?? 'unknown');
  const locale = pickLocale(navigator.languages);
  document.documentElement.lang = locale;
  createRoot(container).render(
    <StrictMode>
      <App platform={platform} router={router} locale={locale} />
    </StrictMode>,
  );
} catch (error) {
  // No catalog and no reporting before the configuration exists (REACT-CFG-03): static message from index.html.
  console.error('Start-up failed', error);
  document.getElementById('startup-error')?.removeAttribute('hidden');
}
