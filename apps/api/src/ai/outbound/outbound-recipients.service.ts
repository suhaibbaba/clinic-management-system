import { Inject, Injectable } from "@nestjs/common";
import {
  AI_OUTBOUND_TARGET,
  addDays,
  APPOINTMENT_STATUS,
  clinicScheduleSettings,
  currencySymbol,
  DEFAULT_TIME_ZONE,
  formatWholeMoney,
  instantFromLocal,
  LAB_ORDER_AWAITING_STATUSES,
  localDate,
  minutesFromLocalMidnight,
  type AiOutboundTarget,
} from "@clinic/shared";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { notificationName } from "@api/common/person-name";
import { DATABASE, type Database } from "@api/database/database.module";
import { appointments, clinics, doctors, labOrders, patients, users } from "@api/database/schema";

/** One patient to message, with the values their message is rendered from. */
export interface Candidate {
  readonly patientId: string;
  readonly name: string;
  readonly phone: string;
  readonly vars: Readonly<Record<string, string>>;
}

export interface Resolved {
  readonly candidates: Candidate[];
  /** True when there were more than `limit`: the caller refuses rather than sends to some. */
  readonly overflow: boolean;
}

export interface ResolveInput {
  readonly clinicId: string;
  readonly target: AiOutboundTarget;
  /** The rule's threshold for the two overdue targets; ignored by the others. */
  readonly days: number;
  readonly patientIds?: readonly string[] | undefined;
  /** The recipient cap. One more is fetched, to know whether there were more. */
  readonly limit: number;
}

const DAY_MS = 86_400_000;

// Plain queries, no model: which patients a rule reaches is decided here, deterministically, and
// the model is only ever asked how to phrase what they are sent. One message per patient.
@Injectable()
export class OutboundRecipientsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async resolve(input: ResolveInput): Promise<Resolved> {
    const clinic = await this.clinic(input.clinicId);
    const fetched = await this.fetch(input, clinic);
    const withClinic = fetched.map((candidate) => ({
      ...candidate,
      vars: { ...candidate.vars, name: candidate.name, clinic: clinic.name },
    }));

    return {
      candidates: withClinic.slice(0, input.limit),
      overflow: withClinic.length > input.limit,
    };
  }

  private fetch(input: ResolveInput, clinic: ClinicContext): Promise<Candidate[]> {
    switch (input.target) {
      case AI_OUTBOUND_TARGET.OVERDUE_LABS:
        return this.overdueLabs(input.clinicId, input.days, input.limit + 1);
      case AI_OUTBOUND_TARGET.UNPAID_INVOICES:
        return this.unpaid(input.clinicId, input.days, input.limit + 1, clinic.currency);
      case AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS:
        return this.tomorrow(input.clinicId, clinic.timeZone, input.limit + 1);
      case AI_OUTBOUND_TARGET.PATIENT_IDS:
        return this.explicit(input.clinicId, input.patientIds ?? []);
    }
  }

  /** Lab work the lab promised at least `days` ago and has not delivered, one row per patient. */
  async overdueLabs(clinicId: string, days: number, limit: number): Promise<Candidate[]> {
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const rows = await this.db
      .select({
        patientId: patients.id,
        name: patients.fullName,
        phone: patients.phone,
        oldest: sql<Date>`min(${labOrders.expectedAt})`,
      })
      .from(labOrders)
      .innerJoin(patients, eq(patients.id, labOrders.patientId))
      .where(
        and(
          eq(labOrders.clinicId, clinicId),
          isNull(labOrders.deletedAt),
          isNull(patients.deletedAt),
          isNotNull(labOrders.expectedAt),
          lt(labOrders.expectedAt, cutoff),
          inArray(labOrders.status, [...LAB_ORDER_AWAITING_STATUSES]),
        ),
      )
      .groupBy(patients.id, patients.fullName, patients.phone)
      .orderBy(asc(sql`min(${labOrders.expectedAt})`), asc(patients.fullName))
      .limit(limit);

    return rows.map((row) => ({
      patientId: row.patientId,
      name: row.name,
      phone: row.phone,
      vars: {
        days: String(Math.floor((Date.now() - new Date(row.oldest).getTime()) / DAY_MS)),
      },
    }));
  }

  // Not the overdue list's rule, which counts a never-paid balance from its first day: here some
  // of what was charged at least `days` ago must still be uncovered by everything paid since.
  async unpaid(
    clinicId: string,
    days: number,
    limit: number,
    currency: string,
  ): Promise<Candidate[]> {
    // A `Date` inside a raw `sql` template reaches postgres-js unserialized, and it rejects it.
    const cutoff = sql`${new Date(Date.now() - days * DAY_MS).toISOString()}::timestamptz`;

    const rows = await this.db.execute<UnpaidRow>(sql`
      with ledger as (
        select
          p.id as patient_id,
          p.full_name,
          p.phone,
          coalesce((
            select sum(amount - discount) from charges
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as charged,
          coalesce((
            select sum(amount - discount) from charges
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
              and created_at < ${cutoff}
          ), 0) as charged_before,
          coalesce((
            select sum(amount) from payments
            where clinic_id = ${clinicId} and patient_id = p.id and deleted_at is null
          ), 0) as paid
        from patients p
        where p.clinic_id = ${clinicId} and p.deleted_at is null
      )
      select patient_id::text as patient_id, full_name, phone,
             (charged - paid)::text as balance
      from ledger
      where charged - paid > 0 and charged_before - paid > 0
      order by charged - paid desc, full_name asc
      limit ${limit}
    `);

    return [...rows].map((row) => ({
      patientId: row.patient_id,
      name: row.full_name,
      phone: row.phone,
      vars: {
        balance: `${formatWholeMoney(row.balance)} ${currencySymbol(currency)}`.trim(),
      },
    }));
  }

  /** Confirmed appointments on the clinic's own tomorrow, the earliest per patient. */
  async tomorrow(clinicId: string, timeZone: string, limit: number): Promise<Candidate[]> {
    const tomorrow = addDays(localDate(new Date(), timeZone), 1);
    const from = instantFromLocal(tomorrow, 0, timeZone);
    const to = instantFromLocal(addDays(tomorrow, 1), 0, timeZone);

    const rows = await this.db
      .select({
        patientId: patients.id,
        name: patients.fullName,
        phone: patients.phone,
        startsAt: appointments.startsAt,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          isNull(appointments.deletedAt),
          isNull(patients.deletedAt),
          eq(appointments.status, APPOINTMENT_STATUS.CONFIRMED),
          gte(appointments.startsAt, from),
          lt(appointments.startsAt, to),
        ),
      )
      .orderBy(asc(appointments.startsAt));

    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    for (const row of rows) {
      if (seen.has(row.patientId)) {
        continue;
      }

      seen.add(row.patientId);
      candidates.push({
        patientId: row.patientId,
        name: row.name,
        phone: row.phone,
        vars: {
          time: clockTime(row.startsAt, tomorrow, timeZone),
          doctor: notificationName({ ar: row.doctorNameAr, en: row.doctorNameEn }),
        },
      });

      if (candidates.length >= limit) {
        break;
      }
    }

    return candidates;
  }

  /** Only this clinic's live patients: an id from anywhere else simply resolves to nobody. */
  async explicit(clinicId: string, patientIds: readonly string[]): Promise<Candidate[]> {
    if (patientIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({ patientId: patients.id, name: patients.fullName, phone: patients.phone })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
          inArray(patients.id, [...new Set(patientIds)]),
        ),
      )
      .orderBy(asc(patients.fullName));

    return rows.map((row) => ({ ...row, vars: {} }));
  }

  async clinic(clinicId: string): Promise<ClinicContext> {
    const [row] = await this.db
      .select({
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        currency: clinics.currency,
        settings: clinics.settings,
      })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return {
      name: notificationName({ ar: row?.nameAr ?? "", en: row?.nameEn ?? "" }),
      currency: row?.currency ?? "",
      timeZone: clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE,
      settings: row?.settings ?? {},
    };
  }
}

interface UnpaidRow extends Record<string, unknown> {
  readonly patient_id: string;
  readonly full_name: string;
  readonly phone: string;
  readonly balance: string;
}

export interface ClinicContext {
  readonly name: string;
  readonly currency: string;
  readonly timeZone: string;
  readonly settings: Record<string, unknown>;
}

function clockTime(at: Date, isoDate: string, timeZone: string): string {
  const minutes = Math.round(minutesFromLocalMidnight(at, isoDate, timeZone));

  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
