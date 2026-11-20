import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

const core = ['src/**/domain/**/*.spec.ts', 'src/**/application/**/*.spec.ts', 'src/**/ports/**/*.spec.ts'];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
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
