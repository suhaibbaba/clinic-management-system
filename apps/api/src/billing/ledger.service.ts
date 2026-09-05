import { Inject, Injectable } from '@nestjs/common';
import {
  addMoney,
  formatMinorUnits,
  LEDGER_ENTRY_KIND,
  subtractMoney,
  toMinorUnits,
  type LedgerEntryKind,
  type Money,
  type PatientBalance,
  type Statement,
  type StatementEntry,
  type StatementQuery,
} from '@clinic/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@api/database/database.module';
import { charges, payments, performedProcedures, procedureCatalog } from '@api/database/schema';

interface LedgerLine {
  readonly id: string;
  readonly kind: LedgerEntryKind;
  readonly occurredAt: Date;
  readonly amount: Money;
  readonly description: string;
  readonly receiptNumber: number | null;
  readonly isReversal: boolean;
}

/**
 * Reads the money ledgers.
 *
 * A balance is **never stored** (CLAUDE.md): every read is a SQL aggregate over
 * `charges` and `payments`. Reversing entries carry negative amounts, so they
 * fall out of the same `sum()` with no special case — which is the point of
 * correcting by reversal rather than by edit.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `sum(charges) − sum(payments)` for one patient. */
  async balanceFor(clinicId: string, patientId: string): Promise<PatientBalance> {
    const rows = await this.db.execute<{
      charged: string;
      paid: string;
      last_payment_at: Date | string | null;
    }>(sql`
      select
        coalesce((
          select sum(amount - discount) from charges
          where clinic_id = ${clinicId} and patient_id = ${patientId} and deleted_at is null
        ), 0)::text as charged,
        coalesce((
          select sum(amount) from payments
          where clinic_id = ${clinicId} and patient_id = ${patientId} and deleted_at is null
        ), 0)::text as paid,
        (
          select max(created_at) from payments
          where clinic_id = ${clinicId} and patient_id = ${patientId}
            and deleted_at is null and amount > 0
        ) as last_payment_at
    `);

    const row = rows[0];
    const charged = normalise(row?.charged ?? '0');
    const paid = normalise(row?.paid ?? '0');

    return {
      patientId,
      charged,
      paid,
      balance: subtractMoney(charged, paid),
      lastPaymentAt: row?.last_payment_at ? new Date(row.last_payment_at).toISOString() : null,
    };
  }

  /** Balances for many patients at once, so a list is one query rather than N. */
  async balancesFor(clinicId: string, patientIds: readonly string[]): Promise<Map<string, Money>> {
    if (patientIds.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      patientIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const rows = await this.db.execute<{ patient_id: string; balance: string }>(sql`
      with scoped as (select unnest(array[${ids}]) as patient_id)
      select s.patient_id::text as patient_id,
             (
               coalesce((
                 select sum(amount - discount) from charges
                 where clinic_id = ${clinicId} and patient_id = s.patient_id and deleted_at is null
               ), 0)
               - coalesce((
                 select sum(amount) from payments
                 where clinic_id = ${clinicId} and patient_id = s.patient_id and deleted_at is null
               ), 0)
             )::text as balance
      from scoped s
    `);

    return new Map([...rows].map((row) => [row.patient_id, normalise(row.balance)]));
  }

  /**
   * Every ledger line for a patient, oldest first, with the balance after each.
   *
   * A date range narrows the lines shown but not the arithmetic: whatever
   * happened before `from` is folded into an opening balance, so the closing
   * figure of an open-ended range always equals the patient's real balance.
   *
   * A charge describes itself with the procedure's catalog name and nothing
   * else — a receptionist reads statements, and ROLES.md keeps diagnoses and
   * visit notes away from them.
   */
  async statementFor(
    clinicId: string,
    patientId: string,
    query: StatementQuery,
  ): Promise<Statement> {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const [chargeRows, paymentRows] = await Promise.all([
      this.db
        .select({
          id: charges.id,
          createdAt: charges.createdAt,
          amount: charges.amount,
          discount: charges.discount,
          note: charges.note,
          reversesId: charges.reversesId,
          procedureName: procedureCatalog.nameAr,
        })
        .from(charges)
        .leftJoin(performedProcedures, eq(performedProcedures.id, charges.performedProcedureId))
        .leftJoin(procedureCatalog, eq(procedureCatalog.id, performedProcedures.procedureId))
        .where(
          and(
            eq(charges.clinicId, clinicId),
            eq(charges.patientId, patientId),
            isNull(charges.deletedAt),
          ),
        ),
      this.db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.clinicId, clinicId),
            eq(payments.patientId, patientId),
            isNull(payments.deletedAt),
          ),
        ),
    ]);

    const lines: LedgerLine[] = [
      ...chargeRows.map((row) => ({
        id: row.id,
        kind: LEDGER_ENTRY_KIND.CHARGE,
        occurredAt: row.createdAt,
        // Net of its discount: what the patient is actually asked for.
        amount: subtractMoney(row.amount, row.discount),
        description: row.procedureName ?? row.note ?? '',
        receiptNumber: null,
        isReversal: row.reversesId !== null,
      })),
      ...paymentRows.map((row) => ({
        id: row.id,
        kind: LEDGER_ENTRY_KIND.PAYMENT,
        occurredAt: row.createdAt,
        // A payment reduces the balance, so it enters the running total negated.
        amount: formatMinorUnits(-toMinorUnits(row.amount)),
        description: row.note ?? '',
        receiptNumber: row.receiptNumber,
        isReversal: row.reversesId !== null,
      })),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));

    let running: Money = '0.00';
    let opening: Money = '0.00';
    const entries: StatementEntry[] = [];

    for (const line of lines) {
      // Past the window: later lines change the real balance but not this
      // statement, and the list is sorted, so nothing after it matters either.
      if (to && line.occurredAt > to) {
        break;
      }

      running = addMoney(running, line.amount);

      if (from && line.occurredAt < from) {
        // Before the window: it only moves the opening balance.
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
        receiptNumber: line.receiptNumber,
        isReversal: line.isReversal,
      });
    }

    return {
      patientId,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      openingBalance: opening,
      closingBalance: entries.at(-1)?.runningBalance ?? opening,
      entries,
    };
  }
}

/** Postgres hands back `numeric` as a string; normalise the scale for TS. */
function normalise(value: string): Money {
  return formatMinorUnits(toMinorUnits(value));
}
