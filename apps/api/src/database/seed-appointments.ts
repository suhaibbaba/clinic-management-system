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
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { appointments, patients, waitingList } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface AppointmentsSeedContext {
  readonly clinicId: string;
  /** Both calendars, so the day view has more than one column to draw. */
  readonly doctorIds: readonly string[];
  readonly actorId: string;
  readonly timeZone: string;
}

interface SeedAppointment {
  /** Days from today; negative is the past, so statuses can be terminal. */
  readonly dayOffset: number;
  readonly time: string;
  readonly durationMinutes: number;
  /** Index into `doctorIds`. */
  readonly doctor: number;
  /** Index into the clinic's patients, in file-number order. */
  readonly patient: number;
  readonly type: AppointmentType;
  readonly status: AppointmentStatus;
  readonly reason: string;
  readonly cancelledReason?: string;
}

/**
 * A week that looks like a week.
 *
 * Yesterday is finished — completed, one no-show, one cancellation — today is
 * partly done and partly ahead, and the rest of the week is booked. That is
 * what makes the calendar worth looking at on a fresh database, and what gives
 * the status colours something to be.
 *
 * Times avoid 13:00–14:00: the seeded clinic closes for lunch, and an
 * appointment there would contradict the availability endpoint on the very
 * first screen anyone opens.
 */
const SCHEDULE: readonly SeedAppointment[] = [
  // ── Yesterday: a finished day ──────────────────────────────────────────
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

  // ── Today: partly behind, partly ahead ─────────────────────────────────
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

  // ── The rest of the week ───────────────────────────────────────────────
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

/**
 * Appointments and a waiting list for the seeded clinic.
 *
 * Idempotent like the rest of the seed: it returns early once this clinic has
 * any appointment at all, so `pnpm seed` stays safe to repeat — and re-running
 * it cannot trip the overlap constraint on rows it already inserted.
 */
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

  return { appointments: SCHEDULE.length, waiting: WAITING.length };
}

const toMinuteOfDay = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
};

const shiftDate = (isoDate: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
