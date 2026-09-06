import { hash } from '@node-rs/argon2';
import {
  CHART_TYPE,
  SPECIALTY_CODE,
  USER_ROLE,
  type UserRole,
  type WeeklySchedule,
} from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, isNull, and } from 'drizzle-orm';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import { clinics, doctors, specialties, users } from '@api/database/schema';
import { seedAppointments } from '@api/database/seed-appointments';
import { seedBilling } from '@api/database/seed-billing';
import { seedPatients } from '@api/database/seed-patients';

/**
 * Development seed: one clinic, the dental specialty, and one account per role.
 *
 * Idempotent — re-running it reuses the existing rows instead of failing on the
 * unique phone/email indexes, so `pnpm seed` is safe to repeat.
 *
 *   docker compose exec api pnpm seed
 */

const CLINIC_NAME = 'Al Nour Dental Clinic';

/**
 * Sunday–Thursday, 09:00–17:00, with a 13:00–14:00 break expressed as two
 * ranges. That is the working week in Damascus, where the seeded clinic is —
 * a Monday–Friday default would show the calendar closed on the two busiest
 * days and open on the weekend.
 */
const WEEKDAY_HOURS: WeeklySchedule = [0, 1, 2, 3, 4].map((weekday) => ({
  weekday,
  ranges: [
    { start: '09:00', end: '13:00' },
    { start: '14:00', end: '17:00' },
  ],
}));

interface SeedAccount {
  readonly role: UserRole;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
}

const ACCOUNTS: readonly SeedAccount[] = [
  {
    role: USER_ROLE.ADMIN,
    name: 'Clinic Admin',
    phone: '+963100000001',
    email: 'admin@clinic.local',
  },
  {
    role: USER_ROLE.DOCTOR,
    name: 'Dr. Layla Haddad',
    phone: '+963100000002',
    email: 'doctor@clinic.local',
  },
  {
    role: USER_ROLE.RECEPTIONIST,
    name: 'Front Desk',
    phone: '+963100000003',
    email: 'reception@clinic.local',
  },
  {
    role: USER_ROLE.TECHNICIAN,
    name: 'Lab Technician',
    phone: '+963100000004',
    email: 'technician@clinic.local',
  },
  // A second doctor, so the calendar's day view has two columns to draw and
  // the availability endpoint has two schedules to answer for.
  {
    role: USER_ROLE.DOCTOR,
    name: 'Dr. Samer Nassar',
    phone: '+963100000005',
    email: 'doctor2@clinic.local',
  },
];

/** The zone the clinic's opening hours are expressed in (see `clinicScheduleSettings`). */
const CLINIC_TIME_ZONE = 'Asia/Damascus';

async function main(): Promise<void> {
  const env = validateEnv(process.env);

  if (env.NODE_ENV === 'production' && process.env.SEED_ON_BOOT !== 'true') {
    throw new Error('Refusing to seed a production database');
  }

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    const passwordHash = await hash(env.SEED_PASSWORD, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const clinic = await upsertClinic(db);
    const specialty = await upsertSpecialty(db, clinic.id);

    const created: { account: SeedAccount; id: string }[] = [];
    for (const account of ACCOUNTS) {
      const id = await upsertUser(db, clinic.id, account, passwordHash);
      created.push({ account, id });
    }

    const doctorAccounts = created.filter((entry) => entry.account.role === USER_ROLE.DOCTOR);
    const [doctorAccount] = doctorAccounts;
    const adminAccount = created.find((entry) => entry.account.role === USER_ROLE.ADMIN);
    let seededPatients = 0;
    let seededCharges = 0;
    let seededAppointments = 0;

    if (doctorAccount && adminAccount) {
      const doctorIds: string[] = [];
      for (const entry of doctorAccounts) {
        doctorIds.push(await upsertDoctor(db, clinic.id, entry.id, specialty.id));
      }

      seededPatients = await seedPatients(db, {
        clinicId: clinic.id,
        specialtyId: specialty.id,
        doctorId: doctorIds[0] ?? '',
        actorId: adminAccount.id,
      });

      seededCharges = await seedBilling(db, {
        clinicId: clinic.id,
        actorId: adminAccount.id,
      });

      const calendar = await seedAppointments(db, {
        clinicId: clinic.id,
        doctorIds,
        actorId: adminAccount.id,
        timeZone: CLINIC_TIME_ZONE,
      });
      seededAppointments = calendar.appointments;
    }

    report(
      clinic.name,
      created,
      env.SEED_PASSWORD,
      seededPatients,
      seededCharges,
      seededAppointments,
    );
  } finally {
    await client.end();
  }
}

async function upsertClinic(db: ReturnType<typeof drizzle>): Promise<{ id: string; name: string }> {
  const [existing] = await db
    .select({ id: clinics.id, name: clinics.name })
    .from(clinics)
    .where(and(eq(clinics.name, CLINIC_NAME), isNull(clinics.deletedAt)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [row] = await db
    .insert(clinics)
    .values({
      name: CLINIC_NAME,
      phone: '+963110000000',
      email: 'info@clinic.local',
      address: 'Damascus, Syria',
      currency: 'USD',
      workingHours: WEEKDAY_HOURS,
      settings: { timezone: CLINIC_TIME_ZONE, holidays: [] },
    })
    .returning({ id: clinics.id, name: clinics.name });

  if (!row) {
    throw new Error('Failed to create the seed clinic');
  }

  return row;
}

async function upsertSpecialty(
  db: ReturnType<typeof drizzle>,
  clinicId: string,
): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: specialties.id })
    .from(specialties)
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.code, SPECIALTY_CODE.DENTAL),
        isNull(specialties.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [row] = await db
    .insert(specialties)
    .values({
      clinicId,
      code: SPECIALTY_CODE.DENTAL,
      name: 'Dentistry',
      chartType: CHART_TYPE.TOOTH_FDI,
    })
    .returning({ id: specialties.id });

  if (!row) {
    throw new Error('Failed to create the seed specialty');
  }

  return row;
}

async function upsertUser(
  db: ReturnType<typeof drizzle>,
  clinicId: string,
  account: SeedAccount,
  passwordHash: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, account.phone), isNull(users.deletedAt)))
    .limit(1);

  if (existing) {
    // Keep the documented password working even if it changed in .env.
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(users)
    .values({
      clinicId,
      name: account.name,
      phone: account.phone,
      email: account.email,
      passwordHash,
      role: account.role,
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error(`Failed to create the seed ${account.role}`);
  }

  return row.id;
}

async function upsertDoctor(
  db: ReturnType<typeof drizzle>,
  clinicId: string,
  userId: string,
  specialtyId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.userId, userId), isNull(doctors.deletedAt)))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [row] = await db
    .insert(doctors)
    .values({
      clinicId,
      userId,
      specialtyId,
      weeklySchedule: WEEKDAY_HOURS,
      defaultAppointmentDurationMinutes: 30,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning({ id: doctors.id });

  if (!row) {
    throw new Error('Failed to create the seed doctor');
  }

  return row.id;
}

function report(
  clinicName: string,
  created: { account: SeedAccount; id: string }[],
  password: string,
  seededPatients: number,
  seededCharges: number,
  seededAppointments: number,
): void {
  const lines = [
    '',
    `Seeded clinic: ${clinicName}`,
    '',
    'Sign in at POST /auth/login with the phone or the email as "identifier":',
    '',
    ...created.map(
      ({ account }) => `  ${account.role.padEnd(13)} ${account.phone}  ${account.email.padEnd(24)}`,
    ),
    '',
    `  password (all accounts): ${password}`,
    '',
    seededPatients > 0
      ? `Seeded ${seededPatients} patients with histories, visits, procedures and a treatment plan.`
      : 'Patient data already present — left untouched.',
    seededCharges > 0
      ? `Billed ${seededCharges} procedures and recorded payments — file 00005 is left overdue.`
      : 'Billing data already present — left untouched.',
    seededAppointments > 0
      ? `Booked ${seededAppointments} appointments across this week for both doctors, plus a waiting list.`
      : 'Appointment data already present — left untouched.',
    '',
    'Development credentials only — change SEED_PASSWORD before any shared environment.',
    '',
  ];

  console.log(lines.join('\n'));
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
