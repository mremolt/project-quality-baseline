// eslint.config.ts: TypeScript base (TS-TOOL-04..07) plus the Node backend rules (NODE-TOOL-05)
import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

const noDynamicImport = {
  selector: 'ImportExpression[source.type!="Literal"]',
  message: 'No import() of computed paths (NEST-SEC-26).',
};
const noProcessImport = [
  { name: 'process', message: 'Configuration only in src/platform/config (NODE-ARCH-12).' },
  { name: 'node:process', message: 'Configuration only in src/platform/config (NODE-ARCH-12).' },
];
const noCodeExecution = ['child_process', 'node:child_process', 'vm', 'node:vm'].map((name) => ({
  name,
  message: 'No child processes or dynamic code (NEST-SEC-26).',
}));

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '**/generated/**', 'test/fixtures/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      sonarjs.configs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver()] },
    plugins: { 'simple-import-sort': simpleImportSort, security, regexp },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import-x/order': 'off',
      'import-x/no-cycle': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/deprecation': 'off',
      // Node backend (NODE-TOOL-05)
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unsafe-class-instance-assignment': 'off', // Nest types option objects as classes
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Configuration only in src/platform/config (NODE-ARCH-12).' },
      ],
      'no-restricted-imports': ['error', { paths: [...noProcessImport, ...noCodeExecution] }],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: "Import fetch and Agent from 'undici' with explicit timeouts (NEST-LIB-07)." },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',
      'no-restricted-syntax': ['error', noDynamicImport],
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'regexp/no-super-linear-backtracking': 'error',
      'regexp/no-super-linear-move': 'error',
    },
  },
  {
    // NEST-I18N-05: no locale logic in the core (rule arrays replace, so the general entries are repeated)
    files: ['src/**/domain/**/*.ts', 'src/**/ports/**/*.ts', 'src/**/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: "Import fetch and Agent from 'undici' with explicit timeouts (NEST-LIB-07)." },
        { name: 'Intl', message: 'No locale logic in the core (NEST-I18N-05).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Configuration only in src/platform/config (NODE-ARCH-12).' },
        ...[
          'toLocaleString',
          'toLocaleDateString',
          'toLocaleTimeString',
          'localeCompare',
          'toLocaleUpperCase',
          'toLocaleLowerCase',
        ].map((property) => ({
          property,
          message: 'Locale-dependent: format or translate in an adapter (NEST-I18N-05).',
        })),
      ],
    },
  },
  {
    // NEST-SEC-27: request schemas never carry owner, tenant, role or audit fields
    files: ['src/**/adapter/in/rest/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        noDynamicImport,
        {
          selector:
            'VariableDeclarator[id.name=/Request$/] Property[key.name=/^(ownerId|tenantId|role|roles|permissions|createdBy|createdAt)$/]',
          message: 'Set by the server from the Caller, never by the request (NEST-SEC-27).',
        },
      ],
    },
  },
  {
    files: ['src/platform/config/**/*.ts', 'src/instrumentation.ts', '**/*.test.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': ['error', { paths: noCodeExecution }],
      'security/detect-non-literal-fs-filename': 'off', // mounted secret files, test fixtures
    },
  },
  {
    files: ['**/*.test.ts', 'test/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off',
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
