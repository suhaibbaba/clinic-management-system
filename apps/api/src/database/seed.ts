import { hash } from "@node-rs/argon2";
import { USER_ROLE } from "@clinic/shared";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { validateEnv, type Env } from "@api/config/env.schema";
import * as schema from "@api/database/schema";
import { CLINIC_NAME } from "@api/database/seed/clinic";
import { seedDatabase, type SeedSummary } from "@api/database/seed/seed-database";
import { seedWebsite } from "@api/database/seed/website";
import { StorageService } from "@api/modules/storage/services/storage.service";

async function main(): Promise<void> {
  const env = validateEnv(process.env);

  if (env.NODE_ENV === "production" && process.env.SEED_ON_BOOT !== "true") {
    throw new Error("Refusing to seed a production database");
  }

  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  const startedAt = Date.now();

  try {
    const passwordHash = await hash(env.SEED_PASSWORD, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const summary = await seedDatabase(db, { passwordHash });
    const website = await seedWebsiteSafely(
      db,
      new StorageService(new ConfigService<Env, true>(env)),
      summary,
    );

    report(
      { ...summary, notes: [...summary.notes, ...website] },
      env.SEED_PASSWORD,
      Date.now() - startedAt,
    );
  } finally {
    await client.end();
  }
}

async function seedWebsiteSafely(
  db: Parameters<typeof seedWebsite>[0],
  storage: StorageService,
  summary: SeedSummary,
): Promise<string[]> {
  const adminId = summary.accounts.find(({ account }) => account.role === USER_ROLE.ADMIN)?.id;

  if (!adminId) {
    return [];
  }

  try {
    return await seedWebsite(db, storage, {
      clinicId: summary.clinicId,
      adminId,
      doctorUserIds: summary.accounts
        .filter(({ account }) => account.role === USER_ROLE.DOCTOR)
        .map(({ id }) => id),
    });
  } catch (error: unknown) {
    return [`The website, logo and photos were not seeded: ${String(error)}`];
  } finally {
    storage.onApplicationShutdown();
  }
}

function report(summary: SeedSummary, password: string, elapsedMs: number): void {
  const rows = Object.entries(summary.counts)
    .filter(([, value]) => value > 0)
    .map(([table, value]) => `  ${table.padEnd(22)} ${String(value).padStart(6)}`);

  const lines = [
    "",
    `Seeded clinic: ${CLINIC_NAME.en} (${CLINIC_NAME.ar})`,
    "",
    'Sign in at POST /auth/login with the phone or the email as "identifier":',
    "",
    ...summary.accounts.map(
      ({ account }) => `  ${account.role.padEnd(13)} ${account.phone}  ${account.email}`,
    ),
    "",
    `  password (all accounts): ${password}`,
    "",
    ...(summary.created
      ? [`Wrote, in ${(elapsedMs / 1000).toFixed(1)}s:`, "", ...rows]
      : ["The clinic already holds patients — nothing was written."]),
    ...(summary.notes.length > 0 ? ["", ...summary.notes] : []),
    "",
    "Development credentials only — change SEED_PASSWORD before any shared environment.",
    "",
  ];

  console.log(lines.join("\n"));
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
