import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import {
  DASHBOARD_COLLECTION_DAYS,
  DASHBOARD_VISITS_LIMIT,
  RULE,
  addDays,
  instantFromLocal,
  localDate,
  type DashboardCollections,
  type DashboardVisits,
  type Money,
} from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, patients, payments, users, visits } from "@api/database/schema";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { normalise } from "@api/common/lib/money";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";

interface Day {
  readonly date: string;
  readonly timeZone: string;
  readonly start: Date;
  readonly end: Date;
}

@Injectable()
export class DashboardActivityService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly permissions: PermissionsService,
  ) {}

  async visitsToday(actor: AuthenticatedUser): Promise<DashboardVisits> {
    const day = await this.today(actor.clinicId);
    const where = await this.visitsWhere(actor, day);

    const [rows, [counted]] = await Promise.all([
      this.db
        .select({
          id: visits.id,
          visitDate: visits.visitDate,
          patientId: patients.id,
          patientName: patients.fullName,
          fileNumber: patients.fileNumber,
          doctorName: users.name,
        })
        .from(visits)
        .innerJoin(patients, eq(patients.id, visits.patientId))
        .innerJoin(doctors, eq(doctors.id, visits.doctorId))
        .innerJoin(users, eq(users.id, doctors.userId))
        .where(where)
        .orderBy(desc(visits.visitDate))
        .limit(DASHBOARD_VISITS_LIMIT),
      this.db
        .select({ total: count() })
        .from(visits)
        .innerJoin(patients, eq(patients.id, visits.patientId))
        .innerJoin(doctors, eq(doctors.id, visits.doctorId))
        .where(where),
    ]);

    const balances = (await this.permissions.can(actor, RULE.PATIENTS_FINANCIAL))
      ? await this.ledger.balancesFor(actor.clinicId, [
          ...new Set(rows.map((row) => row.patientId)),
        ])
      : null;

    return {
      items: rows.map((row) => {
        const balance = balances?.get(row.patientId);

        return {
          id: row.id,
          visitDate: row.visitDate.toISOString(),
          patientId: row.patientId,
          patientName: row.patientName,
          fileNumber: row.fileNumber,
          doctorName: row.doctorName,
          ...(balances !== null && { balance: balance ?? normalise("0") }),
        };
      }),
      total: counted?.total ?? 0,
    };
  }

  async visitsTodayCount(actor: AuthenticatedUser): Promise<number> {
    const day = await this.today(actor.clinicId);
    const [row] = await this.db
      .select({ total: count() })
      .from(visits)
      .innerJoin(patients, eq(patients.id, visits.patientId))
      .innerJoin(doctors, eq(doctors.id, visits.doctorId))
      .where(await this.visitsWhere(actor, day));

    return row?.total ?? 0;
  }

  async collections(clinicId: string): Promise<DashboardCollections> {
    const today = await this.today(clinicId);
    const first = addDays(today.date, 1 - DASHBOARD_COLLECTION_DAYS);
    const start = instantFromLocal(first, 0, today.timeZone);

    const rows = await this.db.execute<{ day: string; total: string }>(sql`
      select to_char(created_at at time zone ${today.timeZone}, 'YYYY-MM-DD') as day,
             sum(amount)::text as total
      from payments
      where clinic_id = ${clinicId} and deleted_at is null
        and created_at >= ${start.toISOString()} and created_at < ${today.end.toISOString()}
      group by 1
    `);
    const byDay = new Map([...rows].map((row) => [row.day, normalise(row.total)]));

    return {
      days: Array.from({ length: DASHBOARD_COLLECTION_DAYS }, (_, index) => {
        const date = addDays(first, index);

        return { date, total: byDay.get(date) ?? normalise("0") };
      }),
    };
  }

  async collectedToday(clinicId: string): Promise<Money> {
    const day = await this.today(clinicId);
    const [row] = await this.db
      .select({ total: sql<string | null>`sum(${payments.amount})::text` })
      .from(payments)
      .where(
        and(
          eq(payments.clinicId, clinicId),
          isNull(payments.deletedAt),
          gte(payments.createdAt, day.start),
          lt(payments.createdAt, day.end),
        ),
      );

    return normalise(row?.total ?? "0");
  }

  async newPatientsToday(clinicId: string): Promise<number> {
    const day = await this.today(clinicId);
    const [row] = await this.db
      .select({ total: count() })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
          gte(patients.createdAt, day.start),
          lt(patients.createdAt, day.end),
        ),
      );

    return row?.total ?? 0;
  }

  private async visitsWhere(actor: AuthenticatedUser, day: Day): Promise<SQL | undefined> {
    const ownOnly = !(await this.permissions.can(actor, RULE.PATIENTS_ALL));

    return and(
      eq(visits.clinicId, actor.clinicId),
      isNull(visits.deletedAt),
      isNull(patients.deletedAt),
      gte(visits.visitDate, day.start),
      lt(visits.visitDate, day.end),
      ownOnly ? eq(doctors.userId, actor.id) : undefined,
    );
  }

  private async today(clinicId: string): Promise<Day> {
    const timeZone = await clinicTimeZone(this.db, clinicId);
    const date = localDate(new Date(), timeZone);

    return {
      date,
      timeZone,
      start: instantFromLocal(date, 0, timeZone),
      end: instantFromLocal(addDays(date, 1), 0, timeZone),
    };
  }
}
