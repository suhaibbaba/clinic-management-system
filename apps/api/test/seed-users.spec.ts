import { randomUUID } from 'node:crypto';

import { USER_ROLE } from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import { clinics, users } from '@api/database/schema';
import { upsertUser, type SeedAccount } from '@api/database/seed-users';

/**
 * The seed has to recognise the account it seeded last time.
 *
 * It stopped doing so, and the cost was the sandbox. The lookup was on the
 * phone alone; the day the seeded numbers moved from `+963` to `+970` it
 * missed, the seed tried to *insert* an account that was already there, and
 * `users_email_uniq` rejected it. A failed seed exits the API container, so a
 * changed string in a constant took the deployment down — the same shape as
 * the duplicate-clinic bug one table over, and the reason both of these are
 * tested against a real database rather than a mock: the whole bug lived in
 * what a `where` clause did or did not match.
 */
describe('the seed accounts', () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  let clinicId: string;

  beforeAll(async () => {
    const databaseUrl = process.env['DATABASE_URL'];

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to run the API tests.');
    }

    client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    db = drizzle(client);

    const handle = `seed-users-${randomUUID().slice(0, 8)}`;
    const [row] = await db
      .insert(clinics)
      .values({
        nameAr: `عيادة ${handle}`,
        nameEn: `Clinic ${handle}`,
        slug: handle,
        currency: 'ILS',
        workingHours: [],
        settings: {},
      })
      .returning({ id: clinics.id });

    clinicId = row?.id ?? '';
  });

  afterAll(async () => {
    await client.end();
  });

  const HASH = '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNlZWQ$c2VlZHNlZWRzZWVkc2VlZHNlZWRzZWVk';

  /**
   * An account nobody else in the suite can collide with.
   *
   * Both identifiers are unique system-wide and this database is shared with
   * every other spec, so neither may be a literal — a hardcoded number is a
   * test that passes until something else in the run happens to take it.
   */
  let serial = 0;
  function account(overrides: Partial<SeedAccount> = {}): SeedAccount {
    const handle = randomUUID().slice(0, 8);
    const digits =
      String(Date.now() % 100_000).padStart(5, '0') + String(serial++).padStart(2, '0');

    return {
      role: USER_ROLE.ADMIN,
      name: { ar: 'مدير العيادة', en: 'Clinic Admin' },
      phone: `+97059${digits}`,
      email: `${handle}@clinic.local`,
      ...overrides,
    };
  }

  const read = async (id: string) => {
    const [row] = await db
      .select({ phone: users.phone, email: users.email, nameAr: users.nameAr })
      .from(users)
      .where(eq(users.id, id));

    return row;
  };

  it('creates the account when there is nothing to adopt', async () => {
    const target = account();

    const result = await upsertUser(db, clinicId, target, HASH);

    expect(result.notes).toEqual([]);
    expect(await read(result.id)).toMatchObject({ phone: target.phone, email: target.email });
  });

  it('adopts the same account when it is run again', async () => {
    const target = account();

    const first = await upsertUser(db, clinicId, target, HASH);
    const second = await upsertUser(db, clinicId, target, HASH);

    expect(second.id).toBe(first.id);
    expect(second.notes).toEqual([]);
  });

  /* The sandbox failure, reproduced: same email, the phone the seed used to use. */
  it('adopts an account whose phone the seed has since changed, and moves the phone', async () => {
    const before = account();
    const existing = await upsertUser(db, clinicId, before, HASH);

    // What the move from Damascus to Ramallah did to every seeded account.
    const after = { ...before, phone: before.phone.replace('+97059', '+96310') };
    const result = await upsertUser(db, clinicId, after, HASH);

    expect(result.id).toBe(existing.id);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain(after.phone);
    // Brought into line, so the credentials the report prints are the ones
    // that work — not a second account and a unique-constraint violation.
    expect(await read(existing.id)).toMatchObject({ phone: after.phone });
  });

  /* And the mirror image, so neither identifier is the only one that is looked at. */
  it('adopts an account whose email the seed has since changed, and moves the email', async () => {
    const before = account();
    const existing = await upsertUser(db, clinicId, before, HASH);

    const after = { ...before, email: `renamed-${before.email}` };
    const result = await upsertUser(db, clinicId, after, HASH);

    expect(result.id).toBe(existing.id);
    expect(await read(existing.id)).toMatchObject({ email: after.email });
  });

  /*
   * Both identifiers are unique system-wide, so "bring it into line" cannot be
   * unconditional: the seed says what it could not do rather than failing, and
   * rather than printing a sign-in that would not work.
   */
  it('leaves an identifier alone when another account holds it, and says so', async () => {
    const squatter = account();
    await upsertUser(db, clinicId, squatter, HASH);

    const target = account();
    const existing = await upsertUser(db, clinicId, target, HASH);

    const result = await upsertUser(db, clinicId, { ...target, phone: squatter.phone }, HASH);

    expect(result.id).toBe(existing.id);
    expect(result.notes[0]).toContain('held by another account');
    expect(await read(existing.id)).toMatchObject({ phone: target.phone });
  });

  it('leaves the name alone — that is a thing a practice edits about its own staff', async () => {
    const target = account();
    const existing = await upsertUser(db, clinicId, target, HASH);

    await db.update(users).set({ nameAr: 'اسم العيادة' }).where(eq(users.id, existing.id));
    await upsertUser(db, clinicId, target, HASH);

    expect(await read(existing.id)).toMatchObject({ nameAr: 'اسم العيادة' });
  });

  it('refuses an account that belongs to another clinic', async () => {
    const target = account();
    await upsertUser(db, clinicId, target, HASH);

    const [other] = await db
      .insert(clinics)
      .values({
        nameAr: 'عيادة أخرى',
        nameEn: 'Another clinic',
        slug: `other-${randomUUID().slice(0, 8)}`,
        currency: 'ILS',
        workingHours: [],
        settings: {},
      })
      .returning({ id: clinics.id });

    await expect(upsertUser(db, other?.id ?? '', target, HASH)).rejects.toThrow(
      /already belongs to clinic/,
    );
  });
});
