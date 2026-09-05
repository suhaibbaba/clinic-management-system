import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';

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
    await migrate(drizzle(client), { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
