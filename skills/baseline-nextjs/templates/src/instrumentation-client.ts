import { z } from 'zod';

// Runs before any application code in the browser.

// zod 4 probes `new Function` for its JIT when the first object schema is built; under
// `require-trusted-types-for 'script'` that probe is a reported violation, so turn the JIT off.
z.config({ jitless: true });

// Turbopack's chunk loader assigns plain strings to `script.src` when it loads a lazy chunk. The default policy
// lets only the app's own chunks through, unchanged (an absolute URL breaks the loader); every other script URL,
// and all HTML and script strings, stay blocked.
if (typeof window !== 'undefined' && window.trustedTypes) {
  window.trustedTypes.createPolicy('default', {
    createScriptURL: (input) => {
      const url = new URL(input, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith('/_next/static/chunks/')) return input;
      throw new TypeError(`script URL blocked by the Trusted Types default policy: ${url.href}`);
    },
  });
}
