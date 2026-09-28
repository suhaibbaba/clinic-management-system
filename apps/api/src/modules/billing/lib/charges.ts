import { type Money, type PerformedProcedureStatus } from "@clinic/shared";
import { BILLABLE_STATUSES } from "@api/modules/billing/constants";
import { type SQL, and, eq, isNull } from "drizzle-orm";
import { charges } from "@api/database/schema";

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

export function isBillable(status: PerformedProcedureStatus): boolean {
  return BILLABLE_STATUSES.includes(status);
}

export function currentChargePredicate(clinicId: string, performedProcedureId: string): SQL {
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
