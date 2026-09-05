import {
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  type PaymentMethod,
  type PerformedProcedureStatus,
} from '@clinic/shared';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import {
  charges,
  clinicCounters,
  patients,
  payments,
  performedProcedures,
} from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface BillingSeedContext {
  readonly clinicId: string;
  readonly actorId: string;
}

/** Work that has started is billed; planned work is not (see ChargesService). */
const BILLABLE: readonly PerformedProcedureStatus[] = [
  PERFORMED_PROCEDURE_STATUS.DONE,
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
];

interface PaymentSeed {
  readonly fileNumber: string;
  readonly amount: string;
  readonly method: PaymentMethod;
  readonly daysAgo: number;
  readonly note: string;
}

/**
 * A believable set of payments against the seeded work.
 *
 * Files 00005 and 00008 are the overdue cases the billing screens need: still
 * owing, and last paid (or never paid) well outside the default 30-day window.
 */
const PAYMENTS: readonly PaymentSeed[] = [
  {
    fileNumber: '00001',
    amount: '200.00',
    method: PAYMENT_METHOD.CASH,
    daysAgo: 110,
    note: 'دفعة أولى',
  },
  {
    fileNumber: '00001',
    amount: '150.00',
    method: PAYMENT_METHOD.TRANSFER,
    daysAgo: 44,
    note: 'دفعة ثانية',
  },
  {
    fileNumber: '00001',
    amount: '100.00',
    method: PAYMENT_METHOD.CARD,
    daysAgo: 3,
    note: 'دفعة على الحساب',
  },
  {
    fileNumber: '00003',
    amount: '40.00',
    method: PAYMENT_METHOD.CASH,
    daysAgo: 14,
    note: 'تسديد كامل',
  },
  {
    fileNumber: '00005',
    amount: '20.00',
    method: PAYMENT_METHOD.CASH,
    daysAgo: 60,
    note: 'دفعة جزئية',
  },
];

/**
 * Bills the seeded procedures and records some payments against them.
 *
 * The charges are written the way `ChargesService` writes them — one per
 * billable procedure, amount and discount snapshotted — so a seeded database
 * shows the same balances the API would compute for real work.
 */
export async function seedBilling(db: Db, ctx: BillingSeedContext): Promise<number> {
  const [alreadyBilled] = await db
    .select({ id: charges.id })
    .from(charges)
    .where(eq(charges.clinicId, ctx.clinicId))
    .limit(1);

  if (alreadyBilled) {
    return 0;
  }

  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };

  const billable = await db
    .select({
      id: performedProcedures.id,
      patientId: performedProcedures.patientId,
      price: performedProcedures.price,
      discount: performedProcedures.discount,
      discountReason: performedProcedures.discountReason,
      performedAt: performedProcedures.performedAt,
    })
    .from(performedProcedures)
    .where(
      and(
        eq(performedProcedures.clinicId, ctx.clinicId),
        isNull(performedProcedures.deletedAt),
        inArray(performedProcedures.status, [...BILLABLE]),
      ),
    );

  if (billable.length > 0) {
    await db.insert(charges).values(
      billable.map((procedure) => ({
        clinicId: ctx.clinicId,
        patientId: procedure.patientId,
        performedProcedureId: procedure.id,
        amount: procedure.price,
        discount: procedure.discount,
        discountReason: procedure.discountReason,
        // Dated with the work, so a statement reads in the order it happened.
        createdAt: procedure.performedAt,
        ...audit,
      })),
    );
  }

  const patientRows = await db
    .select({ id: patients.id, fileNumber: patients.fileNumber })
    .from(patients)
    .where(and(eq(patients.clinicId, ctx.clinicId), isNull(patients.deletedAt)));

  const idByFileNumber = new Map(patientRows.map((row) => [row.fileNumber, row.id]));
  const seeded = PAYMENTS.filter((payment) => idByFileNumber.has(payment.fileNumber));

  if (seeded.length === 0) {
    return billable.length;
  }

  await db
    .insert(clinicCounters)
    .values({ clinicId: ctx.clinicId, nextReceiptNumber: seeded.length + 1 })
    .onConflictDoNothing({ target: clinicCounters.clinicId });

  await db.insert(payments).values(
    // Receipt numbers follow the order the payments were taken, which is what
    // the counter would have produced.
    [...seeded]
      .sort((left, right) => right.daysAgo - left.daysAgo)
      .map((payment, index) => ({
        clinicId: ctx.clinicId,
        patientId: idByFileNumber.get(payment.fileNumber) as string,
        amount: payment.amount,
        method: payment.method,
        note: payment.note,
        receiptNumber: index + 1,
        receivedBy: ctx.actorId,
        createdAt: daysAgo(payment.daysAgo),
        ...audit,
      })),
  );

  return billable.length;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
