import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

const core = ['src/**/domain/**/*.spec.ts', 'src/**/application/**/*.spec.ts', 'src/**/ports/**/*.spec.ts'];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Reported, never gated (REACT-TEST-22); `npm run test:coverage`
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.spec.{ts,tsx}', '**/generated/**'],
        reporter: ['text-summary', 'lcov'],
      },
      projects: [
        // TS-TEST-05: domain and application tests run without a DOM
        { extends: true, test: { name: 'core', environment: 'node', include: [...core, 'test/**/*.spec.ts'] } },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/*.spec.{ts,tsx}'],
            exclude: core,
            setupFiles: ['test/setup-dom.ts'],
          },
        },
      ],
    },
  }),
);
