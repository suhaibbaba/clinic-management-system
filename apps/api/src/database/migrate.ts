import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import { ensureSystemLookups } from '@api/database/system-lookups';

/**
 * Standalone migration runner. Production containers run this before the API
 * starts listening (see docker-compose.prod.yml), so a deploy never serves
 * traffic against an un-migrated database.
 */
async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const migrationsFolder =
    process.env['MIGRATIONS_FOLDER'] ?? join(__dirname, '..', '..', 'drizzle');

  // A single, non-pooled connection: migrations must not run concurrently.
  const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    const db = drizzle(client);

    await migrate(db, { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);

    /*
     * The row half of the enums-to-lookups migration.
     *
     * The SQL widened the columns and kept their values; this puts a row
     * behind each of those values for every clinic, keyed by the same code.
     * It lives here rather than in the `.sql` file so the built-in lists have
     * exactly one definition — `SYSTEM_LOOKUPS` in the shared package — which
     * the API, the seed and this runner all read.
     */
    const written = await ensureSystemLookups(db);
    console.log(`System lookup rows ensured (${written} across all clinics)`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
