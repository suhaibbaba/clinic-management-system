import type { PersonName } from '@clinic/shared';
import { and, asc, count, eq, isNull, ne, or, type InferInsertModel } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { clinics, users } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

/** Everything the row needs beyond the two things that identify it. */
type ClinicDefaults = Omit<
  InferInsertModel<typeof clinics>,
  'nameAr' | 'nameEn' | 'slug' | 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface SeedClinicSpec {
  readonly slug: string;
  readonly name: PersonName;
  /** Used only when there is nothing to adopt. */
  readonly defaults: ClinicDefaults;
}

export interface SeedClinicResult {
  readonly id: string;
  /** Lines for the seed's report — empty on a database that was already right. */
  readonly notes: readonly string[];
}

/**
 * The one clinic the seed maintains, found however it was last written.
 *
 * **Why this is not a lookup by slug.** It was, and that is what broke the
 * sandbox. `0005` gave every existing clinic a slug derived from its name, so
 * a database seeded before that migration holds `al-nour-dental-clinic` where
 * the seed now says `al-nour`; the lookup missed, the seed created a *second*
 * clinic, and then — because accounts are matched by phone, which is unique
 * across the system, not per clinic — it reused the first clinic's doctors and
 * collided with the first clinic's appointments on `appointments_no_overlap`.
 * The API container exits on a failed seed, so a mismatched string took a
 * deployment down.
 *
 * So the clinic is matched on any of the three things that name it — its slug
 * or either spelling of its name — and the oldest match wins, because a
 * duplicate is always the newer row. Its slug is then brought back into line,
 * so the drift is repaired rather than carried for ever; its *name* is left
 * exactly as it is, because that is a thing a practice edits about itself.
 */
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
  // Whatever else is sitting on the slug the seed wants.
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

/** A live clinic other than `exceptId` holding `slug`, if there is one. */
async function clinicOnSlug(db: Db, slug: string, exceptId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(and(isNull(clinics.deletedAt), eq(clinics.slug, slug), ne(clinics.id, exceptId)))
    .limit(1);

  return row?.id;
}

/**
 * A clinic on the seed's slug that nobody can sign into.
 *
 * Exactly the wreckage the lookup-by-slug bug left behind: a second clinic,
 * created because the first was not recognised, carrying seeded demo rows and
 * **no users at all** — every account stayed with the original clinic, since
 * accounts are matched by phone. That last part is the whole condition. A
 * clinic with even one account is somebody's, and the seed leaves it alone.
 *
 * Soft-deleted, like everything else in this system, so the rows are still
 * there to look at if the diagnosis was wrong.
 */
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
