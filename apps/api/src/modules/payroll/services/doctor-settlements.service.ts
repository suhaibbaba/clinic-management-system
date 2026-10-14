import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  PAY_PLAN_KIND,
  PAYROLL_ERROR,
  STAFF_PAYMENT_KIND,
  addDays,
  addMoney,
  instantFromLocal,
  type CreateSettlementPayoutInput,
  type DoctorSettlement,
  type OwnSettlement,
  type SettlementPayout,
  type SettlementQuery,
  type SettlementTermsInput,
  type SettlementTreatment,
  type TreatmentSettlementStatus,
  type UpdateTreatmentSettlementInput,
} from "@clinic/shared";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  doctors,
  performedProcedures,
  settlementItems,
  staffPayments,
  users,
} from "@api/database/schema";
import { SETTLEMENT_TREATMENTS_ENTITY } from "@api/common/constants/audit-entities";
import { negate } from "@api/common/lib/money";
import {
  oneDoctor,
  payoutItems,
  performedBetween,
  settlementLines,
  toSettlementItem,
  toSettlementTreatment,
  type SettlementItemRow,
  type SettlementRow,
  type SettlementScope,
  type ShareTotals,
  totalsOf,
} from "@api/modules/payroll/lib/doctor-settlements";
import { includesShare } from "@api/modules/payroll/lib/pay-terms";
import { toStaffPayment, type StaffPaymentRow } from "@api/modules/payroll/lib/payroll";
import { PayTermsService } from "@api/modules/payroll/services/pay-terms.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

const ZERO = "0.00";

interface DoctorRow {
  readonly id: string;
  readonly userId: string;
  readonly role: AuthenticatedUser["role"];
  readonly clinicSharePercent: string | null;
}

@Injectable()
export class DoctorSettlementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly payments: StaffPaymentsService,
    private readonly terms: PayTermsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SETTLEMENT_TREATMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select({
          materialCost: performedProcedures.materialCost,
          clinicSharePercent: performedProcedures.clinicSharePercent,
          shareSplit: performedProcedures.shareSplit,
          shareWaivedReason: performedProcedures.shareWaivedReason,
        })
        .from(performedProcedures)
        .where(this.scope.where(performedProcedures, clinicId, eq(performedProcedures.id, id)))
        .limit(1);

      return row ? { ...row } : null;
    });
  }

  async settlement(
    actor: AuthenticatedUser,
    doctorId: string,
    query: SettlementQuery,
  ): Promise<DoctorSettlement> {
    const doctor = await this.requireDoctor(actor.clinicId, doctorId);
    const month = await this.terms.currentMonth(actor.clinicId);
    const [statement, rules, rate, plans] = await Promise.all([
      this.statement(actor.clinicId, doctor, query),
      this.terms.payRules(actor),
      this.terms.doctorRateAt(actor.clinicId, doctor, month),
      this.terms.plansAt(actor.clinicId, [{ id: doctor.userId, role: doctor.role }], month),
    ]);

    return {
      doctorId,
      from: query.from,
      to: query.to,
      clinicSharePercent: rate,
      onPercentage: includesShare(plans.get(doctor.userId) ?? PAY_PLAN_KIND.SALARY),
      basis: rules.current.basis,
      labCostBearer: rules.current.labCostBearer,
      ...statement,
    };
  }

  async ownSettlement(actor: AuthenticatedUser, query: SettlementQuery): Promise<OwnSettlement> {
    const doctor = await this.doctorOfUser(actor.clinicId, actor.id);
    const [statement, rules] = await Promise.all([
      this.statement(actor.clinicId, doctor, query),
      this.terms.payRules(actor),
    ]);

    return {
      from: query.from,
      to: query.to,
      basis: rules.current.basis,
      lines: statement.treatments.map((line) => ({
        id: line.id,
        performedAt: line.performedAt,
        patientId: line.patientId,
        patientName: line.patientName,
        fileNumber: line.fileNumber,
        procedureName: line.procedureName,
        revenue: line.revenue,
        workPercent: line.workPercent,
        doctorShare: line.doctorShare,
        waivedReason: line.waivedReason,
        collectedPercent: line.collectedPercent,
        payable: line.payable,
        paid: line.paid,
        outstanding: line.outstanding,
        status: line.status,
      })),
      totals: {
        payable: statement.totals.payable,
        paid: statement.totals.paid,
        outstanding: statement.totals.outstanding,
      },
      payouts: statement.payouts,
      earned: statement.earned,
      paid: statement.paid,
      balance: statement.balance,
    };
  }

  async updateTerms(
    actor: AuthenticatedUser,
    doctorId: string,
    input: SettlementTermsInput,
  ): Promise<{ id: string }> {
    await this.requireDoctor(actor.clinicId, doctorId);

    return {
      id: await this.terms.setDoctorRate(
        actor,
        doctorId,
        input.clinicSharePercent,
        input.effectiveMonth,
      ),
    };
  }

  async updateTreatment(
    actor: AuthenticatedUser,
    treatmentId: string,
    input: UpdateTreatmentSettlementInput,
  ): Promise<void> {
    if (input.shareSplit) {
      await this.requireDoctors(
        actor.clinicId,
        input.shareSplit.map((entry) => entry.doctorId),
      );
    }

    const [row] = await this.db
      .update(performedProcedures)
      .set({
        ...(input.materialCost !== undefined && { materialCost: input.materialCost }),
        ...(input.clinicSharePercent !== undefined && {
          clinicSharePercent:
            input.clinicSharePercent === null ? null : String(input.clinicSharePercent),
        }),
        ...(input.shareSplit !== undefined && { shareSplit: input.shareSplit }),
        ...(input.shareWaivedReason !== undefined && {
          shareWaivedReason: input.shareWaivedReason,
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
    input: CreateSettlementPayoutInput,
  ): Promise<SettlementPayout> {
    const doctor = await this.requireDoctor(actor.clinicId, doctorId);
    const timeZone = await clinicTimeZone(this.db, actor.clinicId);
    const treatmentIds = input.treatmentIds ?? [];

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`settlement:${doctorId}`}))`);

      if (treatmentIds.length === 0) {
        const month = await this.terms.currentMonth(actor.clinicId);
        const plans = await this.terms.plansAt(
          actor.clinicId,
          [{ id: doctor.userId, role: doctor.role }],
          month,
        );

        if (!includesShare(plans.get(doctor.userId) ?? PAY_PLAN_KIND.SALARY)) {
          throw new BadRequestException(PAYROLL_ERROR.NOT_ON_PERCENTAGE);
        }

        const payout = await this.payments.record(
          actor,
          { userId: doctor.userId, kind: STAFF_PAYMENT_KIND.SETTLEMENT, month: null },
          { amount: input.amount ?? ZERO, method: input.method, note: input.note ?? null },
          tx,
        );

        return { ...payout, items: [] };
      }

      const lines = await this.lines(
        {
          clinicId: actor.clinicId,
          timeZone,
          doctors: oneDoctor(doctorId),
          treatments: sql`p.id in (${sql.join(
            treatmentIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        },
        tx,
      );

      if (treatmentIds.some((id) => !lines.some((line) => line.id === id))) {
        throw new NotFoundException("Resource not found");
      }

      const owed = lines.filter((line) => Number(line.outstanding) !== 0);
      const total = owed.reduce((sum, line) => addMoney(sum, line.outstanding), ZERO);

      if (Number(total) <= 0) {
        throw new BadRequestException(PAYROLL_ERROR.NOTHING_TO_PAY);
      }

      const payout = await this.payments.record(
        actor,
        { userId: doctor.userId, kind: STAFF_PAYMENT_KIND.SETTLEMENT, month: null },
        { amount: total, method: input.method, note: input.note ?? null },
        tx,
      );

      await tx.insert(settlementItems).values(
        owed.map((line) => ({
          clinicId: actor.clinicId,
          payoutId: payout.id,
          performedProcedureId: line.id,
          doctorId,
          amount: line.outstanding,
          createdBy: actor.id,
        })),
      );

      return {
        ...payout,
        items: owed.map((line) => ({
          treatmentId: line.id,
          patientId: line.patientId,
          patientName: line.patientName,
          fileNumber: line.fileNumber,
          procedureName: line.procedureName,
          performedAt: line.performedAt,
          amount: line.outstanding,
        })),
      };
    });
  }

  async payout(
    actor: AuthenticatedUser,
    doctorId: string,
    payoutId: string,
  ): Promise<SettlementPayout> {
    const doctor = await this.requireDoctor(actor.clinicId, doctorId);
    const [row] = await this.db
      .select()
      .from(staffPayments)
      .where(and(this.paymentsOf(actor.clinicId, doctor.userId), eq(staffPayments.id, payoutId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    const [payout] = await this.withItems(actor.clinicId, [row]);

    if (!payout) {
      throw new NotFoundException("Resource not found");
    }

    return payout;
  }

  async treatmentStatuses(
    actor: AuthenticatedUser,
    patientId: string,
  ): Promise<TreatmentSettlementStatus[]> {
    const timeZone = await clinicTimeZone(this.db, actor.clinicId);
    const rows = await this.db.execute<
      SettlementRow & { name_ar: string; name_en: string } & Record<string, unknown>
    >(
      sql`select line.*, u.name_ar, u.name_en
          from (${settlementLines({
            clinicId: actor.clinicId,
            timeZone,
            treatments: sql`p.patient_id = ${patientId}`,
          })}) line
          join doctors d on d.id = line.doctor_id
          join users u on u.id = d.user_id
          order by line.performed_at desc`,
    );

    return [...rows].map((row) => ({
      treatmentId: row.id,
      doctorId: row.doctor_id,
      doctorName: { ar: row.name_ar, en: row.name_en },
      payable: row.payable,
      paid: row.paid,
      status: row.status,
      lastPaidAt: row.last_paid_at ? new Date(row.last_paid_at).toISOString() : null,
    }));
  }

  async shareTotalsBetween(
    clinicId: string,
    start: Date,
    end: Date,
  ): Promise<Map<string, ShareTotals>> {
    const timeZone = await clinicTimeZone(this.db, clinicId);
    const rows = await this.db.execute<{
      doctor_id: string;
      share: string;
      payable: string;
      paid: string;
    }>(
      sql`select doctor_id,
                 coalesce(sum(doctor_share), 0)::numeric(12, 2)::text as share,
                 coalesce(sum(payable), 0)::numeric(12, 2)::text as payable,
                 coalesce(sum(paid), 0)::numeric(12, 2)::text as paid
          from (${settlementLines({ clinicId, timeZone, window: performedBetween(start, end) })}) settled
          group by doctor_id`,
    );

    return new Map(
      [...rows].map((row) => [
        row.doctor_id,
        {
          share: addMoney(row.share, ZERO),
          payable: addMoney(row.payable, ZERO),
          paid: addMoney(row.paid, ZERO),
        },
      ]),
    );
  }

  private async statement(
    clinicId: string,
    doctor: DoctorRow,
    query: SettlementQuery,
  ): Promise<
    Pick<DoctorSettlement, "treatments" | "totals" | "payouts" | "earned" | "paid" | "balance">
  > {
    const timeZone = await clinicTimeZone(this.db, clinicId);
    const start = instantFromLocal(query.from, 0, timeZone);
    const end = instantFromLocal(addDays(query.to, 1), 0, timeZone);

    const [treatments, earnedRows, payoutRows, paidRows] = await Promise.all([
      this.lines({
        clinicId,
        timeZone,
        doctors: oneDoctor(doctor.id),
        window: performedBetween(start, end),
      }),
      this.db.execute<{ earned: string | null }>(
        sql`select coalesce(sum(payable), 0)::numeric(12, 2)::text as earned from (${settlementLines(
          { clinicId, timeZone, doctors: oneDoctor(doctor.id) },
        )}) settled`,
      ),
      this.db
        .select()
        .from(staffPayments)
        .where(
          and(
            this.paymentsOf(clinicId, doctor.userId),
            gte(staffPayments.createdAt, start),
            lt(staffPayments.createdAt, end),
          ),
        )
        .orderBy(desc(staffPayments.createdAt)),
      this.db
        .select({ paid: sql<string>`coalesce(sum(${staffPayments.amount}), 0)::text` })
        .from(staffPayments)
        .where(this.paymentsOf(clinicId, doctor.userId)),
    ]);

    const filtered = query.status
      ? treatments.filter((line) => line.status === query.status)
      : treatments;
    const earned = addMoney(earnedRows[0]?.earned ?? ZERO, ZERO);
    const paid = addMoney(paidRows[0]?.paid ?? ZERO, ZERO);

    return {
      treatments: filtered,
      totals: totalsOf(filtered),
      payouts: await this.withItems(clinicId, payoutRows),
      earned,
      paid,
      balance: addMoney(earned, negate(paid)),
    };
  }

  private async lines(
    scope: SettlementScope,
    executor: DatabaseExecutor = this.db,
  ): Promise<SettlementTreatment[]> {
    const rows = await executor.execute<SettlementRow & Record<string, unknown>>(
      sql`${settlementLines(scope)} order by performed_at desc`,
    );

    return [...rows].map(toSettlementTreatment);
  }

  private async withItems(
    clinicId: string,
    rows: readonly StaffPaymentRow[],
  ): Promise<SettlementPayout[]> {
    const items =
      rows.length === 0
        ? []
        : [
            ...(await this.db.execute<SettlementItemRow & Record<string, unknown>>(
              payoutItems(
                clinicId,
                rows.map((row) => row.id),
              ),
            )),
          ];

    return rows.map((row) => ({
      ...toStaffPayment(row),
      items: items.filter((item) => item.payout_id === row.id).map(toSettlementItem),
    }));
  }

  private paymentsOf(clinicId: string, userId: string) {
    return and(
      eq(staffPayments.clinicId, clinicId),
      eq(staffPayments.userId, userId),
      eq(staffPayments.kind, STAFF_PAYMENT_KIND.SETTLEMENT),
    );
  }

  private async requireDoctor(clinicId: string, doctorId: string): Promise<DoctorRow> {
    const [row] = await this.db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        role: users.role,
        clinicSharePercent: doctors.clinicSharePercent,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(this.scope.where(doctors, clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  private async doctorOfUser(clinicId: string, userId: string): Promise<DoctorRow> {
    const [row] = await this.db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        role: users.role,
        clinicSharePercent: doctors.clinicSharePercent,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(this.scope.where(doctors, clinicId, eq(doctors.userId, userId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  private async requireDoctors(clinicId: string, ids: readonly string[]): Promise<void> {
    const rows = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(
        and(
          eq(doctors.clinicId, clinicId),
          inArray(doctors.id, [...ids]),
          isNull(doctors.deletedAt),
        ),
      );

    if (rows.length !== new Set(ids).size) {
      throw new NotFoundException("Resource not found");
    }
  }
}
