import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import { ensureSystemLookups } from '@api/database/system-lookups';

// Production containers run this before the API listens, so a deploy never serves traffic against
// an un-migrated database.
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

    // The row half of the enums-to-lookups migration. Here rather than in the `.sql` so the built-
    // in lists have one definition, `SYSTEM_LOOKUPS`.
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
