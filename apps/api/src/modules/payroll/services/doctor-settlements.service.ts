import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  STAFF_PAYMENT_KIND,
  addDays,
  addMoney,
  instantFromLocal,
  type CreateStaffPaymentInput,
  type DoctorSettlement,
  type StaffPayment,
  type SettlementQuery,
  type SettlementTermsInput,
  type UpdateTreatmentSettlementInput,
} from "@clinic/shared";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, performedProcedures, staffPayments } from "@api/database/schema";
import { negate } from "@api/common/lib/money";
import {
  oneDoctor,
  settlementRows,
  toSettlementTreatment,
  visitingDoctors,
  type SettlementRow,
} from "@api/modules/payroll/lib/doctor-settlements";
import { toStaffPayment } from "@api/modules/payroll/lib/payroll";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

@Injectable()
export class DoctorSettlementsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly payments: StaffPaymentsService,
  ) {}

  async settlement(
    actor: AuthenticatedUser,
    doctorId: string,
    query: SettlementQuery,
  ): Promise<DoctorSettlement> {
    const doctor = await this.requireDoctor(actor, doctorId);
    const timeZone = await clinicTimeZone(this.db, actor.clinicId);
    const start = instantFromLocal(query.from, 0, timeZone);
    const end = instantFromLocal(addDays(query.to, 1), 0, timeZone);

    const [rows, earnedRows, payouts, paidRows] = await Promise.all([
      this.db.execute<SettlementRow & Record<string, unknown>>(
        sql`${settlementRows(
          actor.clinicId,
          oneDoctor(doctorId),
          sql`p.performed_at >= ${start.toISOString()}::timestamptz and p.performed_at < ${end.toISOString()}::timestamptz`,
        )} order by performed_at desc`,
      ),
      this.db.execute<{ earned: string | null }>(
        sql`select coalesce(sum(doctor_share), 0)::numeric(12, 2)::text as earned from (${settlementRows(
          actor.clinicId,
          oneDoctor(doctorId),
        )}) settled`,
      ),
      this.db
        .select()
        .from(staffPayments)
        .where(
          and(
            this.paymentsOf(actor.clinicId, doctor.userId),
            gte(staffPayments.createdAt, start),
            lt(staffPayments.createdAt, end),
          ),
        )
        .orderBy(desc(staffPayments.createdAt)),
      this.db
        .select({ paid: sql<string>`coalesce(sum(${staffPayments.amount}), 0)::text` })
        .from(staffPayments)
        .where(this.paymentsOf(actor.clinicId, doctor.userId)),
    ]);

    const treatments = [...rows].map(toSettlementTreatment);
    const earned = earnedRows[0]?.earned ?? "0.00";
    const paid = paidRows[0]?.paid ?? "0.00";

    return {
      doctorId,
      from: query.from,
      to: query.to,
      clinicSharePercent: Number(doctor.clinicSharePercent ?? 0),
      treatments,
      totals: treatments.reduce(
        (sum, row) => ({
          revenue: addMoney(sum.revenue, addMoney(row.price, negate(row.discount))),
          materials: addMoney(sum.materials, row.materialCost),
          net: addMoney(sum.net, row.net),
          clinicShare: addMoney(sum.clinicShare, row.clinicShare),
          doctorShare: addMoney(sum.doctorShare, row.doctorShare),
        }),
        {
          revenue: "0.00",
          materials: "0.00",
          net: "0.00",
          clinicShare: "0.00",
          doctorShare: "0.00",
        },
      ),
      payouts: payouts.map(toStaffPayment),
      earned: addMoney(earned, "0.00"),
      paid: addMoney(paid, "0.00"),
      balance: addMoney(earned, negate(addMoney(paid, "0.00"))),
    };
  }

  async updateTerms(
    actor: AuthenticatedUser,
    doctorId: string,
    input: SettlementTermsInput,
  ): Promise<void> {
    await this.requireDoctor(actor, doctorId);

    await this.db
      .update(doctors)
      .set({
        clinicSharePercent: String(input.clinicSharePercent),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)));
  }

  async updateTreatment(
    actor: AuthenticatedUser,
    treatmentId: string,
    input: UpdateTreatmentSettlementInput,
  ): Promise<void> {
    const [row] = await this.db
      .update(performedProcedures)
      .set({
        ...(input.materialCost !== undefined && { materialCost: input.materialCost }),
        ...(input.clinicSharePercent !== undefined && {
          clinicSharePercent:
            input.clinicSharePercent === null ? null : String(input.clinicSharePercent),
        }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(
        this.scope.where(
          performedProcedures,
          actor.clinicId,
          eq(performedProcedures.id, treatmentId),
        ),
      )
      .returning({ id: performedProcedures.id });

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
  }

  async createPayout(
    actor: AuthenticatedUser,
    doctorId: string,
    input: CreateStaffPaymentInput,
  ): Promise<StaffPayment> {
    const doctor = await this.requireDoctor(actor, doctorId);

    return this.payments.record(
      actor,
      { userId: doctor.userId, kind: STAFF_PAYMENT_KIND.SETTLEMENT, month: null },
      input,
    );
  }

  async visitingSharesBetween(clinicId: string, start: Date, end: Date): Promise<string> {
    const [row] = await this.db.execute<{ total: string | null }>(
      sql`select coalesce(sum(doctor_share), 0)::numeric(12, 2)::text as total from (${settlementRows(
        clinicId,
        visitingDoctors,
        sql`p.performed_at >= ${start.toISOString()}::timestamptz and p.performed_at < ${end.toISOString()}::timestamptz`,
      )}) settled`,
    );

    return addMoney(row?.total ?? "0.00", "0.00");
  }

  private paymentsOf(clinicId: string, userId: string) {
    return and(
      eq(staffPayments.clinicId, clinicId),
      eq(staffPayments.userId, userId),
      eq(staffPayments.kind, STAFF_PAYMENT_KIND.SETTLEMENT),
    );
  }

  private async requireDoctor(
    actor: AuthenticatedUser,
    doctorId: string,
  ): Promise<{ clinicSharePercent: string | null; userId: string }> {
    const [row] = await this.db
      .select({ clinicSharePercent: doctors.clinicSharePercent, userId: doctors.userId })
      .from(doctors)
      .where(and(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId))))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }
}
