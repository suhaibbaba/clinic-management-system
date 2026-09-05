import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration. Generated SQL is committed under ./drizzle and an
 * applied migration is never edited (CLAUDE.md) — corrections are new migrations.
 *
 * Usage: pnpm --filter @clinic/api db:generate
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  strict: true,
  verbose: true,
});
