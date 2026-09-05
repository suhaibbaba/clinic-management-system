import { Inject, Injectable } from '@nestjs/common';
import {
  formatMinorUnits,
  PERFORMED_PROCEDURE_STATUS,
  toMinorUnits,
  type Money,
  type PerformedProcedureStatus,
} from '@clinic/shared';
import { and, eq, isNull, type SQL } from 'drizzle-orm';

import { DATABASE, type Database, type DatabaseExecutor } from '@api/database/database.module';
import { charges } from '@api/database/schema';

/** What a procedure looks like to billing. No clinical fields cross this line. */
export interface ProcedureBillingEvent {
  readonly clinicId: string;
  readonly patientId: string;
  readonly performedProcedureId: string;
  readonly price: Money;
  readonly discount: Money;
  readonly discountReason: string | null;
  readonly status: PerformedProcedureStatus;
  readonly actorId: string;
}

export const CHARGES_ENTITY = 'charges';

/**
 * Planned work is not owed yet: a treatment plan a patient never comes back for
 * must not sit on their balance. Money starts at the moment the chair is used.
 */
const BILLABLE_STATUSES: readonly PerformedProcedureStatus[] = [
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  PERFORMED_PROCEDURE_STATUS.DONE,
];

export function isBillable(status: PerformedProcedureStatus): boolean {
  return BILLABLE_STATUSES.includes(status);
}

/**
 * Writes the `charges` ledger.
 *
 * Every method takes the executor to run on, because a charge is only ever
 * written in the **same transaction** as the procedure that caused it: a
 * procedure without its charge, or a charge without its procedure, is a
 * corrupted ledger, and there is no repair path for one.
 *
 * Nothing here updates an amount. A correction is the negative of the original
 * with `reverses_id` pointing back at it, followed by the corrected row
 * (CLAUDE.md architecture decision 2).
 */
@Injectable()
export class ChargesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Bills a newly recorded procedure. A procedure still only planned writes
   * nothing — it starts owing money when it is first worked on, which the
   * amend path then picks up.
   */
  async onProcedureRecorded(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    if (!isBillable(event.status)) {
      return;
    }

    await this.insertCharge(tx, event);
  }

  /**
   * Re-bills an amended procedure: the charge in force is reversed and the new
   * figure inserted. The old row keeps its amount forever — what changes is the
   * balance, through the two new rows.
   *
   * Also the path a procedure takes when it moves off `planned`, which is why
   * it inserts even when there was nothing to reverse.
   */
  async onProcedureAmended(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    await this.reverseCurrentCharge(tx, event.clinicId, event.performedProcedureId, event.actorId);

    if (isBillable(event.status)) {
      await this.insertCharge(tx, event);
    }
  }

  /** A soft-deleted procedure is not owed: reverse it, never delete the row. */
  async onProcedureReversed(
    tx: DatabaseExecutor,
    event: Pick<ProcedureBillingEvent, 'clinicId' | 'performedProcedureId' | 'actorId'>,
  ): Promise<void> {
    await this.reverseCurrentCharge(tx, event.clinicId, event.performedProcedureId, event.actorId);
  }

  /** The charge currently in force for a procedure, if it has one. */
  async currentChargeFor(
    clinicId: string,
    performedProcedureId: string,
  ): Promise<typeof charges.$inferSelect | undefined> {
    const [row] = await this.db
      .select()
      .from(charges)
      .where(currentChargePredicate(clinicId, performedProcedureId))
      .limit(1);

    return row;
  }

  private async insertCharge(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    await tx.insert(charges).values({
      clinicId: event.clinicId,
      patientId: event.patientId,
      performedProcedureId: event.performedProcedureId,
      amount: event.price,
      discount: event.discount,
      discountReason: event.discountReason,
      createdBy: event.actorId,
      updatedBy: event.actorId,
    });
  }

  /**
   * Cancels the charge in force for a procedure, if there is one.
   *
   * The reversal carries the same procedure id so it describes itself on a
   * statement, and the original is stamped `reversed_at` — bookkeeping only,
   * no amount is touched — which is what keeps `charges_procedure_uniq` able to
   * guarantee a procedure has at most one charge in force.
   */
  private async reverseCurrentCharge(
    tx: DatabaseExecutor,
    clinicId: string,
    performedProcedureId: string,
    actorId: string,
  ): Promise<void> {
    // Locked for the length of the transaction so two concurrent amendments
    // cannot both decide they are the one reversing the same charge.
    const [existing] = await tx
      .select()
      .from(charges)
      .where(currentChargePredicate(clinicId, performedProcedureId))
      .limit(1)
      .for('update');

    if (!existing) {
      return;
    }

    await tx
      .update(charges)
      .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actorId })
      .where(eq(charges.id, existing.id));

    await tx.insert(charges).values({
      clinicId,
      patientId: existing.patientId,
      performedProcedureId,
      amount: negate(existing.amount),
      discount: negate(existing.discount),
      discountReason: existing.discountReason,
      reversesId: existing.id,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }
}

function currentChargePredicate(clinicId: string, performedProcedureId: string): SQL {
  const predicate = and(
    eq(charges.clinicId, clinicId),
    eq(charges.performedProcedureId, performedProcedureId),
    isNull(charges.deletedAt),
    isNull(charges.reversesId),
    isNull(charges.reversedAt),
  );

  /* istanbul ignore next -- `and` only returns undefined with no arguments. */
  if (!predicate) {
    throw new Error('Failed to build a charge predicate');
  }

  return predicate;
}

/** `-0.00` is not a thing; everything else flips sign in minor units. */
export function negate(amount: Money): Money {
  return formatMinorUnits(-toMinorUnits(amount));
}
