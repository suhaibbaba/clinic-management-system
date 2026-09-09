import { hash } from '@node-rs/argon2';
import {
  BOOKING_CONFIRMATION_MODE,
  CHART_TYPE,
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNEL,
  SPECIALTY_CODE,
  USER_ROLE,
  type PersonName,
  type WeeklySchedule,
} from '@clinic/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';

import { validateEnv } from '@api/config/env.schema';
import { doctors, specialties } from '@api/database/schema';
import { ensureSystemLookups } from '@api/database/system-lookups';
import { seedAppointments } from '@api/database/seed-appointments';
import { seedBilling } from '@api/database/seed-billing';
import { seedInventory } from '@api/database/seed-inventory';
import { seedLabs } from '@api/database/seed-labs';
import { upsertSeedClinic } from '@api/database/seed-clinic';
import { upsertUser, type SeedAccount } from '@api/database/seed-users';
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
 * ranges. That is the working week in Ramallah, where the seeded clinic is —
 * the weekend is Friday and Saturday, so a Monday–Friday default would show
 * the calendar closed on the two busiest days and open on the weekend.
 */
const WEEKDAY_HOURS: WeeklySchedule = [0, 1, 2, 3, 4].map((weekday) => ({
  weekday,
  ranges: [
    { start: '09:00', end: '13:00' },
    { start: '14:00', end: '17:00' },
  ],
}));

const ACCOUNTS: readonly SeedAccount[] = [
  {
    role: USER_ROLE.ADMIN,
    name: { ar: 'مدير العيادة', en: 'Clinic Admin' },
    phone: '+970599000101',
    email: 'admin@clinic.local',
  },
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: 'د. ليلى حداد', en: 'Dr. Layla Haddad' },
    phone: '+970599000102',
    email: 'doctor@clinic.local',
  },
  {
    role: USER_ROLE.RECEPTIONIST,
    name: { ar: 'الاستقبال', en: 'Front Desk' },
    phone: '+970599000103',
    email: 'reception@clinic.local',
  },
  {
    role: USER_ROLE.TECHNICIAN,
    name: { ar: 'فني المخبر', en: 'Lab Technician' },
    phone: '+970599000104',
    email: 'technician@clinic.local',
  },
  // A second doctor, so the calendar's day view has two columns to draw and
  // the availability endpoint has two schedules to answer for.
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: 'د. سامر نصار', en: 'Dr. Samer Nassar' },
    phone: '+970599000105',
    email: 'doctor2@clinic.local',
  },
];

/** The zone the clinic's opening hours are expressed in (see `clinicScheduleSettings`). */
const CLINIC_TIME_ZONE = 'Asia/Hebron';

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

    const clinic = await upsertSeedClinic(db, {
      slug: CLINIC_SLUG,
      name: CLINIC_NAME,
      defaults: {
        phone: '+97022950000',
        email: 'info@clinic.local',
        address: 'رام الله، فلسطين',
        // Shekels, shown as ₪ — the currency the clinic is actually paid in.
        currency: 'ILS',
        workingHours: WEEKDAY_HOURS,
        settings: CLINIC_SETTINGS,
      },
    });
    // Before anything that stores a code: the dropdowns are rows now, and a
    // seeded appointment of type `checkup` needs the row that names it.
    await ensureSystemLookups(db, clinic.id);
    const specialty = await upsertSpecialty(db, clinic.id);

    const created: { account: SeedAccount; id: string }[] = [];
    // Anything the accounts had to repair joins the clinic's own notes, so one
    // report says everything the seed changed about a database it inherited.
    const notes = [...clinic.notes];
    for (const account of ACCOUNTS) {
      const user = await upsertUser(db, clinic.id, account, passwordHash);
      created.push({ account, id: user.id });
      notes.push(...user.notes);
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
      notes,
    );
  } finally {
    await client.end();
  }
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
      // A specialty's name is clinic data a practice edits, and this one's
      // interface is Arabic — seeding it in English put one Latin word in the
      // middle of every doctor card.
      name: 'طب الأسنان',
      chartType: CHART_TYPE.TOOTH_FDI,
    })
    .returning({ id: specialties.id });

  if (!row) {
    throw new Error('Failed to create the seed specialty');
  }

  return row;
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
  /** What the seed had to repair before it could run — usually nothing. */
  notes: readonly string[],
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
    ...(notes.length > 0 ? ['', ...notes] : []),
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
