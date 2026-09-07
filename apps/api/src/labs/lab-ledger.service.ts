import { Inject, Injectable } from '@nestjs/common';
import {
  addMoney,
  formatMinorUnits,
  LAB_ORDER_BILLABLE_STATUSES,
  LAB_STATEMENT_ENTRY_KIND,
  subtractMoney,
  toMinorUnits,
  type LabBalance,
  type LabStatement,
  type LabStatementEntry,
  type LabStatementEntryKind,
  type Money,
  type StatementQuery,
} from '@clinic/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@api/database/database.module';
import { labOrders, labPayments, labWorkTypes } from '@api/database/schema';
import { LabsService } from '@api/labs/labs.service';

interface LedgerLine {
  readonly id: string;
  readonly kind: LabStatementEntryKind;
  readonly occurredAt: Date;
  readonly amount: Money;
  readonly description: string;
  readonly isReversal: boolean;
}

/**
 * What the clinic owes a lab.
 *
 * **The rule, once:** an order counts from the moment it is *sent*, and stops
 * counting only if it is *cancelled*. Everything else follows from it —
 *
 *  - a `draft` is a note to self and costs nothing;
 *  - a `returned` crown keeps counting, because the lab made it, and a remake
 *    is the lab's problem rather than an entry that quietly disappears;
 *  - `cancelled` is only reachable before the lab has started (see the
 *    transition table), which is exactly why it is the one status allowed to
 *    take an order out of the balance with nothing to explain it.
 *
 * The list of billable statuses lives in `@clinic/shared`, so this service,
 * the directory's balance chips and the screens all read the same definition.
 * Nothing is stored: a balance is a `sum()` over orders minus a `sum()` over
 * payments, every time (CLAUDE.md).
 */
@Injectable()
export class LabLedgerService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly labsService: LabsService,
  ) {}

  async balanceFor(clinicId: string, labId: string): Promise<LabBalance> {
    await this.labsService.requireRow(clinicId, labId);

    const billable = sql.join(
      LAB_ORDER_BILLABLE_STATUSES.map((status) => sql`${status}`),
      sql`, `,
    );

    const rows = await this.db.execute<{
      owed: string;
      paid: string;
      last_payment_at: Date | string | null;
    }>(sql`
      select
        coalesce((
          select sum(price) from lab_orders
          where clinic_id = ${clinicId} and lab_id = ${labId} and deleted_at is null
            and status in (${billable})
        ), 0)::text as owed,
        coalesce((
          select sum(amount) from lab_payments
          where clinic_id = ${clinicId} and lab_id = ${labId} and deleted_at is null
        ), 0)::text as paid,
        (
          select max(created_at) from lab_payments
          where clinic_id = ${clinicId} and lab_id = ${labId}
            and deleted_at is null and amount > 0
        ) as last_payment_at
    `);

    const row = rows[0];
    const owed = normalise(row?.owed ?? '0');
    const paid = normalise(row?.paid ?? '0');

    return {
      labId,
      owed,
      paid,
      balance: subtractMoney(owed, paid),
      lastPaymentAt: row?.last_payment_at ? new Date(row.last_payment_at).toISOString() : null,
    };
  }

  /**
   * Every line, oldest first, with the balance after each.
   *
   * An order enters the statement on the day it was **sent**, not the day it
   * was drafted — that is the day the debt begins, and a statement whose dates
   * disagree with the balance rule is a statement nobody can reconcile. A date
   * range narrows what is listed but not the arithmetic: everything before it
   * folds into the opening balance.
   */
  async statementFor(
    clinicId: string,
    labId: string,
    query: StatementQuery,
  ): Promise<LabStatement> {
    const lab = await this.labsService.requireRow(clinicId, labId);

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const [orderRows, paymentRows] = await Promise.all([
      this.db
        .select({
          id: labOrders.id,
          sentAt: labOrders.sentAt,
          createdAt: labOrders.createdAt,
          price: labOrders.price,
          status: labOrders.status,
          teeth: labOrders.teeth,
          workTypeName: labWorkTypes.nameAr,
        })
        .from(labOrders)
        .leftJoin(labWorkTypes, eq(labWorkTypes.id, labOrders.workTypeId))
        .where(
          and(
            eq(labOrders.clinicId, clinicId),
            eq(labOrders.labId, labId),
            isNull(labOrders.deletedAt),
            inArray(labOrders.status, [...LAB_ORDER_BILLABLE_STATUSES]),
          ),
        ),
      this.db
        .select()
        .from(labPayments)
        .where(
          and(
            eq(labPayments.clinicId, clinicId),
            eq(labPayments.labId, labId),
            isNull(labPayments.deletedAt),
          ),
        ),
    ]);

    const lines: LedgerLine[] = [
      ...orderRows.map((row) => ({
        id: row.id,
        kind: LAB_STATEMENT_ENTRY_KIND.ORDER,
        // Billable means sent, so `sent_at` is the date of the debt. The
        // fallback only matters for data written before this rule existed.
        occurredAt: row.sentAt ?? row.createdAt,
        amount: row.price,
        description: describeOrder(row.workTypeName, row.teeth),
        isReversal: false,
      })),
      ...paymentRows.map((row) => ({
        id: row.id,
        kind: LAB_STATEMENT_ENTRY_KIND.PAYMENT,
        occurredAt: row.createdAt,
        // A payment reduces what is owed, so it enters the running total negated.
        amount: formatMinorUnits(-toMinorUnits(row.amount)),
        description: row.note ?? '',
        isReversal: row.reversesId !== null,
      })),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));

    let running: Money = '0.00';
    let opening: Money = '0.00';
    const entries: LabStatementEntry[] = [];

    for (const line of lines) {
      if (to && line.occurredAt > to) {
        break;
      }

      running = addMoney(running, line.amount);

      if (from && line.occurredAt < from) {
        opening = running;
        continue;
      }

      entries.push({
        id: line.id,
        kind: line.kind,
        occurredAt: line.occurredAt.toISOString(),
        description: line.description,
        amount: line.amount,
        runningBalance: running,
        isReversal: line.isReversal,
      });
    }

    return {
      labId,
      labName: lab.name,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      openingBalance: opening,
      closingBalance: entries.at(-1)?.runningBalance ?? opening,
      entries,
    };
  }
}

/** "تاج — 26، 27", or just the work type when it is not tooth-specific. */
function describeOrder(workTypeName: string | null, teeth: readonly number[]): string {
  const name = workTypeName ?? 'عمل مخبري';

  return teeth.length > 0 ? `${name} — ${teeth.join('، ')}` : name;
}

/** Postgres returns `numeric` unpadded; money is always two decimals here. */
function normalise(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');

  return `${whole}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}
