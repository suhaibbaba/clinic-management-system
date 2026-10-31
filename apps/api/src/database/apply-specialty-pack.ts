import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { SPECIALTY_CODE, type SpecialtyCode } from "@clinic/shared";
import { validateEnv } from "@api/config/env.schema";
import * as schema from "@api/database/schema";
import { clinics } from "@api/database/schema";
import { applySpecialtyPack, hasSpecialtyPack } from "@api/database/specialty-packs/specialty-pack";

const CODES = Object.values(SPECIALTY_CODE) as readonly string[];

async function main(): Promise<void> {
  const [slug, code] = process.argv.slice(2);

  if (!slug || !code || !CODES.includes(code) || !hasSpecialtyPack(code as SpecialtyCode)) {
    throw new Error(
      `Usage: node dist/database/apply-specialty-pack.js <clinic slug> <specialty>\n` +
        `Specialties with a pack: ${CODES.filter((entry) => hasSpecialtyPack(entry as SpecialtyCode)).join(", ")}`,
    );
  }

  const env = validateEnv(process.env);
  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [clinic] = await db
      .select({ id: clinics.id, nameEn: clinics.nameEn })
      .from(clinics)
      .where(and(eq(clinics.slug, slug), isNull(clinics.deletedAt)))
      .limit(1);

    if (!clinic) {
      throw new Error(`No clinic with the slug "${slug}"`);
    }

    const result = await db.transaction((tx) =>
      applySpecialtyPack(tx, clinic.id, code as SpecialtyCode),
    );

    console.log(
      [
        "",
        `${code} starter pack for ${clinic.nameEn}:`,
        `  ${result.procedures} procedures added, priced 0 and switched off until priced`,
        `  ${result.lookups} list entries added`,
        "  Anything the clinic already had, or had deleted, was left as it is.",
        "",
      ].join("\n"),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Specialty pack failed:", error);
  process.exit(1);
});
