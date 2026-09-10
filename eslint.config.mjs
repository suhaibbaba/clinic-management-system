// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/** Formatting is Prettier's job — `eslint-config-prettier` last, so no rule fights the formatter. */
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
      // Nest resolves constructor dependencies from `emitDecoratorMetadata`, which `import type`
      // erases — so the rule is off for the API.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest modules are legitimately empty classes.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  {
    // The public booking entry is a wall: one import of a dashboard component drags in Radix, the
    // router and the auth module. It shares `@clinic/shared` and the stylesheet, nothing else.
    files: ['apps/web/src/booking/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', './*'],
              message: 'Use the @web/… alias instead of a relative path.',
            },
            {
              group: [
                '@web/features/*',
                '@web/components/*',
                '@web/app/*',
                '@web/lib/*',
                '@web/i18n*',
                '@web/App',
              ],
              message:
                'The booking entry ships its own bundle and must not import the dashboard app. Write what it needs under src/booking, or move the shared piece to a token file.',
            },
            {
              group: [
                '@tanstack/*',
                'react-router*',
                'react-i18next',
                'i18next',
                'react-hook-form',
                '@hookform/*',
                '@radix-ui/*',
                'lucide-react',
                'date-fns',
                'react-day-picker',
                'tailwind-merge',
              ],
              message:
                'Not in the booking bundle: it has an 80 KB gzip budget and none of these earn their weight on a one-page form.',
            },
          ],
        },
      ],
    },
  },

  {
    /* And the other way: the dashboard has no business reaching into the
       booking entry either — a shared piece belongs in a shared place. */
    files: ['apps/web/src/!(booking)/**/*.{ts,tsx}', 'apps/web/src/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', './*'],
              message: 'Use the @web/… alias instead of a relative path.',
            },
            {
              group: ['@web/booking/*'],
              message:
                'The booking entry is a separate bundle; move anything shared out of it rather than importing from it.',
            },
          ],
        },
      ],
    },
  },

  {
    // Config files legitimately reference sibling paths, and `apps/web/vite/` runs in the Vite
    // process where the `@web/…` alias does not exist yet.
    files: ['**/*.config.{ts,mts,mjs,js}', 'eslint.config.mjs', 'apps/web/vite/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    files: ['docker/**/*.js', 'scripts/**/*.mjs', 'apps/web/scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', fetch: 'readonly', process: 'readonly' },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    // The QA sweep and the smoke run sit outside every workspace, so there is no `@web/…` alias —
    // and half of `qa-screens.mjs` is serialised into the browser.
    files: ['scripts/qa-screens.mjs', 'scripts/qa/**/*.mjs', 'tests/e2e/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        process: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-restricted-imports': 'off',
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
