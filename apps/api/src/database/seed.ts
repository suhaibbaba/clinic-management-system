import { hash } from '@node-rs/argon2';
import {
  BOOKING_CONFIRMATION_MODE,
  CHART_TYPE,
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNEL,
  SPECIALTY_CODE,
  USER_ROLE,
  type PersonName,
  type UserRole,
  type WeeklySchedule,
} from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, isNull, and } from 'drizzle-orm';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import { clinics, doctors, specialties, users } from '@api/database/schema';
import { ensureSystemLookups } from '@api/database/system-lookups';
import { seedAppointments } from '@api/database/seed-appointments';
import { seedBilling } from '@api/database/seed-billing';
import { seedInventory } from '@api/database/seed-inventory';
import { seedLabs } from '@api/database/seed-labs';
import { seedClosures } from '@api/database/seed-closures';
import { seedPatients } from '@api/database/seed-patients';

/**
 * Development seed: one clinic, the dental specialty, and one account per role.
 *
 * Idempotent — re-running it reuses the existing rows instead of failing on the
 * unique phone/email indexes, so `pnpm seed` is safe to repeat.
 *
 *   docker compose exec api pnpm seed
 */

/**
 * The seeded practice, in both languages.
 *
 * Every staff name below is bilingual too: the interface is Arabic, and a seed
 * that filled only the English column would make the calendar and the doctors
 * list look exactly like the bug this replaced.
 */
const CLINIC_NAME: PersonName = { ar: 'عيادة النور لطب الأسنان', en: 'Al Nour Dental Clinic' };
/** The clinic's handle in a public booking URL: /public/booking/al-nour. */
const CLINIC_SLUG = 'al-nour';

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
  readonly name: PersonName;
  readonly phone: string;
  readonly email: string;
}

const ACCOUNTS: readonly SeedAccount[] = [
  {
    role: USER_ROLE.ADMIN,
    name: { ar: 'مدير العيادة', en: 'Clinic Admin' },
    phone: '+963100000001',
    email: 'admin@clinic.local',
  },
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: 'د. ليلى حداد', en: 'Dr. Layla Haddad' },
    phone: '+963100000002',
    email: 'doctor@clinic.local',
  },
  {
    role: USER_ROLE.RECEPTIONIST,
    name: { ar: 'الاستقبال', en: 'Front Desk' },
    phone: '+963100000003',
    email: 'reception@clinic.local',
  },
  {
    role: USER_ROLE.TECHNICIAN,
    name: { ar: 'فني المخبر', en: 'Lab Technician' },
    phone: '+963100000004',
    email: 'technician@clinic.local',
  },
  // A second doctor, so the calendar's day view has two columns to draw and
  // the availability endpoint has two schedules to answer for.
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: 'د. سامر نصار', en: 'Dr. Samer Nassar' },
    phone: '+963100000005',
    email: 'doctor2@clinic.local',
  },
];

/** The zone the clinic's opening hours are expressed in (see `clinicScheduleSettings`). */
const CLINIC_TIME_ZONE = 'Asia/Damascus';

/**
 * Everything the clinic's `settings` blob holds today.
 *
 * Booking is on and in OTP mode, so `pnpm seed` produces a database the public
 * flow can be exercised against end to end — the log provider is the default,
 * so the code lands in `notifications_log` and needs no gateway.
 *
 * The message bodies are the Arabic defaults, written out rather than left
 * implicit: a clinic edits these, and having them present in settings is what
 * makes it obvious they are editable.
 */
const CLINIC_SETTINGS = {
  timezone: CLINIC_TIME_ZONE,
  booking: {
    enabled: true,
    maxDaysAhead: 30,
    minHoursBefore: 2,
    confirmationMode: BOOKING_CONFIRMATION_MODE.OTP,
    holdMinutes: 15,
    maxActivePerPhone: 3,
  },
  notifications: {
    enabled: true,
    channel: NOTIFICATION_CHANNEL.SMS,
    remind24h: true,
    remind2h: true,
    templates: { ...DEFAULT_NOTIFICATION_TEMPLATES },
  },
};

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
    // Before anything that stores a code: the dropdowns are rows now, and a
    // seeded appointment of type `checkup` needs the row that names it.
    await ensureSystemLookups(db, clinic.id);
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
    let seededLabOrders = 0;
    let seededStockMovements = 0;
    let seededClosures = 0;

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

      const lab = await seedLabs(db, {
        clinicId: clinic.id,
        doctorIds,
        actorId: adminAccount.id,
      });
      seededLabOrders = lab.orders;

      const store = await seedInventory(db, {
        clinicId: clinic.id,
        actorId: adminAccount.id,
      });
      seededStockMovements = store.movements;

      const calendar = await seedAppointments(db, {
        clinicId: clinic.id,
        doctorIds,
        actorId: adminAccount.id,
        timeZone: CLINIC_TIME_ZONE,
      });
      seededAppointments = calendar.appointments;

      // After the appointments: one of the seeded absences deliberately sits
      // on top of one of them, so the conflict dialog has a real collision.
      seededClosures = await seedClosures(db, {
        clinicId: clinic.id,
        doctorIds,
        actorId: adminAccount.id,
        timeZone: CLINIC_TIME_ZONE,
      });
    }

    report(
      CLINIC_NAME.en,
      created,
      env.SEED_PASSWORD,
      seededPatients,
      seededCharges,
      seededAppointments,
      seededLabOrders,
      seededStockMovements,
      seededClosures,
    );
  } finally {
    await client.end();
  }
}

async function upsertClinic(db: ReturnType<typeof drizzle>): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: clinics.id })
    .from(clinics)
    // Matched on the slug rather than the name: the slug is the clinic's
    // identity in a URL, and it is the one of the two that cannot be spelled
    // two ways.
    .where(and(eq(clinics.slug, CLINIC_SLUG), isNull(clinics.deletedAt)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [row] = await db
    .insert(clinics)
    .values({
      nameAr: CLINIC_NAME.ar,
      nameEn: CLINIC_NAME.en,
      slug: CLINIC_SLUG,
      phone: '+963110000000',
      email: 'info@clinic.local',
      address: 'Damascus, Syria',
      currency: 'USD',
      workingHours: WEEKDAY_HOURS,
      settings: CLINIC_SETTINGS,
    })
    .returning({ id: clinics.id });

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
  seededLabOrders: number,
  seededStockMovements: number,
  seededClosures: number,
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
    seededLabOrders > 0
      ? `Sent ${seededLabOrders} orders to two labs — one is overdue, one came back — with part of the bill paid.`
      : 'Lab data already present — left untouched.',
    seededStockMovements > 0
      ? `Stocked 15 items from three suppliers over ${seededStockMovements} movements — gloves are below their minimum and a batch of anaesthetic is nearly out of date.`
      : 'Inventory already present — left untouched.',
    seededClosures > 0
      ? 'Closed the clinic for a two-day holiday and booked two absences for the first doctor — one of them overlaps a booked appointment, so the conflict dialog has something real to show.'
      : 'Closures already present — left untouched.',
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
