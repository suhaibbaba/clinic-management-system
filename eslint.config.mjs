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
      '**/storybook-static/**',
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
    /*
     * The public booking entry is a wall, not a folder.
     *
     * It is a second bundle with its own gzip budget, opened on a phone from a
     * WhatsApp link. One import of a dashboard component drags in Radix, the
     * router, the query client and the auth module — none of which shows up in
     * review as anything worse than a tidy-looking import line, and all of
     * which shows up for the patient as a slower page.
     *
     * So the boundary is enforced here rather than remembered, and again in CI
     * by the size check. `@web/assets` is allowed through: the logo is the one
     * thing the two entries are *meant* to share, along with the CSS tokens.
     */
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
                'The booking entry ships its own bundle and must not import the dashboard app. Write what it needs under src/booking, or move the shared piece to src/assets or a token file.',
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
    // Config files at a package root legitimately reference sibling paths.
    files: ['**/*.config.{ts,mts,mjs,js}', 'eslint.config.mjs'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    // Plain Node scripts that run outside a bundler or the Nest runtime.
    files: ['docker/**/*.js', 'apps/web/scripts/**/*.mjs'],
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
