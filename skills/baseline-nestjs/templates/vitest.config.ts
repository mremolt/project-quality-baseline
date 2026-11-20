import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which Nest's DI and testing module need; Vitest's default (esbuild) does not.
// jsc.target: SWC does not know ES2025 yet, so it must not take the target from tsconfig.json.
const swcPlugin = swc.vite({ module: { type: 'es6' }, jsc: { target: 'es2024' } });

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    setupFiles: ['reflect-metadata', './test/setup-env.ts'],
    tags: [{ name: 'cross-user', description: 'Object-level access across callers (NEST-SEC-08)' }],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts', 'test/**/*.test.ts'], exclude: ['**/*.it.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'it',
          include: ['src/**/*.it.test.ts', 'test/**/*.it.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
