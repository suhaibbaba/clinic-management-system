import { and, eq, isNull } from "drizzle-orm";
import { USER_ROLE, joinPersonName } from "@clinic/shared";
import type { Database, DatabaseExecutor } from "@api/database/database.module";
import { clinics, users } from "@api/database/schema";
import type { BootstrapEnv } from "@api/database/bootstrap/bootstrap-env";
import { grantSpecialty } from "@api/database/clinic-specialties";

export interface BootstrapResult {
  readonly clinicId: string;
  readonly createdClinic: boolean;
  readonly createdAdmin: boolean;
  readonly notes: readonly string[];
}

export async function bootstrapClinic(
  db: Database,
  env: BootstrapEnv,
  passwordHash: string | null,
): Promise<BootstrapResult> {
  return db.transaction(async (tx) => {
    const notes: string[] = [];
    const [existing] = await tx
      .select({ id: clinics.id })
      .from(clinics)
      .where(and(eq(clinics.slug, env.BOOTSTRAP_CLINIC_SLUG), isNull(clinics.deletedAt)))
      .limit(1);

    const clinicId = existing?.id ?? (await createClinic(tx, env));

    if (existing) {
      notes.push(
        `Clinic "${env.BOOTSTRAP_CLINIC_SLUG}" already exists — its name, modules and domain were left as they are.`,
      );
    }

    for (const code of env.BOOTSTRAP_SPECIALTIES) {
      const grant = await grantSpecialty(tx, clinicId, code);

      if (existing && grant.granted) {
        notes.push(`Enabled the ${code} specialty.`);
      }

      if (grant.procedures + grant.lookups > 0) {
        notes.push(
          `Added the ${code} starter pack: ${grant.procedures} procedures (priced 0 and switched off until priced) and ${grant.lookups} list entries.`,
        );
      }
    }

    const createdAdmin = await ensureAdmin(tx, clinicId, env, passwordHash);

    if (!createdAdmin) {
      notes.push("The clinic already has an admin — no account was created or changed.");
    }

    return { clinicId, createdClinic: !existing, createdAdmin, notes };
  });
}

async function createClinic(db: DatabaseExecutor, env: BootstrapEnv): Promise<string> {
  const [row] = await db
    .insert(clinics)
    .values({
      slug: env.BOOTSTRAP_CLINIC_SLUG,
      name: { ar: env.BOOTSTRAP_CLINIC_NAME_AR, en: env.BOOTSTRAP_CLINIC_NAME_EN },
      siteDomain: env.BOOTSTRAP_SITE_DOMAIN ?? null,
      currency: env.BOOTSTRAP_CURRENCY,
      country: env.BOOTSTRAP_COUNTRY,
      modules: env.BOOTSTRAP_MODULES,
      settings: { timezone: env.BOOTSTRAP_TIMEZONE },
    })
    .returning({ id: clinics.id });

  if (!row) {
    throw new Error("Failed to create the clinic");
  }

  return row.id;
}

async function ensureAdmin(
  db: DatabaseExecutor,
  clinicId: string,
  env: BootstrapEnv,
  passwordHash: string | null,
): Promise<boolean> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.clinicId, clinicId), eq(users.role, USER_ROLE.ADMIN), isNull(users.deletedAt)),
    )
    .limit(1);

  if (admin) {
    return false;
  }

  const firstName = {
    ar: env.BOOTSTRAP_ADMIN_FIRST_NAME_AR,
    en: env.BOOTSTRAP_ADMIN_FIRST_NAME_EN,
  };
  const lastName = { ar: env.BOOTSTRAP_ADMIN_LAST_NAME_AR, en: env.BOOTSTRAP_ADMIN_LAST_NAME_EN };

  await db.insert(users).values({
    clinicId,
    firstName,
    lastName,
    name: joinPersonName(firstName, lastName),
    phone: env.BOOTSTRAP_ADMIN_PHONE,
    email: env.BOOTSTRAP_ADMIN_EMAIL ?? null,
    passwordHash,
    role: USER_ROLE.ADMIN,
  });

  return true;
}
