import { ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  CLINICAL_DELETE_ERROR,
  formatMinorUnits,
  PERFORMED_PROCEDURE_STATUS,
  toMinorUnits,
  type Money,
  type PerformedProcedureStatus,
} from "@clinic/shared";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { LedgerService } from "@api/billing/ledger.service";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { charges, patients } from "@api/database/schema";

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

const BILLABLE_STATUSES: readonly PerformedProcedureStatus[] = [
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  PERFORMED_PROCEDURE_STATUS.DONE,
];

export function isBillable(status: PerformedProcedureStatus): boolean {
  return BILLABLE_STATUSES.includes(status);
}

// Every method takes the executor: a charge is only ever written in the same transaction as the
// procedure that caused it, and a half-written pair has no repair path.
@Injectable()
export class ChargesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Payments are not allocated to charges, so "paid towards" is read off the balance: if taking these
  // charges away would leave the patient in credit, money was taken for them, and deleting would
  // move it silently. The caller corrects with a reversal instead.
  async assertRemovable(
    tx: DatabaseExecutor,
    clinicId: string,
    patientId: string,
    performedProcedureIds: readonly string[],
  ): Promise<void> {
    if (performedProcedureIds.length === 0) {
      return;
    }

    const ids = sql.join(
      performedProcedureIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const rows = await tx.execute<{ removable: boolean }>(sql`
      select ${LedgerService.balanceOf(clinicId, patients.id)} >= coalesce((
        select sum(amount - discount) from charges
        where clinic_id = ${clinicId} and patient_id = ${patientId}
          and performed_procedure_id in (${ids})
          and deleted_at is null and reverses_id is null and reversed_at is null
      ), 0) as removable
      from patients where id = ${patientId}
    `);

    if (rows[0]?.removable !== true) {
      throw new ConflictException(CLINICAL_DELETE_ERROR.HAS_PAYMENTS);
    }
  }

  async onProcedureRecorded(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    if (!isBillable(event.status)) {
      return;
    }

    await this.insertCharge(tx, event);
  }

  // Reverses the charge in force and inserts the new figure. Also the path off `planned`, which is
  // why it inserts with nothing to reverse.
  async onProcedureAmended(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    await this.reverseCurrentCharge(tx, event.clinicId, event.performedProcedureId, event.actorId);

    if (isBillable(event.status)) {
      await this.insertCharge(tx, event);
    }
  }

  /** A soft-deleted procedure is not owed: reverse it, never delete the row. */
  async onProcedureReversed(
    tx: DatabaseExecutor,
    event: Pick<ProcedureBillingEvent, "clinicId" | "performedProcedureId" | "actorId">,
  ): Promise<void> {
    await this.reverseCurrentCharge(tx, event.clinicId, event.performedProcedureId, event.actorId);
  }

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

  // The reversal carries the procedure id so it describes itself on a statement, and `reversed_at`
  // is what keeps `charges_procedure_uniq` to one charge in force.
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
      .for("update");

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
    throw new Error("Failed to build a charge predicate");
  }

  return predicate;
}

/** `-0.00` is not a thing; everything else flips sign in minor units. */
export function negate(amount: Money): Money {
  return formatMinorUnits(-toMinorUnits(amount));
}
