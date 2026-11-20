import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Placeholder the BFF (here: e2e/serve-dist.ts) replaces with a fresh nonce per response (REACT-SEC-04). */
const CSP_NONCE_PLACEHOLDER = 'CSP_NONCE_PLACEHOLDER';

/** REACT-ARCH-18: exactly these options. */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  define: {
    // Only values identical in every deployment (REL-VER-05, REACT-TOOL-11); the release comes from /config.json
    __APP_COMMIT__: JSON.stringify(process.env['GIT_COMMIT'] ?? 'dev'),
  },
  html: { cspNonce: CSP_NONCE_PLACEHOLDER },
  build: {
    target: ['chrome119', 'edge119', 'firefox119', 'safari17'], // TS-TOOL-02 browser set
    sourcemap: 'hidden', // uploaded to the error-reporting tool, never shipped (REACT-OBS-06, TS-SEC-05)
    // Keep source order across chunks, so `strict-csp.ts` (zod jitless) runs before any schema in a shared chunk
    rolldownOptions: { output: { strictExecutionOrder: true } },
  },
  server: {
    // config.json and the API come from the locally running BFF (REACT-CFG-06)
    proxy: { '/config.json': 'http://localhost:8080', '/api': 'http://localhost:8080' },
  },
});
