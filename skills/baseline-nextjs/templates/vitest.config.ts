import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// the package's own `react-server` entry: an empty module
const serverOnlyStub = fileURLToPath(new URL('node_modules/server-only/empty.js', import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'server-only': serverOnlyStub }, // the marker package throws outside a react-server bundle
  },
  test: {
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: { name: 'core', environment: 'node', include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.spec.tsx'],
          setupFiles: ['./vitest.setup-dom.ts'],
        },
      },
    ],
    coverage: { include: ['src/**'], exclude: ['**/generated/**'] },
  },
});
