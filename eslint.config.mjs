// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config for every workspace package. Formatting is Prettier's job
 * (`eslint-config-prettier` last, so no rule fights the formatter).
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/api/drizzle/**',
      'pnpm-lock.yaml',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Imports use the per-package alias (@api/, @web/, @shared/) rather than
      // walking up the tree, so a file can move without rewriting its imports.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', './*'],
              message:
                'Use the package alias instead of a relative path: @api/… in apps/api, @web/… in apps/web, @shared/… in packages/shared.',
            },
          ],
        },
      ],
      // Money is never a float and IDs are strings — but where numbers do appear,
      // keep implicit coercion out of the codebase.
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['apps/api/**/*.ts'],
    rules: {
      // Nest resolves constructor dependencies from `emitDecoratorMetadata`.
      // Rewriting an injected class to `import type` erases that metadata and
      // breaks DI at runtime, so the rule is off for the API.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest modules are legitimately empty classes.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  {
    // Config files at a package root legitimately reference sibling paths.
    files: ['**/*.config.{ts,mts,mjs,js}', 'eslint.config.mjs'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    // Plain Node scripts that run outside a bundler or the Nest runtime.
    files: ['docker/**/*.js'],
    languageOptions: {
      globals: { console: 'readonly', fetch: 'readonly', process: 'readonly' },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    // Standalone scripts run outside Nest and log to stdout by design.
    files: ['apps/api/src/database/migrate.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
);
