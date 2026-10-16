import { USER_ROLE } from "@clinic/shared";
import { ConfigService } from "@nestjs/config";
import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { validateEnv, type Env } from "@api/config/env.schema";
import * as schema from "@api/database/schema";
import { clinics, doctors, users } from "@api/database/schema";
import { seedWebsite } from "@api/database/seed/website";
import { StorageService } from "@api/modules/storage/services/storage.service";

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const slug = process.argv[2];
  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  const storage = new StorageService(new ConfigService<Env, true>(env));

  try {
    const live = await db
      .select({ id: clinics.id, slug: clinics.slug })
      .from(clinics)
      .where(
        slug ? and(isNull(clinics.deletedAt), eq(clinics.slug, slug)) : isNull(clinics.deletedAt),
      )
      .limit(2);

    const [clinic] = live;

    if (!clinic || live.length > 1) {
      throw new Error(
        slug
          ? `No live clinic has the slug "${slug}"`
          : "Name the clinic by its slug: there is not exactly one live clinic",
      );
    }

    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.clinicId, clinic.id),
          eq(users.role, USER_ROLE.ADMIN),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(users.createdAt))
      .limit(1);

    if (!admin) {
      throw new Error(`The clinic "${clinic.slug}" has no admin to publish as`);
    }

    const doctorRows = await db
      .select({ userId: doctors.userId })
      .from(doctors)
      .where(and(eq(doctors.clinicId, clinic.id), isNull(doctors.deletedAt)))
      .orderBy(asc(doctors.createdAt));

    const notes = await seedWebsite(db, storage, {
      clinicId: clinic.id,
      adminId: admin.id,
      doctorUserIds: doctorRows.map((row) => row.userId),
      replaceContent: true,
      withDoctorPhotos: false,
    });

    console.log(
      [`Sample website for ${clinic.slug}:`, ...notes.map((note) => `  ${note}`)].join("\n"),
    );
  } finally {
    storage.onApplicationShutdown();
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Applying the sample website failed:", error);
  process.exit(1);
});
