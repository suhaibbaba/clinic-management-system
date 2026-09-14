import { hash } from '@node-rs/argon2';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import * as schema from '@api/database/schema';
import { CLINIC_NAME } from '@api/database/seed/clinic';
import { seedDatabase, type SeedSummary } from '@api/database/seed/seed-database';

async function main(): Promise<void> {
  const env = validateEnv(process.env);

  if (env.NODE_ENV === 'production' && process.env.SEED_ON_BOOT !== 'true') {
    throw new Error('Refusing to seed a production database');
  }

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  const startedAt = Date.now();

  try {
    const passwordHash = await hash(env.SEED_PASSWORD, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const summary = await seedDatabase(db, { passwordHash });

    report(summary, env.SEED_PASSWORD, Date.now() - startedAt);
  } finally {
    await client.end();
  }
}

function report(summary: SeedSummary, password: string, elapsedMs: number): void {
  const rows = Object.entries(summary.counts)
    .filter(([, value]) => value > 0)
    .map(([table, value]) => `  ${table.padEnd(22)} ${String(value).padStart(6)}`);

  const lines = [
    '',
    `Seeded clinic: ${CLINIC_NAME.en} (${CLINIC_NAME.ar})`,
    '',
    'Sign in at POST /auth/login with the phone or the email as "identifier":',
    '',
    ...summary.accounts.map(
      ({ account }) => `  ${account.role.padEnd(13)} ${account.phone}  ${account.email}`,
    ),
    '',
    `  password (all accounts): ${password}`,
    '',
    ...(summary.created
      ? [`Wrote, in ${(elapsedMs / 1000).toFixed(1)}s:`, '', ...rows]
      : ['The clinic already holds patients — nothing was written.']),
    ...(summary.notes.length > 0 ? ['', ...summary.notes] : []),
    '',
    'Development credentials only — change SEED_PASSWORD before any shared environment.',
    '',
  ];

  console.log(lines.join('\n'));
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
