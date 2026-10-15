import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  LOOKUP_LIST,
  PAYROLL_ERROR,
  addMoney,
  type CreateExpenseInput,
  type Expense,
  type ExpenseQuery,
  type ExpensesPage,
} from "@clinic/shared";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { EXPENSES_ENTITY } from "@api/common/constants/audit-entities";
import { DATABASE, type Database } from "@api/database/database.module";
import { expenses, payrollMonths } from "@api/database/schema";
import { negate } from "@api/common/lib/money";
import { monthOfDate, toExpense } from "@api/modules/expenses/lib/expenses";

const ZERO = "0.00";

const firstOf = (month: string): string => `${month}-01`;

function nextMonth(month: string): string {
  const [year = 0, index = 1] = month.split("-").map(Number);

  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;
}

@Injectable()
export class ExpensesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(EXPENSES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(expenses)
        .where(and(eq(expenses.clinicId, clinicId), eq(expenses.id, id)))
        .limit(1);

      return row ? { ...toExpense(row) } : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ExpenseQuery): Promise<ExpensesPage> {
    const where = and(
      eq(expenses.clinicId, actor.clinicId),
      isNull(expenses.deletedAt),
      gte(expenses.spentOn, firstOf(query.month)),
      lt(expenses.spentOn, firstOf(nextMonth(query.month))),
      query.category ? eq(expenses.category, query.category) : undefined,
    );

    const [rows, [counted], [summed]] = await Promise.all([
      this.db
        .select()
        .from(expenses)
        .where(where)
        .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(expenses).where(where),
      this.db
        .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)::text` })
        .from(expenses)
        .where(where),
    ]);
    const total = counted?.total ?? 0;

    return {
      items: rows.map(toExpense),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      monthTotal: addMoney(summed?.total ?? ZERO, ZERO),
    };
  }

  async create(actor: AuthenticatedUser, input: CreateExpenseInput): Promise<Expense> {
    await Promise.all([
      this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.EXPENSE_CATEGORY, input.category),
      this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.PAYMENT_METHOD, input.method),
      this.requireOpen(actor.clinicId, monthOfDate(input.spentOn)),
    ]);

    const [row] = await this.db
      .insert(expenses)
      .values({
        clinicId: actor.clinicId,
        spentOn: input.spentOn,
        category: input.category,
        amount: input.amount,
        method: input.method,
        note: input.note ?? null,
        paidBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the expense");
    }

    return toExpense(row);
  }

  async reverse(actor: AuthenticatedUser, id: string, reason: string): Promise<Expense> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.clinicId, actor.clinicId),
            eq(expenses.id, id),
            isNull(expenses.deletedAt),
          ),
        )
        .limit(1)
        .for("update");

      if (!original) {
        throw new NotFoundException("Resource not found");
      }
      if (original.reversesId !== null) {
        throw new BadRequestException("A reversing entry cannot itself be reversed");
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException("This expense has already been reversed");
      }

      await this.requireOpen(actor.clinicId, monthOfDate(original.spentOn));

      await tx
        .update(expenses)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(expenses.id, original.id));

      const [row] = await tx
        .insert(expenses)
        .values({
          clinicId: original.clinicId,
          spentOn: original.spentOn,
          category: original.category,
          amount: negate(original.amount),
          method: original.method,
          note: reason,
          reversesId: original.id,
          paidBy: actor.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to reverse the expense");
      }

      return toExpense(row);
    });
  }

  async totalBetween(clinicId: string, from: string, to: string): Promise<string> {
    const [row] = await this.db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)::text` })
      .from(expenses)
      .where(
        and(
          eq(expenses.clinicId, clinicId),
          isNull(expenses.deletedAt),
          gte(expenses.spentOn, from),
          lt(expenses.spentOn, to),
        ),
      );

    return addMoney(row?.total ?? ZERO, ZERO);
  }

  private async requireOpen(clinicId: string, month: string): Promise<void> {
    const [closed] = await this.db
      .select({ id: payrollMonths.id })
      .from(payrollMonths)
      .where(and(eq(payrollMonths.clinicId, clinicId), eq(payrollMonths.month, firstOf(month))))
      .limit(1);

    if (closed) {
      throw new ConflictException(PAYROLL_ERROR.MONTH_CLOSED);
    }
  }
}
