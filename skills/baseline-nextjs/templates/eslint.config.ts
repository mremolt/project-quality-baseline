// eslint.config.ts: TypeScript base (TS-TOOL-04..07), the React set (REACT-TOOL-01..07) and Next.js (NEXT-TOOL-05/06)
import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import pluginQuery from '@tanstack/eslint-plugin-query';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { configs as sonarConfigs } from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

function asError(entry: Linter.RuleEntry): Linter.RuleSeverityAndOptions {
  const [severity, ...options]: [Linter.RuleSeverity, ...unknown[]] = Array.isArray(entry) ? entry : [entry];
  return [severity === 'warn' || severity === 1 ? 'error' : severity, ...options];
}

/** TS-TOOL-05, REACT-TOOL-04: a rule is `error` or `off`; the React and Next.js presets ship many `warn` entries. */
function warnAsError(config: Linter.Config): Linter.Config {
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).flatMap(([name, entry]) =>
      entry === undefined ? [] : [[name, asError(entry)]],
    ),
  );
  return { ...config, rules };
}

const eslintReactHooksDuplicates = [
  'rules-of-hooks',
  'exhaustive-deps',
  'error-boundaries',
  'purity',
  'set-state-in-effect',
  'set-state-in-render',
  'static-components',
  'unsupported-syntax',
  'use-memo',
];

// REACT-TOOL-05: ESLint replaces a rule's options per block, so each block lists every entry it needs.
const fetchOnlyInHttpAdapters = {
  name: 'fetch',
  message: 'Backend calls go through an outgoing port in adapter/out/http (TS-ARCH-04).',
};
const noHtmlWrites = [
  {
    selector: 'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'TS-SEC-02',
  },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'TS-SEC-02' },
];
// NEXT-TOOL-06: directives only in files whose name says so; dependency-cruiser decides client-ness by file name
const noUseClient = {
  selector: 'Program > ExpressionStatement[directive="use client"]',
  message: "'use client' only in *.client.tsx, *.composition.tsx and the root client files of src/app (NEXT-ARCH-06).",
};
const noUseServer = {
  selector: 'Program > ExpressionStatement[directive="use server"]',
  message: "'use server' only in adapter/in/next/*-actions.ts (NEXT-ARCH-04).",
};
const CLIENT_FILES = [
  'src/**/*.client.tsx',
  'src/**/*.composition.tsx',
  'src/app/{providers,app-shell}.tsx',
  'src/app/theme.ts',
];
const SERVER_ACTION_FILES = ['src/**/adapter/in/next/*-actions.ts'];
const restrictedImports = {
  paths: [
    { name: 'process', message: 'Read configuration in src/platform/config (NEXT-CFG-04).' },
    { name: 'node:process', message: 'Read configuration in src/platform/config (NEXT-CFG-04).' },
  ],
  patterns: [
    { group: ['@reduxjs/toolkit/query', '@reduxjs/toolkit/query/*'], message: 'RTK Query is banned (REACT-STATE-09)' },
  ],
};

export default defineConfig(
  {
    ignores: [
      '.next/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      '**/generated/**',
      'next-env.d.ts',
      'test/fixtures/**',
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error', // TS-TOOL-06
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      sonarConfigs.recommended, // named import: typed as a flat config (TS-TOOL-04)
      warnAsError(importX.flatConfigs.recommended),
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import-x/order': 'off',
      'import-x/no-cycle': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'sonarjs/no-unused-vars': 'off', // covered by @typescript-eslint/no-unused-vars
      'sonarjs/deprecation': 'off', // covered by @typescript-eslint/no-deprecated
      // TS-SEC-02
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',
      'no-restricted-globals': ['error', fetchOnlyInHttpAdapters],
      'no-restricted-syntax': ['error', ...noHtmlWrites, noUseClient, noUseServer], // REACT-SEC-03, NEXT-TOOL-06
      'no-restricted-imports': ['error', restrictedImports], // REACT-STATE-14, NEXT-CFG-04
      // NEXT-TOOL-06 replaces the (React SPA) `process` ban: server code uses process, only process.env is configuration
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration in src/platform/config (NEXT-CFG-04).' },
      ],
    },
  },
  {
    files: CLIENT_FILES,
    rules: { 'no-restricted-syntax': ['error', ...noHtmlWrites, noUseServer] },
  },
  {
    files: SERVER_ACTION_FILES,
    rules: { 'no-restricted-syntax': ['error', ...noHtmlWrites, noUseClient] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      warnAsError(reactHooks.configs.flat['recommended-latest']),
      pluginQuery.configs['flat/recommended-strict'],
    ],
  },
  {
    files: ['src/**/*.tsx'],
    extends: [warnAsError(eslintReact.configs['strict-type-checked']), warnAsError(jsxA11y.configs.strict)],
    // Hooks and React Compiler rules come from eslint-plugin-react-hooks (the compiler itself); @eslint-react 5
    // re-implements them, so its copies are off (REACT-TOOL-03).
    rules: {
      ...Object.fromEntries(eslintReactHooksDuplicates.map((rule) => [`@eslint-react/${rule}`, 'off'])),
      'jsx-a11y-x/control-has-associated-label': 'error', // off in the preset
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...warnAsError({ rules: nextPlugin.configs['core-web-vitals'].rules ?? {} }).rules, // NEXT-TOOL-05
      '@next/next/no-html-link-for-pages': 'off', // Pages Router rule; the app has no pages/ directory
    },
  },
  {
    files: ['src/**/adapter/out/http/**/*.ts', 'src/platform/adapter/out/http/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' }, // fetch allowed here only
  },
  {
    files: ['src/platform/config/**/*.ts', 'src/instrumentation.ts', '*.config.ts', 'e2e/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' }, // the only readers of process.env (NEXT-CFG-04)
  },
  {
    files: ['**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off', // test fixtures
      'sonarjs/no-hardcoded-secrets': 'off', // test fixtures
      'sonarjs/no-clear-text-protocols': 'off', // in-process stub URLs
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off', // expect(mock.method) with vitest-mock-extended
    },
  },
  {
    files: ['eslint.config.ts'],
    rules: { 'import-x/no-named-as-default-member': 'off' },
  },
  prettier,
);
