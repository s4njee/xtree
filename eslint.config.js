import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      '.cache/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The library itself runs in browsers and must not depend on Node.
    files: ['packages/xtree/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['node:*', '@mk7s/holocss', '@mk7s/holocss/*'] },
      ],
    },
  },
);
