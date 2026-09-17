// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** Formatting is Prettier's job — `eslint-config-prettier` last, so no rule fights the formatter. */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "apps/api/drizzle/**",
      "pnpm-lock.yaml",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Imports use the per-package alias (@api/, @web/, @shared/) rather than
      // walking up the tree, so a file can move without rewriting its imports.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./*"],
              message:
                "Use the package alias instead of a relative path: @api/… in apps/api, @web/… in apps/web, @shared/… in packages/shared, @ui/… in packages/ui.",
            },
          ],
        },
      ],
      // Money is never a float and IDs are strings — but where numbers do appear,
      // keep implicit coercion out of the codebase.
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    files: ["apps/api/**/*.ts"],
    rules: {
      // Nest resolves constructor dependencies from `emitDecoratorMetadata`, which `import type`
      // erases — so the rule is off for the API.
      "@typescript-eslint/consistent-type-imports": "off",
      // Nest modules are legitimately empty classes.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },

  {
    /* The library is a package, not a folder of the app: it may be copied into another product, so
       it must compile with no app in the tree at all. The rule is the boundary — the alias would
       resolve, and a single `@web/…` import is what turns a library back into a folder. */
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./*"],
              message: "Use the @ui/… alias instead of a relative path.",
            },
            {
              group: ["@web/*", "@api/*", "@clinic/web", "@clinic/api"],
              message:
                "packages/ui must not import from an app. Move the shared piece into packages/ui, or pass it in as a prop.",
            },
          ],
        },
      ],
    },
  },

  {
    // The public booking entry is a wall: one import of a dashboard component drags in Radix, the
    // router and the auth module. It shares `@clinic/shared` and the stylesheet, nothing else.
    files: ["apps/web/src/booking/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./*"],
              message: "Use the @web/… alias instead of a relative path.",
            },
            {
              group: [
                "@web/features/*",
                "@web/components/*",
                "@web/app/*",
                "@web/lib/*",
                "@web/i18n*",
                "@web/App",
                "@clinic/ui",
                "@clinic/ui/*",
              ],
              message:
                "The booking entry ships its own bundle and must not import the dashboard app or the UI library. Write what it needs under src/booking, or move the shared piece to a token file.",
            },
            {
              group: [
                "@tanstack/*",
                "react-router*",
                "react-i18next",
                "i18next",
                "react-hook-form",
                "@hookform/*",
                "@radix-ui/*",
                "lucide-react",
                "date-fns",
                "react-day-picker",
                "tailwind-merge",
              ],
              message:
                "Not in the booking bundle: it has an 80 KB gzip budget and none of these earn their weight on a one-page form.",
            },
          ],
        },
      ],
    },
  },

  {
    /* And the other way: the dashboard has no business reaching into the
       booking entry either — a shared piece belongs in a shared place. */
    files: ["apps/web/src/!(booking)/**/*.{ts,tsx}", "apps/web/src/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./*"],
              message: "Use the @web/… alias instead of a relative path.",
            },
            {
              group: ["@web/booking/*"],
              message:
                "The booking entry is a separate bundle; move anything shared out of it rather than importing from it.",
            },
            {
              /* The package's own alias resolves here, because the app compiles its source. Using
                 it would tie the app to the library's internal layout rather than its exports. */
              group: ["@ui/*"],
              message:
                "Import the library by its package name — @clinic/ui, @clinic/ui/components/… — never by its internal alias.",
            },
          ],
        },
      ],
    },
  },

  {
    // Config files legitimately reference sibling paths, and `apps/web/vite/` runs in the Vite
    // process where the `@web/…` alias does not exist yet.
    files: ["**/*.config.{ts,mts,mjs,js}", "eslint.config.mjs", "apps/web/vite/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  {
    files: ["docker/**/*.js", "scripts/**/*.mjs", "apps/*/scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", fetch: "readonly", process: "readonly" },
    },
    rules: {
      "no-console": "off",
    },
  },

  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "no-console": "off",
    },
  },

  {
    // Standalone scripts run outside Nest and log to stdout by design.
    files: ["apps/api/src/database/migrate.ts", "apps/api/src/database/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },

  prettier,
);
