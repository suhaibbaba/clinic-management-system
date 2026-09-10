import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  instantFromLocal,
  localDate,
  WAITING_LIST_PRIORITY,
  type AppointmentStatus,
  type AppointmentType,
  type WaitingListPriority,
} from '@clinic/shared';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { appointments, patients, waitingList } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface AppointmentsSeedContext {
  readonly clinicId: string;
  readonly doctorIds: readonly string[];
  readonly actorId: string;
  readonly timeZone: string;
}

interface SeedAppointment {
  /** Days from today; negative is the past, so statuses can be terminal. */
  readonly dayOffset: number;
  readonly time: string;
  readonly durationMinutes: number;
  readonly doctor: number;
  readonly patient: number;
  readonly type: AppointmentType;
  readonly status: AppointmentStatus;
  readonly reason: string;
  readonly cancelledReason?: string;
}

// Times avoid 13:00–14:00: the seeded clinic closes for lunch, and an appointment there would
// contradict the availability endpoint on the first screen anyone opens.
const SCHEDULE: readonly SeedAppointment[] = [
  {
    dayOffset: -1,
    time: '09:00',
    durationMinutes: 30,
    doctor: 0,
    patient: 0,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.COMPLETED,
    reason: 'فحص دوري',
  },
  {
    dayOffset: -1,
    time: '10:00',
    durationMinutes: 45,
    doctor: 0,
    patient: 1,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.COMPLETED,
    reason: 'حشوة',
  },
  {
    dayOffset: -1,
    time: '11:00',
    durationMinutes: 30,
    doctor: 1,
    patient: 2,
    type: APPOINTMENT_TYPE.FOLLOWUP,
    status: APPOINTMENT_STATUS.NO_SHOW,
    reason: 'مراجعة',
  },
  {
    dayOffset: -1,
    time: '14:30',
    durationMinutes: 30,
    doctor: 1,
    patient: 3,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.CANCELLED,
    reason: 'فحص',
    cancelledReason: 'اعتذر المريض',
  },

  {
    dayOffset: 0,
    time: '09:00',
    durationMinutes: 30,
    doctor: 0,
    patient: 4,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.COMPLETED,
    reason: 'معالجة لبية',
  },
  {
    dayOffset: 0,
    time: '09:30',
    durationMinutes: 30,
    doctor: 0,
    patient: 5,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.ARRIVED,
    reason: 'ألم في الضرس',
  },
  {
    dayOffset: 0,
    time: '10:00',
    durationMinutes: 60,
    doctor: 0,
    patient: 6,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.IN_PROGRESS,
    reason: 'تركيب تاج',
  },
  {
    dayOffset: 0,
    time: '11:30',
    durationMinutes: 30,
    doctor: 0,
    patient: 7,
    type: APPOINTMENT_TYPE.FOLLOWUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'مراجعة بعد الحشوة',
  },
  {
    dayOffset: 0,
    time: '15:00',
    durationMinutes: 30,
    doctor: 0,
    patient: 8,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'فحص دوري',
  },
  {
    dayOffset: 0,
    time: '09:30',
    durationMinutes: 30,
    doctor: 1,
    patient: 9,
    type: APPOINTMENT_TYPE.EMERGENCY,
    status: APPOINTMENT_STATUS.ARRIVED,
    reason: 'كسر في السن',
  },
  {
    dayOffset: 0,
    time: '10:30',
    durationMinutes: 45,
    doctor: 1,
    patient: 0,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'قلع',
  },
  {
    dayOffset: 0,
    time: '16:00',
    durationMinutes: 30,
    doctor: 1,
    patient: 1,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.REQUESTED,
    reason: 'حجز عبر الموقع',
  },

  {
    dayOffset: 1,
    time: '09:00',
    durationMinutes: 30,
    doctor: 0,
    patient: 2,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'فحص',
  },
  {
    dayOffset: 1,
    time: '10:00',
    durationMinutes: 60,
    doctor: 0,
    patient: 3,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'جسر',
  },
  {
    dayOffset: 1,
    time: '14:00',
    durationMinutes: 30,
    doctor: 1,
    patient: 4,
    type: APPOINTMENT_TYPE.FOLLOWUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'مراجعة',
  },
  {
    dayOffset: 2,
    time: '09:30',
    durationMinutes: 45,
    doctor: 0,
    patient: 5,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'تنظيف وتلميع',
  },
  {
    dayOffset: 2,
    time: '11:00',
    durationMinutes: 30,
    doctor: 1,
    patient: 6,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'فحص دوري',
  },
  {
    dayOffset: 2,
    time: '15:30',
    durationMinutes: 30,
    doctor: 0,
    patient: 7,
    type: APPOINTMENT_TYPE.FOLLOWUP,
    status: APPOINTMENT_STATUS.REQUESTED,
    reason: 'حجز عبر الموقع',
  },
  {
    dayOffset: 3,
    time: '10:00',
    durationMinutes: 30,
    doctor: 0,
    patient: 8,
    type: APPOINTMENT_TYPE.CHECKUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'فحص',
  },
  {
    dayOffset: 3,
    time: '11:00',
    durationMinutes: 45,
    doctor: 1,
    patient: 9,
    type: APPOINTMENT_TYPE.TREATMENT,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'حشوة تجميلية',
  },
  {
    dayOffset: 4,
    time: '09:00',
    durationMinutes: 30,
    doctor: 1,
    patient: 0,
    type: APPOINTMENT_TYPE.FOLLOWUP,
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'مراجعة',
  },
];

interface SeedWaitingEntry {
  readonly patient: number;
  readonly doctor: number | null;
  readonly priority: WaitingListPriority;
  readonly reason: string;
}

const WAITING: readonly SeedWaitingEntry[] = [
  {
    patient: 3,
    doctor: null,
    priority: WAITING_LIST_PRIORITY.URGENT,
    reason: 'ألم حاد — مراجعة طارئة',
  },
  {
    patient: 6,
    doctor: 0,
    priority: WAITING_LIST_PRIORITY.NORMAL,
    reason: 'ينتظر موعداً هذا الأسبوع',
  },
];

interface SeedOnlineBooking {
  readonly fullName: string;
  readonly phone: string;
  readonly dayOffset: number;
  readonly time: string;
  readonly doctor: number;
  readonly reason: string;
}

// Both `requested` and both with no `created_by` — nobody at the desk made them, which is what
// marks the row "data not verified".
const ONLINE_BOOKINGS: readonly SeedOnlineBooking[] = [
  {
    fullName: 'ريم العلي',
    phone: '+970568123456',
    dayOffset: 0,
    time: '16:30',
    doctor: 0,
    reason: 'ألم في الضرس الخلفي',
  },
  {
    fullName: 'باسل حمدان',
    phone: '+970599987654',
    dayOffset: 2,
    time: '12:00',
    doctor: 1,
    reason: 'تنظيف وتبييض',
  },
];

// Returns early once this clinic has any appointment, so re-running cannot trip the overlap
// constraint on rows it already inserted.
export async function seedAppointments(
  db: Db,
  ctx: AppointmentsSeedContext,
): Promise<{ appointments: number; waiting: number }> {
  const [existing] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.clinicId, ctx.clinicId), isNull(appointments.deletedAt)))
    .limit(1);

  if (existing) {
    return { appointments: 0, waiting: 0 };
  }

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.clinicId, ctx.clinicId), isNull(patients.deletedAt)))
    .orderBy(asc(patients.fileNumber));

  if (patientRows.length === 0 || ctx.doctorIds.length === 0) {
    return { appointments: 0, waiting: 0 };
  }

  const patientId = (index: number): string => {
    const row = patientRows[index % patientRows.length];

    /* istanbul ignore next -- the modulo keeps this in range. */
    if (!row) {
      throw new Error('Seeded patient is missing');
    }

    return row.id;
  };

  const doctorId = (index: number): string => {
    const id = ctx.doctorIds[index % ctx.doctorIds.length];

    /* istanbul ignore next -- the modulo keeps this in range. */
    if (!id) {
      throw new Error('Seeded doctor is missing');
    }

    return id;
  };

  const today = localDate(new Date(), ctx.timeZone);
  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };

  await db.insert(appointments).values(
    SCHEDULE.map((entry) => ({
      clinicId: ctx.clinicId,
      patientId: patientId(entry.patient),
      doctorId: doctorId(entry.doctor),
      startsAt: instantFromLocal(
        shiftDate(today, entry.dayOffset),
        toMinuteOfDay(entry.time),
        ctx.timeZone,
      ),
      durationMinutes: entry.durationMinutes,
      type: entry.type,
      status: entry.status,
      reason: entry.reason,
      cancelledReason: entry.cancelledReason ?? null,
      ...audit,
    })),
  );

  await db.insert(waitingList).values(
    WAITING.map((entry) => ({
      clinicId: ctx.clinicId,
      patientId: patientId(entry.patient),
      doctorId: entry.doctor === null ? null : doctorId(entry.doctor),
      reason: entry.reason,
      priority: entry.priority,
      ...audit,
    })),
  );

  await seedOnlineBookings(db, ctx, today);

  return { appointments: SCHEDULE.length + ONLINE_BOOKINGS.length, waiting: WAITING.length };
}

async function seedOnlineBookings(
  db: Db,
  ctx: AppointmentsSeedContext,
  today: string,
): Promise<void> {
  const [lastFileNumber] = await db
    .select({ value: patients.fileNumber })
    .from(patients)
    .where(eq(patients.clinicId, ctx.clinicId))
    .orderBy(desc(patients.fileNumber))
    .limit(1);

  let next = Number(lastFileNumber?.value ?? '0');

  for (const booking of ONLINE_BOOKINGS) {
    next += 1;

    const [patient] = await db
      .insert(patients)
      .values({
        clinicId: ctx.clinicId,
        fileNumber: String(next).padStart(5, '0'),
        fullName: booking.fullName,
        phone: booking.phone,
        notes: 'أُنشئ من الحجز الإلكتروني — لم يُتحقق من الهوية بعد',
      })
      .returning({ id: patients.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!patient) {
      throw new Error('Failed to seed the online-booking patient');
    }

    await db.insert(appointments).values({
      clinicId: ctx.clinicId,
      patientId: patient.id,
      doctorId: ctx.doctorIds[booking.doctor % ctx.doctorIds.length] ?? '',
      startsAt: instantFromLocal(
        shiftDate(today, booking.dayOffset),
        toMinuteOfDay(booking.time),
        ctx.timeZone,
      ),
      durationMinutes: 30,
      type: APPOINTMENT_TYPE.CHECKUP,
      status: APPOINTMENT_STATUS.REQUESTED,
      reason: booking.reason,
    });
  }
}

const toMinuteOfDay = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
};

const shiftDate = (isoDate: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
