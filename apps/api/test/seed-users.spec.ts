import { randomUUID } from 'node:crypto';

import { USER_ROLE } from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';

import type { Database } from '@api/database/database.module';
import * as schema from '@api/database/schema';
import { doctors, users } from '@api/database/schema';
import { ACCOUNTS, DOCTOR_SCHEDULES } from '@api/database/seed/clinic';
import { buildPeople } from '@api/database/seed/people';
import { Rng } from '@api/database/seed/random';
import { upsertUser, type SeedAccount } from '@api/database/seed/users';
import { seedDatabase } from '@api/database/seed/seed-database';

// Two things about the staff the seed writes: the accounts are the ones documented in .env.example,
// and re-running never invents a second set of them.
describe('the seeded staff', () => {
  jest.setTimeout(180_000);

  let client: ReturnType<typeof postgres>;
  let db: Database;

  beforeAll(() => {
    const databaseUrl = process.env['DATABASE_URL'];

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to run the API tests.');
    }

    client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    db = drizzle(client, { schema });
  });

  afterAll(async () => {
    await client.end();
  });

  it('opens one admin, one receptionist, one technician and two doctors', () => {
    const roles = ACCOUNTS.map((account) => account.role).sort();

    expect(roles).toEqual([
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]);

    // Every account carries both spellings, because a name is printed on a document in the
    // clinic's language and shown on screen in the reader's.
    for (const account of ACCOUNTS) {
      expect(account.name.ar.length).toBeGreaterThan(0);
      expect(account.name.en.length).toBeGreaterThan(0);
      expect(account.phone.startsWith('+970')).toBe(true);
    }
  });

  it('gives the two doctors different weeks', () => {
    const [senior, junior] = DOCTOR_SCHEDULES;

    expect(senior).toBeDefined();
    expect(junior).toBeDefined();
    expect(senior?.map((day) => day.weekday)).not.toEqual(junior?.map((day) => day.weekday));

    // Neither of them works the day the clinic is shut.
    for (const schedule of DOCTOR_SCHEDULES) {
      expect(schedule.map((day) => day.weekday)).not.toContain(5);
    }
  });

  it('builds the same patients from the same seed, and different ones from another', () => {
    const reference = new Date('2026-09-14T09:00:00.000Z');
    const first = buildPeople(new Rng(1234), 20, reference).map((person) => person.fullName);
    const again = buildPeople(new Rng(1234), 20, reference).map((person) => person.fullName);
    const other = buildPeople(new Rng(9999), 20, reference).map((person) => person.fullName);

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);

    // Both spellings of one name, so the folded search has something to prove itself on.
    expect(first).toContain('أحمد خالد النابلسي');
    expect(first).toContain('احمد خالد النابلسي');
  });

  it('adopts the account it wrote last time rather than opening a second one', async () => {
    const handle = randomUUID().slice(0, 8);
    const options = {
      passwordHash: 'x'.repeat(32),
      slug: `staff-${handle}`,
      namePrefix: handle,
      identifierPrefix: handle,
      patientCount: 4,
      daysBack: 7,
      daysForward: 7,
    };

    const first = await seedDatabase(db, options);
    const second = await seedDatabase(db, options);

    expect(second.clinicId).toBe(first.clinicId);
    expect(second.created).toBe(false);

    const staff = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clinicId, first.clinicId), isNull(users.deletedAt)));

    expect(staff.length).toBe(ACCOUNTS.length);

    const practising = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(and(eq(doctors.clinicId, first.clinicId), isNull(doctors.deletedAt)));

    expect(practising.length).toBe(2);
  });

  it('refuses to seed a second clinic with an account that belongs to another clinic', async () => {
    const handle = randomUUID().slice(0, 8);
    const account: SeedAccount = {
      role: USER_ROLE.ADMIN,
      name: { ar: 'مدير', en: 'Admin' },
      phone: `+9705999${handle.slice(0, 5)}`,
      email: `${handle}@clinic.local`,
    };

    const [clinicA] = await db
      .insert(schema.clinics)
      .values({ nameAr: 'أ', nameEn: 'A', slug: `a-${handle}` })
      .returning({ id: schema.clinics.id });
    const [clinicB] = await db
      .insert(schema.clinics)
      .values({ nameAr: 'ب', nameEn: 'B', slug: `b-${handle}` })
      .returning({ id: schema.clinics.id });

    await upsertUser(db, clinicA?.id as string, account, 'x'.repeat(32));

    await expect(upsertUser(db, clinicB?.id as string, account, 'x'.repeat(32))).rejects.toThrow(
      /already belongs to clinic/,
    );
  });
});
