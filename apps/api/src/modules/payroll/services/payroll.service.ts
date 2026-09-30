import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  PAYROLL_ADJUSTMENT_KIND,
  PAYROLL_ERROR,
  STAFF_PAYMENT_KIND,
  USER_ROLE,
  addMoney,
  instantFromLocal,
  localDate,
  type CreatePayrollAdjustmentInput,
  type CreateSalaryPaymentInput,
  type Payroll,
  type PayrollAdjustment,
  type PayrollLine,
  type PayrollMonth,
  type SalaryTerm,
  type SalaryTermsInput,
  type StaffPayment,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  payrollAdjustments,
  payrollMonths,
  salaryTerms,
  staffPayments,
  users,
  type PayrollLineSnapshot,
} from "@api/database/schema";
import {
  PAYROLL_ADJUSTMENTS_ENTITY,
  PAYROLL_MONTHS_ENTITY,
  SALARY_TERMS_ENTITY,
} from "@api/common/constants/audit-entities";
import { negate } from "@api/common/lib/money";
import {
  monthEnd,
  monthOf,
  monthStart,
  nextMonthStart,
  toAdjustment,
  toSalaryTerm,
  toStaffPayment,
} from "@api/modules/payroll/lib/payroll";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

const ZERO = "0.00";

@Injectable()
export class PayrollService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payments: StaffPaymentsService,
    private readonly settlements: DoctorSettlementsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SALARY_TERMS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(salaryTerms)
        .where(and(eq(salaryTerms.clinicId, clinicId), eq(salaryTerms.id, id)))
        .limit(1);

      return row ? { ...toSalaryTerm(row) } : null;
    });

    this.auditSnapshots.register(PAYROLL_ADJUSTMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(payrollAdjustments)
        .where(and(eq(payrollAdjustments.clinicId, clinicId), eq(payrollAdjustments.id, id)))
        .limit(1);

      return row ? { ...toAdjustment(row) } : null;
    });

    this.auditSnapshots.register(PAYROLL_MONTHS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(payrollMonths)
        .where(and(eq(payrollMonths.clinicId, clinicId), eq(payrollMonths.id, id)))
        .limit(1);

      return row ? { month: monthOf(row.month), lines: row.lines } : null;
    });
  }

  async payroll(actor: AuthenticatedUser, month: PayrollMonth): Promise<Payroll> {
    const closed = await this.closedMonth(actor.clinicId, month);
    const lines = await this.linesFor(actor.clinicId, month, closed?.lines);
    const timeZone = await clinicTimeZone(this.db, actor.clinicId);
    const visitingShares = await this.settlements.visitingSharesBetween(
      actor.clinicId,
      instantFromLocal(monthStart(month), 0, timeZone),
      instantFromLocal(nextMonthStart(month), 0, timeZone),
    );

    const totals = lines.reduce(
      (sum, line) => ({
        base: addMoney(sum.base, line.base),
        extras: addMoney(sum.extras, line.extras),
        cuts: addMoney(sum.cuts, line.cuts),
        due: addMoney(sum.due, line.due),
        paid: addMoney(sum.paid, line.paid),
        remaining: addMoney(sum.remaining, line.remaining),
      }),
      { base: ZERO, extras: ZERO, cuts: ZERO, due: ZERO, paid: ZERO, remaining: ZERO },
    );

    return {
      month,
      closedAt: closed?.closedAt.toISOString() ?? null,
      lines,
      totals,
      visitingShares,
      staffCost: addMoney(totals.due, visitingShares),
    };
  }

  async salaryHistory(actor: AuthenticatedUser, userId: string): Promise<SalaryTerm[]> {
    await this.requireEmployee(actor, userId);

    const rows = await this.db
      .select()
      .from(salaryTerms)
      .where(and(eq(salaryTerms.clinicId, actor.clinicId), eq(salaryTerms.userId, userId)))
      .orderBy(desc(salaryTerms.effectiveMonth), desc(salaryTerms.createdAt));

    return rows.map(toSalaryTerm);
  }

  async setSalary(
    actor: AuthenticatedUser,
    userId: string,
    input: SalaryTermsInput,
  ): Promise<SalaryTerm> {
    await this.requireEmployee(actor, userId);
    await this.requireOpenFrom(actor.clinicId, input.effectiveMonth);

    const [row] = await this.db
      .insert(salaryTerms)
      .values({
        clinicId: actor.clinicId,
        userId,
        monthlyAmount: input.monthlyAmount,
        effectiveMonth: monthStart(input.effectiveMonth),
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the salary");
    }

    return toSalaryTerm(row);
  }

  async addAdjustment(
    actor: AuthenticatedUser,
    month: PayrollMonth,
    input: CreatePayrollAdjustmentInput,
  ): Promise<PayrollAdjustment> {
    await this.requireEmployee(actor, input.userId);
    await this.requireOpen(actor.clinicId, month);

    const [row] = await this.db
      .insert(payrollAdjustments)
      .values({
        clinicId: actor.clinicId,
        userId: input.userId,
        month: monthStart(month),
        kind: input.kind,
        amount: input.amount,
        reason: input.reason,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the adjustment");
    }

    return toAdjustment(row);
  }

  async reverseAdjustment(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<PayrollAdjustment> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(payrollAdjustments)
        .where(and(eq(payrollAdjustments.clinicId, actor.clinicId), eq(payrollAdjustments.id, id)))
        .limit(1)
        .for("update");

      if (!original) {
        throw new NotFoundException("Resource not found");
      }
      if (original.reversesId !== null) {
        throw new BadRequestException("A reversing entry cannot itself be reversed");
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException("This adjustment has already been reversed");
      }

      await this.requireOpen(actor.clinicId, monthOf(original.month));

      await tx
        .update(payrollAdjustments)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(payrollAdjustments.id, original.id));

      const [row] = await tx
        .insert(payrollAdjustments)
        .values({
          clinicId: original.clinicId,
          userId: original.userId,
          month: original.month,
          kind: original.kind,
          amount: negate(original.amount),
          reason,
          reversesId: original.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to reverse the adjustment");
      }

      return toAdjustment(row);
    });
  }

  async pay(
    actor: AuthenticatedUser,
    month: PayrollMonth,
    input: CreateSalaryPaymentInput,
  ): Promise<StaffPayment> {
    await this.requireEmployee(actor, input.userId);

    return this.payments.record(
      actor,
      { userId: input.userId, kind: STAFF_PAYMENT_KIND.SALARY, month: monthStart(month) },
      input,
    );
  }

  async close(actor: AuthenticatedUser, month: PayrollMonth): Promise<Payroll> {
    if (await this.closedMonth(actor.clinicId, month)) {
      throw new ConflictException(PAYROLL_ERROR.ALREADY_CLOSED);
    }

    const today = localDate(new Date(), await clinicTimeZone(this.db, actor.clinicId));
    if (monthStart(month) > today) {
      throw new BadRequestException(PAYROLL_ERROR.FUTURE_MONTH);
    }

    const lines = await this.linesFor(actor.clinicId, month);

    await this.db.insert(payrollMonths).values({
      clinicId: actor.clinicId,
      month: monthStart(month),
      lines: lines.map(({ userId, base, extras, cuts, due }) => ({
        userId,
        base,
        extras,
        cuts,
        due,
      })),
      closedBy: actor.id,
    });

    return this.payroll(actor, month);
  }

  private async linesFor(
    clinicId: string,
    month: PayrollMonth,
    snapshot?: readonly PayrollLineSnapshot[],
  ): Promise<PayrollLine[]> {
    const start = monthStart(month);
    const snapshotIds = (snapshot ?? []).map((line) => line.userId);

    const staff = await this.db
      .select({
        id: users.id,
        nameAr: users.nameAr,
        nameEn: users.nameEn,
        role: users.role,
        joinedOn: users.joinedOn,
      })
      .from(users)
      .where(
        and(
          eq(users.clinicId, clinicId),
          snapshot
            ? snapshotIds.length === 0
              ? sql`false`
              : inArray(users.id, snapshotIds)
            : and(
                isNull(users.deletedAt),
                eq(users.isActive, true),
                ne(users.role, USER_ROLE.VISITING_DOCTOR),
                or(isNull(users.joinedOn), lte(users.joinedOn, monthEnd(month))),
              ),
        ),
      )
      .orderBy(asc(users.nameAr));

    const ids = staff.map((person) => person.id);
    if (ids.length === 0) {
      return [];
    }

    const [terms, adjustments, paid] = await Promise.all([
      this.db
        .select()
        .from(salaryTerms)
        .where(
          and(
            eq(salaryTerms.clinicId, clinicId),
            inArray(salaryTerms.userId, ids),
            lte(salaryTerms.effectiveMonth, start),
          ),
        )
        .orderBy(desc(salaryTerms.effectiveMonth), desc(salaryTerms.createdAt)),
      this.db
        .select()
        .from(payrollAdjustments)
        .where(
          and(
            eq(payrollAdjustments.clinicId, clinicId),
            inArray(payrollAdjustments.userId, ids),
            eq(payrollAdjustments.month, start),
          ),
        )
        .orderBy(desc(payrollAdjustments.createdAt)),
      this.db
        .select()
        .from(staffPayments)
        .where(
          and(
            eq(staffPayments.clinicId, clinicId),
            inArray(staffPayments.userId, ids),
            eq(staffPayments.kind, STAFF_PAYMENT_KIND.SALARY),
            eq(staffPayments.month, start),
          ),
        )
        .orderBy(desc(staffPayments.createdAt)),
    ]);

    return staff.map((person) => {
      const own = adjustments.filter((row) => row.userId === person.id);
      const payments = paid.filter((row) => row.userId === person.id);
      const frozen = snapshot?.find((line) => line.userId === person.id);
      const base =
        frozen?.base ?? terms.find((row) => row.userId === person.id)?.monthlyAmount ?? ZERO;
      const extras =
        frozen?.extras ?? sumOf(own.filter((row) => row.kind === PAYROLL_ADJUSTMENT_KIND.EXTRA));
      const cuts =
        frozen?.cuts ?? sumOf(own.filter((row) => row.kind === PAYROLL_ADJUSTMENT_KIND.CUT));
      const due = frozen?.due ?? addMoney(addMoney(base, extras), negate(cuts));
      const settled = sumOf(payments);

      return {
        userId: person.id,
        name: { ar: person.nameAr, en: person.nameEn },
        role: person.role,
        joinedOn: person.joinedOn,
        base: addMoney(base, ZERO),
        extras,
        cuts,
        due,
        paid: settled,
        remaining: addMoney(due, negate(settled)),
        adjustments: own.map(toAdjustment),
        payments: payments.map(toStaffPayment),
      };
    });
  }

  private async closedMonth(clinicId: string, month: PayrollMonth) {
    const [row] = await this.db
      .select()
      .from(payrollMonths)
      .where(and(eq(payrollMonths.clinicId, clinicId), eq(payrollMonths.month, monthStart(month))))
      .limit(1);

    return row ?? null;
  }

  private async requireOpen(clinicId: string, month: PayrollMonth): Promise<void> {
    if (await this.closedMonth(clinicId, month)) {
      throw new ConflictException(PAYROLL_ERROR.MONTH_CLOSED);
    }
  }

  private async requireOpenFrom(clinicId: string, month: PayrollMonth): Promise<void> {
    const [row] = await this.db
      .select({ month: payrollMonths.month })
      .from(payrollMonths)
      .where(
        and(
          eq(payrollMonths.clinicId, clinicId),
          sql`${payrollMonths.month} >= ${monthStart(month)}`,
        ),
      )
      .limit(1);

    if (row) {
      throw new ConflictException(PAYROLL_ERROR.MONTH_CLOSED);
    }
  }

  private async requireEmployee(actor: AuthenticatedUser, userId: string): Promise<void> {
    const [row] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.clinicId, actor.clinicId), eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
    if (row.role === USER_ROLE.VISITING_DOCTOR) {
      throw new BadRequestException(PAYROLL_ERROR.NOT_EMPLOYEE);
    }
  }
}

function sumOf(rows: readonly { amount: string }[]): string {
  return rows.reduce((total, row) => addMoney(total, row.amount), ZERO);
}
