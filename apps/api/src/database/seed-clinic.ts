import type { PersonName } from '@clinic/shared';
import { and, asc, count, eq, isNull, ne, or, type InferInsertModel } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { clinics, users } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

type ClinicDefaults = Omit<
  InferInsertModel<typeof clinics>,
  'nameAr' | 'nameEn' | 'slug' | 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface SeedClinicSpec {
  readonly slug: string;
  readonly name: PersonName;
  readonly defaults: ClinicDefaults;
}

export interface SeedClinicResult {
  readonly id: string;
  readonly notes: readonly string[];
}

// Not a lookup by slug: `0005` derived slugs from names, so an older database holds a different one
// and the seed made a second clinic. Matched on slug or either name, oldest wins.
export async function upsertSeedClinic(db: Db, spec: SeedClinicSpec): Promise<SeedClinicResult> {
  const [adopted] = await db
    .select({ id: clinics.id, slug: clinics.slug })
    .from(clinics)
    .where(
      and(
        isNull(clinics.deletedAt),
        or(
          eq(clinics.slug, spec.slug),
          eq(clinics.nameAr, spec.name.ar),
          eq(clinics.nameEn, spec.name.en),
        ),
      ),
    )
    .orderBy(asc(clinics.createdAt))
    .limit(1);

  if (!adopted) {
    const [row] = await db
      .insert(clinics)
      .values({
        ...spec.defaults,
        nameAr: spec.name.ar,
        nameEn: spec.name.en,
        slug: spec.slug,
      })
      .returning({ id: clinics.id });

    if (!row) {
      throw new Error('Failed to create the seed clinic');
    }

    return { id: row.id, notes: [] };
  }

  const notes: string[] = [];
  const squatter = await clinicOnSlug(db, spec.slug, adopted.id);

  // Retire before renaming: the unique index on the slug covers live rows, so
  // the squatter has to go first for the real clinic to take its handle back.
  if (squatter && (await retireStray(db, squatter))) {
    notes.push(
      `Retired an empty duplicate clinic that was holding the slug "${spec.slug}" — it had no ` +
        'accounts, so nobody could reach it. Its rows are soft-deleted, not removed.',
    );
  } else if (squatter) {
    // A clinic with staff of its own. The seed does not take a handle off a
    // practice somebody is using, so the adopted row keeps the slug it has.
    return { id: adopted.id, notes };
  }

  if (adopted.slug !== spec.slug) {
    await db
      .update(clinics)
      .set({ slug: spec.slug, updatedAt: new Date() })
      .where(eq(clinics.id, adopted.id));

    notes.push(`Renamed the clinic's booking slug from "${adopted.slug}" to "${spec.slug}".`);
  }

  return { id: adopted.id, notes };
}

async function clinicOnSlug(db: Db, slug: string, exceptId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(and(isNull(clinics.deletedAt), eq(clinics.slug, slug), ne(clinics.id, exceptId)))
    .limit(1);

  return row?.id;
}

// The wreckage of that bug: a second clinic with seeded rows and no users at all, since accounts
// are matched by phone. One account means it is somebody's, and the seed leaves it alone.
async function retireStray(db: Db, strayId: string): Promise<boolean> {
  const [{ value: accounts } = { value: 0 }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.clinicId, strayId), isNull(users.deletedAt)));

  if (accounts > 0) {
    return false;
  }

  await db
    .update(clinics)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(clinics.id, strayId));

  return true;
}
