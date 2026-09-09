import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import type { PersonName, UserRole } from '@clinic/shared';

import { users } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

/** One of the accounts the seed maintains, one per role. */
export interface SeedAccount {
  readonly role: UserRole;
  readonly name: PersonName;
  readonly phone: string;
  readonly email: string;
}

export interface UpsertUserResult {
  readonly id: string;
  /** Lines for the seed's report — empty on a database that was already right. */
  readonly notes: readonly string[];
}

/**
 * The seed's own account, found however it was last written.
 *
 * **Why this matches on either identifier.** It matched on the phone alone, and
 * that is what broke the sandbox the day the seeded numbers moved from `+963`
 * to `+970`: the lookup missed, the seed tried to *insert* an account that was
 * already there, and `users_email_uniq` rejected it — which fails the seed,
 * which exits the API container, which takes the deployment down. The same
 * shape as the duplicate-clinic bug `upsertSeedClinic` documents, one table
 * over: a seeded row has two unique identifiers and recognising it by only one
 * of them means any future edit to the other one does this again.
 *
 * So an account is matched on **either** identifier, and the **email wins**
 * when the two disagree. That order is not arbitrary: the email is what names
 * an account in the report, in DEPLOY.md and in every conversation about it,
 * and it is the one that has never moved — the phone is the one that drifted,
 * so a row matching only by phone is the weaker claim. Taking the older row
 * instead, as the clinic lookup does, would be wrong here: asking for a phone
 * that another account already holds would adopt *that* account and start
 * rewriting its email.
 *
 * The identifier that drifted is then brought back into line, so the
 * credentials the report prints are the credentials that work. Both are unique
 * system-wide, so each is only rewritten when no other live account holds it;
 * when one is taken, the seed says so rather than printing a sign-in that
 * would fail.
 *
 * The names are left exactly as they are, for the same reason the clinic's are:
 * that is a thing a practice edits about its own staff.
 */
export async function upsertUser(
  db: Db,
  clinicId: string,
  account: SeedAccount,
  passwordHash: string,
): Promise<UpsertUserResult> {
  const matches = await db
    .select({ id: users.id, clinicId: users.clinicId, phone: users.phone, email: users.email })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        or(
          eq(users.phone, account.phone),
          eq(sql`lower(${users.email})`, account.email.toLowerCase()),
        ),
      ),
    )
    .orderBy(asc(users.createdAt))
    .limit(2);

  const existing =
    matches.find((row) => (row.email ?? '').toLowerCase() === account.email.toLowerCase()) ??
    matches[0];

  if (existing) {
    // An account that belongs somewhere else means the clinic lookup adopted
    // the wrong row — accounts are unique across the system rather than per
    // clinic, so carrying on would attach this clinic's demo data to another
    // clinic's staff. That is the shape of the duplicate-clinic bug
    // `upsertSeedClinic` exists to prevent, and it is worth saying out loud
    // rather than seeding a fork of the database.
    if (existing.clinicId !== clinicId) {
      throw new Error(
        `The seed account ${account.email} already belongs to clinic ${existing.clinicId}, ` +
          `not ${clinicId}. Refusing to seed a second clinic with the same staff.`,
      );
    }

    const notes: string[] = [];
    const changes: Partial<{ phone: string; email: string }> = {};

    if (existing.phone !== account.phone) {
      if (await identifierIsFree(db, users.phone, account.phone, existing.id)) {
        changes.phone = account.phone;
        notes.push(
          `Moved the ${account.role} account's phone from "${existing.phone}" to ` +
            `"${account.phone}" to match the seed.`,
        );
      } else {
        notes.push(
          `The ${account.role} account still signs in as "${existing.phone}": the seed's ` +
            `"${account.phone}" is held by another account.`,
        );
      }
    }

    if ((existing.email ?? '').toLowerCase() !== account.email.toLowerCase()) {
      if (await identifierIsFree(db, users.email, account.email, existing.id)) {
        changes.email = account.email;
        notes.push(
          `Moved the ${account.role} account's email from "${existing.email ?? '—'}" to ` +
            `"${account.email}" to match the seed.`,
        );
      } else {
        notes.push(
          `The ${account.role} account still signs in as "${existing.email ?? '—'}": the seed's ` +
            `"${account.email}" is held by another account.`,
        );
      }
    }

    // Keep the documented password working even if it changed in .env.
    await db
      .update(users)
      .set({ ...changes, passwordHash, updatedAt: new Date() })
      .where(eq(users.id, existing.id));

    return { id: existing.id, notes };
  }

  const [row] = await db
    .insert(users)
    .values({
      clinicId,
      nameAr: account.name.ar,
      nameEn: account.name.en,
      phone: account.phone,
      email: account.email,
      passwordHash,
      role: account.role,
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error(`Failed to create the seed ${account.role}`);
  }

  return { id: row.id, notes: [] };
}

/** True when no other live account holds this phone or email. */
async function identifierIsFree(
  db: Db,
  column: typeof users.phone | typeof users.email,
  value: string,
  exceptUserId: string,
): Promise<boolean> {
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(sql`lower(${column})`, value.toLowerCase()),
        ne(users.id, exceptUserId),
      ),
    )
    .limit(1);

  return clash === undefined;
}
