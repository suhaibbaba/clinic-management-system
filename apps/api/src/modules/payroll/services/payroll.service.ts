import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  PAYMENT_COLLECTOR,
  PAY_PLAN_KIND,
  PAYROLL_ADJUSTMENT_KIND,
  MOVEMENT_TYPE,
  PAYROLL_ERROR,
  STAFF_PAYMENT_KIND,
  STAFF_SHARE_BASIS,
  USER_ROLE,
  addMoney,
  instantFromLocal,
  subtractMoney,
  localDate,
  type CreatePayrollAdjustmentInput,
  type CreateSalaryPaymentInput,
  type MonthProfit,
  type OwnerDraw,
  type Payroll,
  type PayrollAdjustment,
  type PayrollLine,
  type PayrollMonth,
  type SalaryTerm,
  type SalaryTermsInput,
  type StaffPayment,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  doctors,
  labPayments,
  ownerDraws,
  payments,
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
  toOwnerDraw,
  toStaffPayment,
} from "@api/modules/payroll/lib/payroll";
import {
  percentOf,
  profitBeforeShares,
  sumMoney,
  withProfitShares,
  type MonthOutgoings,
} from "@api/modules/payroll/lib/profit";
import { ExpensesService } from "@api/modules/expenses/services/expenses.service";
import {
  defaultShareTerms,
  includesSalary,
  includesShare,
  isEmployee,
  planKindsFor,
} from "@api/modules/payroll/lib/pay-terms";
import { type ShareTotals } from "@api/modules/payroll/lib/doctor-settlements";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import { PayTermsService } from "@api/modules/payroll/services/pay-terms.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

const ZERO = "0.00";

@Injectable()
export class PayrollService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payments: StaffPaymentsService,
    private readonly settlements: DoctorSettlementsService,
    private readonly terms: PayTermsService,
    private readonly expenses: ExpensesService,
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
    const [closed, draw] = await Promise.all([
      this.closedMonth(actor.clinicId, month),
      this.drawOf(actor.clinicId, month),
    ]);
    const { lines, profit, doctorShares } = await this.monthFor(
      actor.clinicId,
      month,
      closed?.lines,
    );

    const totals = lines.reduce(
      (sum, line) => ({
        base: addMoney(sum.base, line.base),
        extras: addMoney(sum.extras, line.extras),
        cuts: addMoney(sum.cuts, line.cuts),
        due: addMoney(sum.due, line.due),
        paid: addMoney(sum.paid, line.paid),
        remaining: addMoney(sum.remaining, line.remaining),
        expected: addMoney(sum.expected, line.expected),
        held: addMoney(sum.held, line.held),
        remitted: addMoney(sum.remitted, line.remitted),
        received: addMoney(sum.received, line.received),
        owed: Number(line.owed) > 0 ? addMoney(sum.owed, line.owed) : sum.owed,
        owedToClinic:
          Number(line.owed) < 0 ? subtractMoney(sum.owedToClinic, line.owed) : sum.owedToClinic,
      }),
      {
        base: ZERO,
        extras: ZERO,
        cuts: ZERO,
        due: ZERO,
        paid: ZERO,
        remaining: ZERO,
        expected: ZERO,
        held: ZERO,
        remitted: ZERO,
        received: ZERO,
        owed: ZERO,
        owedToClinic: ZERO,
      },
    );

    return {
      month,
      closedAt: closed?.closedAt.toISOString() ?? null,
      profit: draw?.profit ?? profit,
      draw,
      lines,
      totals,
      doctorShares,
      staffCost: addMoney(totals.due, doctorShares),
    };
  }

  async ownerDraws(actor: AuthenticatedUser): Promise<OwnerDraw[]> {
    const rows = await this.db
      .select()
      .from(ownerDraws)
      .where(eq(ownerDraws.clinicId, actor.clinicId))
      .orderBy(desc(ownerDraws.month));

    return rows.map(toOwnerDraw);
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
    await this.terms.requireOpenFrom(actor.clinicId, input.effectiveMonth);

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

    const { lines, profit } = await this.monthFor(actor.clinicId, month);

    await this.db.transaction(async (tx) => {
      await tx.insert(payrollMonths).values({
        clinicId: actor.clinicId,
        month: monthStart(month),
        lines: lines.map(
          ({
            userId,
            plan,
            share,
            shareBasis,
            shareRate,
            percentBase,
            percentShare,
            base,
            extras,
            cuts,
            due,
          }) => ({
            userId,
            plan,
            share,
            shareBasis,
            shareRate,
            percentBase,
            percentShare,
            base,
            extras,
            cuts,
            due,
          }),
        ),
        closedBy: actor.id,
      });

      await tx.insert(ownerDraws).values({
        clinicId: actor.clinicId,
        month: monthStart(month),
        amount: profit.ownerProfit,
        profit,
        createdBy: actor.id,
      });
    });

    return this.payroll(actor, month);
  }

  private async monthFor(
    clinicId: string,
    month: PayrollMonth,
    snapshot?: readonly PayrollLineSnapshot[],
  ): Promise<{ lines: PayrollLine[]; profit: MonthProfit; doctorShares: string }> {
    const timeZone = await clinicTimeZone(this.db, clinicId);
    const start = instantFromLocal(monthStart(month), 0, timeZone);
    const end = instantFromLocal(nextMonthStart(month), 0, timeZone);
    const [shares, held, outgoings] = await Promise.all([
      this.settlements.shareTotalsBetween(clinicId, start, end),
      this.settlements.heldBetween(clinicId, start, end),
      this.outgoingsOf(clinicId, month, start, end),
    ]);
    const drafts = await this.linesFor(
      clinicId,
      month,
      { shares, held },
      outgoings.collections,
      snapshot,
    );
    const before = profitBeforeShares(
      outgoings,
      sumMoney(drafts.map((line) => line.due)),
      sumMoney(drafts.map((line) => line.sharePayable)),
    );
    const lines = drafts.map((line) => withShareOfProfit(line, before.beforeShares, snapshot));
    const profit = withProfitShares(
      before,
      sumMoney(
        lines
          .filter((line) => line.shareBasis === STAFF_SHARE_BASIS.PROFIT)
          .map((line) => line.percentShare),
      ),
    );

    return {
      lines,
      profit,
      doctorShares: sumMoney([...shares.values()].map((totals) => totals.share)),
    };
  }

  private async outgoingsOf(
    clinicId: string,
    month: PayrollMonth,
    start: Date,
    end: Date,
  ): Promise<MonthOutgoings> {
    const from = start.toISOString();
    const until = end.toISOString();
    const documentVariance = sql`(case when i.kind = 'invoice' then coalesce((
        select sum(l.variance) from supplier_invoice_lines l where l.invoice_id = i.id
      ), 0) else i.variance end)`;
    const sumWhere = async (query: ReturnType<typeof sql>): Promise<string> => {
      const [row] = [...(await this.db.execute<{ total: string | null }>(query))];

      return addMoney(row?.total ?? ZERO, ZERO);
    };

    const [collections, labs, stock, purchaseVariance, spent] = await Promise.all([
      sumWhere(
        sql`select coalesce(sum(${payments.amount}), 0)::numeric(12, 2)::text as total
            from ${payments}
            where ${payments.clinicId} = ${clinicId} and ${payments.deletedAt} is null
              and ${payments.createdAt} >= ${from}::timestamptz and ${payments.createdAt} < ${until}::timestamptz`,
      ),
      sumWhere(
        sql`select coalesce(sum(${labPayments.amount}), 0)::numeric(12, 2)::text as total
            from ${labPayments}
            where ${labPayments.clinicId} = ${clinicId} and ${labPayments.deletedAt} is null
              and ${labPayments.createdAt} >= ${from}::timestamptz and ${labPayments.createdAt} < ${until}::timestamptz`,
      ),
      sumWhere(
        sql`select (
              coalesce((
                select sum(
                  (case when i.kind = 'credit_note' then -1 else 1 end)
                  * (i.total - ${documentVariance})
                ) from supplier_invoices i
                where i.clinic_id = ${clinicId} and i.status = 'posted'
                  and i.invoice_date >= ${monthStart(month)}::date
                  and i.invoice_date < ${nextMonthStart(month)}::date
              ), 0)
              + coalesce((
                select sum(m.value) from stock_movements m
                join stock_receipt_lines l on l.id = m.receipt_line_id
                join stock_receipts r on r.id = l.receipt_id
                where r.clinic_id = ${clinicId} and r.kind = 'receipt' and r.supplier_id is null
                  and r.status = 'posted' and m.type = ${MOVEMENT_TYPE.PURCHASE} and m.reverses_id is null
                  and r.received_on >= ${monthStart(month)}::date
                  and r.received_on < ${nextMonthStart(month)}::date
              ), 0)
            )::numeric(12, 2)::text as total`,
      ),
      sumWhere(
        sql`select coalesce((
              select sum((case when i.kind = 'credit_note' then -1 else 1 end) * ${documentVariance})
              from supplier_invoices i
              where i.clinic_id = ${clinicId} and i.status = 'posted'
                and i.invoice_date >= ${monthStart(month)}::date
                and i.invoice_date < ${nextMonthStart(month)}::date
            ), 0)::numeric(12, 2)::text as total`,
      ),
      this.expenses.totalBetween(clinicId, monthStart(month), nextMonthStart(month)),
    ]);

    return { collections, labs, stock, purchaseVariance, expenses: spent };
  }

  private async drawOf(clinicId: string, month: PayrollMonth): Promise<OwnerDraw | null> {
    const [row] = await this.db
      .select()
      .from(ownerDraws)
      .where(and(eq(ownerDraws.clinicId, clinicId), eq(ownerDraws.month, monthStart(month))))
      .limit(1);

    return row ? toOwnerDraw(row) : null;
  }

  private async linesFor(
    clinicId: string,
    month: PayrollMonth,
    doctorsMonth: {
      readonly shares: ReadonlyMap<string, ShareTotals>;
      readonly held: ReadonlyMap<string, string>;
    },
    collections: string,
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
        doctorId: doctors.id,
      })
      .from(users)
      .leftJoin(doctors, and(eq(doctors.userId, users.id), isNull(doctors.deletedAt)))
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
                or(isNull(users.joinedOn), lte(users.joinedOn, monthEnd(month))),
              ),
        ),
      )
      .orderBy(asc(users.nameAr));

    const ids = staff.map((person) => person.id);
    if (ids.length === 0) {
      return [];
    }

    const doctorIds = staff.flatMap((person) => (person.doctorId ? [person.doctorId] : []));
    const [plans, shareTermsOf, collectors, terms, adjustments, paid] = await Promise.all([
      this.terms.plansAt(clinicId, staff, month),
      this.terms.shareTermsAt(clinicId, staff, month),
      this.terms.collectorsAt(clinicId, doctorIds, month),
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
            inArray(staffPayments.kind, [STAFF_PAYMENT_KIND.SALARY, STAFF_PAYMENT_KIND.REMITTANCE]),
            eq(staffPayments.month, start),
          ),
        )
        .orderBy(desc(staffPayments.createdAt)),
    ]);

    return staff.map((person) => {
      const own = adjustments.filter((row) => row.userId === person.id);
      const payments = paid.filter(
        (row) => row.userId === person.id && row.kind === STAFF_PAYMENT_KIND.SALARY,
      );
      const remittances = paid.filter(
        (row) => row.userId === person.id && row.kind === STAFF_PAYMENT_KIND.REMITTANCE,
      );
      const frozen = snapshot?.find((line) => line.userId === person.id);
      const plan = frozen?.plan ?? plans.get(person.id) ?? PAY_PLAN_KIND.SALARY;
      const salary = terms.find((row) => row.userId === person.id)?.monthlyAmount ?? ZERO;
      const base = frozen?.base ?? (includesSalary(plan) ? salary : ZERO);
      const shareTerms = shareTermsOf.get(person.id) ?? defaultShareTerms(person.doctorId !== null);
      const shareBasis = frozen?.shareBasis ?? shareTerms.basis;
      const shareRate = frozen?.shareRate ?? shareTerms.percent;
      const onTreatments = includesShare(plan) && shareBasis === STAFF_SHARE_BASIS.TREATMENTS;
      const onCollections = includesShare(plan) && shareBasis === STAFF_SHARE_BASIS.COLLECTIONS;
      const percentBase = frozen?.percentBase ?? (onCollections ? collections : ZERO);
      const percentShare =
        frozen?.percentShare ?? (onCollections ? percentOf(collections, shareRate) : ZERO);
      const earned =
        onTreatments && person.doctorId ? doctorsMonth.shares.get(person.doctorId) : undefined;
      const share = frozen?.share ?? earned?.share ?? ZERO;
      const sharePayable = earned?.payable ?? ZERO;
      const sharePaid = earned?.paid ?? ZERO;
      const extras =
        frozen?.extras ?? sumOf(own.filter((row) => row.kind === PAYROLL_ADJUSTMENT_KIND.EXTRA));
      const cuts =
        frozen?.cuts ?? sumOf(own.filter((row) => row.kind === PAYROLL_ADJUSTMENT_KIND.CUT));
      const due = frozen?.due ?? sumMoney([base, extras, negate(cuts), percentShare]);
      const settled = sumOf(payments);
      const held = (person.doctorId && doctorsMonth.held.get(person.doctorId)) || ZERO;
      const remitted = sumOf(remittances);
      const expected = addMoney(due, sharePayable);
      const received = sumMoney([settled, sharePaid, held, negate(remitted)]);

      return {
        userId: person.id,
        name: { ar: person.nameAr, en: person.nameEn },
        role: person.role,
        joinedOn: person.joinedOn,
        plan,
        planKinds: planKindsFor(person.role),
        employee: isEmployee(person.role),
        doctorId: person.doctorId,
        shareBasis,
        shareRate,
        percentBase,
        percentShare,
        share: addMoney(share, ZERO),
        sharePayable,
        sharePaid,
        base: addMoney(base, ZERO),
        extras,
        cuts,
        due,
        paid: settled,
        remaining: addMoney(due, negate(settled)),
        expected,
        collector: (person.doctorId && collectors.get(person.doctorId)) || PAYMENT_COLLECTOR.CLINIC,
        held,
        remitted,
        received,
        owed: addMoney(expected, negate(received)),
        adjustments: own.map(toAdjustment),
        payments: payments.map(toStaffPayment),
        remittances: remittances.map(toStaffPayment),
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

function withShareOfProfit(
  line: PayrollLine,
  profit: string,
  snapshot?: readonly PayrollLineSnapshot[],
): PayrollLine {
  if (
    line.shareBasis !== STAFF_SHARE_BASIS.PROFIT ||
    !includesShare(line.plan) ||
    snapshot?.some((frozen) => frozen.userId === line.userId)
  ) {
    return line;
  }

  const percentShare = percentOf(profit, line.shareRate);
  const due = addMoney(line.due, percentShare);
  const expected = addMoney(due, line.sharePayable);

  return {
    ...line,
    percentBase: profit,
    percentShare,
    due,
    remaining: subtractMoney(due, line.paid),
    expected,
    owed: subtractMoney(expected, line.received),
  };
}
