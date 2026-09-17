import {
  APPOINTMENT_STATUS,
  addDays,
  instantFromLocal,
  localWeekday,
  occupiesSlot,
  type AppointmentStatus,
  type WeeklySchedule,
} from "@clinic/shared";

import { computeDaySlots, type BusyInterval } from "@api/appointments/slots";
import type { CatalogEntry } from "@api/database/seed/clinic";
import type { Rng } from "@api/database/seed/random";

export interface CalendarDoctor {
  readonly id: string;
  readonly schedule: WeeklySchedule;
}

export interface PlannedAppointment {
  readonly doctorId: string;
  readonly doctorIndex: number;
  readonly patientIndex: number;
  readonly startsAt: Date;
  readonly durationMinutes: number;
  readonly isoDate: string;
  readonly startMinute: number;
  readonly type: string;
  readonly status: AppointmentStatus;
  readonly reason: string;
  readonly cancelledReason: string | null;
  readonly procedure: CatalogEntry | null;
}

export interface CalendarPlanInput {
  readonly rng: Rng;
  readonly today: string;
  readonly timeZone: string;
  readonly clinicHours: WeeklySchedule;
  readonly doctors: readonly CalendarDoctor[];
  readonly patientCount: number;
  readonly catalog: readonly CatalogEntry[];
  /** Dates the clinic is shut — the generator never books into them. */
  readonly closedDates: ReadonlySet<string>;
  /** Instants a doctor is away, so the clean absence has nothing under it. */
  readonly timeOff: ReadonlyMap<string, readonly BusyInterval[]>;
  readonly daysBack: number;
  readonly daysForward: number;
}

const REASONS: readonly string[] = [
  "ألم في الضرس",
  "فحص دوري",
  "متابعة معالجة",
  "تنظيف",
  "كسر في الحشوة",
  "تركيب التاج",
  "مراجعة بعد القلع",
  "استشارة تقويم",
];

const CANCELLED_REASONS: readonly string[] = [
  "اعتذر المريض",
  "ظرف طارئ",
  "تأجيل بطلب المريض",
  "تعارض مع موعد آخر",
];

const APPOINTMENT_TYPES: readonly string[] = ["checkup", "treatment", "followup", "emergency"];

export function planAppointments(input: CalendarPlanInput): PlannedAppointment[] {
  const planned: PlannedAppointment[] = [];
  // Per doctor and day, what the generator has already taken. `computeDaySlots` is pure, so the
  // running list is what keeps the second appointment of a day off the first.
  const taken = new Map<string, BusyInterval[]>();

  for (let offset = -input.daysBack; offset <= input.daysForward; offset += 1) {
    const isoDate = addDays(input.today, offset);

    if (input.closedDates.has(isoDate)) {
      continue;
    }

    const weekday = localWeekday(isoDate, input.timeZone);
    const clinicRanges = input.clinicHours.find((day) => day.weekday === weekday)?.ranges ?? [];

    if (clinicRanges.length === 0) {
      continue;
    }

    for (const [doctorIndex, doctor] of input.doctors.entries()) {
      const doctorRanges = doctor.schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

      if (doctorRanges.length === 0) {
        continue;
      }

      const key = `${doctor.id}:${isoDate}`;
      const busy = taken.get(key) ?? [];
      taken.set(key, busy);

      const wanted = appointmentsForDay(input.rng, offset);

      for (let index = 0; index < wanted; index += 1) {
        const procedure = pickProcedure(input.rng, input.catalog);
        const duration = procedure.minutes;

        const { slots } = computeDaySlots({
          clinicRanges,
          doctorRanges,
          isClosed: false,
          timeOff: input.timeOff.get(key) ?? [],
          busy,
          durationMinutes: duration,
          stepMinutes: 15,
        });

        const free = slots.filter((slot) => slot.available);

        if (free.length === 0) {
          break;
        }

        const slot = free[Math.min(free.length - 1, input.rng.skewedInt(0, free.length - 1))];

        /* istanbul ignore next -- `free` is non-empty here. */
        if (!slot) {
          break;
        }

        busy.push({ startMinute: slot.startMinute, endMinute: slot.endMinute });

        const status = statusFor(input.rng, offset);

        planned.push({
          doctorId: doctor.id,
          doctorIndex,
          patientIndex: input.rng.int(0, input.patientCount - 1),
          startsAt: instantFromLocal(isoDate, slot.startMinute, input.timeZone),
          durationMinutes: duration,
          isoDate,
          startMinute: slot.startMinute,
          type: appointmentType(input.rng, procedure),
          status,
          reason: input.rng.pick(REASONS),
          cancelledReason:
            status === APPOINTMENT_STATUS.CANCELLED ? input.rng.pick(CANCELLED_REASONS) : null,
          procedure: occupiesSlot(status) ? procedure : null,
        });
      }
    }
  }

  return planned;
}

function appointmentsForDay(rng: Rng, offset: number): number {
  if (offset === 0) {
    return rng.int(6, 9);
  }

  if (offset < 0) {
    return rng.int(2, 4);
  }

  if (offset <= 14) {
    return rng.int(10, 12);
  }

  if (offset <= 45) {
    return rng.int(2, 4);
  }

  return rng.bool(0.35) ? rng.int(1, 2) : 0;
}

function statusFor(rng: Rng, offset: number): AppointmentStatus {
  if (offset < 0) {
    if (rng.bool(0.08)) {
      return APPOINTMENT_STATUS.NO_SHOW;
    }

    if (rng.bool(0.076)) {
      return APPOINTMENT_STATUS.CANCELLED;
    }

    return APPOINTMENT_STATUS.COMPLETED;
  }

  if (offset === 0) {
    return rng.pick([
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.ARRIVED,
      APPOINTMENT_STATUS.IN_PROGRESS,
      APPOINTMENT_STATUS.CONFIRMED,
      APPOINTMENT_STATUS.CONFIRMED,
      APPOINTMENT_STATUS.NO_SHOW,
    ]);
  }

  return offset <= 10 && rng.bool(0.04)
    ? APPOINTMENT_STATUS.REQUESTED
    : APPOINTMENT_STATUS.CONFIRMED;
}

function appointmentType(rng: Rng, procedure: CatalogEntry): string {
  if (procedure.code === "EXAM") {
    return "checkup";
  }

  return rng.bool(0.08) ? "emergency" : rng.pick(APPOINTMENT_TYPES.slice(0, 3));
}

function pickProcedure(rng: Rng, catalog: readonly CatalogEntry[]): CatalogEntry {
  const total = catalog.reduce((sum, entry) => sum + entry.weight, 0);
  let ticket = rng.next() * total;

  for (const entry of catalog) {
    ticket -= entry.weight;

    if (ticket <= 0) {
      return entry;
    }
  }

  return catalog[0] as CatalogEntry;
}
