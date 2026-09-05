import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Applies migrations once before the suites run. */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to run the API tests. Start the stack with `docker compose up` ' +
        'and run them inside the api container, or point DATABASE_URL at a scratch Postgres.',
    );
  }

  // `onnotice` silences the "already exists, skipping" notices on re-runs.
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: join(__dirname, '..', 'drizzle'),
    });
  } finally {
    await client.end();
  }
}
