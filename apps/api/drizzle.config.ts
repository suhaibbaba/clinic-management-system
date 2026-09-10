import { defineConfig } from 'drizzle-kit';

// Generated SQL is committed under ./drizzle; an applied migration is never edited — corrections
// are new migrations.
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
