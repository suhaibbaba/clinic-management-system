import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { SPECIALTY_CODE, type SpecialtyCode } from "@clinic/shared";
import { validateEnv } from "@api/config/env.schema";
import * as schema from "@api/database/schema";
import { clinics, specialties } from "@api/database/schema";
import { grantSpecialty, revokeSpecialty } from "@api/database/clinic-specialties";

const CODES = Object.values(SPECIALTY_CODE) as readonly string[];
const ACTIONS = ["list", "enable", "disable"] as const;

const USAGE = [
  "Usage:",
  "  node dist/database/clinic-specialty.js list",
  "  node dist/database/clinic-specialty.js enable <clinic slug or id> <specialty>",
  "  node dist/database/clinic-specialty.js disable <clinic slug or id> <specialty>",
  `Specialties: ${CODES.join(", ")}`,
].join("\n");

async function main(): Promise<void> {
  const [action, clinic, code] = process.argv.slice(2);

  if (
    !ACTIONS.includes(action as (typeof ACTIONS)[number]) ||
    (action !== "list" && (!clinic || !CODES.includes(code ?? "")))
  ) {
    throw new Error(USAGE);
  }

  const env = validateEnv(process.env);
  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    if (action === "list") {
      const rows = await db
        .select({ slug: clinics.slug, nameEn: clinics.nameEn, code: specialties.code })
        .from(clinics)
        .leftJoin(
          specialties,
          and(
            eq(specialties.clinicId, clinics.id),
            eq(specialties.isActive, true),
            isNull(specialties.deletedAt),
          ),
        )
        .where(isNull(clinics.deletedAt))
        .orderBy(asc(clinics.createdAt), asc(specialties.code));

      const byClinic = new Map<string, { nameEn: string; codes: string[] }>();
      for (const row of rows) {
        const entry = byClinic.get(row.slug) ?? { nameEn: row.nameEn, codes: [] };
        if (row.code) {
          entry.codes.push(row.code);
        }
        byClinic.set(row.slug, entry);
      }

      for (const [slug, entry] of byClinic) {
        console.log(`${slug}\t${entry.nameEn}\t${entry.codes.join(", ") || "-"}`);
      }

      return;
    }

    const isId = /^[0-9a-f-]{36}$/i.test(clinic ?? "");
    const [target] = await db
      .select({ id: clinics.id, slug: clinics.slug })
      .from(clinics)
      .where(
        and(
          isNull(clinics.deletedAt),
          isId ? eq(clinics.id, clinic ?? "") : eq(clinics.slug, clinic ?? ""),
        ),
      )
      .limit(1);

    if (!target) {
      throw new Error(`No clinic matches "${clinic}".`);
    }

    const specialty = code as SpecialtyCode;

    if (action === "enable") {
      const result = await db.transaction((tx) => grantSpecialty(tx, target.id, specialty));

      console.log(
        [
          `${target.slug}: ${specialty} ${result.granted ? "enabled" : "was already enabled"}`,
          `  ${result.procedures} starter procedures added, priced 0 and switched off until priced`,
          `  ${result.lookups} starter list entries added`,
          "Takes effect on the next sign-in or page load.",
        ].join("\n"),
      );
    } else {
      const revoked = await revokeSpecialty(db, target.id, specialty);

      console.log(
        revoked
          ? `${target.slug}: ${specialty} disabled. Its procedures and records stay.`
          : `${target.slug}: ${specialty} was not enabled.`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
