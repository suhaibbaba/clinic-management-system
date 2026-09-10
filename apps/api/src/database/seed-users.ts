import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import type { PersonName, UserRole } from '@clinic/shared';

import { users } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface SeedAccount {
  readonly role: UserRole;
  readonly name: PersonName;
  readonly phone: string;
  readonly email: string;
}

export interface UpsertUserResult {
  readonly id: string;
  readonly notes: readonly string[];
}

// Matched on either identifier, email winning, because matching on the phone alone missed when the
// seeded numbers moved and the insert hit `users_email_uniq`. The drifted one is then rewritten.
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
    // Accounts are unique system-wide, not per clinic, so an account in another clinic means the
    // clinic lookup adopted the wrong row.
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
