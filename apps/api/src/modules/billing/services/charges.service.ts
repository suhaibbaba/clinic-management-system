import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { CLINICAL_DELETE_ERROR } from "@clinic/shared";
import { eq, sql } from "drizzle-orm";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { charges, patients } from "@api/database/schema";
import {
  ProcedureBillingEvent,
  isBillable,
  currentChargePredicate,
} from "@api/modules/billing/lib/charges";
import { negate } from "@api/common/lib/money";

@Injectable()
export class ChargesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

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

  async onProcedureAmended(tx: DatabaseExecutor, event: ProcedureBillingEvent): Promise<void> {
    await this.reverseCurrentCharge(tx, event.clinicId, event.performedProcedureId, event.actorId);

    if (isBillable(event.status)) {
      await this.insertCharge(tx, event);
    }
  }

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

  private async reverseCurrentCharge(
    tx: DatabaseExecutor,
    clinicId: string,
    performedProcedureId: string,
    actorId: string,
  ): Promise<void> {
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
