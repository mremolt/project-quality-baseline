// eslint.config.ts: TypeScript base (TS-TOOL-04..07) plus the React set (REACT-TOOL-01..07)
import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import eslintReact from '@eslint-react/eslint-plugin';
import pluginQuery from '@tanstack/eslint-plugin-query';
import vitest from '@vitest/eslint-plugin';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { configs as sonarConfigs } from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

function asError(entry: Linter.RuleEntry): Linter.RuleSeverityAndOptions {
  const [severity, ...options]: [Linter.RuleSeverity, ...unknown[]] = Array.isArray(entry) ? entry : [entry];
  return [severity === 'warn' || severity === 1 ? 'error' : severity, ...options];
}

/** TS-TOOL-05, REACT-TOOL-04: a rule is `error` or `off`; the React presets ship many `warn` entries. */
function warnAsError(config: Linter.Config): Linter.Config {
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).flatMap(([name, entry]) =>
      entry === undefined ? [] : [[name, asError(entry)]],
    ),
  );
  return { ...config, rules };
}

// REACT-TOOL-03: the hooks and compiler rules @eslint-react re-implements; switched off in the *.tsx block below
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

// REACT-TOOL-05: ESLint replaces a rule's options per block, so each block lists every restricted global it needs.
const fetchOnlyInHttpAdapters = {
  name: 'fetch',
  message: 'Backend calls go through an outgoing port in adapter/out/http (TS-ARCH-04).',
};
const noProcessInBrowser = {
  name: 'process',
  message: 'No process in browser code; runtime values come from /config.json (CFG-11).',
};
const noHtmlWrites = [
  {
    selector: 'AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'TS-SEC-02',
  },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'TS-SEC-02' },
];
// TS-TOOL-21, REACT-TOOL-15: time only from the platform clock (TS-ARCH-22)
const noWallClock = [
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'TS-ARCH-22' },
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'TS-ARCH-22' },
];
const noRtkQuery = {
  patterns: [
    { group: ['@reduxjs/toolkit/query', '@reduxjs/toolkit/query/*'], message: 'RTK Query is banned (REACT-STATE-09)' },
  ],
};

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/', '**/generated/**', 'test/fixtures/**'] },
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
      'no-restricted-syntax': ['error', ...noHtmlWrites], // REACT-SEC-03
      'no-restricted-imports': ['error', noRtkQuery], // REACT-STATE-14
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      warnAsError(reactHooks.configs.flat['recommended-latest']),
      pluginQuery.configs['flat/recommended-strict'],
    ],
    rules: {
      'no-restricted-globals': ['error', fetchOnlyInHttpAdapters, noProcessInBrowser],
      'no-restricted-syntax': ['error', ...noHtmlWrites, ...noWallClock],
    },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [warnAsError(eslintReact.configs['strict-type-checked']), warnAsError(jsxA11y.configs.strict)],
    // Hooks and React Compiler rules come from eslint-plugin-react-hooks (the compiler itself); @eslint-react 5
    // re-implements them, so its copies are off (TS-TOOL-07). Its preset `disable-conflict-eslint-plugin-react-hooks`
    // does the opposite and switches the react-hooks rules off.
    rules: Object.fromEntries(eslintReactHooksDuplicates.map((rule) => [`@eslint-react/${rule}`, 'off'])),
  },
  {
    files: ['src/**/adapter/out/http/**/*.ts', 'src/platform/adapter/out/http/**/*.ts'],
    rules: { 'no-restricted-globals': ['error', noProcessInBrowser] }, // fetch allowed here only
  },
  {
    files: ['src/platform/platform.composition*.{ts,tsx}', '**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...noHtmlWrites] }, // the clock lives here; tests pin time themselves
  },
  {
    // TS-TOOL-22: Vitest rules for unit, component and adapter specs; the Playwright specs under e2e/ have their own block
    files: ['**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    ignores: ['e2e/**', 'e2e-smoke/**'],
    extends: [warnAsError(vitest.configs.recommended)],
  },
  {
    // TS-TOOL-22: Playwright rules for the E2E code (TS-TOOL-20)
    files: ['e2e/**/*.ts', 'e2e-smoke/**/*.ts'],
    extends: [warnAsError(playwright.configs['flat/recommended'])],
  },
  {
    files: ['**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off', // test fixtures
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
