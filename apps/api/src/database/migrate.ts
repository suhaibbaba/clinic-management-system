import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { validateEnv } from "@api/config/env.schema";
import { ensureSystemLookups } from "@api/database/system-lookups";
import { ensureAppRole } from "@api/database/app-role";

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const migrationsFolder =
    process.env["MIGRATIONS_FOLDER"] ?? join(__dirname, "..", "..", "drizzle");

  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });

  try {
    const db = drizzle(client);

    await migrate(db, { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);

    const written = await ensureSystemLookups(db);
    console.log(`System lookup rows ensured (${written} across all clinics)`);

    if (env.APP_DATABASE_ROLE && env.APP_DATABASE_PASSWORD) {
      await ensureAppRole(client, env.APP_DATABASE_ROLE, env.APP_DATABASE_PASSWORD);
      console.log(`Application role ${env.APP_DATABASE_ROLE} ensured`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
