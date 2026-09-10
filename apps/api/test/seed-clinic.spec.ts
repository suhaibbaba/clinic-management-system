import { randomUUID } from 'node:crypto';

import { USER_ROLE, type PersonName } from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';

import { clinics, users } from '@api/database/schema';
import { upsertSeedClinic, type SeedClinicSpec } from '@api/database/seed-clinic';

// The seed must recognise the clinic it seeded last time; when the lookup moved to the slug it made
// a second clinic and died on `appointments_no_overlap`, taking the sandbox with it.
describe('the seed clinic', () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const databaseUrl = process.env['DATABASE_URL'];

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to run the API tests.');
    }

    client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    db = drizzle(client);
  });

  afterAll(async () => {
    await client.end();
  });

  function spec(): SeedClinicSpec {
    const handle = `seed-${randomUUID().slice(0, 8)}`;

    return {
      slug: handle,
      name: { ar: `عيادة ${handle}`, en: `Clinic ${handle}` } satisfies PersonName,
      defaults: {
        phone: '+963110000000',
        email: 'info@clinic.local',
        address: 'Damascus, Syria',
        currency: 'USD',
        workingHours: [],
        settings: {},
      },
    };
  }

  /** A clinic written the way an older seed wrote it, with a derived slug. */
  async function legacyClinic(target: SeedClinicSpec, slug: string): Promise<string> {
    const [row] = await db
      .insert(clinics)
      .values({
        ...target.defaults,
        nameAr: target.name.ar,
        nameEn: target.name.en,
        slug,
      })
      .returning({ id: clinics.id });

    if (!row) {
      throw new Error('Failed to insert the legacy clinic');
    }

    return row.id;
  }

  it('creates the clinic when there is nothing to adopt', async () => {
    const target = spec();

    const result = await upsertSeedClinic(db, target);

    expect(result.notes).toEqual([]);

    const [row] = await db
      .select({ slug: clinics.slug, nameAr: clinics.nameAr })
      .from(clinics)
      .where(eq(clinics.id, result.id));

    expect(row).toEqual({ slug: target.slug, nameAr: target.name.ar });
  });

  it('adopts the same clinic when it is run again', async () => {
    const target = spec();

    const first = await upsertSeedClinic(db, target);
    const second = await upsertSeedClinic(db, target);

    expect(second.id).toBe(first.id);
    expect(second.notes).toEqual([]);
  });

  it('adopts a clinic whose slug was derived from its name, and takes the slug back', async () => {
    const target = spec();
    // What `0005` left behind: the name matches, the slug does not.
    const legacyId = await legacyClinic(target, `${target.slug}-dental-clinic`);

    const result = await upsertSeedClinic(db, target);

    expect(result.id).toBe(legacyId);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain('booking slug');

    const [row] = await db
      .select({ slug: clinics.slug })
      .from(clinics)
      .where(eq(clinics.id, legacyId));

    expect(row?.slug).toBe(target.slug);
  });

  it('retires the empty duplicate a missed lookup created, and keeps the older clinic', async () => {
    const target = spec();
    // The sandbox, exactly: the real clinic under its derived slug, and the
    // duplicate the missed lookup created sitting on the slug the seed wants.
    const realId = await legacyClinic(target, `${target.slug}-dental-clinic`);
    const strayId = await legacyClinic(target, target.slug);

    // The real clinic is the one with the staff — that is what makes the
    // other one unreachable, and it is the whole condition for retiring it.
    await db.insert(users).values({
      clinicId: realId,
      nameAr: 'مسؤول',
      nameEn: 'Admin',
      phone: `+9639${Math.floor(Math.random() * 100_000_000)
        .toString()
        .padStart(8, '0')}`,
      email: `${randomUUID()}@clinic.local`,
      passwordHash: 'x',
      role: USER_ROLE.ADMIN,
    });

    const result = await upsertSeedClinic(db, target);

    expect(result.id).toBe(realId);
    expect(result.notes.join('\n')).toContain('Retired an empty duplicate');

    const [stray] = await db
      .select({ deletedAt: clinics.deletedAt })
      .from(clinics)
      .where(eq(clinics.id, strayId));

    expect(stray?.deletedAt).not.toBeNull();

    // And the real clinic ends up on the slug the booking link is printed with.
    const [real] = await db
      .select({ slug: clinics.slug })
      .from(clinics)
      .where(eq(clinics.id, realId));

    expect(real?.slug).toBe(target.slug);
  });

  it('leaves a duplicate alone once somebody can sign into it', async () => {
    const target = spec();
    const realId = await legacyClinic(target, `${target.slug}-dental-clinic`);
    const otherId = await legacyClinic(target, target.slug);

    await db.insert(users).values({
      clinicId: otherId,
      nameAr: 'مسؤول',
      nameEn: 'Admin',
      phone: `+9639${Math.floor(Math.random() * 100_000_000)
        .toString()
        .padStart(8, '0')}`,
      email: `${randomUUID()}@clinic.local`,
      passwordHash: 'x',
      role: USER_ROLE.ADMIN,
    });

    const result = await upsertSeedClinic(db, target);

    expect(result.id).toBe(realId);
    expect(result.notes).toEqual([]);

    const [other] = await db
      .select({ deletedAt: clinics.deletedAt, slug: clinics.slug })
      .from(clinics)
      .where(eq(clinics.id, otherId));

    expect(other?.deletedAt).toBeNull();
    expect(other?.slug).toBe(target.slug);

    // The seed does not fight it for the slug either.
    const [real] = await db
      .select({ slug: clinics.slug })
      .from(clinics)
      .where(eq(clinics.id, realId));

    expect(real?.slug).toBe(`${target.slug}-dental-clinic`);
  });

  it('ignores a soft-deleted clinic', async () => {
    const target = spec();
    const goneId = await legacyClinic(target, target.slug);

    await db.update(clinics).set({ deletedAt: new Date() }).where(eq(clinics.id, goneId));

    const result = await upsertSeedClinic(db, target);

    expect(result.id).not.toBe(goneId);

    const [live] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(and(eq(clinics.slug, target.slug), isNull(clinics.deletedAt)));

    expect(live?.id).toBe(result.id);
  });
});
