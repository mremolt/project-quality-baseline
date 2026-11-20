import createCache, { type EmotionCache } from '@emotion/cache';

/**
 * The per-response CSP nonce, templated by the server into the `<meta property="csp-nonce">` tag that Vite
 * emits for `html.cspNonce`. Read through the `nonce` property: browsers hide the attribute value.
 */
function cspNonce(): string | undefined {
  const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce;
  return nonce === undefined || nonce === '' ? undefined : nonce;
}

/** Emotion (MUI) puts this nonce on every `<style>` it inserts, so `style-src` needs no 'unsafe-inline'. */
export function createEmotionCache(): EmotionCache {
  const nonce = cspNonce();
  return createCache({ key: 'mui', prepend: true, ...(nonce && { nonce }) });
}
